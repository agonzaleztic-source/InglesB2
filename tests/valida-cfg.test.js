// Caracteriza valida(cfg) (index.html), la función que valida/normaliza la
// conexión guardada en localStorage al arrancar la app. No se puede requerir
// index.html (mezcla JSX en el mismo archivo), así que se extrae su código
// fuente como texto —igual que tests/delbanco.test.js hace con delBanco()—
// y se ejecuta con vm. No se modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const m = html.match(/function valida\(cfg\) \{[\s\S]*?\n  \}/);
assert.ok(m, "no se encontró valida(cfg) en index.html");
const validaSrc = m[0];

function cargarValida() {
  const sandbox = {};
  vm.runInNewContext(`${validaSrc}\nthis.valida = valida;`, sandbox);
  return sandbox.valida;
}

const valida = cargarValida();

test("valores no objeto o vacíos dan null", () => {
  assert.equal(valida(null), null);
  assert.equal(valida(undefined), null);
  assert.equal(valida(""), null);
  assert.equal(valida(0), null);
  assert.equal(valida("banco"), null);
  assert.equal(valida(42), null);
});

test("modo banco se acepta tal cual", () => {
  const cfg = { mode: "banco" };
  assert.equal(valida(cfg), cfg);
});

test("modo key con clave se acepta tal cual", () => {
  const cfg = { mode: "key", key: "sk-ant-123" };
  assert.equal(valida(cfg), cfg);
});

test("modo key sin clave se descarta", () => {
  assert.equal(valida({ mode: "key" }), null);
  assert.equal(valida({ mode: "key", key: "" }), null);
});

test("modo worker con endpoint se acepta tal cual", () => {
  const cfg = { mode: "worker", endpoint: "https://ejemplo.workers.dev" };
  assert.equal(valida(cfg), cfg);
});

test("modo worker sin endpoint se descarta", () => {
  assert.equal(valida({ mode: "worker" }), null);
  assert.equal(valida({ mode: "worker", endpoint: "" }), null);
});

test("formato antiguo (solo endpoint, sin mode) se normaliza a worker", () => {
  const resultado = valida({ endpoint: "https://viejo.workers.dev", pass: "1234" });
  assert.equal(resultado.mode, "worker");
  assert.equal(resultado.endpoint, "https://viejo.workers.dev");
  assert.equal(resultado.pass, "1234");
});

test("formato antiguo sin pass deja pass como undefined", () => {
  const resultado = valida({ endpoint: "https://viejo.workers.dev" });
  assert.equal(resultado.mode, "worker");
  assert.equal(resultado.endpoint, "https://viejo.workers.dev");
  assert.equal(resultado.pass, undefined);
});

test("mode desconocido y sin endpoint se descarta", () => {
  assert.equal(valida({ mode: "lo-que-sea" }), null);
  assert.equal(valida({ mode: "lo-que-sea", key: "sk-ant-123" }), null);
});

test("objeto vacío se descarta", () => {
  assert.equal(valida({}), null);
});
