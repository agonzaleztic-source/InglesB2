/**
 * Service worker de la app Aptis B2.
 *
 * Guarda en caché la página, el banco de ejercicios y las librerías de
 * vendor/, para que el modo sin clave funcione sin conexión. Las llamadas a la
 * API (Anthropic o el Worker) y las fuentes de Google no pasan por aquí.
 *
 * Estrategia: se responde primero desde la caché y se pide la versión nueva en
 * segundo plano, así que una actualización se ve en la siguiente carga.
 * Al cambiar algo en vendor/ conviene subir VERSION para vaciar la caché vieja.
 */

const VERSION = "2026-09-24-2";
const CACHE = `aptis-b2-${VERSION}`;
const SHELL = [
  "./",
  "index.html",
  "banco.js",
  "parse-json.js",
  "manifest.webmanifest",
  "privacidad.html",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "vendor/react.production.min.js",
  "vendor/react-dom.production.min.js",
  "vendor/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
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
      return new Response("Sin conexión y sin copia guardada de esta página.", {
        status: 503, headers: { "content-type": "text/plain; charset=utf-8" },
      });
    })
  );
});
