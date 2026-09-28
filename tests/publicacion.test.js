// Comprueba que sw.js (caché offline), publicar.mjs (despliegue) y el disco
// están de acuerdo sobre qué ficheros forman la app pública.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function extraerArray(src, nombre) {
  const m = src.match(new RegExp(`const ${nombre} = \\[([\\s\\S]*?)\\];`));
  assert.ok(m, `no se encontró ${nombre}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const sw = leer("sw.js");
const publicarSrc = leer("publicar.mjs");
const SHELL = extraerArray(sw, "SHELL");
const PUBLICOS = extraerArray(publicarSrc, "PUBLICOS");
const VERSION = sw.match(/const VERSION = "([^"]+)";/)[1];

function cubierto(entrada, lista) {
  return lista.some((p) => entrada === p || entrada.startsWith(`${p}/`));
}

test("cada entrada de SHELL (salvo './') existe en disco", () => {
  for (const entrada of SHELL) {
    if (entrada === "./") continue;
    assert.ok(fs.existsSync(path.join(ROOT, entrada)), `falta en disco: ${entrada}`);
  }
});

test("cada entrada de SHELL está cubierta por PUBLICOS", () => {
  for (const entrada of SHELL) {
    if (entrada === "./") continue;
    assert.ok(cubierto(entrada, PUBLICOS), `no publicado: ${entrada}`);
  }
});

test("VERSION de sw.js tiene el formato AAAA-MM-DD u AAAA-MM-DD-N", () => {
  assert.match(VERSION, /^\d{4}-\d{2}-\d{2}(-\d+)?$/);
});

test("SHELL no tiene entradas duplicadas", () => {
  assert.equal(new Set(SHELL).size, SHELL.length);
});

test("worker.js, README e historico no están en PUBLICOS", () => {
  for (const prohibido of ["worker.js", "README.md", "historico"]) {
    assert.ok(!cubierto(prohibido, PUBLICOS), `${prohibido} no debería publicarse`);
  }
});

function localesDe(html) {
  const locales = [];
  for (const m of html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)) locales.push(m[1]);
  for (const m of html.matchAll(/<link\b[^>]*\shref="([^"]+)"/g)) locales.push(m[1]);
  return locales.filter((u) => !/^(https?:)?\/\//.test(u));
}

for (const pagina of ["index.html", "privacidad.html"]) {
  test(`los <script src> y <link href> locales de ${pagina} están en SHELL y PUBLICOS`, () => {
    for (const ref of localesDe(leer(pagina))) {
      assert.ok(SHELL.includes(ref), `${ref} (${pagina}) no está en SHELL`);
      assert.ok(cubierto(ref, PUBLICOS), `${ref} (${pagina}) no está en PUBLICOS`);
    }
  });
}

test("los iconos de manifest.webmanifest están en SHELL y PUBLICOS", () => {
  const manifest = JSON.parse(leer("manifest.webmanifest"));
  for (const icono of manifest.icons) {
    assert.ok(SHELL.includes(icono.src), `${icono.src} no está en SHELL`);
    assert.ok(cubierto(icono.src, PUBLICOS), `${icono.src} no está en PUBLICOS`);
  }
});
