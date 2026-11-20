// Antes, un fallo al renderizar cualquier pantalla (un ejercicio con datos
// raros, un bug) tumbaba todo el árbol de React y dejaba la app en blanco sin
// ninguna explicación: la única salida, sin saberlo, era el botón «cambiar
// conexión» de index.html, que vive fuera de ese árbol. ErrorBoundary (al
// final de src/app.jsx, envolviendo <App/>) ahora muestra un aviso claro con
// un botón para recargar y devuelve el foco a ese aviso. Se extrae la clase
// ya compilada de app.js (sin JSX, código normal) y se ejecuta con vm contra
// un React mínimo, igual que tests/almacenamiento.test.js hace con save().
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");

const m = app.match(/class ErrorBoundary extends React\.Component \{[\s\S]*?\n\}\n(?=const root)/);
assert.ok(m, "no se encontró class ErrorBoundary en app.js (¿se ejecutó npm run build?)");
const claseSrc = m[0];

assert.match(app, /root\.render\(\/\* @__PURE__ \*\/ React\.createElement\(ErrorBoundary, null, \/\* @__PURE__ \*\/ React\.createElement\(App, null\)\)\);/,
  "<App/> debe renderizarse dentro de <ErrorBoundary>");

function crearSandbox() {
  class Component {
    constructor(props) { this.props = props; }
  }
  const errores = [];
  let recargas = 0;
  const sandbox = {
    React: {
      Component,
      createElement(type, props, ...children) { return { type, props, children }; },
      createRef() { return { current: null }; },
    },
    location: { reload() { recargas++; } },
    console: { error(...a) { errores.push(a); } },
  };
  vm.runInNewContext(`${claseSrc}\nthis.ErrorBoundary = ErrorBoundary;`, sandbox);
  return { ErrorBoundary: sandbox.ErrorBoundary, errores, recargas: () => recargas };
}

test("sin error, ErrorBoundary.render() devuelve los hijos tal cual", () => {
  const { ErrorBoundary } = crearSandbox();
  const inst = new ErrorBoundary({ children: "hijo" });
  assert.equal(inst.render(), "hijo");
});

test("getDerivedStateFromError guarda el error en el estado", () => {
  const { ErrorBoundary } = crearSandbox();
  const err = new Error("boom");
  const estado = ErrorBoundary.getDerivedStateFromError(err);
  assert.equal(estado.error, err);
  assert.deepEqual(Object.keys(estado), ["error"]);
});

test("componentDidCatch registra el error sin relanzarlo", () => {
  const { ErrorBoundary, errores } = crearSandbox();
  const inst = new ErrorBoundary({ children: "hijo" });
  assert.doesNotThrow(() => inst.componentDidCatch(new Error("boom"), { componentStack: "x" }));
  assert.equal(errores.length, 1);
});

test("con error, el aviso lleva role=alert, un encabezado enfocable y un botón que recarga", () => {
  const { ErrorBoundary, recargas } = crearSandbox();
  const inst = new ErrorBoundary({ children: "hijo" });
  inst.state = ErrorBoundary.getDerivedStateFromError(new Error("boom"));

  const el = inst.render();
  assert.equal(el.type, "div");
  assert.equal(el.props.role, "alert");

  const [h1, , boton] = el.children;
  assert.equal(h1.type, "h1");
  assert.equal(h1.props.tabIndex, -1, "el encabezado debe poder recibir el foco");
  assert.equal(h1.props.ref, inst.headingRef, "el ref del encabezado debe ser el que usa componentDidUpdate");

  assert.equal(boton.type, "button");
  assert.equal(recargas(), 0);
  boton.props.onClick();
  assert.equal(recargas(), 1, "el botón debe recargar la página");
});

test("componentDidUpdate enfoca el encabezado una sola vez", () => {
  const { ErrorBoundary } = crearSandbox();
  const inst = new ErrorBoundary({ children: "hijo" });
  inst.state = ErrorBoundary.getDerivedStateFromError(new Error("boom"));
  inst.render();

  let foco = 0;
  inst.headingRef.current = { focus() { foco++; } };
  inst.componentDidUpdate();
  inst.componentDidUpdate();
  assert.equal(foco, 1, "no debe robar el foco en cada actualización, solo la primera vez");
});

test("sin error, componentDidUpdate no toca el foco", () => {
  const { ErrorBoundary } = crearSandbox();
  const inst = new ErrorBoundary({ children: "hijo" });
  let foco = 0;
  inst.headingRef.current = { focus() { foco++; } };
  inst.componentDidUpdate();
  assert.equal(foco, 0);
});
