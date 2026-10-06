const { test } = require("node:test");
const assert = require("node:assert/strict");
const { key, back, fp, level, pctOf, noVistos, streakOf, normalizaProgreso, reintentable } = require("../logica.js");

test("key: rellena con cero mes y día de un solo dígito", () => {
  assert.equal(key(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(key(new Date(2026, 8, 9)), "2026-09-09");
});

test("key: no rellena cuando mes y día ya tienen dos dígitos", () => {
  assert.equal(key(new Date(2025, 11, 31)), "2025-12-31");
});

test("back: 0 días devuelve la misma fecha que key()", () => {
  const d = new Date(2026, 5, 15);
  assert.equal(back(0, d), key(d));
});

test("back: cruza el año al retroceder desde el 1 de enero", () => {
  assert.equal(back(1, new Date(2026, 0, 1)), "2025-12-31");
});

test("back: respeta el 29 de febrero en año bisiesto", () => {
  assert.equal(back(1, new Date(2024, 2, 1)), "2024-02-29");
});

test("back: en año no bisiesto, retrocede de marzo a 28 de febrero", () => {
  assert.equal(back(1, new Date(2025, 2, 1)), "2025-02-28");
});

test("back: retrocede varios meses de golpe", () => {
  assert.equal(back(40, new Date(2026, 2, 10)), "2026-01-29");
});

test("level: fronteras exactas entre tramos", () => {
  assert.equal(level(34), "A1");
  assert.equal(level(35), "A2");
  assert.equal(level(54), "A2");
  assert.equal(level(55), "B1");
  assert.equal(level(74), "B1");
  assert.equal(level(75), "B2");
  assert.equal(level(89), "B2");
  assert.equal(level(90), "C");
});

test("pctOf: nivel desconocido da 50", () => {
  assert.equal(pctOf("Z"), 50);
  assert.equal(pctOf(undefined), 50);
});

test("pctOf: niveles conocidos", () => {
  assert.equal(pctOf("A2"), 42);
  assert.equal(pctOf("C"), 92);
});

test("fp: recorta a 45 caracteres", () => {
  const largo = "a".repeat(60);
  assert.equal(fp(largo).length, 45);
});

test("fp: quita acentos, espacios y símbolos, en minúsculas", () => {
  assert.equal(fp("CAFÉ ÜBER NAÏVE!"), "cafbernave");
});

test("fp: valor vacío o falsy no rompe", () => {
  assert.equal(fp(undefined), "");
  assert.equal(fp(""), "");
});

test("noVistos: si ya se vio todo, devuelve la lista completa", () => {
  const lista = [{ q: "uno" }, { q: "dos" }];
  const vistos = lista.map((x) => fp(x.q));
  assert.deepEqual(noVistos(lista, (x) => fp(x.q), vistos), lista);
});

test("noVistos: filtra solo lo ya visto", () => {
  const lista = [{ q: "uno" }, { q: "dos" }, { q: "tres" }];
  const vistos = [fp("dos")];
  assert.deepEqual(noVistos(lista, (x) => fp(x.q), vistos), [{ q: "uno" }, { q: "tres" }]);
});

test("streakOf: racha de hoy", () => {
  const now = new Date("2026-09-25T12:00:00");
  const days = {
    "2026-09-25": { done: true },
    "2026-09-24": { done: true },
    "2026-09-23": { done: false },
  };
  assert.equal(streakOf(days, now), 2);
});

test("streakOf: hoy sin hacer pero ayer sí (racha sigue viva)", () => {
  const now = new Date("2026-09-25T12:00:00");
  const days = {
    "2026-09-24": { done: true },
    "2026-09-23": { done: true },
    "2026-09-22": { done: false },
  };
  assert.equal(streakOf(days, now), 2);
});

test("streakOf: un hueco corta la racha aunque haya días sueltos detrás", () => {
  const now = new Date("2026-09-25T12:00:00");
  const days = {
    "2026-09-25": { done: true },
    "2026-09-24": { done: false },
    "2026-09-23": { done: true },
  };
  assert.equal(streakOf(days, now), 1);
});

test("streakOf: sin ningún día hecho da 0", () => {
  const now = new Date("2026-09-25T12:00:00");
  assert.equal(streakOf({}, now), 0);
});

test("normalizaProgreso: null o valores no-objeto dan un progreso en blanco", () => {
  const blanco = { days: {}, skills: {}, lessons: {}, errors: [], seen: [], usedTopics: [] };
  assert.deepEqual(normalizaProgreso(null), blanco);
  assert.deepEqual(normalizaProgreso(undefined), blanco);
  assert.deepEqual(normalizaProgreso("texto"), blanco);
  assert.deepEqual(normalizaProgreso(42), blanco);
  assert.deepEqual(normalizaProgreso([1, 2, 3]), blanco);
});

test("normalizaProgreso: campos con el tipo equivocado se sustituyen por su valor por defecto", () => {
  const r = normalizaProgreso({
    errors: null,
    seen: "no es un array",
    usedTopics: 5,
    days: [1, 2],
    skills: "x",
    lessons: null,
  });
  assert.deepEqual(r, { days: {}, skills: {}, lessons: {}, errors: [], seen: [], usedTopics: [] });
});

test("normalizaProgreso: un progreso válido no se toca", () => {
  const valido = {
    days: { "2026-09-25": { done: true, blocks: { core: true } } },
    skills: { reading: [{ d: "2026-09-25", pct: 80 }] },
    lessons: { r1: { visto: true } },
    errors: [{ tag: "Tercer condicional" }],
    seen: ["abc", "def"],
    usedTopics: ["commuting by train"],
  };
  assert.deepEqual(normalizaProgreso(valido), valido);
});

test("normalizaProgreso: campos ausentes se rellenan con el valor por defecto", () => {
  assert.deepEqual(normalizaProgreso({ seen: ["a"] }), {
    days: {}, skills: {}, lessons: {}, errors: [], seen: ["a"], usedTopics: [],
  });
});

test("reintentable: un error marcado reintentable=false no se repite", () => {
  const e = new Error("La clave no es válida.");
  e.reintentable = false;
  assert.equal(reintentable(e), false);
});

test("reintentable: errores de red o de parseo del JSON sí se repiten", () => {
  assert.equal(reintentable(new Error("No hay conexión con el modelo. Revisa tu conexión a internet.")), true);
  assert.equal(reintentable(new Error("sin JSON")), true);
  assert.equal(reintentable(new Error("JSON sin cerrar")), true);
  assert.equal(reintentable(new SyntaxError("Unexpected token o in JSON at position 1")), true);
});

test("reintentable: sin marcar explícitamente, se considera reintentable por defecto", () => {
  assert.equal(reintentable(new Error("cualquier otro fallo")), true);
  assert.equal(reintentable({}), true);
});
