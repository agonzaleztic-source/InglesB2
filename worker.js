/**
 * Proxy para la app Ruta B2, con cuentas de usuario y cupo mensual.
 *
 * Guarda la clave de la API fuera del navegador: la página habla con este
 * Worker, y el Worker habla con Anthropic.
 *
 * Cada usuario tiene un código de acceso personal (apt_...). Se genera con el
 * endpoint de administración, se entrega una sola vez y en el KV solo queda su
 * hash SHA-256: si el KV se filtrara, los códigos no se pueden recuperar.
 * Cada usuario tiene un cupo de peticiones al mes. El webhook de Lemon Squeezy
 * (/webhooks/lemonsqueezy) da de alta y de baja automáticamente al pagar,
 * renovar, cancelar o caducar la suscripción.
 *
 * Variables de entorno que hay que configurar en Cloudflare:
 *   ANTHROPIC_API_KEY  (secreto, obligatorio)
 *   ADMIN_SECRET       (secreto: protege /admin/*; sin él no hay altas de usuarios)
 *   APP_PASS           (secreto, opcional: contraseña única de uso personal,
 *                       con límite por IP y día; es el modo de la opción C)
 *   ALLOWED_ORIGIN     (opcional: origen de la app, o varios separados por comas;
 *                       por defecto tu GitHub Pages)
 *   DAILY_LIMIT        (opcional, por defecto 60 peticiones por IP y día, solo APP_PASS)
 *   GLOBAL_DAILY_LIMIT (opcional, por defecto 1500 peticiones al día entre todos:
 *                       tope de gasto total, pase lo que pase con los usuarios)
 *   DEFAULT_MONTHLY_QUOTA (opcional, por defecto 300 peticiones al mes por usuario)
 *   LEMONSQUEEZY_SIGNING_SECRET (secreto: el "Signing secret" del webhook
 *                       /webhooks/lemonsqueezy, el mismo que se escribe en Lemon Squeezy)
 *   LEMONSQUEEZY_PRODUCT_IDS (opcional: id(s) del producto de Ruta B2 en Lemon
 *                       Squeezy, separados por comas; si está vacía o no se
 *                       define, el webhook atiende cualquier producto de la
 *                       tienda. Con la tienda compartida con otros productos,
 *                       hay que definirla.)
 *   STRIPE_WEBHOOK_SECRET (OBSOLETO, secreto: firma del webhook /webhooks/stripe, whsec_...)
 *   RESEND_API_KEY, EMAIL_FROM (secreto y remitente para enviar el código por email)
 *   APP_URL            (opcional: dirección de la app que se pone en el email)
 *
 * Binding que hay que configurar en Cloudflare:
 *   RATE_LIMIT  (KV Namespace, obligatorio: usuarios, cupos y límites)
 *
 * Los contadores del KV no son atómicos: con peticiones simultáneas pueden
 * quedarse cortos en una o dos unidades. Vale como freno, no como contabilidad.
 */

const DEFAULT_ORIGIN = "https://agonzaleztic-source.github.io";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1200;
const DEFAULT_DAILY_LIMIT = 60;
const DEFAULT_GLOBAL_LIMIT = 1500;
const DEFAULT_MONTHLY_QUOTA = 300;
const TWO_DAYS = 172800;
const FORTY_DAYS = 3456000;

