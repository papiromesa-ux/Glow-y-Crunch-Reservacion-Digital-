// =====================================================
// Service Worker — Glow & Crunch Admin
// Versión: gc-admin-v4-rosa
// Al cambiar el número de versión, fuerza actualización
// en TODOS los dispositivos automáticamente.
// =====================================================

const VERSION = 'gc-admin-v4-rosa';

const CACHE_NAME = `glow-crunch-${VERSION}`;
const RECURSOS = [
  './',
  './index.html',
  './manifest.json'
];

// -------- INSTALAR: toma control inmediato --------
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versión:', VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(RECURSOS).catch((err) => {
        console.warn('[SW] No se pudieron pre-cachear todos los recursos:', err);
      });
    })
  );
});

// -------- ACTIVAR: borra TODOS los cachés viejos --------
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando versión:', VERSION);
  event.waitUntil(
    caches.keys().then((nombres) => {
      return Promise.all(
        nombres.map((nombre) => {
          if (nombre !== CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', nombre);
            return caches.delete(nombre);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// -------- FETCH: HTML siempre desde la red --------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar Firebase, Google, etc.
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('gstatic') ||
    url.hostname.includes('cdnjs') ||
    url.hostname.includes('jsdelivr')
  ) {
    return;
  }

  // Solo GET del mismo origen
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // HTML → NETWORK FIRST (siempre la última versión)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Resto → CACHE FIRST con respaldo en red
  event.respondWith(
    caches.match(req).then((cacheado) => {
      return cacheado || fetch(req).then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
        return resp;
      });
    })
  );
});

// -------- Mensaje para forzar skipWaiting desde la app --------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});