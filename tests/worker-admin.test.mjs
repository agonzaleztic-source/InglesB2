// Caracteriza las rutas /admin/* (alta, edición y reinicio de usuarios) y
// /me de worker.js, que tests/worker.test.mjs no cubre (solo usa
// /admin/users/create como utilidad interna para montar otros casos). Mismo
// patrón que tests/worker.test.mjs: KV en memoria, sin red real. No se
// modifica worker.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const ORIGIN = "https://agonzaleztic-source.github.io";
const BASE = "https://worker.example";

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
    ANTHROPIC_API_KEY: "sk-test",
    ADMIN_SECRET: "admin-secret",
    ALLOWED_ORIGIN: ORIGIN,
    ...overrides,
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

function admin(path, env, opts = {}) {
  const secret = "secret" in opts ? opts.secret : env.ADMIN_SECRET;
  const body = "body" in opts ? opts.body : {};
  const headers = {};
  if (secret !== null) headers["x-admin-secret"] = secret;
  return worker.fetch(req(path, { headers, body }), env);
}

test("/admin/* sin ADMIN_SECRET configurado responde 500", async () => {
  const env = makeEnv({ ADMIN_SECRET: undefined });
  const res = await admin("/admin/users/create", env, { secret: "cualquiera" });
  assert.equal(res.status, 500);
});

test("/admin/* con x-admin-secret incorrecto responde 401", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/create", env, { secret: "otro-secreto" });
  assert.equal(res.status, 401);
});

test("/admin/* sin cabecera x-admin-secret responde 401", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/create", env, { secret: null });
  assert.equal(res.status, 401);
});

test("/admin/users/create con email no válido responde 400", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/create", env, { body: { email: "no-es-un-email" } });
  assert.equal(res.status, 400);
});

test("/admin/users/create da de alta con plan y cupo por defecto", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/create", env, { body: { email: "ana@example.com" } });
  assert.equal(res.status, 201);
  const data = await res.json();
  assert.ok(data.token.startsWith("apt_"));
  assert.equal(data.plan, "pro");
  assert.equal(data.quota, 300);
});

test("/admin/users/create respeta el plan y el cupo indicados", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/create", env, {
    body: { email: "bea@example.com", plan: "premium", monthly_quota: 50 },
  });
  const data = await res.json();
  assert.equal(data.plan, "premium");
  assert.equal(data.quota, 50);
});

test("/admin/users/create con un email ya existente responde 409", async () => {
  const env = makeEnv();
  await admin("/admin/users/create", env, { body: { email: "dup@example.com" } });
  const res = await admin("/admin/users/create", env, { body: { email: "dup@example.com" } });
  assert.equal(res.status, 409);
});

test("/admin/users/update sobre un email inexistente responde 404", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/update", env, { body: { email: "nadie@example.com", plan: "pro" } });
  assert.equal(res.status, 404);
});

test("/admin/users/update cambia el plan y el cupo sin tocar el código", async () => {
  const env = makeEnv();
  const alta = await (await admin("/admin/users/create", env, { body: { email: "carla@example.com" } })).json();
  const res = await admin("/admin/users/update", env, {
    body: { email: "carla@example.com", plan: "premium", monthly_quota: 10 },
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.plan, "premium");
  assert.equal(data.quota, 10);
  assert.equal(data.disabled, false);

  const me = await worker.fetch(
    req("/me", { headers: { Origin: ORIGIN, "x-app-pass": alta.token } }),
    env
  );
  assert.equal(me.status, 200, "el código anterior debe seguir funcionando tras la edición");
  const meData = await me.json();
  assert.equal(meData.quota, 10);
});

test("/admin/users/update con disabled:true impide seguir usando el código", async () => {
  const env = makeEnv();
  const alta = await (await admin("/admin/users/create", env, { body: { email: "dana@example.com" } })).json();
  await admin("/admin/users/update", env, { body: { email: "dana@example.com", disabled: true } });

  const me = await worker.fetch(
    req("/me", { headers: { Origin: ORIGIN, "x-app-pass": alta.token } }),
    env
  );
  assert.equal(me.status, 401);
});

test("/admin/users/reset sobre un email inexistente responde 404", async () => {
  const env = makeEnv();
  const res = await admin("/admin/users/reset", env, { body: { email: "nadie@example.com" } });
  assert.equal(res.status, 404);
});

test("/admin/users/reset invalida el código anterior, emite uno nuevo y conserva plan y cupo", async () => {
  const env = makeEnv();
  const alta = await (await admin("/admin/users/create", env, {
    body: { email: "elena@example.com", plan: "premium", monthly_quota: 20 },
  })).json();

  const res = await admin("/admin/users/reset", env, { body: { email: "elena@example.com" } });
  assert.equal(res.status, 200);
  const { token: nuevo } = await res.json();
  assert.notEqual(nuevo, alta.token);

  const conViejo = await worker.fetch(
    req("/me", { headers: { Origin: ORIGIN, "x-app-pass": alta.token } }),
    env
  );
  assert.equal(conViejo.status, 401, "el código viejo debe quedar invalidado");

  const conNuevo = await worker.fetch(
    req("/me", { headers: { Origin: ORIGIN, "x-app-pass": nuevo } }),
    env
  );
  assert.equal(conNuevo.status, 200);
  const data = await conNuevo.json();
  assert.equal(data.plan, "premium");
  assert.equal(data.quota, 20, "el reinicio no debe perder el cupo asignado");
});

test("/admin/ruta desconocida responde 404", async () => {
  const env = makeEnv();
  await admin("/admin/users/create", env, { body: { email: "fani@example.com" } });
  const res = await admin("/admin/users/otracosa", env, { body: { email: "fani@example.com" } });
  assert.equal(res.status, 404);
});

test("/me sin usuario pero con la contraseña personal responde plan personal", async () => {
  const env = makeEnv({ APP_PASS: "clave-personal" });
  const res = await worker.fetch(
    req("/me", { headers: { Origin: ORIGIN, "x-app-pass": "clave-personal" } }),
    env
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { plan: "personal" });
});

test("/me con un usuario nuevo devuelve el cupo completo sin consumir nada", async () => {
  const env = makeEnv();
  const alta = await (await admin("/admin/users/create", env, { body: { email: "gara@example.com" } })).json();
  const res = await worker.fetch(
    req("/me", { headers: { Origin: ORIGIN, "x-app-pass": alta.token } }),
    env
  );
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.used, 0);
  assert.equal(data.quota, 300);
  assert.equal(res.headers.get("x-quota-limit"), "300");
  assert.equal(res.headers.get("x-quota-used"), "0");
});
