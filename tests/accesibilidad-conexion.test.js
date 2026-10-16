// Accesibilidad de la pantalla de conexión (#setup): #epErr no tenía
// role="alert", así que un lector de pantalla no anunciaba los errores de
// conexión; y el botón #go pasa por disabled mientras comprueba el Worker
// (ver tests/comprobacion.test.js), lo que le hace perder el foco sin que
// nadie navegando con teclado o lector de pantalla sepa a dónde fue. Ahora
// el aviso lleva role="alert" y, al mostrar un error, recupera el foco en
// #epErr. No se puede requerir index.html (es una página,
// no un módulo), así que se extrae el click de #go como texto —igual que
// tests/valida-cfg.test.js hace con valida()— y se ejecuta con vm. No se
// modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("#epErr tiene role=\"alert\" para que los errores de conexión se anuncien solos", () => {
  const m = html.match(/<p id="epErr"[^>]*>/);
  assert.ok(m, "no se encontró #epErr en index.html");
  assert.match(m[0], /role="alert"/, "#epErr debe llevar role=\"alert\"");
  assert.match(m[0], /tabindex="-1"/, "#epErr debe ser enfocable por programa (tabindex=\"-1\")");
});

const m = html.match(/const goBtn = document\.getElementById\("go"\);[\s\S]*?\r?\n\r?\n {2}document\.getElementById\("free"\)/);
assert.ok(m, "no se encontró el click de #go en index.html");
const clickSrc = m[0].replace(/\r?\n {2}document\.getElementById\("free"\)$/, "");

function crearElemento(valorInicial = "") {
  let vecesEnfocado = 0;
  const listeners = {};
  return {
    value: valorInicial,
    textContent: "",
    disabled: false,
    addEventListener(ev, fn) { listeners[ev] = fn; },
    listeners,
    get vecesEnfocado() { return vecesEnfocado; },
    focus() { vecesEnfocado++; },
  };
}

function cargarClick({ fetchImpl, ep = "", eppass = "" }) {
  const elementos = {
    go: crearElemento(),
    ep: crearElemento(ep),
    eppass: crearElemento(eppass),
    epErr: crearElemento(),
  };
  let guardadoEn = null;
  let arrancadoCon = null;
  const sandbox = {
    document: {
      getElementById(id) { return elementos[id]; },
    },
    localStorage: { setItem(k, v) { guardadoEn = { k, v }; } },
    fetch: fetchImpl,
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    setTimeout,
    clearTimeout,
    mensajeDeComprobacion: require("../logica.js").mensajeDeComprobacion,
    start(cfg) { arrancadoCon = cfg; },
    CFG_KEY: "aptis-conexion",
  };
  vm.runInNewContext(clickSrc, sandbox);
  return {
    elementos,
    click: () => elementos.go.listeners.click(),
    guardado: () => guardadoEn,
    arranque: () => arrancadoCon,
  };
}

test("conexión rechazada por el Worker (401): el foco vuelve al aviso, no se guarda", async () => {
  const { elementos, click, guardado } = cargarClick({
    ep: "https://ejemplo.workers.dev",
    eppass: "mala",
    fetchImpl: async () => ({ status: 401, json: async () => ({ error: "Código de acceso incorrecto o dado de baja" }) }),
  });
  await click();
  assert.equal(elementos.epErr.textContent, "Código de acceso incorrecto o dado de baja");
  assert.equal(elementos.epErr.vecesEnfocado, 1, "el foco debe volver al aviso de error");
  assert.equal(guardado(), null, "no debe guardarse una conexión rechazada");
});

test("sin red o el Worker no responde: el foco vuelve al aviso", async () => {
  const { elementos, click, guardado } = cargarClick({
    ep: "https://ejemplo.workers.dev",
    fetchImpl: async () => { throw new Error("network error"); },
  });
  await click();
  assert.match(elementos.epErr.textContent, /no se pudo comprobar la conexión/i);
  assert.equal(elementos.epErr.vecesEnfocado, 1);
  assert.equal(guardado(), null);
});

test("conexión aceptada (200): no toca el foco del aviso y guarda", async () => {
  const { elementos, click, guardado, arranque } = cargarClick({
    ep: "https://ejemplo.workers.dev",
    eppass: "buena",
    fetchImpl: async () => ({ status: 200, json: async () => ({ plan: "personal" }) }),
  });
  await click();
  assert.equal(elementos.epErr.vecesEnfocado, 0);
  assert.ok(guardado(), "debe guardar la conexión comprobada");
  assert.equal(arranque().mode, "worker");
});

test("valor que no parece clave ni Worker: el foco va al campo, no al aviso de error", async () => {
  const { elementos, click } = cargarClick({ ep: "cualquier-cosa", fetchImpl: async () => { throw new Error("no debería llamarse"); } });
  await click();
  assert.match(elementos.epErr.textContent, /no parece una clave/i);
  assert.equal(elementos.ep.vecesEnfocado, 1, "el foco debe ir al campo de clave/Worker");
  assert.equal(elementos.epErr.vecesEnfocado, 0);
});