// Number(env.X) || valorPorDefecto trataba un "0" explícito en Cloudflare
// (querer cortar del todo DAILY_LIMIT, GLOBAL_DAILY_LIMIT o
// DEFAULT_MONTHLY_QUOTA) igual que no haberlo puesto, porque 0 también es
// falsy: el límite real se quedaba en el valor de fábrica sin avisar.
function envNum(v, porDefecto) {
  if (v == null || String(v).trim() === "") return porDefecto;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

export default {
  async fetch(request, env) {
    // ALLOWED_ORIGIN admite varios orígenes separados por comas (sin barra
    // final), para poder cambiar de alojamiento sin cortar a nadie.
    const allowedList = (env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(",").map((s) => s.trim()).filter(Boolean);
    const reqOrigin = request.headers.get("Origin");
    const allowed = allowedList.includes(reqOrigin) ? reqOrigin : allowedList[0];
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-app-pass",
      "Access-Control-Expose-Headers": "x-quota-limit, x-quota-used",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return json({ error: "Solo se admite POST" }, 405, cors);
    }
    if (!env.RATE_LIMIT) {
      return json({ error: "El Worker no está configurado del todo: falta el KV Namespace RATE_LIMIT." }, 500, cors);
    }

    const path = new URL(request.url).pathname;

    // Los webhooks y la administración no los llama un navegador: no llevan
    // Origin y se protegen con la firma de la pasarela o con el secreto de admin.
    if (path === "/webhooks/lemonsqueezy") return lemonWebhook(request, env);
    // OBSOLETO: la pasarela es Lemon Squeezy desde el 15 nov 2026. Se quita
    // cuando se confirme que no queda ninguna suscripción viva en Stripe.
    if (path === "/webhooks/stripe") return stripeWebhook(request, env);
    if (path.startsWith("/admin/")) return admin(path, request, env, cors);

    // Sin cabecera Origin no es un navegador el que llama: fuera.
    const origin = reqOrigin;
    if (!origin || !allowedList.includes(origin)) {
      return json({ error: "Origen no autorizado" }, 403, cors);
    }

    const pass = request.headers.get("x-app-pass") || "";
    const user = await findUser(env, pass);
    // En tiempo constante, como el resto de secretos: no revelar por el tiempo
    // de respuesta cuántos caracteres de la contraseña personal aciertan.
    const personal = !user && !!env.APP_PASS && (await safeEqual(pass, env.APP_PASS));
    if (!user && !personal) {
      return json({ error: "Código de acceso incorrecto o dado de baja" }, 401, cors);
    }

    const day = new Date().toISOString().slice(0, 10);
    const month = day.slice(0, 7);

    // Consulta del cupo, sin gastar nada.
    if (path === "/me") {
      if (!user) return json({ plan: "personal" }, 200, cors);
      const used = await count(env, `use:${month}:${user.email}`);
      return json({ plan: user.plan, quota: user.quota, used, month }, 200, quotaHeaders(user.quota, used, cors));
    }

    // Tope global: acota el gasto máximo diario aunque haya muchos usuarios.
    const globalKey = `rl:${day}:global`;
    const globalLimit = envNum(env.GLOBAL_DAILY_LIMIT, DEFAULT_GLOBAL_LIMIT);
    const globalUsed = await count(env, globalKey);
    if (globalUsed >= globalLimit) {
      return json({ error: "El servicio ha llegado a su límite diario. Vuelve mañana." }, 429, cors);
    }

    let usedKey, used, limit;
    if (user) {
      usedKey = `use:${month}:${user.email}`;
      limit = user.quota;
      used = await count(env, usedKey);
      if (used >= limit) {
        return json({ error: `Has agotado tu cupo de ${limit} correcciones de este mes. Se renueva el día 1.` }, 429, cors);
      }
    } else {
      // Contraseña única de uso personal: corte diario por IP.
      const ip = request.headers.get("CF-Connecting-IP") || "sin-ip";
      usedKey = `rl:${day}:${ip}`;
      limit = envNum(env.DAILY_LIMIT, DEFAULT_DAILY_LIMIT);
      used = await count(env, usedKey);
      if (used >= limit) {
        return json({ error: "Se ha llegado al límite diario de peticiones desde tu conexión. Vuelve mañana." }, 429, cors);
      }
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Cuerpo no válido" }, 400, cors); }

    if (!body || typeof body !== "object") {
      return json({ error: "Cuerpo no válido" }, 400, cors);
    }
    if (!Array.isArray(body.messages) || !body.messages.length) {
      return json({ error: "Faltan los mensajes" }, 400, cors);
    }
    const firstMessage = body.messages[0];
    if (
      !firstMessage ||
      typeof firstMessage !== "object" ||
      typeof firstMessage.content !== "string" ||
      !firstMessage.content.trim()
    ) {
      return json({ error: "Mensaje no válido" }, 400, cors);
    }

    // Se cuenta antes de llamar al modelo, para que las peticiones lentas no
    // dejen colarse más de las permitidas.
    const ttl = user ? FORTY_DAYS : TWO_DAYS;
    await env.RATE_LIMIT.put(usedKey, String(used + 1), { expirationTtl: ttl });
    await env.RATE_LIMIT.put(globalKey, String(globalUsed + 1), { expirationTtl: TWO_DAYS });

    // Solo dejamos pasar lo que la app necesita: nada de modelos ni límites arbitrarios
    const payload = {
      model: MODEL,
      max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS),
      // Un único turno de usuario: la app nunca necesita historial, y así no puede
      // construirse una petición que termine en un turno de assistant.
      messages: [{ role: "user", content: firstMessage.content.slice(0, 12000) }],
    };

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      upstream = null;
    }

    // Si el fallo es del modelo y no del usuario, no le contamos la petición.
    // Un 429 de Anthropic es nuestro límite (de la cuenta, no del usuario), así
    // que también se perdona.
    if (!upstream || upstream.status >= 500 || upstream.status === 429) {
      await env.RATE_LIMIT.put(usedKey, String(used), { expirationTtl: ttl });
      return json({ error: "El modelo no responde ahora mismo. Vuelve a intentarlo en un momento." }, 502, cors);
    }

    const text = await upstream.text();
    const headers = user ? quotaHeaders(limit, used + 1, cors) : cors;
    return new Response(text, {
      status: upstream.status,
      headers: { ...headers, "content-type": "application/json" },
    });
  },
};

