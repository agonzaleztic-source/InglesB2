// Caracteriza /webhooks/stripe (firma, altas, renovaciones y bajas), sin
// cobertura en tests/worker.test.mjs. La firma se genera con el mismo HMAC-
// SHA256 que usa worker.js, y el envío de email (Resend) se simula con un
// fetch de mentira: no hay red real. No se modifica worker.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const BASE = "https://worker.example";
const SECRET = "whsec_test";
let eventId = 0;

class MemoryKV {
  constructor() {
    this.store = new Map();
  }
  async get(key, type) {
    if (!this.store.has(key)) return null;
    const value = this.store.get(key).value;
    if (type === "json") {
      try { return JSON.parse(value); } catch { return null; }
    }
    return value;
  }
  async put(key, value) {
    this.store.set(key, { value: String(value) });
  }
  async delete(key) {
    this.store.delete(key);
  }
}

function makeEnv(overrides = {}) {
  return {
    RATE_LIMIT: new MemoryKV(),
    STRIPE_WEBHOOK_SECRET: SECRET,
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "cuenta@example.com",
    ...overrides,
  };
}

async function sign(raw, secret, t = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const hex = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `t=${t},v1=${hex}`;
}

async function send(env, ev, { secret = SECRET, t } = {}) {
  const raw = JSON.stringify(ev);
  const headers = { "content-type": "application/json" };
  if (secret !== null) headers["stripe-signature"] = await sign(raw, secret, t);
  return worker.fetch(new Request(`${BASE}/webhooks/stripe`, { method: "POST", headers, body: raw }), env);
}

function checkoutEvent(overrides = {}) {
  eventId += 1;
  return {
    id: `evt_${eventId}`,
    type: "checkout.session.completed",
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        mode: "subscription",
        customer: `cus_${eventId}`,
        customer_details: { email: "cliente@example.com" },
        ...overrides,
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

test("sin STRIPE_WEBHOOK_SECRET configurado responde 500", async () => {
  const env = makeEnv({ STRIPE_WEBHOOK_SECRET: undefined });
  const res = await send(env, checkoutEvent(), { secret: SECRET });
  assert.equal(res.status, 500);
});

test("sin cabecera stripe-signature responde 400", async () => {
  const env = makeEnv();
  const res = await send(env, checkoutEvent(), { secret: null });
  assert.equal(res.status, 400);
});

test("con una firma calculada con otro secreto responde 400", async () => {
  const env = makeEnv();
  const res = await send(env, checkoutEvent(), { secret: "secreto-equivocado" });
  assert.equal(res.status, 400);
});

test("con una firma caducada (más de 5 minutos) responde 400", async () => {
  const env = makeEnv();
  const t = Math.floor(Date.now() / 1000) - 400;
  const res = await send(env, checkoutEvent(), { t });
  assert.equal(res.status, 400);
});

test("checkout.session.completed da de alta y envía el código por email", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, checkoutEvent());
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "ok");
    assert.equal(calls.length, 1, "debe llamar una vez a Resend");
    assert.match(String(calls[0].url), /resend\.com/);

    const hash = await env.RATE_LIMIT.get("email:cliente@example.com");
    assert.ok(hash, "debe indexar el email hacia un hash de usuario");
    const rec = await env.RATE_LIMIT.get(`user:${hash}`, "json");
    assert.equal(rec.email, "cliente@example.com");
    assert.equal(rec.disabled, false);
  } finally { restoreFetch(); }
});

test("el email de alta incluye el enlace con #worker= y el código solo aparece en su propia línea", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, checkoutEvent());
    assert.equal(res.status, 200);
    const sent = JSON.parse(calls[0].init.body);
    const texto = sent.text;
    assert.ok(texto.includes(`#worker=${encodeURIComponent(BASE)}`), "debe incluir el enlace con el Worker precargado");

    const lineas = texto.split("\n");
    const lineasConCodigo = lineas.filter((l) => /^apt_/.test(l.trim()));
    assert.equal(lineasConCodigo.length, 1, "el código debe aparecer en una sola línea propia");
    const codigo = lineasConCodigo[0].trim();
    const fueraDeSuLinea = lineas.filter((l) => l.includes(codigo) && l.trim() !== codigo);
    assert.equal(fueraDeSuLinea.length, 0, "el código no debe aparecer fuera de su línea");
  } finally { restoreFetch(); }
});

