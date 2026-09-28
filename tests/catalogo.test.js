const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Caracterización de datos: el catálogo TASKS y la lista TOPICS de
// index.html (leídos como texto, sin ejecutar el JSX) frente a las claves
// reales de banco.js y los formatos que de verdad consume el render.

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extraerTasks() {
  const m = html.match(/const TASKS = \[([\s\S]*?)\n\];/);
  assert.ok(m, "no se encontró el array TASKS en index.html");
  const bloques = [...m[1].matchAll(
    /\{\s*id: "([^"]+)", skill: "([^"]+)", name: "([^"]+)",\s*\n\s*real: "((?:[^"\\]|\\.)*)", format: "([^"]+)", mins: (\d+),/g
  )];
  return bloques.map((b) => ({
    id: b[1], skill: b[2], name: b[3], real: b[4], format: b[5], mins: Number(b[6]),
  }));
}

function extraerTopics() {
  const m = html.match(/const TOPICS = \[([\s\S]*?)\];/);
  assert.ok(m, "no se encontró el array TOPICS en index.html");
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
}

function clavesBanco() {
  const src = fs.readFileSync(path.join(__dirname, "..", "banco.js"), "utf8");
  const ctx = { window: {} };
  vm.runInNewContext(src, ctx);
  return Object.keys(ctx.window.BANK || {});
}

const FORMATOS_VALIDOS = new Set(["mcq", "fill", "order", "match", "write", "speak"]);
const SKILLS_VALIDAS = new Set(["core", "reading", "listening", "writing", "speaking"]);

const TASKS = extraerTasks();

test("TASKS: se extraen las 17 tareas del catálogo", () => {
  assert.equal(TASKS.length, 17);
});

test("TASKS: ids únicos", () => {
  const ids = TASKS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, `ids repetidos: ${ids.join(",")}`);
});

test("TASKS: name y real no están vacíos", () => {
  for (const t of TASKS) {
    assert.ok(t.name.trim(), `${t.id}: name vacío`);
    assert.ok(t.real.trim(), `${t.id}: real vacío`);
  }
});

test("TASKS: skill es una destreza válida", () => {
  for (const t of TASKS) {
    assert.ok(SKILLS_VALIDAS.has(t.skill), `${t.id}: skill desconocida "${t.skill}"`);
  }
});

test("TASKS: format es uno de los que de verdad renderiza index.html", () => {
  for (const t of TASKS) {
    assert.ok(FORMATOS_VALIDOS.has(t.format), `${t.id}: format desconocido "${t.format}"`);
  }
});

test("TASKS: mins es un entero positivo", () => {
  for (const t of TASKS) {
    assert.ok(Number.isInteger(t.mins) && t.mins > 0, `${t.id}: mins inválido (${t.mins})`);
  }
});

test("TASKS: cada id tiene su banco correspondiente en banco.js", () => {
  const claves = new Set(clavesBanco());
  for (const t of TASKS) {
    assert.ok(claves.has(t.id), `${t.id}: no existe window.BANK.${t.id}`);
  }
});

test("banco.js: no tiene claves de nivel superior que no use ninguna tarea", () => {
  const ids = new Set(TASKS.map((t) => t.id));
  for (const clave of clavesBanco()) {
    assert.ok(ids.has(clave), `banco.js define "${clave}" pero ninguna tarea de TASKS lo usa`);
  }
});

const TOPICS = extraerTopics();

test("TOPICS: no está vacío", () => {
  assert.ok(TOPICS.length > 0);
});

test("TOPICS: sin entradas vacías", () => {
  for (const t of TOPICS) assert.ok(t.trim(), "TOPICS contiene una entrada vacía");
});

test("TOPICS: sin duplicados", () => {
  assert.equal(new Set(TOPICS).size, TOPICS.length, "TOPICS tiene temas repetidos");
});
