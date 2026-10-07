// Caracteriza el soporte de ALLOWED_ORIGIN con varios orígenes separados por
// comas (worker.js ~46-50): cuando el Origin de la petición coincide con
// alguno de la lista, la cabecera CORS debe reflejar ESE origen (no siempre
// el primero); cuando no coincide con ninguno, se rechaza con 403 y la
// cabecera cae al primero de la lista, como con un único origen configurado.
// No se modifica worker.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const BASE = "https://worker.example";
const ORIGIN_A = "https://a.example";
const ORIGIN_B = "https://b.example";

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
  async put(key, value) {
    this.store.set(key, { value: String(value) });
  }
  async delete(key) {
    this.store.delete(key);
  }
}

function makeEnv(allowedOrigin) {
  return {
    RATE_LIMIT: new MemoryKV(),
    ANTHROPIC_API_KEY: "sk-test",
    APP_PASS: "clave-personal",
    ALLOWED_ORIGIN: allowedOrigin,
  };
}

function req(path, { method = "POST", headers = {} } = {}) {
  return new Request(`${BASE}${path}`, { method, headers: { ...headers } });
}

test("ALLOWED_ORIGIN con varios orígenes: refleja el segundo cuando la petición viene de él", async () => {
  const env = makeEnv(`${ORIGIN_A},${ORIGIN_B}`);
  const res = await worker.fetch(
    req("/", { headers: { Origin: ORIGIN_B, "x-app-pass": "clave-personal" } }),
    env
  );
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN_B);
  assert.notEqual(res.status, 403);
});

test("ALLOWED_ORIGIN con espacios tras la coma: el segundo origen se reconoce igual", async () => {
  const env = makeEnv(`${ORIGIN_A}, ${ORIGIN_B}`);
  const res = await worker.fetch(
    req("/", { headers: { Origin: ORIGIN_B, "x-app-pass": "clave-personal" } }),
    env
  );
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN_B);
  assert.notEqual(res.status, 403);
});

test("ALLOWED_ORIGIN con varios orígenes: uno fuera de la lista se rechaza con 403 y la cabecera cae al primero", async () => {
  const env = makeEnv(`${ORIGIN_A},${ORIGIN_B}`);
  const res = await worker.fetch(
    req("/", { headers: { Origin: "https://otro.example", "x-app-pass": "clave-personal" } }),
    env
  );
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN_A);
});

test("OPTIONS con varios orígenes en ALLOWED_ORIGIN refleja el origen de la preflight", async () => {
  const env = makeEnv(`${ORIGIN_A},${ORIGIN_B}`);
  const res = await worker.fetch(req("/", { method: "OPTIONS", headers: { Origin: ORIGIN_B } }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN_B);
});
