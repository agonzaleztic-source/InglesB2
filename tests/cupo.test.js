const { test } = require("node:test");
const assert = require("node:assert/strict");
const { cupoDeCabeceras } = require("../logica.js");

const cabeceras = (obj) => (h) => (h in obj ? obj[h] : null);

test("cupoDeCabeceras: con cabeceras válidas calcula lo que queda", () => {
  const cupo = cupoDeCabeceras(cabeceras({ "x-quota-limit": "100", "x-quota-used": "37" }));
  assert.deepEqual(cupo, { limite: 100, usados: 37, quedan: 63 });
});

test("cupoDeCabeceras: usados por encima del límite no da un negativo", () => {
  const cupo = cupoDeCabeceras(cabeceras({ "x-quota-limit": "10", "x-quota-used": "14" }));
  assert.deepEqual(cupo, { limite: 10, usados: 14, quedan: 0 });
});

test("cupoDeCabeceras: cabeceras ausentes devuelve null", () => {
  assert.equal(cupoDeCabeceras(cabeceras({})), null);
});

test("cupoDeCabeceras: cabeceras no numéricas devuelve null", () => {
  assert.equal(cupoDeCabeceras(cabeceras({ "x-quota-limit": "mucho", "x-quota-used": "37" })), null);
});

test("cupoDeCabeceras: números negativos devuelve null", () => {
  assert.equal(cupoDeCabeceras(cabeceras({ "x-quota-limit": "100", "x-quota-used": "-1" })), null);
});

test("cupoDeCabeceras: cupo en cero es válido (no queda nada)", () => {
  const cupo = cupoDeCabeceras(cabeceras({ "x-quota-limit": "0", "x-quota-used": "0" }));
  assert.deepEqual(cupo, { limite: 0, usados: 0, quedan: 0 });
});
