// /webhooks/lemonsqueezy: firma X-Signature (HMAC-SHA256 hex del cuerpo en
// bruto), altas, idempotencia, cancelación, expiración y test_mode. El KV es
// un Map en memoria y el envío del email (Resend) se simula con un fetch de
// mentira: no hay red real.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const BASE = "https://worker.example";
const SECRET = "secreto-de-firma-de-prueba";
let seq = 0;

class MemoryKV {
  constructor() { this.store = new Map(); }
  async get(key, type) {
    if (!this.store.has(key)) return null;
    const value = this.store.get(key);
    if (type === "json") { try { return JSON.parse(value); } catch { return null; } }
    return value;
  }
  async put(key, value) { this.store.set(key, String(value)); }
  async delete(key) { this.store.delete(key); }
}

function makeEnv(overrides = {}) {
  return {
    RATE_LIMIT: new MemoryKV(),
    LEMONSQUEEZY_SIGNING_SECRET: SECRET,
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "cuenta@example.com",
    ...overrides,
  };
}

async function hmacHex(raw, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// secret: null = sin cabecera; signature: firma literal (para firmas basura).
async function send(env, ev, { secret = SECRET, signature, raw } = {}) {
  const body = raw ?? JSON.stringify(ev);
  const headers = { "content-type": "application/json", "x-event-name": ev?.meta?.event_name || "" };
  if (signature !== undefined) headers["x-signature"] = signature;
  else if (secret !== null) headers["x-signature"] = await hmacHex(body, secret);
  return worker.fetch(new Request(`${BASE}/webhooks/lemonsqueezy`, { method: "POST", headers, body }), env);
}

function orderEvent(attrs = {}, meta = {}) {
  seq += 1;
  return {
    meta: { event_name: "order_created", custom_data: { ref: "web" }, ...meta },
    data: {
      type: "orders",
      id: String(1000 + seq),
      attributes: {
        user_email: "Cliente@Example.com",
        status: "paid",
        test_mode: false,
        created_at: "2026-11-15T10:00:00.000000Z",
        updated_at: "2026-11-15T10:00:00.000000Z",
        ...attrs,
      },
    },
  };
}

function refundEvent(orderId, attrs = {}) {
  return {
    meta: { event_name: "order_refunded" },
    data: {
      type: "orders",
      id: String(orderId),
      attributes: {
        user_email: "cliente@example.com",
        status: "refunded",
        test_mode: false,
        created_at: "2026-11-15T10:00:00.000000Z",
        updated_at: "2026-11-16T10:00:00.000000Z",
        ...attrs,
      },
    },
  };
}

function subEvent(name, id, attrs = {}) {
  return {
    meta: { event_name: name },
    data: {
      type: "subscriptions",
      id: String(id),
      attributes: {
        user_email: "cliente@example.com",
        status: "active",
        test_mode: false,
        ends_at: null,
        updated_at: "2026-11-15T10:00:00.000000Z",
        ...attrs,
      },
    },
  };
}

const REAL_FETCH = globalThis.fetch;
function stubResend(handler = () => new Response("ok", { status: 200 })) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return handler(url, init); };
  return calls;
}
function restoreFetch() { globalThis.fetch = REAL_FETCH; }

async function userOf(env, email = "cliente@example.com") {
  const hash = await env.RATE_LIMIT.get(`email:${email}`);
  return hash ? env.RATE_LIMIT.get(`user:${hash}`, "json") : null;
}

function codeFrom(call) {
  return JSON.parse(call.init.body).text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.startsWith("apt_"));
}

async function me(env, code) {
  return worker.fetch(new Request(`${BASE}/me`, {
    method: "POST",
    headers: { Origin: "https://agonzaleztic-source.github.io", "x-app-pass": code, "content-type": "application/json" },
    body: "{}",
  }), env);
}

// Alta completa: pedido + suscripción, devuelve el código enviado.
async function alta(env, subId = 77) {
  const calls = stubResend();
  try {
    assert.equal((await send(env, orderEvent())).status, 200);
    assert.equal((await send(env, subEvent("subscription_created", subId))).status, 200);
    return codeFrom(calls[0]);
  } finally { restoreFetch(); }
}

