// Caracteriza shuffle() y pick() (index.html), los dos ayudantes de azar que
// usa delBanco() para no repetir ejercicios en modo sin clave. No se puede
// requerir index.html (mezcla JSX en el mismo <script>), así que se extrae
// su código fuente como texto —igual que tests/delbanco.test.js— y se
// ejecuta con vm. No se modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function extraerLinea(regex, nombre) {
  const m = html.match(regex);
  assert.ok(m, `no se encontró ${nombre} en index.html`);
  return m[0];
}

const shuffleSrc = extraerLinea(/const shuffle = \(a\) => [^\n]+;/, "shuffle");
const pickSrc = extraerLinea(/const pick = \(a\) => [^\n]+;/, "pick");

const sandbox = {};
vm.runInNewContext(`${shuffleSrc}\n${pickSrc}\nthis.shuffle = shuffle; this.pick = pick;`, sandbox);
const { shuffle, pick } = sandbox;

test("shuffle: devuelve los mismos elementos, en algún orden", () => {
  const a = [1, 2, 3, 4, 5];
  const barajado = shuffle(a);
  assert.equal(barajado.length, a.length);
  assert.deepEqual([...barajado].sort(), [...a].sort());
});

test("shuffle: no muta el array original", () => {
  const a = [1, 2, 3, 4, 5];
  const copia = [...a];
  shuffle(a);
  assert.deepEqual(a, copia);
});

test("shuffle: con un array vacío devuelve un array vacío", () => {
  assert.deepEqual(shuffle([]), []);
});

test("shuffle: con un solo elemento lo devuelve igual", () => {
  assert.deepEqual(shuffle([42]), [42]);
});

test("shuffle: conserva referencias de objeto, no copias", () => {
  const o1 = { id: 1 };
  const o2 = { id: 2 };
  const barajado = shuffle([o1, o2]);
  assert.ok(barajado.includes(o1));
  assert.ok(barajado.includes(o2));
});

test("pick: devuelve siempre un elemento del propio array", () => {
  const a = ["a", "b", "c"];
  for (let i = 0; i < 20; i++) {
    assert.ok(a.includes(pick(a)), "pick debe devolver un elemento del array");
  }
});

test("pick: con un solo elemento lo devuelve siempre", () => {
  assert.equal(pick(["único"]), "único");
});

test("pick: con un array vacío devuelve undefined en vez de lanzar", () => {
  assert.equal(pick([]), undefined);
});
