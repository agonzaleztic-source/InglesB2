// Textos legales para la versión de pago: condiciones.html (contratación y
// aviso legal) y privacidad.html ampliada. Son borradores: deben decirlo bien
// visible hasta que los revise un profesional.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const leer = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

test("condiciones.html existe", () => {
  assert.ok(fs.existsSync(path.join(ROOT, "condiciones.html")));
});

test("condiciones.html avisa de que es un BORRADOR", () => {
  assert.match(leer("condiciones.html"), /BORRADOR/);
});

test("condiciones.html trata el desistimiento y Stripe", () => {
  const html = leer("condiciones.html");
  assert.match(html, /desistimiento/i);
  assert.match(html, /103\.m/);
  assert.match(html, /Stripe/);
});

test("condiciones.html deja visibles los marcadores del titular y el precio", () => {
  const html = leer("condiciones.html");
  for (const m of ["[NOMBRE Y APELLIDOS]", "[NIF]", "[DOMICILIO]", "[EMAIL DE CONTACTO]", "[PRECIO €/mes IVA incluido]"]) {
    assert.ok(html.includes(m), `falta el marcador ${m}`);
  }
});

test("condiciones.html no carga scripts y mantiene la CSP estricta", () => {
  const html = leer("condiciones.html");
  assert.ok(!/<script\b/i.test(html), "no debe tener scripts");
  assert.match(html, /Content-Security-Policy" content="default-src 'none';/);
});

test("privacidad.html menciona Stripe y Resend y ya no está pendiente de redactar", () => {
  const html = leer("privacidad.html");
  assert.match(html, /Stripe/);
  assert.match(html, /Resend/);
  assert.ok(!/pendiente de redactar/i.test(html), "aún dice «pendiente de redactar»");
});

test("privacidad.html y la pantalla de inicio enlazan a condiciones.html", () => {
  assert.match(leer("privacidad.html"), /href="condiciones\.html"/);
  assert.match(leer("index.html"), /href="condiciones\.html"/);
});