test("sin LEMONSQUEEZY_SIGNING_SECRET configurado responde 500 y no hace nada", async () => {
  const env = makeEnv({ LEMONSQUEEZY_SIGNING_SECRET: undefined });
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent());
    assert.equal(res.status, 500);
    assert.equal(calls.length, 0);
    assert.equal(env.RATE_LIMIT.store.size, 0);
  } finally { restoreFetch(); }
});

test("sin cabecera X-Signature responde 401 y no toca el KV ni envía email", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent(), { secret: null });
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
    assert.equal(env.RATE_LIMIT.store.size, 0);
  } finally { restoreFetch(); }
});

test("con una firma calculada con otro secreto responde 401", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent(), { secret: "otro-secreto" });
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
    assert.equal(env.RATE_LIMIT.store.size, 0);
  } finally { restoreFetch(); }
});

test("con una firma basura o vacía responde 401", async () => {
  const env = makeEnv();
  for (const signature of ["", "abc", "0".repeat(64)]) {
    const res = await send(env, orderEvent(), { signature });
    assert.equal(res.status, 401, `firma ${JSON.stringify(signature)}`);
  }
  assert.equal(env.RATE_LIMIT.store.size, 0);
});

test("la firma se calcula sobre el cuerpo en bruto: cambiar un byte la invalida", async () => {
  const env = makeEnv();
  const raw = JSON.stringify(orderEvent());
  const signature = await hmacHex(raw, SECRET);
  const res = await send(env, null, { raw: raw.replace("paid", "paiD"), signature });
  assert.equal(res.status, 401);
});

test("order_created pagado con firma válida da de alta y envía el código por email", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent());
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "ok");
    assert.equal(calls.length, 1, "debe llamar una vez a Resend");
    assert.match(String(calls[0].url), /resend\.com/);
    const sent = JSON.parse(calls[0].init.body);
    assert.deepEqual(sent.to, ["cliente@example.com"], "el email se normaliza a minúsculas");
    assert.ok(sent.text.includes(`#worker=${encodeURIComponent(BASE)}`));

    const rec = await userOf(env);
    assert.equal(rec.email, "cliente@example.com");
    assert.equal(rec.disabled, false);
    assert.equal(rec.quota, 300);
    assert.equal(rec.plan, "pro");

    const code = codeFrom(calls[0]);
    assert.ok(code, "el email lleva un código apt_");
    assert.equal((await me(env, code)).status, 200, "el código recibido funciona");

    assert.match(sent.text, /300 correcciones con IA al mes/, "debe decir el cupo mensual");
  } finally { restoreFetch(); }
});

test("un nuevo pedido del mismo cliente dice en el email el cupo que ya tenía, no el por defecto", async () => {
  const env = makeEnv();
  try {
    const calls1 = stubResend();
    assert.equal((await send(env, orderEvent())).status, 200);
    restoreFetch();

    // Un administrador le había puesto un cupo distinto del por defecto.
    const hash = await env.RATE_LIMIT.get("email:cliente@example.com");
    const rec = await env.RATE_LIMIT.get(`user:${hash}`, "json");
    await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify({ ...rec, quota: 150 }));

    const calls2 = stubResend();
    assert.equal((await send(env, orderEvent())).status, 200);
    const texto = JSON.parse(calls2[0].init.body).text;
    assert.match(texto, /Tu suscripción está activa de nuevo/);
    assert.match(texto, /150 correcciones con IA al mes/);
    assert.equal(calls1.length, 1);
  } finally { restoreFetch(); }
});

test("una firma válida en mayúsculas o con espacios también se acepta", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const ev = orderEvent();
    const raw = JSON.stringify(ev);
    const signature = ` ${(await hmacHex(raw, SECRET)).toUpperCase()} `;
    const res = await send(env, ev, { raw, signature });
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
  } finally { restoreFetch(); }
});

test("un pedido no pagado (pending) no da de alta", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent({ status: "pending" }));
    assert.equal(res.status, 200);
    assert.equal(calls.length, 0);
    assert.equal(await userOf(env), null);
  } finally { restoreFetch(); }
});

test("un reintento del mismo order_created no crea un segundo usuario ni reenvía el email", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const ev = orderEvent();
    assert.equal((await send(env, ev)).status, 200);
    const hash1 = await env.RATE_LIMIT.get("email:cliente@example.com");
    const segunda = await send(env, ev);
    assert.equal(segunda.status, 200);
    assert.equal(await segunda.text(), "ya procesado");
    assert.equal(calls.length, 1);
    assert.equal(await env.RATE_LIMIT.get("email:cliente@example.com"), hash1, "el código no cambia");
    const usuarios = [...env.RATE_LIMIT.store.keys()].filter((k) => k.startsWith("user:"));
    assert.equal(usuarios.length, 1);
  } finally { restoreFetch(); }
});