test("checkout.session.completed sin email válido no da de alta y responde 500", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, checkoutEvent({ customer_details: undefined, customer_email: "" }));
    assert.equal(res.status, 500);
    assert.equal(calls.length, 0, "no debe intentar enviar email sin destinatario");
  } finally { restoreFetch(); }
});

test("checkout.session.completed con mode distinto de subscription no da de alta", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const res = await send(env, checkoutEvent({ mode: "payment" }));
    assert.equal(res.status, 200);
    assert.equal(calls.length, 0);
    assert.equal(await env.RATE_LIMIT.get("email:cliente@example.com"), null);
  } finally { restoreFetch(); }
});

test("un evento repetido (mismo id) se ignora la segunda vez sin reenviar el email", async () => {
  const env = makeEnv();
  const calls = stubResend();
  try {
    const ev = checkoutEvent();
    const primera = await send(env, ev);
    const segunda = await send(env, ev);
    assert.equal(primera.status, 200);
    assert.equal(segunda.status, 200);
    assert.equal(await segunda.text(), "ya procesado");
    assert.equal(calls.length, 1, "el reintento de Stripe no debe repetir el alta");
  } finally { restoreFetch(); }
});

test("si el envío del email falla, se deshace el alta (rollback) y Stripe reintenta con 500", async () => {
  const env = makeEnv();
  const calls = stubResend(() => new Response("error", { status: 500 }));
  try {
    const res = await send(env, checkoutEvent());
    assert.equal(res.status, 500);
    assert.equal(calls.length, 1);
    assert.equal(await env.RATE_LIMIT.get("email:cliente@example.com"), null, "no debe quedar un usuario sin código entregado");
  } finally { restoreFetch(); }
});

test("customer.subscription.deleted deshabilita al usuario existente", async () => {
  const env = makeEnv();
  await env.RATE_LIMIT.put("user:hash1", JSON.stringify({ email: "user@example.com", plan: "pro", quota: 300, disabled: false }));
  await env.RATE_LIMIT.put("email:user@example.com", "hash1");
  await env.RATE_LIMIT.put("cust:cus_1", "user@example.com");

  const res = await send(env, {
    id: "evt_del_1",
    type: "customer.subscription.deleted",
    created: Math.floor(Date.now() / 1000),
    data: { object: { customer: "cus_1" } },
  });
  assert.equal(res.status, 200);
  const rec = await env.RATE_LIMIT.get("user:hash1", "json");
  assert.equal(rec.disabled, true);
});

test("customer.subscription.updated con status active reactiva al usuario", async () => {
  const env = makeEnv();
  await env.RATE_LIMIT.put("user:hash2", JSON.stringify({ email: "otro@example.com", plan: "pro", quota: 300, disabled: true }));
  await env.RATE_LIMIT.put("email:otro@example.com", "hash2");
  await env.RATE_LIMIT.put("cust:cus_2", "otro@example.com");

  const res = await send(env, {
    id: "evt_upd_1",
    type: "customer.subscription.updated",
    created: Math.floor(Date.now() / 1000),
    data: { object: { customer: "cus_2", status: "active" } },
  });
  assert.equal(res.status, 200);
  const rec = await env.RATE_LIMIT.get("user:hash2", "json");
  assert.equal(rec.disabled, false);
});

test("un evento más antiguo que el último aplicado se ignora", async () => {
  const env = makeEnv();
  await env.RATE_LIMIT.put("user:hash3", JSON.stringify({ email: "tarde@example.com", plan: "pro", quota: 300, disabled: false }));
  await env.RATE_LIMIT.put("email:tarde@example.com", "hash3");
  await env.RATE_LIMIT.put("cust:cus_3", "tarde@example.com");
  await env.RATE_LIMIT.put("sub:tarde@example.com", "2000");

  const res = await send(env, {
    id: "evt_old_1",
    type: "customer.subscription.deleted",
    created: 1000,
    data: { object: { customer: "cus_3" } },
  });
  assert.equal(res.status, 200);
  const rec = await env.RATE_LIMIT.get("user:hash3", "json");
  assert.equal(rec.disabled, false, "un evento desordenado no debe deshacer el estado más reciente");
});

test("customer.subscription.deleted sin un cust: indexado no falla, simplemente no hace nada", async () => {
  const env = makeEnv();
  const res = await send(env, {
    id: "evt_del_huerfano",
    type: "customer.subscription.deleted",
    created: Math.floor(Date.now() / 1000),
    data: { object: { customer: "cus_desconocido" } },
  });
  assert.equal(res.status, 200);
});
