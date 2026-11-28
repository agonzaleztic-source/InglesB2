#!/usr/bin/env node
// Comprobación previa al lanzamiento, sin red ni claves: lee wrangler.toml,
// worker.js, DESPLIEGUE.md e index.html del repo (o de la carpeta que se
// pase como primer argumento, para poder probarlo sobre copias alteradas) y
// avisa de incoherencias entre ellos. No llama a Cloudflare, Lemon Squeezy ni
// Resend, no ejecuta wrangler y no lee ningún .env*.
//
// Uso: node scripts/prelanzamiento.mjs [carpeta]
// Sale con código 0 si todo es coherente, o 1 si encuentra algún problema
// (cada uno se imprime en una línea, en español).

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SECRETOS = [
  "ANTHROPIC_API_KEY",
  "ADMIN_SECRET",
  "APP_PASS",
  "LEMONSQUEEZY_SIGNING_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "STRIPE_WEBHOOK_SECRET",
];

function leer(ruta) {
  // Normaliza CRLF a LF: en Windows git deja estos ficheros con CRLF y las
  // comprobaciones de abajo no deben depender del final de línea.
  return readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
}

function quitarComentarioToml(linea) {
  let dentroDeComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') dentroDeComillas = !dentroDeComillas;
    else if (c === "#" && !dentroDeComillas) return linea.slice(0, i);
  }
  return linea;
}

function valorToml(crudo) {
  const v = crudo.trim();
  if (/^".*"$/.test(v)) return v.slice(1, -1);
  return v;
}

// Parser mínimo de TOML, hecho a medida de wrangler.toml: valores sueltos en
// la raíz, tablas [seccion] (una sola, se sobrescribe) y tablas repetibles
// [[seccion]] (una entrada nueva cada vez que aparece el encabezado).
function parseToml(contenido) {
  const raiz = {};
  const secciones = {};
  const seccionesRepetibles = {};
  let actual = raiz;
  for (const bruta of contenido.split("\n")) {
    const linea = quitarComentarioToml(bruta).trim();
    if (!linea) continue;
    let m = linea.match(/^\[\[([^\]]+)\]\]$/);
    if (m) {
      const nombre = m[1].trim();
      seccionesRepetibles[nombre] = seccionesRepetibles[nombre] || [];
      const obj = {};
      seccionesRepetibles[nombre].push(obj);
      actual = obj;
      continue;
    }
    m = linea.match(/^\[([^\]]+)\]$/);
    if (m) {
      const nombre = m[1].trim();
      secciones[nombre] = secciones[nombre] || {};
      actual = secciones[nombre];
      continue;
    }
    m = linea.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (m) actual[m[1]] = valorToml(m[2]);
  }
  return { raiz, secciones, seccionesRepetibles };
}

function comprobarWrangler(toml) {
  const errores = [];
  const { raiz, secciones, seccionesRepetibles } = toml;

  if (!raiz.name) errores.push('wrangler.toml: falta "name" en la raíz.');
  if (raiz.main !== "worker.js") {
    errores.push(`wrangler.toml: "main" debe ser "worker.js" (es ${JSON.stringify(raiz.main ?? null)}).`);
  }

  const kv = seccionesRepetibles.kv_namespaces || [];
  const rateLimit = kv.find((e) => e.binding === "RATE_LIMIT");
  if (!rateLimit) {
    errores.push('wrangler.toml: falta el binding KV "RATE_LIMIT" en un bloque [[kv_namespaces]].');
  } else if (!rateLimit.id) {
    errores.push('wrangler.toml: el binding KV "RATE_LIMIT" no tiene "id".');
  }

  const vars = secciones.vars || {};
  for (const clave of Object.keys(vars)) {
    if (SECRETOS.includes(clave)) {
      errores.push(`wrangler.toml: "${clave}" es un secreto y no debe ir en [vars] (usa wrangler secret put).`);
    }
  }

  const appUrl = vars.APP_URL;
  const allowedOrigin = vars.ALLOWED_ORIGIN;
  if (!appUrl) {
    errores.push("wrangler.toml: falta APP_URL en [vars].");
  } else {
    if (!appUrl.endsWith("/")) {
      errores.push(`wrangler.toml: APP_URL debe terminar en "/" (es "${appUrl}").`);
    }
    let origen = null;
    try {
      origen = new URL(appUrl).origin;
    } catch {
      errores.push(`wrangler.toml: APP_URL no es una URL válida ("${appUrl}").`);
    }
    if (origen) {
      const permitidos = String(allowedOrigin || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!permitidos.includes(origen)) {
        errores.push(`wrangler.toml: el origen de APP_URL (${origen}) no está en ALLOWED_ORIGIN (${permitidos.join(", ") || "vacío"}).`);
      }
    }
  }

  return errores;
}

