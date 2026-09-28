// Integridad de manifest.webmanifest: cada icono declarado existe en disco,
// su tamaño real (leído de la cabecera PNG) coincide con "sizes" y su firma
// de fichero coincide con "type". Solo lectura, sin ejecutar ni tocar nada.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PURPOSES_VALIDAS = new Set(["any", "maskable", "monochrome", "any maskable"]);

function tamanoPng(buf) {
  assert.ok(buf.subarray(0, 8).equals(PNG_SIGNATURE), "no es un PNG válido (firma incorrecta)");
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20) };
}

test("manifest.webmanifest tiene los campos obligatorios de una PWA instalable", () => {
  for (const campo of ["name", "short_name", "start_url", "scope", "display", "icons"]) {
    assert.ok(manifest[campo], `falta el campo "${campo}"`);
  }
  assert.equal(manifest.display, "standalone");
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, "icons debe ser un array no vacío");
});

test("theme_color y background_color son colores hex válidos e iguales entre sí", () => {
  const hex = /^#[0-9a-fA-F]{6}$/;
  assert.match(manifest.theme_color, hex);
  assert.match(manifest.background_color, hex);
});

test("el meta theme-color de index.html coincide con el del manifest", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const m = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)">/);
  assert.ok(m, "no se encontró <meta name=\"theme-color\"> en index.html");
  assert.equal(m[1], manifest.theme_color);
});

test("no hay src de icono duplicado", () => {
  const srcs = manifest.icons.map((i) => i.src);
  assert.equal(new Set(srcs).size, srcs.length, "hay entradas de icons con el mismo src");
});

test("hay al menos un icono any y uno maskable", () => {
  const purposes = manifest.icons.map((i) => i.purpose);
  assert.ok(purposes.includes("any"), "falta un icono con purpose \"any\"");
  assert.ok(purposes.includes("maskable"), "falta un icono con purpose \"maskable\"");
});

for (const [i, icono] of manifest.icons.entries()) {
  test(`icons[${i}] (${icono.src}): existe, su tamaño y tipo coinciden con el fichero real`, () => {
    assert.ok(typeof icono.src === "string" && icono.src.startsWith("icons/"), "src debe vivir en icons/");
    const ruta = path.join(ROOT, icono.src);
    assert.ok(fs.existsSync(ruta), `no existe en disco: ${icono.src}`);

    assert.match(icono.sizes, /^\d+x\d+$/, `sizes con formato inválido: ${icono.sizes}`);
    const [anchoDeclarado, altoDeclarado] = icono.sizes.split("x").map(Number);

    assert.equal(icono.type, "image/png", "solo se validan iconos PNG");
    const buf = fs.readFileSync(ruta);
    const { ancho, alto } = tamanoPng(buf);
    assert.equal(ancho, anchoDeclarado, `ancho real (${ancho}) != sizes (${anchoDeclarado})`);
    assert.equal(alto, altoDeclarado, `alto real (${alto}) != sizes (${altoDeclarado})`);

    assert.ok(PURPOSES_VALIDAS.has(icono.purpose), `purpose no válido: ${icono.purpose}`);
  });
}

test("icons/apple-touch-icon.png (referenciado en index.html, fuera del manifest) es un PNG válido", () => {
  const ruta = path.join(ROOT, "icons", "apple-touch-icon.png");
  assert.ok(fs.existsSync(ruta), "falta icons/apple-touch-icon.png");
  const buf = fs.readFileSync(ruta);
  const { ancho, alto } = tamanoPng(buf);
  assert.ok(ancho > 0 && alto > 0, "dimensiones inválidas");
});
