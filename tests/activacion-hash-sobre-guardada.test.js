// El enlace de activación del email (#worker=<url>) debe ganar siempre a una
// conexión ya guardada en localStorage: quien lo recibe puede venir del modo
// gratis sin clave o de una suscripción anterior con otro código, y el hash
// se borra de la URL en cuanto se lee (workerDeHash(), en index.html), así
// que no hay una segunda oportunidad si se ignora aquí. Antes de este cambio,
// `if (guardada) start(guardada)` ignoraba el hash entero cuando ya había una
// conexión guardada. No se puede requerir index.html (es una página, no un
// módulo), así que se extrae el arranque como texto —igual que
// tests/valida-cfg.test.js hace con valida()— y se ejecuta con vm. No se
// modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const m = html.match(/function valida\(cfg\) \{[\s\S]*?\r?\n {2}\}\r?\n\r?\n {2}\/\/ Service worker:/);
assert.ok(m, "no se encontró el arranque (valida/guardada/workerDeHash) en index.html");
const bloqueSrc = m[0].replace(/\r?\n\r?\n {2}\/\/ Service worker:$/, "");

function crearElemento(valorInicial = "") {
  let valor = valorInicial;
  let vecesEnfocado = 0;
  return {
    get value() { return valor; },
    set value(v) { valor = v; },
    style: { display: "none" },
    focus() { vecesEnfocado++; },
    get vecesEnfocado() { return vecesEnfocado; },
  };
}

function cargarArranque({ hash = "", guardadaEnDisco = null, falloLocalStorage = false }) {
  const elementos = { ep: crearElemento(), eppass: crearElemento() };
  const setup = { style: { display: "none" } };
  const passWrap = { style: { display: "none" } };
  const listenersDOMContentLoaded = [];
  let arrancadoCon = null;
  let borrado = false;
  let avisoAlmacenamientoLlamado = false;
  let nuevaUrl = null;

  const sandbox = {
    document: {
      getElementById(id) { return elementos[id]; },
      addEventListener(ev, fn) { if (ev === "DOMContentLoaded") listenersDOMContentLoaded.push(fn); },
    },
    localStorage: {
      getItem(k) {
        if (falloLocalStorage) throw new Error("bloqueado");
        return k === "aptis-conexion" && guardadaEnDisco ? JSON.stringify(guardadaEnDisco) : null;
      },
      removeItem() { if (falloLocalStorage) throw new Error("bloqueado"); borrado = true; },
    },
    location: { hash, pathname: "/", search: "" },
    history: { replaceState(_s, _t, url) { nuevaUrl = url; } },
    setup,
    passWrap,
    CFG_KEY: "aptis-conexion",
    avisoAlmacenamiento() { avisoAlmacenamientoLlamado = true; },
    start(cfg) { arrancadoCon = cfg; },
  };
  vm.runInNewContext(bloqueSrc, sandbox);
  listenersDOMContentLoaded.forEach((fn) => fn());
  return {
    elementos, setup,
    arranque: () => arrancadoCon,
    fueBorrado: () => borrado,
    avisoAlmacenamientoLlamado: () => avisoAlmacenamientoLlamado,
    hashLimpiado: () => nuevaUrl,
  };
}

test("sin hash y sin conexión guardada: se queda en la pantalla de conexión vacía", () => {
  const { setup, elementos, arranque } = cargarArranque({});
  assert.equal(setup.style.display, "block");
  assert.equal(elementos.ep.value, "");
  assert.equal(arranque(), null);
});

test("sin hash y con conexión guardada: arranca directo con ella, sin mostrar la pantalla", () => {
  const cfg = { mode: "key", key: "sk-ant-123" };
  const { setup, arranque } = cargarArranque({ guardadaEnDisco: cfg });
  assert.equal(setup.style.display, "none");
  // El objeto viene de JSON.parse() dentro del contexto vm (otro realm): se
  // compara por campos, no por igualdad profunda, igual que hace
  // tests/accesibilidad-conexion.test.js con arranque().mode.
  assert.equal(arranque().mode, "key");
  assert.equal(arranque().key, "sk-ant-123");
});

test("enlace de activación sin conexión guardada: precarga el Worker y enfoca el código", () => {
  const { setup, elementos, arranque } = cargarArranque({
    hash: "#worker=" + encodeURIComponent("https://nuevo.workers.dev"),
  });
  assert.equal(setup.style.display, "block");
  assert.equal(elementos.ep.value, "https://nuevo.workers.dev");
  assert.equal(elementos.eppass.vecesEnfocado, 1);
  assert.equal(arranque(), null, "no debe arrancar solo: espera a que se pegue el código y se pulse el botón");
});

test("enlace de activación con una conexión gratis (banco) ya guardada: el enlace manda, no el modo gratis", () => {
  const { setup, elementos, arranque } = cargarArranque({
    hash: "#worker=" + encodeURIComponent("https://nuevo.workers.dev"),
    guardadaEnDisco: { mode: "banco" },
  });
  assert.equal(setup.style.display, "block", "debe mostrar la pantalla de conexión, no arrancar en modo gratis");
  assert.equal(elementos.ep.value, "https://nuevo.workers.dev");
  assert.equal(arranque(), null);
});

test("enlace de activación con un Worker antiguo ya guardado: el enlace manda, no el código caducado", () => {
  const vieja = { mode: "worker", endpoint: "https://viejo.workers.dev", pass: "1234" };
  const { setup, elementos, arranque } = cargarArranque({
    hash: "#worker=" + encodeURIComponent("https://nuevo.workers.dev"),
    guardadaEnDisco: vieja,
  });
  assert.equal(setup.style.display, "block");
  assert.equal(elementos.ep.value, "https://nuevo.workers.dev", "no debe quedarse con el endpoint antiguo");
  assert.equal(arranque(), null, "no debe arrancar sola con la conexión vieja");
});

test("un hash que no es #worker=... no cuenta como enlace de activación", () => {
  const { setup, arranque } = cargarArranque({ hash: "#otracosa", guardadaEnDisco: { mode: "banco" } });
  assert.equal(setup.style.display, "none");
  assert.equal(arranque().mode, "banco");
});
