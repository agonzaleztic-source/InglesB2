// Comprueba que la Content-Security-Policy de index.html es coherente:
// directivas mínimas exigidas y que ninguna URL absoluta del fichero
// apunte a un origen que la CSP no permitiría cargar.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const cspMatch = html.match(
  /<meta http-equiv="Content-Security-Policy" content="([\s\S]*?)">/
);
assert.ok(cspMatch, "no se encontró la meta Content-Security-Policy");
const cspTexto = cspMatch[1];

function parseCSP(texto) {
  const directivas = {};
  for (const parte of texto.split(";")) {
    const trozos = parte.trim().split(/\s+/).filter(Boolean);
    if (trozos.length === 0) continue;
    directivas[trozos[0]] = trozos.slice(1);
  }
  return directivas;
}

const CSP = parseCSP(cspTexto);

test("default-src es 'self'", () => {
  assert.deepEqual(CSP["default-src"], ["'self'"]);
});

test("object-src es 'none'", () => {
  assert.deepEqual(CSP["object-src"], ["'none'"]);
});

test("frame-ancestors es 'none'", () => {
  assert.deepEqual(CSP["frame-ancestors"], ["'none'"]);
});

test("base-uri es 'self'", () => {
  assert.deepEqual(CSP["base-uri"], ["'self'"]);
});

test("connect-src no tiene comodines salvo https://*.workers.dev y api.anthropic.com", () => {
  const permitidos = ["'self'", "https://api.anthropic.com", "https://*.workers.dev"];
  assert.ok(CSP["connect-src"], "falta connect-src");
  for (const origen of CSP["connect-src"]) {
    assert.ok(permitidos.includes(origen), `origen no esperado en connect-src: ${origen}`);
  }
});

// Orígenes https:// que cualquier directiva de la CSP declara permitidos,
// incluido el comodín https://*.workers.dev.
const origenesPermitidos = new Set();
for (const fuentes of Object.values(CSP)) {
  for (const fuente of fuentes) {
    if (fuente.startsWith("https://")) origenesPermitidos.add(fuente);
  }
}

function origenPermitido(url) {
  const origen = new URL(url).origin;
  if (origenesPermitidos.has(origen)) return true;
  for (const permitido of origenesPermitidos) {
    if (permitido.startsWith("https://*.")) {
      const sufijo = permitido.slice("https://*".length);
      if (origen.startsWith("https://") && origen.endsWith(sufijo)) return true;
    }
  }
  return false;
}

// Las URLs de navegación (<a href>) y los textos de ejemplo (placeholder)
// no son recursos que el navegador cargue bajo la CSP: se descartan antes
// de buscar URLs absolutas "reales" (scripts, hojas de estilo, fetch...).
const htmlSinNavegacion = html
  .replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "")
  .replace(/placeholder="[^"]*"/g, "");

const urlsAbsolutas = [
  ...new Set(
    [...htmlSinNavegacion.matchAll(/https:\/\/[^\s"'<>);]+/g)].map((m) => m[0])
  ),
];

test("index.html contiene alguna URL absoluta que analizar", () => {
  assert.ok(urlsAbsolutas.length > 0);
});

test("ninguna URL absoluta (fuera de enlaces de navegación) apunta a un origen no permitido por la CSP", () => {
  for (const url of urlsAbsolutas) {
    assert.ok(origenPermitido(url), `origen no permitido por la CSP: ${url}`);
  }
});
