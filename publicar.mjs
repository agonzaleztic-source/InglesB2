/**
 * Publica la app en Cloudflare Pages con solo los ficheros que necesita el
 * navegador. Así el Worker, la documentación, la licencia y el histórico no se
 * sirven en la web aunque el repositorio sea privado.
 *
 * Uso:  node publicar.mjs            (primera vez: hace falta `npx wrangler login`)
 *       node publicar.mjs --solo-copiar   (solo prepara _publicar/, sin subir)
 *
 * Al cambiar algo de vendor/ o del banco, sube VERSION en sw.js antes.
 */
import { cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PROYECTO = "inglesb2";
const DESTINO = "_publicar";
const PUBLICOS = [
  "index.html", "banco.js", "sw.js", "manifest.webmanifest", "privacidad.html",
  "icons", "vendor",
];

rmSync(DESTINO, { recursive: true, force: true });
mkdirSync(DESTINO);
for (const p of PUBLICOS) cpSync(p, `${DESTINO}/${p}`, { recursive: true });

// El service worker y el manifest no deben quedarse cacheados por el CDN:
// si no, una versión nueva tarda en llegar a quien ya tiene la app.
writeFileSync(`${DESTINO}/_headers`, [
  "/sw.js", "  Cache-Control: no-cache", "",
  "/manifest.webmanifest", "  Cache-Control: no-cache", "",
  "/index.html", "  Cache-Control: no-cache", "",
].join("\n"));

console.log(`Preparado ${DESTINO}/ con: ${PUBLICOS.join(", ")}`);
if (process.argv.includes("--solo-copiar")) process.exit(0);

const r = spawnSync("npx", ["--yes", "wrangler", "pages", "deploy", DESTINO,
  "--project-name", PROYECTO, "--branch", "main", "--commit-dirty=true"],
  { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
