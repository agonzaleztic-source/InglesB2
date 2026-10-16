// Antes, un localStorage que lanza al guardar (Safari en privado, cuota
// llena, navegador que lo bloquea) dejaba la app clavada en la pantalla de
// conexión sin explicación: setItem/removeItem no estaban protegidos. Ahora
// se envuelven en try/catch y, si fallan, se avisa una vez y se arranca
// igual con la configuración en memoria. No se puede requerir index.html
// (es una página, no un módulo), así que se extrae su código fuente como
// texto —igual que tests/delbanco.test.js hace con delBanco()— y se ejecuta
// con vm. No se modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
// save() y STORE son código de la app: viven en src/app.jsx, no en index.html.
const app = fs.readFileSync(path.join(ROOT, "src", "app.jsx"), "utf8");

function extraer(regex, nombre, texto = html, fichero = "index.html") {
  const m = texto.match(regex);
  assert.ok(m, `no se encontró ${nombre} en ${fichero}`);
  return m[0];
}

// El script de arranque completo, sin start(cfg): esa función crea el <script>
// de la app (app.js) y no hace falta para probar cómo se guarda/borra la
// conexión. Al quitarla, la llamada a start(...) que queda en el código
// resuelve contra el start que inyecta el sandbox de cada test.
const scriptCompleto = extraer(/<script>\r?\n  const CFG_KEY[\s\S]*?\r?\n<\/script>/, "script de arranque");
const scriptSinStart = scriptCompleto
  .replace(/^<script>\r?\n/, "")
  .replace(/\r?\n<\/script>$/, "")
  .replace(/  function start\(cfg\) \{\r?\n[\s\S]*?\r?\n  \}\r?\n/, "");
assert.ok(!/function start/.test(scriptSinStart), "no se pudo quitar function start(cfg) del script extraído");

function crearElemento() {
  let mostrado = 0;
  return {
    get vecesMostrado() { return mostrado; },
    style: {
      _display: "",
      set display(v) { if (v === "block") mostrado++; this._display = v; },
      get display() { return this._display; },
    },
    value: "",
    disabled: false,
    textContent: "",
    listeners: {},
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
    focus() {},
  };
}

function crearLocalStorage({ setItemLanza = false, removeItemLanza = false } = {}) {
  const datos = {};
  return {
    datos,
    getItem(k) { return Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null; },
    setItem(k, v) {
      if (setItemLanza) throw new Error("QuotaExceededError");
      datos[k] = v;
    },
    removeItem(k) {
      if (removeItemLanza) throw new Error("no se puede borrar");
      delete datos[k];
    },
  };
}

// cfg lo crea código que corre en el vm (otro realm): assert.deepEqual exige
// el mismo prototipo de Object, así que se compara la forma con JSON.
const comoPlano = (v) => JSON.parse(JSON.stringify(v));

function cargarArranque({ localStorageImpl, startSpy = () => {} }) {
  const elementos = {};
  for (const id of ["setup", "reset", "epPassWrap", "ep", "eppass", "epErr", "go", "free", "avisoAlmacenamiento"]) {
    elementos[id] = crearElemento();
  }
  let recargas = 0;
  const sandbox = {
    document: {
      getElementById(id) { return elementos[id]; },
      addEventListener() {},
      createElement() { return crearElemento(); },
      body: { appendChild() {} },
    },
    localStorage: localStorageImpl,
    location: { hash: "", pathname: "/index.html", search: "", protocol: "https:", reload() { recargas++; } },
    history: { replaceState() {} },
    navigator: {},
    window: {},
    start: startSpy,
    console,
  };
  vm.runInNewContext(scriptSinStart, sandbox);
  return { elementos, recargas: () => recargas };
}

test("arranque: con localStorage normal, #free guarda la conexión y no avisa", async () => {
  const ls = crearLocalStorage();
  let llamadoCon = null;
  const { elementos } = cargarArranque({ localStorageImpl: ls, startSpy: (cfg) => { llamadoCon = cfg; } });
  await elementos.free.listeners.click();
  assert.deepEqual(comoPlano(llamadoCon), { mode: "banco" });
  assert.deepEqual(JSON.parse(ls.datos["aptis-conexion"]), { mode: "banco" });
  assert.equal(elementos.avisoAlmacenamiento.vecesMostrado, 0);
});

