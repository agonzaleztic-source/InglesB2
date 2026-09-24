/**
 * Extrae el primer JSON (objeto o array) que aparezca en la respuesta del
 * modelo, ignorando vallas ```json y cualquier texto alrededor.
 */
function parseJSON(raw) {
  const t = String(raw).trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const starts = ["[", "{"].map((c) => t.indexOf(c)).filter((i) => i >= 0);
  if (!starts.length) throw new Error("sin JSON");
  const s = Math.min(...starts);
  const e = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  return JSON.parse(t.slice(s, e + 1));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = parseJSON;
}