test("si falla el email se deshace el alta y responde 500 para que Lemon Squeezy reintente", async () => {
  const env = makeEnv();
  const ev = orderEvent();
  let calls = stubResend(() => new Response("error", { status: 500 }));
  try {
    assert.equal((await send(env, ev)).status, 500);
    assert.equal(calls.length, 1);
    assert.equal(await userOf(env), null, "no queda un usuario sin código entregado");
  } finally { restoreFetch(); }
  // El reintento, con Resend ya bien, sí da de alta.
  calls = stubResend();
  try {
    assert.equal((await send(env, ev)).status, 200);
    assert.equal(calls.length, 1);
    assert.ok(await userOf(env));
  } finally { restoreFetch(); }
});

test("un pedido sin email válido responde 500 y no intenta enviar", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent({ user_email: "no-es-un-email" }));
    assert.equal(res.status, 500);
    assert.equal(calls.length, 0);
  } finally { restoreFetch(); }
});

test("subscription_expired da de baja: el código deja de funcionar", async () => {
  const env = makeEnv();
  const code = await alta(env);
  const res = await send(env, subEvent("subscription_expired", 77, {
    status: "expired", ends_at: "2026-12-15T10:00:00.000000Z", updated_at: "2026-12-15T10:00:00.000000Z",
  }));
  assert.equal(res.status, 200);
  assert.equal((await userOf(env)).disabled, true);
  assert.equal((await me(env, code)).status, 401);
});

test("subscription_cancelled deja caducar: vale hasta ends_at y después no", async () => {
  const env = makeEnv();
  const code = await alta(env);
  const futuro = new Date(Date.now() + 86400000).toISOString();
  await send(env, subEvent("subscription_cancelled", 77, {
    status: "cancelled", cancelled: true, ends_at: futuro, updated_at: "2026-11-20T10:00:00.000000Z",
  }));
  let rec = await userOf(env);
  assert.equal(rec.expires, futuro);
  assert.equal((await me(env, code)).status, 200, "dentro del periodo pagado sigue entrando");

  // Mismo usuario, pero con la fecha de fin ya pasada.
  const hash = await env.RATE_LIMIT.get("email:cliente@example.com");
  rec = { ...rec, expires: new Date(Date.now() - 1000).toISOString() };
  await env.RATE_LIMIT.put(`user:${hash}`, JSON.stringify(rec));
  assert.equal((await me(env, code)).status, 401, "pasado ends_at caduca aunque no llegue subscription_expired");
});

test("subscription_cancelled sin ends_at da de baja en el acto", async () => {
  const env = makeEnv();
  await alta(env);
  await send(env, subEvent("subscription_cancelled", 77, { status: "cancelled", ends_at: null, updated_at: "2026-11-20T10:00:00.000000Z" }));
  assert.equal((await userOf(env)).disabled, true);
});

test("una reanudación (subscription_updated active) quita la caducidad", async () => {
  const env = makeEnv();
  await alta(env);
  await send(env, subEvent("subscription_cancelled", 77, {
    status: "cancelled", ends_at: "2026-12-15T10:00:00.000000Z", updated_at: "2026-11-20T10:00:00.000000Z",
  }));
  await send(env, subEvent("subscription_updated", 77, { status: "active", updated_at: "2026-11-21T10:00:00.000000Z" }));
  const rec = await userOf(env);
  assert.equal(rec.expires, undefined);
  assert.equal(rec.disabled, false);
});

test("un aviso más antiguo que el último aplicado se ignora", async () => {
  const env = makeEnv();
  await alta(env);
  await send(env, subEvent("subscription_expired", 77, { status: "expired", updated_at: "2026-12-15T10:00:00.000000Z" }));
  await send(env, subEvent("subscription_updated", 77, { status: "active", updated_at: "2026-11-15T11:00:00.000000Z" }));
  assert.equal((await userOf(env)).disabled, true, "un evento desordenado no reactiva");
});

