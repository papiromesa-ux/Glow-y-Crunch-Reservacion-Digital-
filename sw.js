/* ==========================================================
   Glow & Crunch — Panel administrativo · Service Worker
   Cada vez que cambies archivos de la app, sube el número de
   VERSION (por ejemplo gc-admin-v19) para forzar la actualización.
   ========================================================== */

const PREFIJO = 'gc-admin-';               // este SW solo toca cachés que empiecen así
const VERSION = 'gc-admin-v18-icono-neon';

// Archivos básicos para que la app abra rápido y funcione sin internet.
// Si alguno no existe en el repo, no pasa nada: se salta y todo sigue normal.
const RECURSOS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './signature.png',
  './firma.png'
  './ALACRÁN.png',
];

/* ---------- INSTALAR: guardar lo básico ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(RECURSOS.map(async (ruta) => {
      try {
        const respuesta = await fetch(new Request(ruta, { cache: 'reload' }));
        if (respuesta.ok) await cache.put(ruta, respuesta);
      } catch (error) {
        /* archivo faltante o sin conexión: se ignora */
      }
    }));
    await self.skipWaiting();
  })());
});

/* ---------- ACTIVAR: borrar versiones viejas (solo de esta app) ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(
      nombres
        .filter((nombre) => nombre.startsWith(PREFIJO) && nombre !== VERSION)
        .map((nombre) => caches.delete(nombre))
    );
    await self.clients.claim();
  })());
});

/* ---------- PETICIONES ---------- */
self.addEventListener('fetch', (event) => {
  const peticion = event.request;

  // Solo GET y solo archivos de este mismo sitio.
  // Firebase, Google y las librerías externas pasan directo, sin tocarlas.
  if (peticion.method !== 'GET') return;
  if (peticion.cache === 'only-if-cached' && peticion.mode !== 'same-origin') return;
  const url = new URL(peticion.url);
  if (url.origin !== self.location.origin) return;

  // El video (y cualquier petición "por pedazos") se deja pasar:
  // guardarlo en el caché del service worker suele romper la reproducción.
  if (
    peticion.headers.has('range') ||
    peticion.destination === 'video' ||
    peticion.destination === 'audio' ||
    url.pathname.toLowerCase().endsWith('.mp4')
  ) return;

  // Páginas (index.html): primero internet; si no hay, la copia guardada.
  if (peticion.mode === 'navigate') {
    event.respondWith(paginaPrimeroInternet(event));
    return;
  }

  // Íconos, imágenes, manifest: salen rápido del caché y se actualizan atrás.
  event.respondWith(cacheYActualizar(event));
});

async function paginaPrimeroInternet(event) {
  const peticion = event.request;
  const cache = await caches.open(VERSION);
  try {
    const respuesta = await fetch(peticion);
    if (respuesta && respuesta.ok) {
      event.waitUntil(cache.put(peticion, respuesta.clone()));
    }
    return respuesta;
  } catch (error) {
    const guardada =
      (await cache.match(peticion, { ignoreSearch: true })) ||
      (await cache.match('./index.html')) ||
      (await cache.match('./'));
    return guardada || new Response('Sin conexión. Vuelve a intentar cuando tengas internet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function cacheYActualizar(event) {
  const peticion = event.request;
  const cache = await caches.open(VERSION);
  const guardado = await cache.match(peticion);

  const desdeInternet = fetch(peticion)
    .then((respuesta) => {
      if (respuesta && respuesta.status === 200) cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => null);

  event.waitUntil(desdeInternet);

  return guardado || (await desdeInternet) || new Response('', { status: 504 });
}