/* ---------------- pagos: webhook de Lemon Squeezy ---------------- */

// Lemon Squeezy es el vendedor de registro (cobra y gestiona el IVA) y avisa
// aquí de cada pedido y de cada cambio de la suscripción. Documentación:
// https://docs.lemonsqueezy.com/help/webhooks/signing-requests
// https://docs.lemonsqueezy.com/help/webhooks/event-types
//
// La firma X-Signature es el HMAC-SHA256 en hexadecimal del cuerpo en bruto con
// el "Signing secret" del webhook. Es lo único que impide darse de alta gratis,
// así que se comprueba antes de leer nada. No lleva marca de tiempo: la
// protección contra reenvíos es la clave de idempotencia del KV.
//
// Qué hace cada evento:
//   order_created (pedido pagado)  -> alta: usuario, cupo y código por email.
//   subscription_created           -> asocia la suscripción al email.
//   subscription_cancelled         -> no corta en el acto: el usuario caduca
//                                     en ends_at (fin del periodo pagado).
//   subscription_expired           -> baja.
//   subscription_updated           -> aplica el estado: active/on_trial
//                                     reactiva; expired/unpaid/paused da de baja;
//                                     cancelled pone la caducidad; past_due no
//                                     toca nada mientras se reintenta el cobro.
//   subscription_payment_success   -> reactiva (renovación pagada).
async function lemonWebhook(request, env) {
  if (!env.LEMONSQUEEZY_SIGNING_SECRET) return text("Falta LEMONSQUEEZY_SIGNING_SECRET", 500);
  const raw = await request.text();
  if (!(await lemonSignatureOk(raw, request.headers.get("x-signature"), env.LEMONSQUEEZY_SIGNING_SECRET))) {
    return text("Firma no válida", 401);
  }
  let ev;
  try { ev = JSON.parse(raw); } catch { return text("Cuerpo no válido", 400); }
  if (!ev || typeof ev !== "object") return text("Cuerpo no válido", 400);

  const meta = ev.meta || {};
  const data = ev.data || {};
  const name = String(meta.event_name || request.headers.get("x-event-name") || "");
  if (!name || data.id == null) return text("Evento sin nombre o sin id", 400);

  // Lemon Squeezy no manda un id de evento: la clave es evento + recurso +
  // fecha de modificación del recurso. Un reintento trae el mismo cuerpo y
  // cae en la misma clave; el alta va además por id de pedido, así que un
  // pedido nunca crea dos usuarios.
  const attrs = data.attributes || {};
  const seenKey = name === "order_created"
    ? `ls:order:${data.id}`
    : `ls:evt:${name}:${data.id}:${attrs.updated_at || attrs.created_at || ""}`;
  if (await env.RATE_LIMIT.get(seenKey)) return text("ya procesado", 200);

  let resultado;
  try {
    resultado = await handleLemonEvent(name, data, meta, env, new URL(request.url).origin);
  } catch (e) {
    // Un código distinto de 200 hace que Lemon Squeezy lo reintente (solo
    // tres veces más, en unos minutos).
    console.error("webhook Lemon Squeezy:", name, e && e.message);
    return text("Error al procesar el evento", 500);
  }
  await env.RATE_LIMIT.put(seenKey, "1", { expirationTtl: 604800 });
  return text(resultado || "ok", 200);
}

