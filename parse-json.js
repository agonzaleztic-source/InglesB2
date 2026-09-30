/**
 * Extrae el primer JSON (objeto o array) que aparezca en la respuesta del
 * modelo, ignorando vallas ```json y cualquier texto alrededor.
 */
function parseJSON(raw) {
  const t = String(raw).trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const starts = ["[", "{"].map((c) => t.indexOf(c)).filter((i) => i >= 0);
  if (!starts.length) throw new Error("sin JSON");
  const s = Math.min(...starts);
  const e = closingIndex(t, s);
  if (e < 0) throw new Error("JSON sin cerrar");
  return JSON.parse(t.slice(s, e + 1));
}

/*
 * Empareja corchetes/llaves contando profundidad y saltándose el contenido
 * de las cadenas (comillas escapadas incluidas), para no cortar en un ] o }
 * que aparezca dentro de un string o en texto explicativo después del JSON.
 */
function closingIndex(t, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = parseJSON;
}
