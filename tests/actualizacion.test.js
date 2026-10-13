// sw.js sirve primero la caché y actualiza en segundo plano (self.skipWaiting()):
// quien tiene la app abierta no se entera de una versión nueva hasta la
// siguiente carga, y nadie se lo dice. Comprueba que index.html avisa con una
// franja fija y un botón «Actualizar», solo cuando ya había una versión
// anterior (no en la primera instalación). No se puede requerir index.html
// (mezcla JSX en el mismo fichero), así que el registro del service worker se
// extrae como texto —igual que tests/valida-cfg.test.js hace con valida()— y
// se ejecuta con vm contra un navigator.serviceWorker simulado.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { debeAvisarNuevaVersion } = require("../logica.js");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

test("debeAvisarNuevaVersion: avisa solo si ya había controlador y el worker nuevo quedó instalado", () => {
  assert.equal(debeAvisarNuevaVersion(true, "installed"), true);
  assert.equal(debeAvisarNuevaVersion(false, "installed"), false, "primera instalación: nada que actualizar");
  assert.equal(debeAvisarNuevaVersion(true, "installing"), false, "todavía no ha terminado de instalarse");
  assert.equal(debeAvisarNuevaVersion(true, "activated"), false, "el aviso se dispara en 'installed', no después");
  assert.equal(debeAvisarNuevaVersion(false, "activated"), false);
});

test("index.html tiene una única franja de aviso de actualización con su botón", () => {
  const franjas = [...html.matchAll(/<div id="avisoActualizacion"[^>]*>/g)];
  assert.equal(franjas.length, 1, "debe haber exactamente una #avisoActualizacion");
  const botones = [...html.matchAll(/<button id="actualizarBtn"[^>]*>/g)];
  assert.equal(botones.length, 1, "debe haber exactamente un #actualizarBtn");
});

test("la franja de actualización va fija arriba, no abajo donde está «cambiar conexión»", () => {
  const m = html.match(/#avisoActualizacion\{([^}]*)\}/);
  assert.ok(m, "no se encontró el estilo de #avisoActualizacion");
  assert.match(m[1], /top:\s*0\b/, "debe anclarse arriba");
  assert.doesNotMatch(m[1], /\bbottom\s*:/, "no debe competir con #reset, que está fijo abajo");
});

// El registro del service worker: desde "function avisoActualizacionMostrar"
// hasta el cierre del bloque "if (serviceWorker...)", justo antes de
// </script>. No se modifica index.html.
const m = html.match(/function avisoActualizacionMostrar\(\) \{[\s\S]*?\r?\n {2}\}\r?\n<\/script>/);
assert.ok(m, "no se encontró el registro del service worker en index.html");
const scriptSrc = m[0].replace(/\r?\n<\/script>$/, "");

function crearElemento() {
  let mostrado = 0;
  const listeners = {};
  return {
    get vecesMostrado() { return mostrado; },
    style: {
      _display: "",
      set display(v) { if (v === "block") mostrado++; this._display = v; },
      get display() { return this._display; },
    },
    listeners,
    addEventListener(ev, fn) { listeners[ev] = fn; },
  };
}

function crearWorkerInstalando() {
  const listeners = [];
  return {
    state: "installing",
    addEventListener(ev, cb) { if (ev === "statechange") listeners.push(cb); },
    cambiarEstado(estado) { this.state = estado; for (const cb of listeners) cb(); },
  };
}

function crearServiceWorker(controladorInicial) {
  const listenersControllerChange = [];
  const listenersUpdateFound = [];
  const reg = {
    installing: null,
    addEventListener(ev, cb) { if (ev === "updatefound") listenersUpdateFound.push(cb); },
    dispararUpdateFound() { for (const cb of listenersUpdateFound) cb(); },
  };
  return {
    controller: controladorInicial,
    register() { return Promise.resolve(reg); },
    addEventListener(ev, cb) { if (ev === "controllerchange") listenersControllerChange.push(cb); },
    dispararControllerChange() { for (const cb of listenersControllerChange) cb(); },
    reg,
  };
}

function cargarArranque(habiaControladorInicial) {
  const elementos = { avisoActualizacion: crearElemento(), actualizarBtn: crearElemento() };
  const sw = crearServiceWorker(habiaControladorInicial ? {} : null);
  let recargas = 0;
  let loadCb = null;
  const sandbox = {
    document: { getElementById(id) { return elementos[id]; } },
    navigator: { serviceWorker: sw },
    window: { addEventListener(ev, cb) { if (ev === "load") loadCb = cb; } },
    location: { protocol: "https:", reload() { recargas++; } },
    console,
    debeAvisarNuevaVersion,
  };
  vm.runInNewContext(scriptSrc, sandbox);
  return {
    elementos,
    sw,
    recargas: () => recargas,
    dispararLoad: async () => { loadCb(); await Promise.resolve(); await Promise.resolve(); },
  };
}

test("primera visita (sin controlador previo): el worker se instala pero no avisa", async () => {
  const { elementos, sw, dispararLoad } = cargarArranque(false);
  await dispararLoad();
  const nuevo = crearWorkerInstalando();
  sw.reg.installing = nuevo;
  sw.reg.dispararUpdateFound();
  nuevo.cambiarEstado("installed");
  assert.equal(elementos.avisoActualizacion.vecesMostrado, 0);
});

test("visita con una versión anterior: al terminar de instalarse la nueva, avisa", async () => {
  const { elementos, sw, dispararLoad } = cargarArranque(true);
  await dispararLoad();
  const nuevo = crearWorkerInstalando();
  sw.reg.installing = nuevo;
  sw.reg.dispararUpdateFound();
  nuevo.cambiarEstado("installing");
  assert.equal(elementos.avisoActualizacion.vecesMostrado, 0, "todavía no debe avisar");
  nuevo.cambiarEstado("installed");
  assert.equal(elementos.avisoActualizacion.vecesMostrado, 1);
});

test("controllerchange con controlador previo también avisa", async () => {
  const { elementos, sw, dispararLoad } = cargarArranque(true);
  await dispararLoad();
  sw.dispararControllerChange();
  assert.equal(elementos.avisoActualizacion.vecesMostrado, 1);
});

test("controllerchange en la primera instalación no avisa", async () => {
  const { elementos, sw, dispararLoad } = cargarArranque(false);
  await dispararLoad();
  sw.dispararControllerChange();
  assert.equal(elementos.avisoActualizacion.vecesMostrado, 0);
});

test("el botón Actualizar recarga la página", async () => {
  const { elementos, recargas } = cargarArranque(true);
  elementos.actualizarBtn.listeners.click();
  assert.equal(recargas(), 1);
});
