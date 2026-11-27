// cache.addAll() en el evento "install" de sw.js es todo o nada: si al
// pedir una sola URL de SHELL falla (una red intermitente, lo normal en
// móvil), ninguna se llega a cachear y el modo sin clave se queda sin
// funcionar sin conexión, aunque casi todo lo demás se hubiera podido
// descargar bien. Ahora se pide cada URL por separado con cache.add() y se
// espera con Promise.allSettled: un fallo puntual no impide cachear el
// resto ni que el service worker termine de instalarse.
//
// sw.js se ejecuta tal cual con vm, con self/caches simulados, igual que
// tests/sw-offline.test.js y tests/actualizacion.test.js.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const swSrc = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");

function cargarSW({ addImpl }) {
  const listeners = {};
  const añadidos = [];
  let skipWaitingLlamado = false;
  const cache = {
    async add(url) {
      añadidos.push(url);
      return addImpl(url);
    },
  };
  const sandbox = {
    self: {
      addEventListener(ev, cb) { listeners[ev] = cb; },
      skipWaiting() { skipWaitingLlamado = true; },
      clients: { claim() {} },
      location: { origin: "https://app.example" },
    },
    caches: { open: async () => cache },
    fetch: async () => { throw new Error("no debería llamarse en install"); },
    URL,
    Response,
    console,
  };
  vm.runInNewContext(swSrc, sandbox);
  return {
    listeners,
    añadidos,
    skipWaitingLlamado: () => skipWaitingLlamado,
  };
}

function instalar(listeners) {
  const esperas = [];
  const ev = { waitUntil(p) { esperas.push(p); } };
  listeners.install(ev);
  return Promise.all(esperas);
}

test("install: cachea cada URL de SHELL por separado, no con addAll", async () => {
  const sw = cargarSW({ addImpl: async () => {} });
  await instalar(sw.listeners);
  assert.ok(sw.añadidos.length > 1, "debería haber más de una URL en SHELL");
  assert.ok(sw.añadidos.includes("index.html"));
  assert.ok(sw.añadidos.includes("app.js"));
});

test("install: si una sola URL falla, el resto se sigue cacheando y el service worker termina de instalarse", async () => {
  const sw = cargarSW({
    addImpl: async (url) => { if (url === "banco.js") throw new Error("sin red para banco.js"); },
  });
  await assert.doesNotReject(() => instalar(sw.listeners));
  assert.ok(sw.añadidos.includes("banco.js"), "se intenta cachear igual, aunque falle");
  assert.ok(sw.añadidos.includes("app.js"), "el resto de SHELL se pide igualmente");
  assert.ok(sw.skipWaitingLlamado(), "install() se completa (self.skipWaiting()) aunque un recurso falle");
});

test("install: si todas las URL fallan, el service worker igualmente termina de instalarse (sin rechazar)", async () => {
  const sw = cargarSW({ addImpl: async () => { throw new Error("sin red"); } });
  await assert.doesNotReject(() => instalar(sw.listeners));
  assert.ok(sw.skipWaitingLlamado());
});
