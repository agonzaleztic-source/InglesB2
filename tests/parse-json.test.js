const { test } = require("node:test");
const assert = require("node:assert/strict");
const parseJSON = require("../parse-json.js");

test("objeto simple sin vallas", () => {
  assert.deepEqual(parseJSON('{"a":1}'), { a: 1 });
});

test("array simple sin vallas", () => {
  assert.deepEqual(parseJSON("[1,2,3]"), [1, 2, 3]);
});

test("vallas ```json alrededor de un objeto", () => {
  const raw = "```json\n{\"a\":1,\"b\":2}\n```";
  assert.deepEqual(parseJSON(raw), { a: 1, b: 2 });
});

test("vallas ``` sin la palabra json", () => {
  const raw = "```\n[1,2]\n```";
  assert.deepEqual(parseJSON(raw), [1, 2]);
});

test("texto explicativo alrededor del JSON", () => {
  const raw = "Aquí tienes el resultado:\n{\"ok\":true}\nEspero que te sirva.";
  assert.deepEqual(parseJSON(raw), { ok: true });
});

test("objeto con llaves anidadas", () => {
  const raw = '{"a":{"b":{"c":[1,2,{"d":3}]}}}';
  assert.deepEqual(parseJSON(raw), { a: { b: { c: [1, 2, { d: 3 }] } } });
});

test("array de objetos anidados con texto alrededor", () => {
  const raw = "Ejercicios:\n```json\n[{\"id\":1},{\"id\":2}]\n```\nFin.";
  assert.deepEqual(parseJSON(raw), [{ id: 1 }, { id: 2 }]);
});

test("sin JSON en el texto lanza error", () => {
  assert.throws(() => parseJSON("esto no tiene json en absoluto"));
});

test("JSON truncado lanza error", () => {
  assert.throws(() => parseJSON('{"a":1,"b":'));
});

test("salida vacía lanza error", () => {
  assert.throws(() => parseJSON(""));
});
