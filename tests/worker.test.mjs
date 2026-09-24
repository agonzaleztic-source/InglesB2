import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const ORIGIN = "https://agonzaleztic-source.github.io";
const BASE = "https://worker.example";

/* ---------------- KV en memoria ---------------- */

class MemoryKV {
  constructor() {
    this.store = new Map();
  }
  async get(key, type) {
    if (!this.store.has(key)) return null;
    const value = this.store.get(key).value;
    if (type === "json") {
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    }
    return value;
  }
  async put(key, value, opts) {
    this.store.set(key, { value: String(value), opts });
  }
  async delete(key) {
    this.store.delete(key);
  }
}

function makeEnv(overrides = {}) {
  const kv = new MemoryKV();
  return {
    env: {
      RATE_LIMIT: kv,
      ANTHROPIC_API_KEY: "sk-test",
      ADMIN_SECRET: "admin-secret",
      APP_PASS: "clave-personal",
      ALLOWED_ORIGIN: ORIGIN,
      ...overrides,
    },
    kv,
  };
}

function req(path, { method = "POST", headers = {}, body } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers["content-type"] = "application/json";
  }
  return new Request(`${BASE}${path}`, init);
}

function currentDayMonth() {
  const day = new Date().toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7) };
}

/* ---------------- fetch simulado ---------------- */

const REAL_FETCH = globalThis.fetch;

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init);
  };
  return calls;
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

function anthropicOk(body = { id: "msg_1", content: [{ type: "text", text: "ok" }] }) {
  return new Response(JSON.stringify(body), { status: 200 });
}

/* ---------------- utilidades de alta de usuario ---------------- */

async function createUser(env, email, monthlyQuota) {
  const res = await worker.fetch(
    req("/admin/users/create", {
      headers: { "x-admin-secret": env.ADMIN_SECRET },
      body: { email, monthly_quota: monthlyQuota },
    }),
    env
  );
  assert.equal(res.status, 201, "el alta de usuario debe responder 201");
  const data = await res.json();
  assert.ok(data.token && data.token.startsWith("apt_"), "debe devolver un código apt_...");
  return data.token;
}

/* ================= tests ================= */

test("OPTIONS responde con las cabeceras CORS y no exige KV", async () => {
  const res = await worker.fetch(req("/", { method: "OPTIONS" }), {});
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

test("un método distinto de POST se rechaza con 405", async () => {
  const res = await worker.fetch(req("/", { method: "GET" }), {});
  assert.equal(res.status, 405);
  const data = await res.json();
  assert.match(data.error, /Solo se admite POST/);
});

test("sin el KV Namespace configurado responde 500", async () => {
  const res = await worker.fetch(
    req("/", { headers: { Origin: ORIGIN, "x-app-pass": "clave-personal" } }),
    {}
  );
  assert.equal(res.status, 500);
  const data = await res.json();
  assert.match(data.error, /RATE_LIMIT/);
});

test("sin cabecera Origin responde 403", async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(req("/", { headers: { "x-app-pass": "clave-personal" } }), env);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.match(data.error, /Origen no autorizado/);
});

test("con un Origin no permitido responde 403", async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(
    req("/", { headers: { Origin: "https://otro-sitio.example", "x-app-pass": "clave-personal" } }),
    env
  );
  assert.equal(res.status, 403);
});

test("con x-app-pass incorrecto responde 401", async () => {
  const { env } = makeEnv();
  const res = await worker.fetch(
    req("/", { headers: { Origin: ORIGIN, "x-app-pass": "esto-no-vale" } }),
    env
  );
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.match(data.error, /incorrecto/);
});

test("con la contraseña personal válida (APP_PASS) se llama al modelo y responde 200", async () => {
  const { env } = makeEnv();
  const calls = stubFetch(() => anthropicOk());
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": "clave-personal" },
        body: { messages: [{ role: "user", content: "Hola" }] },
      }),
      env
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1, "debe llamar una vez al modelo");
    assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
    // el modo personal no lleva cabeceras de cupo, porque no hay usuario
    assert.equal(res.headers.get("x-quota-limit"), null);
  } finally {
    restoreFetch();
  }
});

