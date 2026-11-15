// sw.js responde primero desde la caché y pide la red en segundo plano. Si la
// URL pedida no tiene copia exacta en caché y no hay red, antes se veía
// siempre un error en texto plano, aunque la app estuviera instalada. Ahora,
// para una navegación (abrir la app, no pedir un recurso suelto), se sirve el
// cascarón ya cacheado (index.html) en su lugar: importa sobre todo en
// Safari/iOS, donde la coincidencia de caché al reabrir la app puede no ser
// exacta (un hash o una ruta distinta de las que están en SHELL).
//
// sw.js se ejecuta tal cual con vm, con self/caches/fetch simulados, igual
// que tests/actualizacion.test.js hace con el registro del service worker.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const swSrc = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

function cargarSW({ cacheMatch, fetchImpl }) {
  const listeners = {};
  const puestos = [];
  const cache = {
    async match(req, opts) { return cacheMatch(req, opts); },
    async put(req) { puestos.push(typeof req === "string" ? req : req.url); },
  };
  const sandbox = {
    self: {
      addEventListener(ev, cb) { listeners[ev] = cb; },
      skipWaiting() {},
      clients: { claim() {} },
      location: { origin: "https://app.example" },
    },
    caches: { open: async () => cache },
    fetch: fetchImpl,
    URL,
    Response,
    console,
  };
  vm.runInNewContext(swSrc, sandbox);
  return { listeners, puestos };
}

function evento(request) {
  let respuesta;
  const esperas = [];
  const ev = {
    request,
    respondWith(p) { respuesta = p; },
    waitUntil(p) { esperas.push(p); },
  };
  return { ev, resultado: () => respuesta, esperar: () => Promise.all(esperas) };
}

test("navegación sin copia exacta en caché y sin red: sirve el cascarón (index.html)", async () => {
  const { listeners } = cargarSW({
    cacheMatch: async (req) => {
      const url = typeof req === "string" ? req : req.url;
      return url === "index.html" || url.endsWith("/index.html") ? "COPIA_INDEX" : undefined;
    },
    fetchImpl: async () => { throw new Error("sin red"); },
  });
  const request = { method: "GET", url: "https://app.example/una-ruta-que-no-esta-en-shell", mode: "navigate" };
  const { ev, resultado } = evento(request);
  listeners.fetch(ev);
  assert.equal(await resultado(), "COPIA_INDEX");
});

test("sin red ni copia de un recurso que no es de navegación: sigue dando el error en texto, no HTML", async () => {
  const { listeners } = cargarSW({
    cacheMatch: async () => undefined,
    fetchImpl: async () => { throw new Error("sin red"); },
  });
  const request = { method: "GET", url: "https://app.example/icons/no-existe.png", mode: "no-cors" };
  const { ev, resultado } = evento(request);
  listeners.fetch(ev);
  const res = await resultado();
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
});

test("navegación sin copia exacta ni copia del cascarón: no hay nada que servir, se mantiene el error", async () => {
  const { listeners } = cargarSW({
    cacheMatch: async () => undefined,
    fetchImpl: async () => { throw new Error("sin red"); },
  });
  const request = { method: "GET", url: "https://app.example/nunca-se-instaló", mode: "navigate" };
  const { ev, resultado } = evento(request);
  listeners.fetch(ev);
  const res = await resultado();
  assert.equal(res.status, 503);
});

test("con copia exacta en caché, el comportamiento normal no cambia (no mira el cascarón)", async () => {
  const { listeners } = cargarSW({
    cacheMatch: async (req) => {
      const url = typeof req === "string" ? req : req.url;
      return url.endsWith("/banco.js") ? "COPIA_BANCO" : undefined;
    },
    fetchImpl: async () => { throw new Error("sin red"); },
  });
  const request = { method: "GET", url: "https://app.example/banco.js", mode: "no-cors" };
  const { ev, resultado, esperar } = evento(request);
  listeners.fetch(ev);
  assert.equal(await resultado(), "COPIA_BANCO");
  await esperar();
});

test("una petición que no es GET no se intercepta", async () => {
  const { listeners } = cargarSW({ cacheMatch: async () => undefined, fetchImpl: async () => { throw new Error("no debería llamarse"); } });
  const request = { method: "POST", url: "https://app.example/algo", mode: "same-origin" };
  const { ev, resultado } = evento(request);
  listeners.fetch(ev);
  assert.equal(resultado(), undefined);
});
