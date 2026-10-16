// app.js es la compilación de src/app.jsx (npm run build) y se commitea,
// porque GitHub Pages sirve la raíz de master sin paso de build. Estos tests
// fallan si alguien toca src/app.jsx y se olvida de recompilar, o si edita
// app.js a mano.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { FUENTE, SALIDA, hashDe, normaliza, compila } from "../build.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (f) => normaliza(fs.readFileSync(path.join(ROOT, f), "utf8"));

const fuente = fs.readFileSync(FUENTE, "utf8");
const app = normaliza(fs.readFileSync(SALIDA, "utf8"));

let esbuildDisponible = true;
try { await import("esbuild"); } catch { esbuildDisponible = false; }

test("la cabecera de app.js lleva el hash del src/app.jsx actual (si falla: npm run build)", () => {
  const m = app.match(/^\/\/ sha256 de src\/app\.jsx: ([0-9a-f]{64})$/m);
  assert.ok(m, "app.js no tiene la cabecera con el hash del fuente");
  assert.equal(m[1], hashDe(fuente), "app.js está desfasado respecto a src/app.jsx: ejecuta npm run build");
});

test("app.js es exactamente la compilación actual de src/app.jsx (si falla: npm run build)", {
  // En el CI esbuild siempre está (npm ci): ahí no se permite saltarlo.
  skip: !esbuildDisponible && !process.env.CI ? "esbuild no instalado (npm install)" : false,
}, async () => {
  assert.equal(app, await compila(fuente), "app.js no coincide con la compilación de src/app.jsx: ejecuta npm run build");
});

test("app.js es JavaScript sin JSX que el navegador puede ejecutar tal cual", () => {
  assert.doesNotThrow(() => new vm.Script(app, { filename: "app.js" }));
});

test("index.html ya no usa Babel ni lleva el código de la app incrustado", () => {
  const html = leer("index.html");
  assert.ok(!/babel/i.test(html), "index.html todavía menciona Babel");
  assert.ok(!html.includes('id="app-source"'), "index.html todavía tiene #app-source");
  assert.ok(!fs.existsSync(path.join(ROOT, "vendor", "babel.min.js")), "vendor/babel.min.js sigue en disco");
});

test("start(cfg) carga app.js, que está en la caché del service worker y en la publicación", () => {
  const html = leer("index.html");
  const start = html.match(/  function start\(cfg\) \{\n[\s\S]*?\n  \}\n/);
  assert.ok(start, "no se encontró start(cfg) en index.html");
  assert.match(start[0], /\.src = "app\.js";/);
  assert.match(leer("sw.js"), /\n  "app\.js",\n/);
  assert.match(leer("publicar.mjs"), /"app\.js"/);
});
