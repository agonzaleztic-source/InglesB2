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
 *   ALLOWED_ORIGIN     (opcional, por defecto tu GitHub Pages)
 *   DAILY_LIMIT        (opcional, por defecto 60 peticiones por IP y día, solo APP_PASS)
 *   GLOBAL_DAILY_LIMIT (opcional, por defecto 1500 peticiones al día entre todos:
 *                       tope de gasto total, pase lo que pase con los usuarios)
 *   DEFAULT_MONTHLY_QUOTA (opcional, por defecto 300 peticiones al mes por usuario)
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
    const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    const cors = {
      "Access-Control-Allow-Origin": allowed,
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

    // La administración la llama un script o un webhook, no un navegador: no
    // lleva Origin y se protege solo con el secreto.
    if (path.startsWith("/admin/")) return admin(path, request, env, cors);

    // Sin cabecera Origin no es un navegador el que llama: fuera.
    const origin = request.headers.get("Origin");
    if (!origin || origin !== allowed) {
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
      messages: body.messages.slice(0, 2).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 12000),
      })),
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

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
