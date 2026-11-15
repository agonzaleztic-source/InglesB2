// avisoSinConexion() decide si App debe mostrar el aviso de que no hay
// conexión. El modo "banco" (gratuito, sin cuenta) no necesita red, así que
// nunca avisa; los modos "key" y "worker" sí, porque piden la corrección a
// un servidor.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { avisoSinConexion } = require("../logica.js");

test("avisoSinConexion: con conexión no hay nada que avisar, sea el modo que sea", () => {
  assert.equal(avisoSinConexion("key", true), null);
  assert.equal(avisoSinConexion("worker", true), null);
  assert.equal(avisoSinConexion("banco", true), null);
});

test("avisoSinConexion: sin conexión en modo banco tampoco avisa (no necesita red)", () => {
  assert.equal(avisoSinConexion("banco", false), null);
});

test("avisoSinConexion: sin conexión en modo key o worker devuelve un texto", () => {
  assert.equal(typeof avisoSinConexion("key", false), "string");
  assert.equal(typeof avisoSinConexion("worker", false), "string");
});

test("avisoSinConexion: el texto no da por hecho que no se puede seguir practicando", () => {
  const texto = avisoSinConexion("worker", false);
  assert.match(texto, /sin conexión/i);
  assert.doesNotMatch(texto, /no puedes practicar/i);
});
