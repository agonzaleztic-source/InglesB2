/**
 * Compila src/app.jsx (el código de la app, con JSX) a app.js, JavaScript
 * normal que el navegador ejecuta tal cual. Antes lo hacía Babel standalone en
 * el propio navegador en cada carga.
 *
 * Uso:  npm run build        (tras cualquier cambio en src/app.jsx)
 *
 * app.js se commitea: GitHub Pages sirve la raíz de master sin paso de build.
 * tests/build.test.mjs falla si app.js no corresponde al src/app.jsx actual.
 *
 * Solo se transforma el JSX (a React.createElement, igual que hacía Babel con
 * el preset "react"): React y ReactDOM siguen siendo los globales de vendor/,
 * y el resto del código sale sin tocar, en el mismo ámbito global de antes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
export const FUENTE = path.join(RAIZ, "src", "app.jsx");
export const SALIDA = path.join(RAIZ, "app.js");

// Con core.autocrlf, Windows ve CRLF y el CI (Linux) LF: se normaliza para que
// el hash y la salida sean los mismos en los dos sitios.
export const normaliza = (s) => s.replace(/\r\n/g, "\n");

export function hashDe(fuente) {
  return createHash("sha256").update(normaliza(fuente)).digest("hex");
}

export function cabecera(fuente) {
  return `// GENERADO con \`npm run build\` desde src/app.jsx: no editar a mano.\n` +
    `// sha256 de src/app.jsx: ${hashDe(fuente)}\n`;
}

export async function compila(fuente) {
  const { transform } = await import("esbuild");
  const { code } = await transform(normaliza(fuente), {
    loader: "jsx",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    target: "esnext",
    charset: "utf8",
    legalComments: "inline",
    sourcefile: "src/app.jsx",
  });
  return cabecera(fuente) + code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fuente = readFileSync(FUENTE, "utf8");
  writeFileSync(SALIDA, await compila(fuente));
  console.log(`app.js generado desde src/app.jsx (${hashDe(fuente).slice(0, 12)}…)`);
}
