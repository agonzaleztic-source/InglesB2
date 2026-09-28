// Valida la estructura de BANK.core (banco.js) sin modificar el fichero:
// se carga con vm.runInNewContext, igual que hace index.html en el navegador.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "banco.js"), "utf8");
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox);
const BANK = sandbox.window.BANK;

// Misma huella que usa index.html para detectar preguntas repetidas.
const fp = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 45);

test("BANK.core existe y tiene al menos 6 preguntas", () => {
  assert.ok(Array.isArray(BANK.core), "BANK.core debe ser un array");
  assert.ok(BANK.core.length >= 6, `BANK.core.length es ${BANK.core.length}, se esperaban >= 6`);
});

test("cada pregunta de BANK.core tiene la forma correcta", () => {
  BANK.core.forEach((item, i) => {
    const etiqueta = `índice ${i} (q: ${JSON.stringify(item.q)})`;

    assert.equal(typeof item.q, "string", `${etiqueta}: q debe ser string`);
    assert.ok(item.q.includes("___"), `${etiqueta}: q debe contener "___"`);

    assert.ok(Array.isArray(item.opts), `${etiqueta}: opts debe ser array`);
    assert.equal(item.opts.length, 4, `${etiqueta}: opts debe tener 4 elementos`);
    item.opts.forEach((o, j) => {
      assert.equal(typeof o, "string", `${etiqueta}: opts[${j}] debe ser string`);
      assert.ok(o.trim().length > 0, `${etiqueta}: opts[${j}] no puede estar vacía`);
    });
    assert.equal(
      new Set(item.opts).size,
      item.opts.length,
      `${etiqueta}: opts no puede tener opciones repetidas`
    );

    assert.ok(Number.isInteger(item.correct), `${etiqueta}: correct debe ser entero`);
    assert.ok(item.correct >= 0 && item.correct <= 3, `${etiqueta}: correct debe estar en 0..3`);

    assert.equal(typeof item.tag, "string", `${etiqueta}: tag debe ser string`);
    assert.ok(item.tag.trim().length > 0, `${etiqueta}: tag no puede estar vacío`);

    assert.equal(typeof item.why, "string", `${etiqueta}: why debe ser string`);
    assert.ok(item.why.trim().length > 0, `${etiqueta}: why no puede estar vacío`);
  });
});

test("si una pregunta tiene deep, rule/mistake/examples son válidos", () => {
  BANK.core.forEach((item, i) => {
    if (item.deep === undefined) return;
    const etiqueta = `índice ${i} (q: ${JSON.stringify(item.q)})`;

    assert.equal(typeof item.deep.rule, "string", `${etiqueta}: deep.rule debe ser string`);
    assert.ok(item.deep.rule.trim().length > 0, `${etiqueta}: deep.rule no puede estar vacío`);

    assert.equal(typeof item.deep.mistake, "string", `${etiqueta}: deep.mistake debe ser string`);
    assert.ok(item.deep.mistake.trim().length > 0, `${etiqueta}: deep.mistake no puede estar vacío`);

    assert.ok(Array.isArray(item.deep.examples), `${etiqueta}: deep.examples debe ser array`);
    assert.ok(item.deep.examples.length >= 1, `${etiqueta}: deep.examples debe tener >= 1 elemento`);
    item.deep.examples.forEach((ej, j) => {
      assert.equal(typeof ej.en, "string", `${etiqueta}: deep.examples[${j}].en debe ser string`);
      assert.ok(ej.en.trim().length > 0, `${etiqueta}: deep.examples[${j}].en no puede estar vacío`);
      assert.equal(typeof ej.es, "string", `${etiqueta}: deep.examples[${j}].es debe ser string`);
      assert.ok(ej.es.trim().length > 0, `${etiqueta}: deep.examples[${j}].es no puede estar vacío`);
    });
  });
});

test("no hay preguntas duplicadas (huella fp de q)", () => {
  const vistas = new Map();
  BANK.core.forEach((item, i) => {
    const huella = fp(item.q);
    if (vistas.has(huella)) {
      assert.fail(
        `índice ${i} (q: ${JSON.stringify(item.q)}) duplica la pregunta del índice ${vistas.get(huella)}`
      );
    }
    vistas.set(huella, i);
  });
});
