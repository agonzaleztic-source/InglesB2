/**
 * Proxy para la app Aptis B2.
 *
 * Guarda la clave de la API fuera del navegador: la página en GitHub Pages
 * habla con este Worker, y el Worker habla con Anthropic.
 *
 * Variables de entorno que hay que configurar en Cloudflare:
 *   ANTHROPIC_API_KEY  (secreto, obligatorio)
 *   APP_PASS           (secreto, obligatorio: sin esto el Worker no atiende peticiones)
 *   ALLOWED_ORIGIN     (opcional, por defecto tu GitHub Pages)
 *   DAILY_LIMIT        (opcional, por defecto 60 peticiones por IP y día)
 *   GLOBAL_DAILY_LIMIT (opcional, por defecto 1500 peticiones al día entre todos:
 *                       tope de gasto total, pase lo que pase con las IP)
 *
 * Binding que hay que configurar en Cloudflare:
 *   RATE_LIMIT  (KV Namespace, obligatorio: sin esto no hay corte diario)
 */

const DEFAULT_ORIGIN = "https://agonzaleztic-source.github.io";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1200;
const DEFAULT_DAILY_LIMIT = 60;
const DEFAULT_GLOBAL_LIMIT = 1500;

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN || DEFAULT_ORIGIN;
    const cors = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-app-pass",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") {
      return json({ error: "Solo se admite POST" }, 405, cors);
    }

    // Sin cabecera Origin no es un navegador el que llama: fuera.
    const origin = request.headers.get("Origin");
    if (!origin || origin !== allowed) {
      return json({ error: "Origen no autorizado" }, 403, cors);
    }

    // La contraseña ya no es opcional: sin ella, cualquiera con la URL del
    // Worker gastaría tu saldo de la API.
    if (!env.APP_PASS) {
      return json({ error: "El Worker no está configurado del todo: falta el secreto APP_PASS." }, 500, cors);
    }
    if (request.headers.get("x-app-pass") !== env.APP_PASS) {
      return json({ error: "Contraseña incorrecta" }, 401, cors);
    }

    // Corte diario por IP, para que un uso descontrolado (o malicioso) no se
    // coma el saldo de la clave. Necesita el binding KV "RATE_LIMIT".
    if (!env.RATE_LIMIT) {
      return json({ error: "El Worker no está configurado del todo: falta el KV Namespace RATE_LIMIT." }, 500, cors);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "sin-ip";
    const day = new Date().toISOString().slice(0, 10);
    const rateKey = `rl:${day}:${ip}`;
    const limit = Number(env.DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
    const used = Number(await env.RATE_LIMIT.get(rateKey)) || 0;
    if (used >= limit) {
      return json({ error: "Se ha llegado al límite diario de peticiones desde tu conexión. Vuelve mañana." }, 429, cors);
    }
    // Tope global: el gasto máximo diario queda acotado aunque haya muchas IP.
    // Es una cuenta aproximada (KV no es atómico), suficiente como freno.
    const globalKey = `rl:${day}:global`;
    const globalLimit = Number(env.GLOBAL_DAILY_LIMIT) || DEFAULT_GLOBAL_LIMIT;
    const globalUsed = Number(await env.RATE_LIMIT.get(globalKey)) || 0;
    if (globalUsed >= globalLimit) {
      return json({ error: "El servicio ha llegado a su límite diario. Vuelve mañana." }, 429, cors);
    }
    await env.RATE_LIMIT.put(globalKey, String(globalUsed + 1), { expirationTtl: 172800 });
    // Un día de margen sobre la expiración: aunque la fecha cambie a medianoche
    // en dos zonas horarias distintas, la clave vieja desaparece sola igual.
    await env.RATE_LIMIT.put(rateKey, String(used + 1), { expirationTtl: 172800 });

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Cuerpo no válido" }, 400, cors); }

    if (!Array.isArray(body.messages) || !body.messages.length) {
      return json({ error: "Faltan los mensajes" }, 400, cors);
    }

    // Solo dejamos pasar lo que la app necesita: nada de modelos ni límites arbitrarios
    const payload = {
      model: MODEL,
      max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS),
      messages: body.messages.slice(0, 2).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content).slice(0, 12000),
      })),
    };

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "content-type": "application/json" },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
