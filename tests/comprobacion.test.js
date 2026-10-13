// mensajeDeComprobacion(status, cuerpo) decide qué mostrar en #epErr cuando
// index.html comprueba un Worker con POST /me antes de guardarlo (ver el
// click de #go). null significa "guardar y seguir"; un texto es el aviso.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mensajeDeComprobacion } = require("../logica.js");

test("mensajeDeComprobacion: 200 no da ningún mensaje", () => {
  assert.equal(mensajeDeComprobacion(200, { plan: "personal" }), null);
  assert.equal(mensajeDeComprobacion(200, null), null);
});

test("mensajeDeComprobacion: usa el motivo que manda el Worker", () => {
  assert.equal(
    mensajeDeComprobacion(401, { error: "Código de acceso incorrecto o dado de baja" }),
    "Código de acceso incorrecto o dado de baja",
  );
  assert.equal(
    mensajeDeComprobacion(403, { error: "Origen no autorizado" }),
    "Origen no autorizado",
  );
});

test("mensajeDeComprobacion: sin cuerpo JSON reconocible, usa un mensaje genérico con el código", () => {
  assert.equal(mensajeDeComprobacion(500, null), "No se pudo comprobar el código de acceso (error 500).");
  assert.equal(mensajeDeComprobacion(404, {}), "No se pudo comprobar el código de acceso (error 404).");
});

test("mensajeDeComprobacion: un error vacío o no textual tampoco se usa", () => {
  assert.equal(mensajeDeComprobacion(400, { error: "" }), "No se pudo comprobar el código de acceso (error 400).");
  assert.equal(mensajeDeComprobacion(400, { error: 123 }), "No se pudo comprobar el código de acceso (error 400).");
});
