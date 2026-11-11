// En WriteTask (Writing de la práctica diaria) y en el formulario de apoyo de
// SpeakTask (cuando no hay reconocimiento de voz) el enunciado se mostraba en
// un <p> suelto, sin relacionarlo con el <textarea>: un lector de pantalla no
// anunciaba de qué pregunta se trataba al entrar en el campo, y el
// "Write in English…" o "Lo que has dicho…" del placeholder desaparece en
// cuanto se escribe. El formulario equivalente del simulacro (Simulacro en
// src/app.jsx) ya usaba <label htmlFor> con el textarea por id; aquí se
// comprueba que WriteTask y SpeakTask hacen lo mismo. No hay framework de
// render de componentes en el repo, así que se comprueba sobre el código
// fuente, como tests/build.test.mjs y el resto de tests de src/app.jsx.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "src", "app.jsx"), "utf8");

function cuerpoDeFuncion(nombre) {
  const inicio = src.indexOf(`function ${nombre}(`);
  assert.ok(inicio >= 0, `no se encontró function ${nombre}`);
  const siguiente = src.indexOf("\nfunction ", inicio + 1);
  return src.slice(inicio, siguiente >= 0 ? siguiente : undefined);
}

test("WriteTask asocia el enunciado al textarea con label/htmlFor e id", () => {
  const cuerpo = cuerpoDeFuncion("WriteTask");
  assert.doesNotMatch(cuerpo, /<p className="prompt">\{f\.prompt\}<\/p>/,
    "el enunciado no debe ser un <p> sin relacionar con el campo");
  const label = cuerpo.match(/<label className="prompt" htmlFor=\{(`[^`]*`)\}>\{f\.prompt\}<\/label>/);
  assert.ok(label, "falta <label htmlFor> con el enunciado de cada campo");
  const idEsperado = label[1];
  assert.match(cuerpo, new RegExp(`<textarea id=\\{${idEsperado.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`),
    "el <textarea> debe llevar el mismo id que el htmlFor del label");
});

test("el formulario de apoyo de SpeakTask (sin reconocimiento de voz) asocia el enunciado al textarea", () => {
  const cuerpo = cuerpoDeFuncion("SpeakTask");
  assert.doesNotMatch(cuerpo, /<p className="prompt dim">\{r\.prompt\}<\/p>/,
    "el enunciado no debe ser un <p> sin relacionar con el campo");
  const label = cuerpo.match(/<label className="prompt dim" htmlFor=\{(`[^`]*`)\}>\{r\.prompt\}<\/label>/);
  assert.ok(label, "falta <label htmlFor> con el enunciado de cada ronda");
  const idEsperado = label[1];
  assert.match(cuerpo, new RegExp(`<textarea id=\\{${idEsperado.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`),
    "el <textarea> debe llevar el mismo id que el htmlFor del label");
});
