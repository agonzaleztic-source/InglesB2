/**
 * Proxy para la app Aptis B2, con cuentas de usuario y cupo mensual.
 *
 * Guarda la clave de la API fuera del navegador: la página habla con este
 * Worker, y el Worker habla con Anthropic.
 *
 * Cada usuario tiene un código de acceso personal (apt_...). Se genera con el
 * endpoint de administración, se entrega una sola vez y en el KV solo queda su
 * hash SHA-256: si el KV se filtrara, los códigos no se pueden recuperar.
 * Cada usuario tiene un cupo de peticiones al mes. Más adelante, el webhook de
 * Stripe puede llamar a esos mismos endpoints para dar de alta o de baja.
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
 *   STRIPE_WEBHOOK_SECRET (secreto: firma del webhook /webhooks/stripe, whsec_...)
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
    // Origin y se protegen con la firma de Stripe o con el secreto de admin.
    if (path === "/webhooks/stripe") return stripeWebhook(request, env);
    if (path.startsWith("/admin/")) return admin(path, request, env, cors);

    // Sin cabecera Origin no es un navegador el que llama: fuera.
    const origin = reqOrigin;
    if (!origin || !allowedList.includes(origin)) {
      return json({ error: "Origen no autorizado" }, 403, cors);
    }

    const pass = request.headers.get("x-app-pass") || "";
    const user = await findUser(env, pass);
    const personal = !user && !!env.APP_PASS && pass === env.APP_PASS;
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
    const globalLimit = Number(env.GLOBAL_DAILY_LIMIT) || DEFAULT_GLOBAL_LIMIT;
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
      limit = Number(env.DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
      used = await count(env, usedKey);
      if (used >= limit) {
        return json({ error: "Se ha llegado al límite diario de peticiones desde tu conexión. Vuelve mañana." }, 429, cors);
      }
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Cuerpo no válido" }, 400, cors); }

    if (!Array.isArray(body.messages) || !body.messages.length) {
      return json({ error: "Faltan los mensajes" }, 400, cors);
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
      messages: [{ role: "user", content: String(body.messages[0].content).slice(0, 12000) }],
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
    if (!upstream || upstream.status >= 500) {
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

/* ---------------- pagos: webhook de Stripe ---------------- */

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
// reintento de Stripe lo repita: un código que nadie ha recibido no sirve.
async function provision(env, email, workerUrl) {
  const indexKey = `email:${email}`;
  const oldHash = await env.RATE_LIMIT.get(indexKey);
  const prev = oldHash ? (await env.RATE_LIMIT.get(`user:${oldHash}`, "json")) || {} : {};

  const token = newToken();
  const hash = await sha256(token);
  if (oldHash) await env.RATE_LIMIT.delete(`user:${oldHash}`);
  await putUser(env, hash, email, {}, { ...prev, disabled: false });
  await env.RATE_LIMIT.put(indexKey, hash);

  try {
    await sendCodeEmail(env, email, token, workerUrl, !!oldHash);
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
async function sendCodeEmail(env, to, token, workerUrl, returning) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("Faltan RESEND_API_KEY o EMAIL_FROM");
  const appUrl = env.APP_URL || `${(env.ALLOWED_ORIGIN || DEFAULT_ORIGIN).split(",")[0].trim()}/`;
  const intro = returning ? "Tu suscripción está activa de nuevo. Este es tu nuevo código de acceso (el anterior ya no funciona):"
    : "Gracias por suscribirte. Este es tu código de acceso personal:";
  const body = `${intro}\n\n${token}\n\nCómo usarlo:\n1. Abre ${appUrl}\n2. En el campo de conexión pega esta dirección: ${workerUrl}\n3. En el campo de contraseña pega tu código.\n\nGuárdalo: no se puede volver a mostrar. Si lo pierdes, responde a este correo y te emitiremos uno nuevo.\n\nEntrenador independiente y no oficial; «Aptis» es una marca del British Council.`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: "Tu código de acceso a Aptis B2", text: body }),
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
    if (b.monthly_quota !== undefined) next.quota = quotaOf(b, env);
    if (b.disabled !== undefined) next.disabled = !!b.disabled;
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
  await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify({
    email,
    plan: String(b.plan || prev.plan || "pro").slice(0, 20),
    quota: b.monthly_quota !== undefined ? quotaOf(b, env) : (prev.quota ?? quotaOf({}, env)),
    disabled: !!prev.disabled,
    created: prev.created || new Date().toISOString(),
  }));
}

const quotaOf = (b, env) => {
  const n = Math.floor(Number(b.monthly_quota));
  return b.monthly_quota !== undefined && Number.isFinite(n) && n >= 0
    ? n : (Number(env.DEFAULT_MONTHLY_QUOTA) || DEFAULT_MONTHLY_QUOTA);
};

/* ---------------- utilidades ---------------- */

async function findUser(env, pass) {
  if (!pass || !pass.startsWith("apt_") || pass.length > 80) return null;
  const hash = await sha256(pass);
  const rec = await env.RATE_LIMIT.get(`user:${hash}`, "json");
  return rec && !rec.disabled ? { hash, ...rec } : null;
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
