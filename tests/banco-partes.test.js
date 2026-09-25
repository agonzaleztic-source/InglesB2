const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const src = fs.readFileSync(path.join(__dirname, "..", "banco.js"), "utf8");
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const BANK = ctx.window.BANK;

// Copia de fp() en index.html: recorta a 45 y quita todo lo que no sea a-z0-9.
const fp = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 45);

// Copia de la huella que usa delBanco() en index.html para no repetir el
// mismo set dentro de una misma parte (r1, l2, s4...).
const huella = (s) => fp(s.text || s.script || s.scene || s.context || (s.lines || [])[1]
  || (s.items || [])[0]?.script || (s.items || [])[0]?.text || (s.questions || [])[0]?.q || (s.rounds || [])[0]?.prompt);

const noVacio = (s) => typeof s === "string" && s.trim() !== "" && s !== "undefined" && s !== "TODO";

function checkArraySinVacios(arr, etiqueta) {
  for (const v of arr) assert.ok(noVacio(v), `${etiqueta}: valor vacío o placeholder: ${JSON.stringify(v)}`);
}

function checkHuellasUnicas(sets, clave) {
  const huellas = sets.map(huella);
  huellas.forEach((h, i) => assert.ok(noVacio(h), `${clave}[${i}]: huella vacía`));
  assert.equal(new Set(huellas).size, huellas.length, `${clave}: huellas de delBanco repetidas entre sets`);
}

function checkOpcionesIndice(opts, correct, etiqueta) {
  assert.ok(Array.isArray(opts) && opts.length >= 2, `${etiqueta}: opts debe tener al menos 2 opciones`);
  checkArraySinVacios(opts, etiqueta);
  assert.ok(Number.isInteger(correct) && correct >= 0 && correct < opts.length,
    `${etiqueta}: correct fuera de rango`);
}

for (const clave of ["r1", "r2", "r3", "r4"]) {
  test(`${clave} presente y con forma válida`, () => {
    const sets = BANK[clave];
    if (!sets) return;
    assert.ok(Array.isArray(sets) && sets.length > 0, `${clave} debe ser un array no vacío`);
    checkHuellasUnicas(sets, clave);

    sets.forEach((s, i) => {
      const et = `${clave}[${i}]`;
      assert.ok(noVacio(s.intro), `${et}.intro vacío`);

      if (clave === "r1") {
        assert.ok(noVacio(s.text), `${et}.text vacío`);
        checkArraySinVacios(s.bank, `${et}.bank`);
        assert.ok(s.answers.length === s.whys.length, `${et}: answers y whys deben tener la misma longitud`);
        s.answers.forEach((a) => assert.ok(Number.isInteger(a) && a >= 0 && a < s.bank.length,
          `${et}: answers fuera de rango de bank`));
        assert.equal(new Set(s.answers).size, s.answers.length, `${et}: answers con índices repetidos`);
        checkArraySinVacios(s.whys, `${et}.whys`);
      }

      if (clave === "r2") {
        assert.ok(Array.isArray(s.lines) && s.lines.length >= 2, `${et}.lines debe tener al menos 2 líneas`);
        checkArraySinVacios(s.lines, `${et}.lines`);
        assert.equal(s.lines.length, s.whys.length, `${et}: lines y whys deben tener la misma longitud`);
        checkArraySinVacios(s.whys, `${et}.whys`);
      }

      if (clave === "r3") {
        assert.ok(noVacio(s.text), `${et}.text vacío`);
        assert.ok(Array.isArray(s.gaps) && s.gaps.length > 0, `${et}.gaps debe ser un array no vacío`);
        s.gaps.forEach((g, j) => {
          checkOpcionesIndice(g.opts, g.correct, `${et}.gaps[${j}]`);
          assert.ok(noVacio(g.why), `${et}.gaps[${j}].why vacío`);
        });
      }

      if (clave === "r4") {
        assert.ok(Array.isArray(s.items) && s.items.length > 0, `${et}.items debe ser un array no vacío`);
        s.items.forEach((it) => {
          assert.ok(noVacio(it.label), `${et}: item.label vacío`);
          assert.ok(noVacio(it.text), `${et}: item.text vacío`);
        });
        assert.equal(new Set(s.items.map((it) => it.label)).size, s.items.length,
          `${et}: labels de items repetidas`);
        checkArraySinVacios(s.options, `${et}.options`);
        assert.equal(s.answers.length, s.items.length, `${et}: answers debe tener un índice por item`);
        s.answers.forEach((a) => assert.ok(Number.isInteger(a) && a >= 0 && a < s.options.length,
          `${et}: answers fuera de rango de options`));
        assert.equal(new Set(s.answers).size, s.answers.length, `${et}: answers con índices repetidos`);
        assert.equal(s.whys.length, s.items.length, `${et}: whys debe tener una entrada por item`);
        checkArraySinVacios(s.whys, `${et}.whys`);
      }
    });
  });
}

