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

const esObjetoPlano = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/*
 * Un progreso guardado o importado con forma incorrecta (p.ej. {"errors":null})
 * rompía la app de por vida, porque se guarda tal cual y load() lo recarga roto
 * en cada visita. Cada campo se acepta solo si tiene el tipo correcto; si no,
 * se sustituye por su valor por defecto.
 */
function normalizaProgreso(data) {
  const d = esObjetoPlano(data) ? data : {};
  return {
    days: esObjetoPlano(d.days) ? d.days : {},
    skills: esObjetoPlano(d.skills) ? d.skills : {},
    lessons: esObjetoPlano(d.lessons) ? d.lessons : {},
    errors: Array.isArray(d.errors) ? d.errors : [],
    seen: Array.isArray(d.seen) ? d.seen : [],
    usedTopics: Array.isArray(d.usedTopics) ? d.usedTopics : [],
  };
}

/*
 * generate() en index.html solo debe reintentar una llamada al modelo si el
 * fallo es de red o de parseo del JSON de la respuesta: un error de estado
 * HTTP (clave inválida, límite de peticiones, cupo agotado, sin saldo...) es
 * determinista y repetirlo no cambia el resultado. callClaude() marca esos
 * errores con reintentable=false; todo lo demás (incluidos los de parseJSON,
 * que no se tocan) se considera reintentable por defecto.
 */
const reintentable = (err) => err?.reintentable !== false;

/*
 * El Worker expone el cupo mensual en las cabeceras x-quota-limit y
 * x-quota-used de cada respuesta a un suscriptor con código. callClaude()
 * en index.html las lee con esta función y le pasa get=header=>valor
 * (p.ej. res.headers.get). Si faltan o no son números válidos no hay cupo
 * que mostrar: null, no un objeto a medias.
 */
function cupoDeCabeceras(get) {
  const l = get("x-quota-limit");
  const u = get("x-quota-used");
  if (l == null || u == null) return null;
  const limite = Number(l);
  const usados = Number(u);
  if (!Number.isFinite(limite) || !Number.isFinite(usados) || limite < 0 || usados < 0) return null;
  return { limite, usados, quedan: Math.max(0, limite - usados) };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    key, back, fp, level, pctOf, noVistos, streakOf, normalizaProgreso, reintentable, cupoDeCabeceras,
  };
}
