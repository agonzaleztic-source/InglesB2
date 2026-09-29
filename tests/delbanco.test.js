// Caracteriza delBanco() (index.html), la función que elige ejercicios en
// modo sin clave. No se puede requerir index.html (mezcla JSX en el mismo
// <script>), así que se extrae su código fuente como texto —igual que
// tests/publicacion.test.js hace con sw.js/publicar.mjs— y se ejecuta con
// vm junto a shuffle/pick (también en index.html) y noVistos/fp reales de
// logica.js. No se modifica index.html.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const { noVistos, fp } = require(path.join(ROOT, "logica.js"));

function extraerLinea(regex, nombre) {
  const m = html.match(regex);
  assert.ok(m, `no se encontró ${nombre} en index.html`);
  return m[0];
}

const shuffleSrc = extraerLinea(/const shuffle = \(a\) => [^\n]+;/, "shuffle");
const pickSrc = extraerLinea(/const pick = \(a\) => [^\n]+;/, "pick");
const delBancoSrc = extraerLinea(/function delBanco\(def, vistos\) \{[\s\S]*?\n\}/, "delBanco");

function cargarDelBanco(BANK) {
  const sandbox = { window: { BANK }, noVistos, fp };
  vm.runInNewContext(
    `${shuffleSrc}\n${pickSrc}\n${delBancoSrc}\nthis.delBanco = delBanco;`,
    sandbox
  );
  return sandbox.delBanco;
}

const q = (n) => ({ q: `pregunta ${n} ___`, opts: ["a", "b", "c", "d"], correct: 0 });

test("core: banco con menos de 6 preguntas lanza error", () => {
  const delBanco = cargarDelBanco({ core: [q(1), q(2), q(3)] });
  assert.throws(() => delBanco({ id: "core" }, []), /banco de gramática está incompleto/);
});

test("core: sin nada visto, devuelve 6 preguntas sin repetir", () => {
  const pool = Array.from({ length: 10 }, (_, i) => q(i));
  const delBanco = cargarDelBanco({ core: pool });
  const { intro, questions } = delBanco({ id: "core" }, []);
  assert.equal(typeof intro, "string");
  assert.equal(questions.length, 6);
  assert.equal(new Set(questions.map((x) => x.q)).size, 6, "no debe repetir preguntas");
});

test("core: si quedan menos de 6 sin ver, rellena con ya vistas hasta 6", () => {
  const pool = Array.from({ length: 8 }, (_, i) => q(i));
  // Todas menos 2 quedan marcadas como vistas (por su huella fp(q.q)).
  const vistos = pool.slice(0, 6).map((x) => fp(x.q));
  const delBanco = cargarDelBanco({ core: pool });
  const { questions } = delBanco({ id: "core" }, vistos);
  assert.equal(questions.length, 6, "debe completar hasta 6 aunque falten sin ver");
  assert.equal(new Set(questions.map((x) => x.q)).size, 6, "el relleno no debe repetir preguntas");
});

test("core: si todo está visto, vuelve a repartir desde el banco completo", () => {
  const pool = Array.from({ length: 6 }, (_, i) => q(i));
  const vistos = pool.map((x) => fp(x.q));
  const delBanco = cargarDelBanco({ core: pool });
  const { questions } = delBanco({ id: "core" }, vistos);
  assert.equal(questions.length, 6);
  assert.equal(new Set(questions.map((x) => x.q)).size, 6);
});

test("otra parte sin ejercicios en el banco lanza error", () => {
  const delBanco = cargarDelBanco({ core: Array.from({ length: 6 }, (_, i) => q(i)) });
  assert.throws(() => delBanco({ id: "r1" }, []), /todavía no tiene ejercicios sin conexión/);
});

test("otra parte: sin nada visto, elige un set del banco", () => {
  const sets = [{ text: "uno" }, { text: "dos" }, { text: "tres" }];
  const delBanco = cargarDelBanco({ r1: sets });
  const elegido = delBanco({ id: "r1" }, []);
  assert.ok(sets.includes(elegido), "debe devolver un set del propio banco");
});

test("otra parte: evita repetir el set ya visto cuando hay alternativas", () => {
  const sets = [{ text: "uno" }, { text: "dos" }];
  const delBanco = cargarDelBanco({ r1: sets });
  const elegido = delBanco({ id: "r1" }, [fp("uno")]);
  assert.equal(elegido.text, "dos");
});

test("otra parte: si ya se vio todo, vuelve a elegir del banco completo", () => {
  const sets = [{ text: "uno" }, { text: "dos" }];
  const delBanco = cargarDelBanco({ r1: sets });
  const vistos = sets.map((s) => fp(s.text));
  const elegido = delBanco({ id: "r1" }, vistos);
  assert.ok(sets.includes(elegido));
});

test("otra parte: usa la huella correcta según la forma del set (script/scene/items/questions/rounds)", () => {
  const casos = [
    { set: { script: "hola script" }, huella: fp("hola script") },
    { set: { scene: "una escena" }, huella: fp("una escena") },
    { set: { lines: ["x", "segunda línea"] }, huella: fp("segunda línea") },
    { set: { items: [{ script: "item script" }] }, huella: fp("item script") },
    { set: { items: [{ text: "item texto" }] }, huella: fp("item texto") },
    { set: { questions: [{ q: "pregunta cero" }] }, huella: fp("pregunta cero") },
    { set: { rounds: [{ prompt: "prompt ronda" }] }, huella: fp("prompt ronda") },
  ];
  for (const { set, huella } of casos) {
    const otro = { text: "relleno distinto" };
    const delBanco = cargarDelBanco({ x: [set, otro] });
    const elegido = delBanco({ id: "x" }, [huella]);
    assert.equal(elegido, otro, `no evitó repetir el set con huella de ${JSON.stringify(set)}`);
  }
});