test("subscription_payment_success pagado reactiva al usuario de esa suscripción", async () => {
  const env = makeEnv();
  await alta(env);
  await send(env, subEvent("subscription_updated", 77, { status: "unpaid", updated_at: "2026-12-20T10:00:00.000000Z" }));
  assert.equal((await userOf(env)).disabled, true);
  const res = await send(env, {
    meta: { event_name: "subscription_payment_success" },
    data: {
      type: "subscription-invoices",
      id: "555",
      attributes: { subscription_id: 77, user_email: "cliente@example.com", status: "paid", billing_reason: "renewal", test_mode: false },
    },
  });
  assert.equal(res.status, 200);
  assert.equal((await userOf(env)).disabled, false);
});

test("un evento de suscripción sin usuario conocido no falla", async () => {
  const env = makeEnv();
  const res = await send(env, subEvent("subscription_expired", 999, { user_email: "nadie@example.com", status: "expired" }));
  assert.equal(res.status, 200);
});

test("un evento que no se usa (p. ej. license_key_created) responde 200 sin tocar usuarios", async () => {
  const env = makeEnv();
  const res = await send(env, { meta: { event_name: "license_key_created" }, data: { type: "license-keys", id: "1", attributes: {} } });
  assert.equal(res.status, 200);
  assert.equal([...env.RATE_LIMIT.store.keys()].filter((k) => k.startsWith("user:")).length, 0);
});

test("test_mode: el pedido de prueba da de alta igual, con plan «prueba», y no rompe nada", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent({ test_mode: true }, { test_mode: true }));
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    const rec = await userOf(env);
    assert.equal(rec.plan, "prueba");
    assert.equal(rec.disabled, false);
    assert.equal((await me(env, codeFrom(calls[0]))).status, 200);
  } finally { restoreFetch(); }
  const baja = await send(env, subEvent("subscription_expired", 88, { status: "expired", test_mode: true }));
  assert.equal(baja.status, 200);
  assert.equal((await userOf(env)).disabled, true);
});

test("LEMONSQUEEZY_PRODUCT_IDS: un pedido de un producto distinto no crea usuario ni llama a Resend", async () => {
  const env = makeEnv({ LEMONSQUEEZY_PRODUCT_IDS: "111" });
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent({ first_order_item: { product_id: 222 } }));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "otro producto");
    assert.equal(calls.length, 0);
    assert.equal(await userOf(env), null);
  } finally { restoreFetch(); }
});

test("LEMONSQUEEZY_PRODUCT_IDS: un pedido del producto de Ruta B2 sí da de alta", async () => {
  const env = makeEnv({ LEMONSQUEEZY_PRODUCT_IDS: "111" });
  const calls = stubResend();
  try {
    const res = await send(env, orderEvent({ first_order_item: { product_id: 111 } }));
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(await userOf(env));
  } finally { restoreFetch(); }
});

test("LEMONSQUEEZY_PRODUCT_IDS: un subscription_expired de otro producto no da de baja a un usuario existente con el mismo email", async () => {
  const env = makeEnv({ LEMONSQUEEZY_PRODUCT_IDS: "111" });
  const calls = stubResend();
  let code;
  try {
    assert.equal((await send(env, orderEvent({ first_order_item: { product_id: 111 } }))).status, 200);
    assert.equal((await send(env, subEvent("subscription_created", 77, { product_id: 111 }))).status, 200);
    code = codeFrom(calls[0]);
  } finally { restoreFetch(); }
  const res = await send(env, subEvent("subscription_expired", 77, {
    status: "expired", product_id: 222, updated_at: "2026-12-15T10:00:00.000000Z",
  }));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "otro producto");
  assert.equal((await userOf(env)).disabled, false);
  assert.equal((await me(env, code)).status, 200);
});

test("subscription_payment_success con un subscription_id desconocido no reactiva a un usuario dado de baja", async () => {
  const env = makeEnv();
  await alta(env);
  await send(env, subEvent("subscription_expired", 77, { status: "expired", updated_at: "2026-12-15T10:00:00.000000Z" }));
  assert.equal((await userOf(env)).disabled, true);
  const res = await send(env, {
    meta: { event_name: "subscription_payment_success" },
    data: {
      type: "subscription-invoices", id: "556",
      attributes: { subscription_id: 9999, user_email: "cliente@example.com", status: "paid", test_mode: false },
    },
  });
  assert.equal(res.status, 200);
  assert.equal((await userOf(env)).disabled, true, "no reactiva: esa suscripción no se conoce");
  assert.equal(await env.RATE_LIMIT.get("ls:sub:9999"), null, "no crea la asociación desde user_email");
});

