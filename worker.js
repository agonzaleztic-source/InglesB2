/**
 * Proxy para la app Aptis B2.
 *
 * Guarda la clave de la API fuera del navegador: la página en GitHub Pages
 * habla con este Worker, y el Worker habla con Anthropic.
 *
 * Variables de entorno que hay que configurar en Cloudflare:
 *   ANTHROPIC_API_KEY  (secreto, obligatorio)
 *   APP_PASS           (secreto, opcional: contraseña para que no lo use cualquiera)
 *   ALLOWED_ORIGIN     (opcional, por defecto tu GitHub Pages)
 */

const DEFAULT_ORIGIN = "https://agonzaleztic-source.github.io";
const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 1200;

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

    // Solo desde tu página
    const origin = request.headers.get("Origin");
    if (origin && origin !== allowed) {
      return json({ error: "Origen no autorizado" }, 403, cors);
    }

    // Contraseña opcional, para que nadie más gaste tu saldo
    if (env.APP_PASS && request.headers.get("x-app-pass") !== env.APP_PASS) {
      return json({ error: "Contraseña incorrecta" }, 401, cors);
    }

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