// Variables de entorno que usa worker.js como env.NOMBRE, fuera del
// comentario inicial del fichero (donde aparecen como documentación, no
// como uso real).
function variablesUsadas(workerJs) {
  const cabecera = workerJs.match(/^\/\*\*[\s\S]*?\*\//);
  const cuerpo = cabecera ? workerJs.slice(cabecera.index + cabecera[0].length) : workerJs;
  const nombres = new Set();
  // Los nombres reales tienen siempre más de una letra; "env.X" de un
  // comentario de ejemplo (explicando envNum) no debe contar como uso.
  for (const m of cuerpo.matchAll(/env\.([A-Z][A-Z0-9_]*)/g)) {
    if (m[1].length > 1) nombres.add(m[1]);
  }
  return { cabecera: cabecera ? cabecera[0] : "", nombres };
}

function comprobarVariablesDocumentadas(workerJs, despliegueMd) {
  const errores = [];
  const { cabecera, nombres } = variablesUsadas(workerJs);
  for (const nombre of nombres) {
    if (!cabecera.includes(nombre)) {
      errores.push(`worker.js: ${nombre} se usa en el código pero no aparece en el comentario inicial del fichero.`);
    }
    if (!despliegueMd.includes(nombre)) {
      errores.push(`DESPLIEGUE.md: falta documentar ${nombre} (lo usa worker.js).`);
    }
  }
  return errores;
}

// Eventos de Lemon Squeezy que trata handleLemonEvent, mirando los
// `name === "..."` dentro de esa función (hasta que empieza la sección
// obsoleta de Stripe, o el final del fichero si no la encuentra).
function eventosTratados(workerJs) {
  const inicio = workerJs.indexOf("async function handleLemonEvent");
  if (inicio === -1) return new Set();
  const finMarcador = workerJs.indexOf("pagos: webhook de Stripe", inicio);
  const cuerpo = workerJs.slice(inicio, finMarcador === -1 ? workerJs.length : finMarcador);
  const eventos = new Set();
  for (const m of cuerpo.matchAll(/name === "([a-z_]+)"/g)) eventos.add(m[1]);
  return eventos;
}

// Eventos listados en la frase "Eventos: `a`, `b` y `c`." del paso 3 de
// DESPLIEGUE.md ("Cobrar con Lemon Squeezy").
function eventosDocumentados(despliegueMd) {
  const inicio = despliegueMd.indexOf("Eventos:");
  if (inicio === -1) return null;
  let fin = despliegueMd.indexOf(".", inicio);
  if (fin === -1) fin = Math.min(despliegueMd.length, inicio + 600);
  const trozo = despliegueMd.slice(inicio, fin + 1);
  const eventos = new Set();
  for (const m of trozo.matchAll(/`([a-z_]+)`/g)) eventos.add(m[1]);
  return eventos;
}

function comprobarEventos(workerJs, despliegueMd) {
  const errores = [];
  const delCodigo = eventosTratados(workerJs);
  const delDocumento = eventosDocumentados(despliegueMd);
  if (delDocumento === null) {
    errores.push('DESPLIEGUE.md: no se encuentra la lista de "Eventos:" del paso 3 de "Cobrar con Lemon Squeezy".');
    return errores;
  }
  for (const ev of delCodigo) {
    if (!delDocumento.has(ev)) {
      errores.push(`DESPLIEGUE.md: falta "${ev}" en la lista de eventos del paso 3 (handleLemonEvent lo trata).`);
    }
  }
  for (const ev of delDocumento) {
    if (!delCodigo.has(ev)) {
      errores.push(`DESPLIEGUE.md: "${ev}" aparece en la lista de eventos del paso 3, pero handleLemonEvent no lo trata.`);
    }
  }
  return errores;
}

function comprobarEnlaceActivacion(workerJs, indexHtml) {
  const errores = [];
  if (!workerJs.includes("#worker=${encodeURIComponent(")) {
    errores.push('worker.js: no se encuentra el enlace "#worker=${encodeURIComponent(...)}" que construye sendCodeEmail.');
  }
  if (!indexHtml.includes("/^#worker=(.*)$/")) {
    errores.push('index.html: no se encuentra la regex "/^#worker=(.*)$/" que lee el enlace de activación.');
  }
  return errores;
}

function main() {
  const carpeta = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), "..");

  const errores = [];
  let wranglerToml, workerJs, despliegueMd, indexHtml;
  try {
    wranglerToml = leer(join(carpeta, "wrangler.toml"));
  } catch (e) {
    errores.push(`No se pudo leer wrangler.toml: ${e.message}`);
  }
  try {
    workerJs = leer(join(carpeta, "worker.js"));
  } catch (e) {
    errores.push(`No se pudo leer worker.js: ${e.message}`);
  }
  try {
    despliegueMd = leer(join(carpeta, "DESPLIEGUE.md"));
  } catch (e) {
    errores.push(`No se pudo leer DESPLIEGUE.md: ${e.message}`);
  }
  try {
    indexHtml = leer(join(carpeta, "index.html"));
  } catch (e) {
    errores.push(`No se pudo leer index.html: ${e.message}`);
  }

  if (wranglerToml !== undefined) {
    errores.push(...comprobarWrangler(parseToml(wranglerToml)));
  }
  if (workerJs !== undefined && despliegueMd !== undefined) {
    errores.push(...comprobarVariablesDocumentadas(workerJs, despliegueMd));
    errores.push(...comprobarEventos(workerJs, despliegueMd));
  }
  if (workerJs !== undefined && indexHtml !== undefined) {
    errores.push(...comprobarEnlaceActivacion(workerJs, indexHtml));
  }

  if (errores.length === 0) {
    console.log("✓ Comprobación previa al lanzamiento: todo coherente.");
    process.exit(0);
  }

  console.error(`✗ Comprobación previa al lanzamiento: ${errores.length} problema(s):`);
  for (const e of errores) console.error(`  - ${e}`);
  process.exit(1);
}

main();