test("un usuario apt_... con el cupo mensual agotado responde 429 y no llama al modelo", async () => {
  const { env, kv } = makeEnv();
  const token = await createUser(env, "agotado@example.com", 1);
  const { month } = currentDayMonth();
  await kv.put(`use:${month}:agotado@example.com`, "1"); // ya gastó su única petición

  const calls = stubFetch(() => anthropicOk());
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": token },
        body: { messages: [{ role: "user", content: "Hola" }] },
      }),
      env
    );
    assert.equal(res.status, 429);
    const data = await res.json();
    assert.match(data.error, /cupo/);
    assert.equal(calls.length, 0, "no debe llegar a llamar al modelo");
  } finally {
    restoreFetch();
  }
});

test("un usuario apt_... con cupo disponible descuenta una unidad tras una respuesta correcta", async () => {
  const { env, kv } = makeEnv();
  const token = await createUser(env, "con-cupo@example.com", 5);
  const { month } = currentDayMonth();

  const calls = stubFetch(() => anthropicOk());
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": token },
        body: { messages: [{ role: "user", content: "Hola" }] },
      }),
      env
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.equal(res.headers.get("x-quota-limit"), "5");
    assert.equal(res.headers.get("x-quota-used"), "1");
    assert.equal(await kv.get(`use:${month}:con-cupo@example.com`), "1");
  } finally {
    restoreFetch();
  }
});

test("con el tope global agotado responde 429 sin llamar al modelo", async () => {
  const { env, kv } = makeEnv({ GLOBAL_DAILY_LIMIT: "1" });
  const { day } = currentDayMonth();
  await kv.put(`rl:${day}:global`, "1");

  const calls = stubFetch(() => anthropicOk());
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": "clave-personal" },
        body: { messages: [{ role: "user", content: "Hola" }] },
      }),
      env
    );
    assert.equal(res.status, 429);
    const data = await res.json();
    assert.match(data.error, /límite diario/);
    assert.equal(calls.length, 0);
  } finally {
    restoreFetch();
  }
});

test("un 5xx del modelo responde 502 y no descuenta cupo del usuario", async () => {
  const { env, kv } = makeEnv();
  const token = await createUser(env, "fallo-modelo@example.com", 5);
  const { month } = currentDayMonth();

  stubFetch(() => new Response("boom", { status: 500 }));
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": token },
        body: { messages: [{ role: "user", content: "Hola" }] },
      }),
      env
    );
    assert.equal(res.status, 502);
    // el contador vuelve a su valor original: no se descuenta la petición
    assert.equal(await kv.get(`use:${month}:fallo-modelo@example.com`), "0");
  } finally {
    restoreFetch();
  }
});

test("un fallo de red al llamar al modelo también responde 502 sin descontar cupo", async () => {
  const { env, kv } = makeEnv();
  const token = await createUser(env, "sin-red@example.com", 5);
  const { month } = currentDayMonth();

  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": token },
        body: { messages: [{ role: "user", content: "Hola" }] },
      }),
      env
    );
    assert.equal(res.status, 502);
    assert.equal(await kv.get(`use:${month}:sin-red@example.com`), "0");
  } finally {
    restoreFetch();
  }
});

test("el payload enviado al modelo lleva un único mensaje de usuario y recorta max_tokens y contenido", async () => {
  const { env } = makeEnv();
  const largeContent = "x".repeat(20000);

  const calls = stubFetch(() => anthropicOk());
  try {
    const res = await worker.fetch(
      req("/", {
        headers: { Origin: ORIGIN, "x-app-pass": "clave-personal" },
        body: {
          max_tokens: 999999,
          messages: [
            { role: "user", content: largeContent },
            { role: "assistant", content: "una respuesta previa que no debe llegar al modelo" },
          ],
        },
      }),
      env
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);

    const sent = JSON.parse(calls[0].init.body);
    assert.equal(sent.messages.length, 1, "solo debe viajar un mensaje");
    assert.equal(sent.messages[0].role, "user");
    assert.equal(sent.messages[0].content.length, 12000, "el contenido se recorta a 12000 caracteres");
    assert.ok(sent.max_tokens <= 1200, "max_tokens nunca debe superar 1200");
    assert.equal(sent.max_tokens, 1200);

    // el Worker no reenvía la clave del cliente: usa la suya propia
    assert.equal(calls[0].init.headers["x-api-key"], env.ANTHROPIC_API_KEY);
  } finally {
    restoreFetch();
  }
});