test("order_refunded (reembolso total) de un pedido que dio de alta da de baja la cuenta", async () => {
  const env = makeEnv();
  const calls = stubResend();
  let ev;
  try {
    ev = orderEvent();
    assert.equal((await send(env, ev)).status, 200);
  } finally { restoreFetch(); }
  const code = codeFrom(calls[0]);
  assert.equal((await me(env, code)).status, 200);

  const res = await send(env, refundEvent(ev.data.id));
  assert.equal(res.status, 200);
  assert.equal((await userOf(env)).disabled, true);
  assert.equal((await me(env, code)).status, 401, "el código deja de valer");
});

test("order_refunded con reembolso parcial no quita el acceso", async () => {
  const env = makeEnv();
  const calls = stubResend();
  let ev;
  try {
    ev = orderEvent();
    assert.equal((await send(env, ev)).status, 200);
  } finally { restoreFetch(); }
  const code = codeFrom(calls[0]);

  const res = await send(env, refundEvent(ev.data.id, { status: "partial_refund" }));
  assert.equal(res.status, 200);
  assert.equal((await userOf(env)).disabled, false);
  assert.equal((await me(env, code)).status, 200);
});

test("reembolsar un pedido antiguo tras un pedido nuevo del mismo cliente no da de baja la cuenta vigente", async () => {
  const env = makeEnv();
  let ev1;
  let calls = stubResend();
  try {
    ev1 = orderEvent();
    assert.equal((await send(env, ev1)).status, 200);
  } finally { restoreFetch(); }

  calls = stubResend();
  try {
    assert.equal((await send(env, orderEvent())).status, 200, "el cliente se vuelve a suscribir: pedido nuevo");
  } finally { restoreFetch(); }
  const code = codeFrom(calls[0]);

  const res = await send(env, refundEvent(ev1.data.id));
  assert.equal(res.status, 200);
  assert.equal((await userOf(env)).disabled, false, "el pedido reembolsado ya no es el que dio el acceso actual");
  assert.equal((await me(env, code)).status, 200);
});

test("order_refunded de un pedido no registrado (otro producto o anterior) responde 200 sin tocar nada", async () => {
  const env = makeEnv();
  const res = await send(env, refundEvent("9999999"));
  assert.equal(res.status, 200);
  assert.equal(await userOf(env), null);
});

test("un reintento del mismo order_refunded es idempotente", async () => {
  const env = makeEnv();
  const calls = stubResend();
  let ev;
  try {
    ev = orderEvent();
    assert.equal((await send(env, ev)).status, 200);
  } finally { restoreFetch(); }

  const refund = refundEvent(ev.data.id);
  assert.equal((await send(env, refund)).status, 200);
  assert.equal((await userOf(env)).disabled, true);

  const segunda = await send(env, refund);
  assert.equal(segunda.status, 200);
  assert.equal(await segunda.text(), "ya procesado");
  assert.equal((await userOf(env)).disabled, true);
});

test("LEMONSQUEEZY_PRODUCT_IDS: order_refunded de un pedido de otro producto no toca la cuenta", async () => {
  const env = makeEnv({ LEMONSQUEEZY_PRODUCT_IDS: "111" });
  const calls = stubResend();
  let ev;
  try {
    ev = orderEvent({ first_order_item: { product_id: 111 } });
    assert.equal((await send(env, ev)).status, 200);
  } finally { restoreFetch(); }
  const code = codeFrom(calls[0]);

  const res = await send(env, refundEvent(ev.data.id, { first_order_item: { product_id: 222 } }));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "otro producto");
  assert.equal((await userOf(env)).disabled, false);
  assert.equal((await me(env, code)).status, 200);
});

test("un cuerpo firmado que no es JSON responde 400", async () => {
  const env = makeEnv();
  const raw = "esto no es json";
  const res = await send(env, null, { raw, signature: await hmacHex(raw, SECRET) });
  assert.equal(res.status, 400);
});

test("la ruta de Stripe (obsoleta) sigue respondiendo", async () => {
  const env = makeEnv({ STRIPE_WEBHOOK_SECRET: "whsec_test" });
  const res = await worker.fetch(new Request(`${BASE}/webhooks/stripe`, { method: "POST", body: "{}" }), env);
  assert.equal(res.status, 400, "sin firma de Stripe, 400 como antes");
});
