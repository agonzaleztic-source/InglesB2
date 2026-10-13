// index.html solo tenía <title>: ni buscadores ni redes sociales veían de qué
// trata la página al compartir el enlace. Comprueba que las etiquetas de
// metadatos existen, son únicas, no prometen resultados ni usan "Aptis" como
// marca propia, y que las rutas son relativas (tests/csp.test.js ya exige que
// ninguna URL absoluta fuera de un <a> apunte a un origen no permitido).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

function unica(regex, nombre) {
  const coincidencias = [...html.matchAll(regex)];
  assert.equal(coincidencias.length, 1, `debe haber exactamente una etiqueta ${nombre}`);
  return coincidencias[0];
}

test("index.html tiene una única meta description con contenido", () => {
  const m = unica(/<meta\s+name="description"\s+content="([^"]*)">/g, "meta description");
  assert.ok(m[1].trim().length > 0, "la meta description no puede estar vacía");
});

test("la meta description no usa 'Aptis' como marca propia ni promete resultados", () => {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]*)">/);
  assert.ok(m, "no se encontró la meta description");
  const texto = m[1].toLowerCase();
  assert.ok(!/garantiz|aprueba|apruebas|100\s*%/.test(texto), "no debe prometer resultados");
});

test("index.html tiene las etiquetas Open Graph y Twitter Card, una vez cada una", () => {
  unica(/<meta\s+property="og:title"\s+content="[^"]*">/g, "og:title");
  unica(/<meta\s+property="og:description"\s+content="[^"]*">/g, "og:description");
  unica(/<meta\s+property="og:type"\s+content="website">/g, "og:type");
  unica(/<meta\s+property="og:locale"\s+content="es_ES">/g, "og:locale");
  unica(/<meta\s+property="og:image"\s+content="([^"]*)">/g, "og:image");
  unica(/<meta\s+name="twitter:card"\s+content="summary">/g, "twitter:card");
});

test("og:image usa una ruta relativa, no una URL absoluta", () => {
  const m = html.match(/<meta\s+property="og:image"\s+content="([^"]*)">/);
  assert.ok(m, "no se encontró og:image");
  assert.ok(!/^https?:\/\//.test(m[1]), "og:image debe ser una ruta relativa");
});

test("index.html tiene un único <noscript> que explica que hace falta JavaScript", () => {
  const m = unica(/<noscript>([^<]*)<\/noscript>/g, "noscript");
  assert.match(m[1].toLowerCase(), /javascript/, "el noscript debe mencionar JavaScript");
});
