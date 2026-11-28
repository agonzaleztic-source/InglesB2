// scripts/prelanzamiento.mjs: sobre el repo tal cual debe salir con 0, y
// sobre copias alteradas en el directorio temporal del sistema debe fallar
// nombrando el problema. No usa red ni claves: solo lee ficheros del repo
// (o de la copia) y los compara entre sí.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const SCRIPT = join(REPO, "scripts", "prelanzamiento.mjs");
const FICHEROS = ["wrangler.toml", "worker.js", "DESPLIEGUE.md", "index.html"];

function leerOriginales() {
  const originales = {};
  for (const f of FICHEROS) originales[f] = readFileSync(join(REPO, f), "utf8");
  return originales;
}

// Copia los cuatro ficheros a una carpeta nueva de os.tmpdir(), aplicando los
// cambios indicados (una función por fichero) para fabricar una incoherencia.
function copiaAlterada(cambios = {}) {
  const originales = leerOriginales();
  const dir = mkdtempSync(join(tmpdir(), "prelanzamiento-"));
  for (const f of FICHEROS) {
    const contenido = cambios[f] ? cambios[f](originales[f]) : originales[f];
    writeFileSync(join(dir, f), contenido);
  }
  return dir;
}

function ejecutarSobre(dir) {
  return spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
}

test("sobre el repo tal cual, sale con 0 (todo coherente)", () => {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("un secreto escrito en [vars] de wrangler.toml hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "wrangler.toml": (c) => c.replace(/^\[vars\]$/m, '[vars]\nADMIN_SECRET = "x"'),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ADMIN_SECRET.*secreto/);
  rmSync(dir, { recursive: true, force: true });
});

test("falta el binding KV RATE_LIMIT en wrangler.toml hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "wrangler.toml": (c) => c.replace('binding = "RATE_LIMIT"', 'binding = "OTRA_COSA"'),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /RATE_LIMIT/);
  rmSync(dir, { recursive: true, force: true });
});

test("APP_URL sin barra final hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "wrangler.toml": (c) => c.replace(/APP_URL = "([^"]+)\/"/, 'APP_URL = "$1"'),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /APP_URL debe terminar en/);
  rmSync(dir, { recursive: true, force: true });
});

test("el origen de APP_URL fuera de ALLOWED_ORIGIN hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "wrangler.toml": (c) => c.replace(/APP_URL = "[^"]+"/, 'APP_URL = "https://otro-origen.example/"'),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ALLOWED_ORIGIN/);
  rmSync(dir, { recursive: true, force: true });
});

test("una variable que usa worker.js pero no está en DESPLIEGUE.md hace fallar nombrándola", () => {
  const dir = copiaAlterada({
    "DESPLIEGUE.md": (c) => c.replaceAll("LEMONSQUEEZY_PRODUCT_IDS", "x".repeat("LEMONSQUEEZY_PRODUCT_IDS".length)),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /LEMONSQUEEZY_PRODUCT_IDS/);
  rmSync(dir, { recursive: true, force: true });
});

test("un evento de handleLemonEvent sin documentar en el paso 3 hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "DESPLIEGUE.md": (c) => c.replace(/`subscription_unpaused`,\s*/, ""),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /subscription_unpaused/);
  rmSync(dir, { recursive: true, force: true });
});

test("un evento documentado que el código ya no trata hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "DESPLIEGUE.md": (c) => c.replace("`subscription_resumed`, ", "`subscription_resumed`, `subscription_no_existe`, "),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /subscription_no_existe/);
  rmSync(dir, { recursive: true, force: true });
});

test("si el enlace #worker= de index.html cambia de forma, hace fallar nombrándolo", () => {
  const dir = copiaAlterada({
    "index.html": (c) => c.replace("/^#worker=(.*)$/", "/^#w=(.*)$/"),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /index\.html.*#worker=/);
  rmSync(dir, { recursive: true, force: true });
});

test("acepta wrangler.toml con CRLF igual que con LF", () => {
  const dir = copiaAlterada({
    "wrangler.toml": (c) => c.replace(/\n/g, "\r\n"),
  });
  const r = ejecutarSobre(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  rmSync(dir, { recursive: true, force: true });
});

test("no hace peticiones de red ni lee .env*", () => {
  const codigo = readFileSync(SCRIPT, "utf8");
  assert.ok(!/\bfetch\(|http\.request|https\.request/.test(codigo));
  assert.ok(!/readFileSync\([^)]*\.env/.test(codigo));
  assert.ok(!codigo.includes("dotenv"));
});
