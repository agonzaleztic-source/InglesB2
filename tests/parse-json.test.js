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

test("texto tras el JSON con corchetes sueltos no rompe el resultado", () => {
  const raw = 'Aquí tienes el JSON: {"ok":true}\nRecuerda revisar los corchetes [ ] antes de enviar.';
  assert.deepEqual(parseJSON(raw), { ok: true });
});

test("string con llaves dentro no corta el objeto antes de tiempo", () => {
  const raw = '{"code":"if (x) { return 1; }","n":2}';
  assert.deepEqual(parseJSON(raw), { code: "if (x) { return 1; }", n: 2 });
});

test("comillas escapadas dentro de un string no confunden el parseo", () => {
  const raw = '{"frase":"dijo \\"hola\\" y se fue"}';
  assert.deepEqual(parseJSON(raw), { frase: 'dijo "hola" y se fue' });
});

test("array con texto y corchetes después no rompe el resultado", () => {
  const raw = "Ejercicios: [1,2,3]\nUsa siempre [corchetes] al anotar.";
  assert.deepEqual(parseJSON(raw), [1, 2, 3]);
});

test("JSON sin cerrar aunque haya un corchete de cierre suelto más adelante lanza error", () => {
  assert.throws(() => parseJSON('{"a":1, "b": [1,2]\ny esto no cierra la llave'));
});

test("un corchete de cierre que no empareja con la llave abierta no corta el JSON ahí", () => {
  assert.throws(() => parseJSON('{"a":1]'), /JSON sin cerrar/);
});

test("una llave de cierre que no empareja con el corchete abierto no corta el JSON ahí", () => {
  assert.throws(() => parseJSON('[1,2}'), /JSON sin cerrar/);
});

test("un cierre desemparejado dentro de una lista anidada tampoco corta el JSON ahí", () => {
  const raw = "Aquí va el resultado: {\"a\":1,\"lista\":[1,2}\nFin.";
  assert.throws(() => parseJSON(raw), /JSON sin cerrar/);
});