// LEMONSQUEEZY_PRODUCT_IDS: lista de ids separados por comas, o null si no
// está configurada (entonces no se filtra por producto).
function productIds(env) {
  const ids = String(env.LEMONSQUEEZY_PRODUCT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length ? new Set(ids) : null;
}

async function handleLemonEvent(name, data, meta, env, workerUrl) {
  const a = data.attributes || {};
  // Los pedidos de prueba (test_mode) se procesan igual, para poder probar el
  // circuito completo, pero el usuario queda con plan "prueba" para
  // distinguirlo. La documentación pone test_mode en data.attributes; se mira
  // también meta.test_mode por si acaso.
  const testMode = a.test_mode === true || meta.test_mode === true;
  // Con la tienda compartida con otros productos, un pedido o una suscripción
  // de otro producto no debe tocar las cuentas de Ruta B2.
  const products = productIds(env);

  if (name === "order_created") {
    if (products && !products.has(String(a.first_order_item?.product_id))) return "otro producto";
    if (a.status !== "paid") return;
    const email = cleanEmail(a.user_email);
    if (!email) throw new Error("pedido sin email válido");
    await provision(env, email, workerUrl, testMode ? "prueba" : undefined, String(data.id));
    return;
  }

  if (name === "order_refunded") {
    if (products && !products.has(String(a.first_order_item?.product_id))) return "otro producto";
    // Un reembolso parcial no quita el acceso: solo uno total.
    if (a.status !== "refunded") return;
    const email = await env.RATE_LIMIT.get(`ls:pedido:${data.id}`);
    if (!email) return; // pedido de otro producto, o de antes de guardar esta relación
    const hash = await env.RATE_LIMIT.get(`email:${email}`);
    const rec = hash && await env.RATE_LIMIT.get(`user:${hash}`, "json");
    // Si el cliente ya se ha vuelto a suscribir con un pedido nuevo, el que se
    // reembolsa ya no es el que le dio acceso: no se le da de baja.
    if (!rec || rec.pedido !== String(data.id)) return;
    const next = { ...rec, disabled: true };
    delete next.expires;
    await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify(next));
    return;
  }

  // subscription_payment_success no lleva product_id (es un aviso de la
  // factura, no de la suscripción): se filtra por la suscripción ya asociada.
  if (name !== "subscription_payment_success" && products && !products.has(String(a.product_id))) {
    return "otro producto";
  }

  // El resto de eventos se refieren a una suscripción: la propia (data) o, en
  // subscription_payment_success, la de la factura.
  const subId = name === "subscription_payment_success" ? a.subscription_id : data.id;
  if (subId == null) return;
  const subKey = `ls:sub:${subId}`;
  let email = await env.RATE_LIMIT.get(subKey);
  if (!email) {
    // subscription_payment_success nunca crea la asociación por su cuenta:
    // solo actúa sobre una suscripción que ya se vio en otro evento suyo.
    if (name === "subscription_payment_success") return;
    email = cleanEmail(a.user_email);
    if (!email) return;
    await env.RATE_LIMIT.put(subKey, email);
  }
  if (name === "subscription_created") return;

  let change;
  if (name === "subscription_expired") change = { disabled: true };
  else if (name === "subscription_cancelled") change = { expires: a.ends_at || null };
  else if (name === "subscription_payment_success") {
    if (a.status === "paid") change = { disabled: false, expires: null };
  } else if (name === "subscription_updated" || name === "subscription_resumed" || name === "subscription_unpaused") {
    if (["active", "on_trial"].includes(a.status)) change = { disabled: false, expires: null };
    else if (["expired", "unpaid", "paused"].includes(a.status)) change = { disabled: true };
    else if (a.status === "cancelled") change = { expires: a.ends_at || null };
  }
  if (!change) return;

  // Los avisos pueden llegar desordenados: solo se aplica un estado de la
  // suscripción igual o más reciente que el último aplicado. Las facturas
  // (payment_success) no llevan la fecha de la suscripción y no se ordenan.
  const orderKey = `ls:upd:${subId}`;
  const stamp = name === "subscription_payment_success" ? 0 : Date.parse(a.updated_at) || 0;
  const last = Number(await env.RATE_LIMIT.get(orderKey)) || 0;
  if (stamp && stamp < last) return;

  const hash = await env.RATE_LIMIT.get(`email:${email}`);
  const rec = hash && await env.RATE_LIMIT.get(`user:${hash}`, "json");
  if (!rec) return;
  const next = { ...rec };
  if (change.disabled !== undefined) next.disabled = change.disabled;
  if (change.expires === null) delete next.expires;
  else if (change.expires !== undefined) next.expires = change.expires;
  // Cancelada sin fecha de fin conocida: se da de baja ya, por prudencia.
  if (change.expires === null && change.disabled === undefined) next.disabled = true;
  await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify(next));
  if (stamp) await env.RATE_LIMIT.put(orderKey, String(stamp));
}