test("arranque: si setItem lanza al pulsar #free, arranca igual y avisa una vez", async () => {
  const ls = crearLocalStorage({ setItemLanza: true });
  let llamadoCon = null;
  const { elementos } = cargarArranque({ localStorageImpl: ls, startSpy: (cfg) => { llamadoCon = cfg; } });
  await elementos.free.listeners.click();
  assert.deepEqual(comoPlano(llamadoCon), { mode: "banco" }, "debe arrancar aunque no se pudiera guardar");
  assert.equal(elementos.avisoAlmacenamiento.vecesMostrado, 1);
});

test("arranque: si setItem lanza al pulsar #go con una clave, arranca igual y avisa una vez", async () => {
  const ls = crearLocalStorage({ setItemLanza: true });
  let llamadoCon = null;
  const { elementos } = cargarArranque({ localStorageImpl: ls, startSpy: (cfg) => { llamadoCon = cfg; } });
  elementos.ep.value = "sk-ant-abc123";
  await elementos.go.listeners.click();
  assert.deepEqual(comoPlano(llamadoCon), { mode: "key", key: "sk-ant-abc123" });
  assert.equal(elementos.avisoAlmacenamiento.vecesMostrado, 1);
});

test("arranque: el aviso no se repite aunque fallen varios intentos", async () => {
  const ls = crearLocalStorage({ setItemLanza: true });
  const { elementos } = cargarArranque({ localStorageImpl: ls });
  await elementos.free.listeners.click();
  elementos.ep.value = "sk-ant-otra";
  await elementos.go.listeners.click();
  assert.equal(elementos.avisoAlmacenamiento.vecesMostrado, 1, "la franja solo debe mostrarse una vez por sesión");
});

test("arranque: #reset no rompe si removeItem lanza, y recarga igual", async () => {
  const ls = crearLocalStorage({ removeItemLanza: true });
  const { elementos, recargas } = cargarArranque({ localStorageImpl: ls });
  await elementos.reset.listeners.click();
  assert.equal(recargas(), 1, "debe recargar aunque no se pudiera borrar la conexión guardada");
  assert.equal(elementos.avisoAlmacenamiento.vecesMostrado, 1);
});

test("arranque: una conexión guardada con formato inválido se descarta y, si removeItem lanza, avisa", () => {
  const ls = crearLocalStorage({ removeItemLanza: true });
  ls.datos["aptis-conexion"] = JSON.stringify({ mode: "lo-que-sea" });
  const { elementos } = cargarArranque({ localStorageImpl: ls });
  assert.equal(elementos.avisoAlmacenamiento.vecesMostrado, 1);
});

const storeSrc = extraer(/const STORE = "[^"]+";/, "STORE", app, "src/app.jsx");
const saveSrc = extraer(/async function save\(s\) \{\r?\n[\s\S]*?\r?\n\}/, "save(s)", app, "src/app.jsx");

function cargarSave({ localStorageImpl, avisoSpy = () => {} }) {
  const sandbox = { localStorage: localStorageImpl, console, avisoAlmacenamiento: avisoSpy };
  vm.runInNewContext(`${storeSrc}\n${saveSrc}\nthis.save = save;`, sandbox);
  return sandbox.save;
}

test("save(): con localStorage normal, guarda sin avisar", async () => {
  const ls = crearLocalStorage();
  let avisos = 0;
  const save = cargarSave({ localStorageImpl: ls, avisoSpy: () => { avisos++; } });
  await save({ days: {} });
  assert.equal(avisos, 0);
  assert.ok(ls.datos["aptis-general-b2"]);
});

test("save(): si setItem lanza, no propaga el error y avisa", async () => {
  const ls = crearLocalStorage({ setItemLanza: true });
  let avisos = 0;
  const save = cargarSave({ localStorageImpl: ls, avisoSpy: () => { avisos++; } });
  await assert.doesNotReject(save({ days: {} }));
  assert.equal(avisos, 1);
});
