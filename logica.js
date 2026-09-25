/**
 * Funciones puras compartidas por la app: fechas, huellas de texto, nivel
 * a partir del porcentaje y selección de ejercicios no vistos. Sin estado,
 * sin DOM: se pueden probar con node:test sin cargar React ni el banco.
 */
const key = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const back = (n, now = new Date()) => { const d = new Date(now); d.setDate(d.getDate() - n); return key(d); };
const fp = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 45);
const level = (p) => (p >= 90 ? "C" : p >= 75 ? "B2" : p >= 55 ? "B1" : p >= 35 ? "A2" : "A1");
const pctOf = (lv) => ({ C: 92, B2: 78, B1: 60, A2: 42 }[lv] ?? 50);

/* Coge lo que aún no hayas visto; si ya lo has visto todo, vuelve a empezar. */
const noVistos = (lista, huella, vistos) => {
  const nuevos = lista.filter((x) => !vistos.includes(huella(x)));
  return nuevos.length ? nuevos : lista;
};

function streakOf(days, now = new Date()) {
  let n = 0;
  if (!days[back(0, now)]?.done && !days[back(1, now)]?.done) return 0;
  for (let i = days[back(0, now)]?.done ? 0 : 1; i < 400; i++) {
    if (days[back(i, now)]?.done) n++; else break;
  }
  return n;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { key, back, fp, level, pctOf, noVistos, streakOf };
}