function cleanEmail(v) {
  const email = String(v || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : "";
}

async function lemonSignatureOk(raw, header, secret) {
  if (!header) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
  // safeEqual compara en tiempo constante.
  return safeEqual(header.trim().toLowerCase(), expected);
}

/* ---------------- pagos: webhook de Stripe (OBSOLETO) ---------------- */

// OBSOLETO desde el 15 nov 2026: la pasarela única es Lemon Squeezy. Se deja
// mientras pueda quedar alguna suscripción de Stripe; para quitarlo, ver
// DESPLIEGUE.md ("Quitar Stripe").

// Stripe llama aquí al pagar, renovar o cancelar. La firma (HMAC-SHA256 del
// cuerpo con STRIPE_WEBHOOK_SECRET) es lo único que impide que cualquiera se
// dé de alta gratis, así que se comprueba antes de leer nada del evento.
async function stripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) return text("Falta STRIPE_WEBHOOK_SECRET", 500);
  const raw = await request.text();
  if (!(await stripeSignatureOk(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
    return text("Firma no válida", 400);
  }
  let ev;
  try { ev = JSON.parse(raw); } catch { return text("Cuerpo no válido", 400); }

  // Stripe reenvía los eventos que no reciben como 2xx: sin esto, un reintento
  // repetiría el alta o el email.
  const seenKey = `evt:${ev.id}`;
  if (await env.RATE_LIMIT.get(seenKey)) return text("ya procesado", 200);

  try {
    await handleStripeEvent(ev, env, new URL(request.url).origin);
  } catch (e) {
    // Un 500 hace que Stripe lo reintente durante varios días.
    console.error("webhook Stripe:", ev.type, e && e.message);
    return text("Error al procesar el evento", 500);
  }
  await env.RATE_LIMIT.put(seenKey, "1", { expirationTtl: 604800 });
  return text("ok", 200);
}

async function handleStripeEvent(ev, env, workerUrl) {
  const obj = (ev.data && ev.data.object) || {};

  if (ev.type === "checkout.session.completed") {
    if (obj.mode !== "subscription" || obj.payment_status === "unpaid") return;
    const email = String((obj.customer_details && obj.customer_details.email) || obj.customer_email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("checkout sin email válido");
    if (obj.customer) await env.RATE_LIMIT.put(`cust:${obj.customer}`, email);
    await env.RATE_LIMIT.put(`sub:${email}`, String(ev.created || 0));
    await provision(env, email, workerUrl);
    return;
  }

  // Estado de la suscripción: renovación, impago o baja. Los eventos de Stripe
  // pueden llegar desordenados, así que solo se aplica uno más reciente que el
  // último aplicado.
  let enabled;
  if (ev.type === "customer.subscription.deleted") enabled = false;
  else if (ev.type === "customer.subscription.updated") {
    if (["active", "trialing"].includes(obj.status)) enabled = true;
    else if (["canceled", "unpaid", "incomplete_expired"].includes(obj.status)) enabled = false;
  } else if (ev.type === "invoice.paid") enabled = true;
  if (enabled === undefined || !obj.customer) return;

  const email = await env.RATE_LIMIT.get(`cust:${obj.customer}`);
  if (!email) return;
  const last = Number(await env.RATE_LIMIT.get(`sub:${email}`)) || 0;
  if ((ev.created || 0) < last) return;

  const hash = await env.RATE_LIMIT.get(`email:${email}`);
  const rec = hash && await env.RATE_LIMIT.get(`user:${hash}`, "json");
  if (!rec) return;
  await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify({ ...rec, disabled: !enabled }));
  await env.RATE_LIMIT.put(`sub:${email}`, String(ev.created || 0));
}

// Alta tras el pago (o reactivación si ya tenía cuenta): código nuevo por
// email. Si el email falla se deshace todo y se devuelve error, para que el
// reintento de la pasarela lo repita: un código que nadie ha recibido no sirve.
// orderId (opcional, solo Lemon Squeezy) queda en el registro para que un
// order_refunded sepa si el pedido que se reembolsa es el que dio el acceso.
async function provision(env, email, workerUrl, plan, orderId) {
  const indexKey = `email:${email}`;
  const oldHash = await env.RATE_LIMIT.get(indexKey);
  const prev = oldHash ? (await env.RATE_LIMIT.get(`user:${oldHash}`, "json")) || {} : {};
  // Mismo cálculo que hace putUser() para el campo quota: así el email dice el
  // cupo que de verdad va a quedar en el registro (el que ya tenía, si vuelve).
  const quota = prev.quota ?? quotaOf({}, env);

  const token = newToken();
  const hash = await sha256(token);
  if (oldHash) await env.RATE_LIMIT.delete(`user:${oldHash}`);
  await putUser(env, hash, email, { ...(plan ? { plan } : {}), ...(orderId ? { pedido: orderId } : {}) }, { ...prev, disabled: false, expires: undefined });
  await env.RATE_LIMIT.put(indexKey, hash);
  if (orderId) await env.RATE_LIMIT.put(`ls:pedido:${orderId}`, email);

  try {
    await sendCodeEmail(env, email, token, workerUrl, !!oldHash, quota);
  } catch (e) {
    await env.RATE_LIMIT.delete(`user:${hash}`);
    if (oldHash) {
      await env.RATE_LIMIT.put(`user:${oldHash}`, JSON.stringify(prev));
      await env.RATE_LIMIT.put(indexKey, oldHash);
    } else {
      await env.RATE_LIMIT.delete(indexKey);
    }
    throw e;
  }
}

async function stripeSignatureOk(raw, header, secret) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = (parts.find((p) => p[0] === "t") || [])[1];
  const sigs = parts.filter((p) => p[0] === "v1").map((p) => p[1]);
  if (!t || !sigs.length) return false;
  // Margen de 5 minutos: una firma capturada no vale para siempre.
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const expected = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
  for (const s of sigs) if (await safeEqual(s || "", expected)) return true;
  return false;
}

