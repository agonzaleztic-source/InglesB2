// privacidad.html no tenía meta description: ni los buscadores ni quien
// comparte el enlace veían de qué trata la página. Comprueba que existe,
// es única y no promete nada que la app no pueda cumplir.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "privacidad.html"), "utf8");

test("privacidad.html tiene una única meta description con contenido", () => {
  const coincidencias = [...html.matchAll(/<meta\s+name="description"\s+content="([^"]*)">/g)];
  assert.equal(coincidencias.length, 1, "debe haber exactamente una meta description");
  assert.ok(coincidencias[0][1].trim().length > 0, "la meta description no puede estar vacía");
});

test("la meta description no usa 'Aptis' como marca propia ni promete resultados", () => {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)">/);
  assert.ok(m, "no se encontró la meta description");
  const texto = m[1].toLowerCase();
  assert.ok(!/garantiz|aprueba|apruebas|100\s*%/.test(texto), "no debe prometer resultados");
  assert.ok(/no oficial|independiente/.test(texto), "debe dejar claro que no es oficial");
});
