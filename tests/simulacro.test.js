// Lógica pura del simulacro cronometrado (simulacro.js): selección de ítems
// del banco real, puntuación 0-50, nivel MCER estimado, temporizador e
// historial. La interfaz está en src/app.jsx.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const SIM = require("../simulacro.js");
const { normalizaProgreso, simulacroValido } = require("../logica.js");

global.window = global.window || {};
require(path.join(__dirname, "..", "banco.js"));
const BANK = global.window.BANK;

/* Generador determinista para que los tests no dependan del azar. */
function semilla(n = 1) {
  let s = n;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

test("preparaSimulacro completo: las cinco secciones, en orden y con los tiempos del examen", () => {
  const e = SIM.preparaSimulacro(BANK, "completo", semilla(), 1000);
  assert.deepEqual(e.secciones.map((s) => s.skill), ["core", "reading", "listening", "writing", "speaking"]);
  assert.deepEqual(e.secciones.map((s) => s.mins), [25, 35, 40, 50, 12]);
  assert.equal(e.fase, "examen");
  assert.equal(e.actual, 0);
  assert.ok(e.secciones.every((s) => s.fin === null && !s.cerrada));
  assert.ok(SIM.estadoValido(e));
});

test("preparaSimulacro: el Core coge hasta 50 preguntas distintas del banco", () => {
  const e = SIM.preparaSimulacro(BANK, "core", semilla());
  const qs = e.secciones[0].partes[0].data.questions;
  assert.equal(qs.length, Math.min(50, BANK.core.length));
  assert.equal(new Set(qs.map((q) => q.q)).size, qs.length);
});

test("preparaSimulacro: Reading tiene r1-r4 y Listening junta los audios cortos de l1", () => {
  const e = SIM.preparaSimulacro(BANK, "completo", semilla(3));
  const r = e.secciones.find((s) => s.skill === "reading");
  assert.deepEqual(r.partes.map((p) => p.id), ["r1", "r2", "r3", "r4"]);
  const l = e.secciones.find((s) => s.skill === "listening");
  assert.equal(l.partes[0].id, "l1");
  const nL1 = BANK.l1.reduce((a, t) => a + t.questions.length, 0);
  assert.equal(l.partes[0].data.questions.length, nL1);
  assert.equal(l.partes.filter((p) => p.id === "l4").length, Math.min(2, BANK.l4.length));
});

test("preparaSimulacro: la tarea de ordenar guarda su orden inicial (permutación de 1..n-1)", () => {
  const e = SIM.preparaSimulacro(BANK, "reading", semilla(7));
  const r2 = e.secciones[0].partes.find((p) => p.id === "r2");
  const n = r2.data.lines.length;
  assert.deepEqual([...r2.orden].sort((a, b) => a - b), Array.from({ length: n - 1 }, (_, i) => i + 1));
});

test("preparaSimulacro: quita las secciones sin contenido y falla si no queda ninguna", () => {
  const e = SIM.preparaSimulacro({ core: BANK.core }, "completo", semilla());
  assert.deepEqual(e.secciones.map((s) => s.skill), ["core"]);
  assert.throws(() => SIM.preparaSimulacro({}, "reading", semilla()), /no tiene ejercicios/);
  assert.throws(() => SIM.preparaSimulacro(BANK, "nada", semilla()), /desconocido/);
});

test("aciertosDeParte: cada formato del catálogo", () => {
  const mcq = { id: "core", data: { questions: [{ correct: 1 }, { correct: 0 }, { correct: 3 }] } };
  assert.equal(SIM.itemsDeParte(mcq), 3);
  assert.equal(SIM.aciertosDeParte(mcq, { 0: 1, 1: 2, 2: 3 }), 2);
  assert.equal(SIM.aciertosDeParte(mcq, null), 0);

  const banco = { id: "r1", data: { bank: ["a", "b", "c"], answers: [2, 0] } };
  assert.equal(SIM.itemsDeParte(banco), 2);
  assert.equal(SIM.aciertosDeParte(banco, { 0: 2, 1: 1 }), 1);

  const gaps = { id: "r3", data: { gaps: [{ correct: 1 }, { correct: 2 }] } };
  assert.equal(SIM.aciertosDeParte(gaps, { 0: 1, 1: 2 }), 2);

  const match = { id: "l3", data: { items: [{}, {}, {}], answers: [2, 0, 1] } };
  assert.equal(SIM.aciertosDeParte(match, { 0: 2, 2: 1 }), 2);

  const order = { id: "r2", data: { lines: ["0", "1", "2", "3"] }, orden: [2, 1, 3] };
  assert.equal(SIM.itemsDeParte(order), 3);
  assert.equal(SIM.aciertosDeParte(order, null), 1, "sin tocar, cuenta el orden inicial");
  assert.equal(SIM.aciertosDeParte(order, [1, 2, 3]), 3);
});

test("nivelDe: fronteras de cada destreza y fuera de rango", () => {
  assert.equal(SIM.nivelDe("reading", 0), "A0");
  assert.equal(SIM.nivelDe("reading", 37), "B1");
  assert.equal(SIM.nivelDe("reading", 38), "B2");
  assert.equal(SIM.nivelDe("listening", 34), "B2");
  assert.equal(SIM.nivelDe("writing", 48), "C");
  assert.equal(SIM.nivelDe("speaking", 50), "C");
  assert.equal(SIM.nivelDe("reading", null), null);
});

test("puntosDeNivel: cae dentro de su franja en todas las destrezas", () => {
  for (const sk of ["core", "reading", "listening", "writing", "speaking", "global"]) {
    for (const lv of SIM.NIVELES) {
      const p = SIM.puntosDeNivel(sk, lv);
      assert.ok(p >= 0 && p <= 50, `${sk} ${lv} → ${p}`);
      assert.equal(SIM.nivelDe(sk, p), lv, `${sk} ${lv} → ${p}`);
    }
  }
  assert.equal(SIM.puntosDeNivel("writing", "?"), null);
  assert.equal(SIM.puntosDeNivel("writing", undefined), null);
});

test("puntosObjetivos: escala 0-50", () => {
  assert.equal(SIM.puntosObjetivos(0, 20), 0);
  assert.equal(SIM.puntosObjetivos(20, 20), 50);
  assert.equal(SIM.puntosObjetivos(15, 20), 38);
  assert.equal(SIM.puntosObjetivos(0, 0), 0);
});

test("puntuaProductiva: partes vacías valen 0, w4 pesa doble y sin nota de alguna parte no hay nota", () => {
  const partes = [{ id: "w1" }, { id: "w2" }, { id: "w3" }, { id: "w4" }];
  const resps = [{ 0: "Ana" }, { 0: "I like it" }, { 0: "Hi" }, { 0: "Dear", 1: "Sir" }];
  const b2 = SIM.puntosDeNivel("writing", "B2");
  assert.equal(SIM.puntuaProductiva("writing", partes, resps, ["B2", "B2", "B2", "B2"]), b2);
  assert.equal(SIM.puntuaProductiva("writing", partes, [null, null, null, null], []), 0);
  const conVacia = SIM.puntuaProductiva("writing", partes, [{ 0: "" }, resps[1], resps[2], resps[3]], [null, "B2", "B2", "B2"]);
  assert.equal(conVacia, Math.round((b2 * 4) / 5));
  assert.equal(SIM.puntuaProductiva("writing", partes, resps, ["B2", null, "B2", "B2"]), null);
  // Speaking guarda textos en un array.
  assert.ok(SIM.parteVacia(["", "  "]));
  assert.ok(!SIM.parteVacia(["", "hello"]));
});

test("temporizador: arranca, cuenta, se cierra al agotarse y pasa a la siguiente sección", () => {
  let e = SIM.preparaSimulacro(BANK, "completo", semilla(), 0);
  assert.equal(SIM.segundosRestantes(e, 0), null, "no corre hasta que se empieza");
  e = SIM.iniciaSeccion(e, 1000);
  assert.equal(SIM.segundosRestantes(e, 1000), 25 * 60);
  assert.equal(SIM.iniciaSeccion(e, 5000), e, "empezar dos veces no reinicia el reloj");
  assert.equal(SIM.compruebaTiempo(e, 1000 + 24 * 60000), e);
  const tras = SIM.compruebaTiempo(e, 1000 + 25 * 60000);
  assert.equal(tras.actual, 1);
  assert.equal(tras.secciones[0].cerrada, true);
  assert.equal(tras.secciones[0].motivo, "tiempo");
  assert.equal(tras.secciones[1].fin, null, "la siguiente espera a que se pulse «Empezar»");
});

test("temporizador: el estado sobrevive a JSON (recarga) y el tiempo sigue contando", () => {
  let e = SIM.iniciaSeccion(SIM.preparaSimulacro(BANK, "reading", semilla(), 0), 0);
  const recargado = JSON.parse(JSON.stringify(e));
  assert.ok(SIM.estadoValido(recargado));
  assert.equal(SIM.segundosRestantes(recargado, 10 * 60000), 25 * 60);
  const cerrado = SIM.compruebaTiempo(recargado, 40 * 60000);
  assert.equal(cerrado.fase, "resultado");
});

test("cierraSeccion: abandonar la última lleva al resultado y no hace nada después", () => {
  let e = SIM.preparaSimulacro(BANK, "core", semilla());
  e = SIM.cierraSeccion(e, "usuario");
  assert.equal(e.fase, "resultado");
  assert.equal(SIM.cierraSeccion(e), e);
});

test("avisoTiempo: solo al cruzar 10, 5 y 1 minuto", () => {
  assert.equal(SIM.avisoTiempo(601, 600), "Quedan 10 minutos de esta sección.");
  assert.equal(SIM.avisoTiempo(301, 299), "Quedan 5 minutos de esta sección.");
  assert.equal(SIM.avisoTiempo(61, 60), "Queda 1 minuto de esta sección.");
  assert.equal(SIM.avisoTiempo(500, 499), null);
  assert.equal(SIM.avisoTiempo(null, 10), null);
  assert.equal(SIM.reloj(3599), "59:59");
  assert.equal(SIM.reloj(-4), "00:00");
});

test("resultadoDe: objetivas puntuadas solas, productivas pendientes en modo banco", () => {
  const e = SIM.preparaSimulacro(BANK, "completo", semilla(11));
  // Todo bien en el Core y nada en el resto.
  const core = e.secciones[0].partes[0].data.questions;
  e.resp[0][0] = Object.fromEntries(core.map((q, i) => [i, q.correct]));
  const r = SIM.resultadoDe(e);
  assert.equal(r.destrezas.core.puntos, 50);
  assert.equal(r.destrezas.core.nivel, "C");
  assert.equal(r.destrezas.writing.puntos, null);
  assert.equal(r.destrezas.writing.fuente, "pendiente");
  assert.equal(r.total.incompleto, true);
  assert.ok(r.total.max === 100, "solo reading y listening suman: el Core va aparte");
  assert.equal(r.total.puntos, r.destrezas.reading.puntos + r.destrezas.listening.puntos);
});

test("resultadoDe: autoevaluación, «sin puntuar» y total con nivel global", () => {
  const e = SIM.preparaSimulacro(BANK, "completo", semilla(5));
  const iw = e.secciones.findIndex((s) => s.skill === "writing");
  const is = e.secciones.findIndex((s) => s.skill === "speaking");
  e.resp[iw] = e.secciones[iw].partes.map(() => ({ 0: "some words here" }));
  e.calif[iw] = { fuente: "autoevaluacion", niveles: ["B2", "B2", "B2", "B2"] };
  e.calif[is] = { fuente: "sin" };
  const r = SIM.resultadoDe(e);
  assert.equal(r.destrezas.writing.nivel, "B2");
  assert.equal(r.destrezas.writing.fuente, "autoevaluacion");
  assert.equal(r.destrezas.speaking.puntos, null);
  assert.equal(r.destrezas.speaking.fuente, "sin");
  assert.equal(r.total.max, 150);
  assert.ok(r.total.nivel);
});

test("resultadoDe: si solo hay Core, el total es el Core", () => {
  const e = SIM.preparaSimulacro(BANK, "core", semilla());
  const r = SIM.resultadoDe(e);
  assert.equal(r.total.max, 50);
  assert.equal(r.total.puntos, r.destrezas.core.puntos);
  assert.equal(r.total.incompleto, false);
});

test("historial: la entrada pasa la validación de normalizaProgreso y se sustituye por id", () => {
  const e = SIM.preparaSimulacro(BANK, "completo", semilla(9));
  const ent = SIM.entradaHistorial(e, "2026-10-16");
  assert.ok(simulacroValido(ent));
  const prog = normalizaProgreso(JSON.parse(JSON.stringify({ simulacros: [ent] })));
  assert.deepEqual(prog.simulacros, [ent]);

  let lista = SIM.anadeAlHistorial([], ent);
  lista = SIM.anadeAlHistorial(lista, { ...ent, total: { ...ent.total, puntos: 1 } });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].total.puntos, 1);
  const muchos = Array.from({ length: 40 }, (_, i) => ({ ...ent, id: `x${i}` })).reduce((l, x) => SIM.anadeAlHistorial(l, x), []);
  assert.equal(muchos.length, 30);
  assert.equal(muchos[0].id, "x39");
});

test("normalizaProgreso: descarta entradas de simulacro mal formadas y conserva las buenas", () => {
  const buena = { id: "a", fecha: "2026-10-16", modo: "core", destrezas: { core: { puntos: 30 } }, total: { puntos: 30 } };
  const r = normalizaProgreso({ simulacros: [buena, null, { id: 1 }, { ...buena, destrezas: { core: { puntos: 99 } } }, { ...buena, total: null }] });
  assert.deepEqual(r.simulacros, [buena]);
  assert.deepEqual(normalizaProgreso({ simulacros: "x" }).simulacros, []);
});

test("estadoValido: rechaza lo que no es un simulacro en curso", () => {
  assert.equal(SIM.estadoValido(null), false);
  assert.equal(SIM.estadoValido({ v: 1 }), false);
  const e = SIM.preparaSimulacro(BANK, "core", semilla());
  assert.equal(SIM.estadoValido({ ...e, resp: [] }), false);
  assert.equal(SIM.estadoValido({ ...e, fase: "otra" }), false);
});