// Envío con Resend (https://resend.com). Cambiar de proveedor es cambiar solo esta función.
async function sendCodeEmail(env, to, token, workerUrl, returning, quota) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Faltan RESEND_API_KEY o EMAIL_FROM");
  const appUrl = env.APP_URL || `${(env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(",")[0].trim()}/`;
  const link = `${appUrl}#worker=${encodeURIComponent(workerUrl)}`;
  const intro = returning ? "Tu suscripción está activa de nuevo. Este es tu nuevo código de acceso (el anterior ya no funciona):"
    : "Gracias por suscribirte. Este es tu código de acceso personal:";
  // Decirlo ya en el email evita la duda más típica al empezar («¿cuánto me
  // dura esto?») y la pregunta de soporte que llega por ella.
  const cupoLinea = Number.isFinite(quota)
    ? `Tu plan incluye ${quota} correcciones con IA al mes; se renuevan el día 1 de cada mes.\n\n`
    : "";
  const body = `${intro}\n\n${token}\n\n${cupoLinea}Cómo usarlo:\n1. Abre este enlace: ${link}\n2. Pega tu código de acceso donde te lo pida.\n\nGuárdalo: no se puede volver a mostrar. Si lo pierdes, responde a este correo y te emitiremos uno nuevo.\n\nRuta B2: preparación para el Aptis General B2 (no oficial; no afiliada al British Council). «Aptis» es una marca del British Council.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: "Tu código de acceso a Ruta B2", text: body }),
  });
  if (!res.ok) throw new Error(`Resend respondió ${res.status}`);
}

/* ---------------- administración ---------------- */

async function admin(path, request, env, cors) {
  if (!env.ADMIN_SECRET) return json({ error: "Falta el secreto ADMIN_SECRET" }, 500, cors);
  const sent = request.headers.get("x-admin-secret") || "";
  if (!(await safeEqual(sent, env.ADMIN_SECRET))) return json({ error: "No autorizado" }, 401, cors);

  let b;
  try { b = await request.json(); } catch { return json({ error: "Cuerpo no válido" }, 400, cors); }
  if (!b || typeof b !== "object") return json({ error: "Cuerpo no válido" }, 400, cors);
  const email = String(b.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Email no válido" }, 400, cors);

  const indexKey = `email:${email}`;
  const existing = await env.RATE_LIMIT.get(indexKey);

  if (path === "/admin/users/create") {
    if (existing) return json({ error: "Ese email ya tiene código. Usa /admin/users/update o /admin/users/reset." }, 409, cors);
    const token = newToken();
    const hash = await sha256(token);
    await putUser(env, hash, email, b, {});
    await env.RATE_LIMIT.put(indexKey, hash);
    // El código solo se ve ahora: entrégaselo al usuario.
    return json({ email, token, plan: b.plan || "pro", quota: quotaOf(b, env) }, 201, cors);
  }

  if (!existing) return json({ error: "No existe ese usuario" }, 404, cors);
  const rec = await env.RATE_LIMIT.get(`user:${existing}`, "json");

  if (path === "/admin/users/update") {
    // Cambiar plan, cupo o dar de baja/alta sin tocar su código.
    const next = { ...rec };
    if (b.plan) next.plan = String(b.plan).slice(0, 20);
    if (cupoEnviado(b)) next.quota = quotaOf(b, env);
    if (b.disabled !== undefined) {
      next.disabled = !!b.disabled;
      // Reactivar a mano también quita una caducidad pendiente.
      if (!next.disabled) delete next.expires;
    }
    await env.RATE_LIMIT.put(`user:${existing}`, JSON.stringify(next));
    return json({ email, plan: next.plan, quota: next.quota, disabled: !!next.disabled }, 200, cors);
  }

  if (path === "/admin/users/reset") {
    // Código perdido o filtrado: se invalida el viejo y se emite uno nuevo.
    await env.RATE_LIMIT.delete(`user:${existing}`);
    const token = newToken();
    const hash = await sha256(token);
    await putUser(env, hash, email, {}, rec);
    await env.RATE_LIMIT.put(indexKey, hash);
    return json({ email, token }, 200, cors);
  }

  return json({ error: "Ruta no encontrada" }, 404, cors);
}

async function putUser(env, hash, email, b, prev) {
  // pedido: id del último pedido de Lemon Squeezy que dio o renovó el acceso;
  // se conserva (p. ej. en /admin/users/reset) salvo que llegue uno nuevo.
  const pedido = b.pedido || prev.pedido;
  await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify({
    email,
    plan: String(b.plan || prev.plan || "pro").slice(0, 20),
    quota: cupoEnviado(b) ? quotaOf(b, env) : (prev.quota ?? quotaOf({}, env)),
    disabled: !!prev.disabled,
    created: prev.created || new Date().toISOString(),
    ...(prev.expires ? { expires: prev.expires } : {}),
    ...(pedido ? { pedido } : {}),
  }));
}

// "", null o solo espacios cuentan como no enviado: Number("") es 0, y un
// campo en blanco no debe dejar a nadie sin cupo.
const cupoEnviado = (b) => b.monthly_quota != null && String(b.monthly_quota).trim() !== "";

const quotaOf = (b, env) => {
  const n = Math.floor(Number(b.monthly_quota));
  return cupoEnviado(b) && Number.isFinite(n) && n >= 0
    ? n : envNum(env.DEFAULT_MONTHLY_QUOTA, DEFAULT_MONTHLY_QUOTA);
};

/* ---------------- utilidades ---------------- */

async function findUser(env, pass) {
  if (!pass || !pass.startsWith("apt_") || pass.length > 80) return null;
  const hash = await sha256(pass);
  const rec = await env.RATE_LIMIT.get(`user:${hash}`, "json");
  if (!rec || rec.disabled) return null;
  // Suscripción cancelada: sigue valiendo hasta el fin del periodo pagado y
  // caduca sola aunque no llegue el aviso de expiración.
  if (rec.expires && Date.parse(rec.expires) <= Date.now()) return null;
  return { hash, ...rec };
}

async function count(env, key) {
  return Number(await env.RATE_LIMIT.get(key)) || 0;
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `apt_${b64}`;
}

async function sha256(s) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Compara los hashes, no los textos, para no filtrar por tiempo cuánto acierta.
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function quotaHeaders(limit, used, cors) {
  return { ...cors, "x-quota-limit": String(limit), "x-quota-used": String(used) };
}

function text(body, status) {
  return new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
