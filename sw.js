/**
 * Service worker de la app Ruta B2.
 *
 * Guarda en caché la página, el banco de ejercicios y las librerías de
 * vendor/, para que el modo sin clave funcione sin conexión. Las llamadas a la
 * API (Anthropic o el Worker) y las fuentes de Google no pasan por aquí.
 *
 * Estrategia: se responde primero desde la caché y se pide la versión nueva en
 * segundo plano, así que una actualización se ve en la siguiente carga.
 * Al cambiar app.js (npm run build) o algo en vendor/ conviene subir VERSION
 * para vaciar la caché vieja.
 */

const VERSION = "2026-11-25-1";
const CACHE = `aptis-b2-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "app.js",
  "banco.js",
  "parse-json.js",
  "logica.js",
  "simulacro.js",
  "manifest.webmanifest",
  "privacidad.html",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "vendor/react.production.min.js",
  "vendor/react-dom.production.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache.addAll() es todo o nada: si una sola URL de SHELL falla al
      // pedirse (una red intermitente, lo normal en móvil), no se cachea
      // ninguna y el modo sin clave se queda sin funcionar sin conexión,
      // aunque casi todo lo demás se pudiera haber descargado bien. Con
      // allSettled, lo que se puede cachear se cachea aunque algo falle.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Solo lo nuestro: la API, el Worker y las fuentes siguen yendo a la red.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        // No esperamos a la red: la actualización queda para la próxima vez.
        event.waitUntil(fresh);
        return cached;
      }
      const res = await fresh;
      if (res) return res;
      // Sin red y sin copia exacta de esta URL (por ejemplo, se abrió con un
      // hash o una ruta que no coincide con ninguna del SHELL): si es una
      // navegación, mejor abrir el cascarón ya cacheado que un error en
      // blanco. Importa sobre todo en Safari/iOS, donde la coincidencia de
      // caché al reabrir la app puede no ser exacta.
      if (request.mode === "navigate") {
        const shell = await cache.match("index.html");
        if (shell) return shell;
      }
      return new Response("Sin conexión y sin copia guardada de esta página.", {
        status: 503, headers: { "content-type": "text/plain; charset=utf-8" },
      });
    })
  );
});