for (const clave of ["l1", "l2", "l3", "l4"]) {
  test(`${clave} presente y con forma válida`, () => {
    const sets = BANK[clave];
    if (!sets) return;
    assert.ok(Array.isArray(sets) && sets.length > 0, `${clave} debe ser un array no vacío`);
    checkHuellasUnicas(sets, clave);

    sets.forEach((s, i) => {
      const et = `${clave}[${i}]`;
      assert.ok(noVacio(s.intro), `${et}.intro vacío`);

      if (clave === "l1" || clave === "l4") {
        if (clave === "l4") assert.ok(noVacio(s.script), `${et}.script vacío`);
        assert.ok(Array.isArray(s.questions) && s.questions.length > 0, `${et}.questions debe ser no vacío`);
        s.questions.forEach((q, j) => {
          const etq = `${et}.questions[${j}]`;
          if (clave === "l1") assert.ok(noVacio(q.script), `${etq}.script vacío`);
          assert.ok(noVacio(q.q), `${etq}.q vacío`);
          checkOpcionesIndice(q.opts, q.correct, etq);
          assert.ok(noVacio(q.why), `${etq}.why vacío`);
        });
      }

      if (clave === "l2" || clave === "l3") {
        if (clave === "l3") assert.ok(noVacio(s.script), `${et}.script vacío`);
        assert.ok(Array.isArray(s.items) && s.items.length > 0, `${et}.items debe ser un array no vacío`);
        s.items.forEach((it) => {
          assert.ok(noVacio(it.label), `${et}: item.label vacío`);
          assert.ok(noVacio(it.script || it.text), `${et}: item.script/text vacío`);
        });
        checkArraySinVacios(s.options, `${et}.options`);
        assert.equal(s.answers.length, s.items.length, `${et}: answers debe tener un índice por item`);
        s.answers.forEach((a) => assert.ok(Number.isInteger(a) && a >= 0 && a < s.options.length,
          `${et}: answers fuera de rango de options`));
        assert.equal(s.whys.length, s.items.length, `${et}: whys debe tener una entrada por item`);
        checkArraySinVacios(s.whys, `${et}.whys`);
      }
    });
  });
}

for (const clave of ["w1", "w2", "w3", "w4"]) {
  test(`${clave} presente y con forma válida`, () => {
    const sets = BANK[clave];
    if (!sets) return;
    assert.ok(Array.isArray(sets) && sets.length > 0, `${clave} debe ser un array no vacío`);
    checkHuellasUnicas(sets, clave);

    sets.forEach((s, i) => {
      const et = `${clave}[${i}]`;
      assert.ok(noVacio(s.intro), `${et}.intro vacío`);
      assert.ok(noVacio(s.context), `${et}.context vacío`);
      assert.ok(Array.isArray(s.fields) && s.fields.length > 0, `${et}.fields debe ser no vacío`);
      s.fields.forEach((f) => {
        assert.ok(noVacio(f.prompt), `${et}: field.prompt vacío`);
        assert.ok(noVacio(f.words), `${et}: field.words vacío`);
      });
      assert.equal(s.model.length, s.fields.length, `${et}: model debe tener una respuesta por field`);
      checkArraySinVacios(s.model, `${et}.model`);
      assert.ok(Array.isArray(s.check) && s.check.length > 0, `${et}.check debe ser no vacío`);
      checkArraySinVacios(s.check, `${et}.check`);
    });
  });
}

for (const clave of ["s1", "s2", "s3", "s4"]) {
  test(`${clave} presente y con forma válida`, () => {
    const sets = BANK[clave];
    if (!sets) return;
    assert.ok(Array.isArray(sets) && sets.length > 0, `${clave} debe ser un array no vacío`);
    checkHuellasUnicas(sets, clave);

    sets.forEach((s, i) => {
      const et = `${clave}[${i}]`;
      assert.ok(noVacio(s.intro), `${et}.intro vacío`);
      if (clave !== "s1") assert.ok(noVacio(s.scene), `${et}.scene vacío`);
      assert.ok(Number.isInteger(s.prep) && s.prep >= 0, `${et}.prep debe ser un entero >= 0`);
      if (clave === "s4") {
        assert.ok(Array.isArray(s.questions3) && s.questions3.length === 3, `${et}.questions3 debe tener 3 preguntas`);
        checkArraySinVacios(s.questions3, `${et}.questions3`);
      }
      assert.ok(Array.isArray(s.rounds) && s.rounds.length > 0, `${et}.rounds debe ser no vacío`);
      s.rounds.forEach((r) => {
        assert.ok(noVacio(r.prompt), `${et}: round.prompt vacío`);
        assert.ok(Number.isInteger(r.seconds) && r.seconds > 0, `${et}: round.seconds debe ser positivo`);
      });
      assert.ok(Array.isArray(s.useful) && s.useful.length > 0, `${et}.useful debe ser no vacío`);
      checkArraySinVacios(s.useful, `${et}.useful`);
      assert.equal(s.model.length, s.rounds.length, `${et}: model debe tener una respuesta por round`);
      checkArraySinVacios(s.model, `${et}.model`);
    });
  });
}
