// =====================================================
// Service Worker — Glow & Crunch Admin
// Versión: gc-admin-v6-perfil
// Al cambiar este número, fuerza actualización
// en TODOS los dispositivos automáticamente.
// =====================================================

const VERSION = 'gc-admin-v6-perfil';

const CACHE_NAME = `glow-crunch-${VERSION}`;
const RECURSOS = [
  './',
  './index.html',
  './manifest.json',
  './firma.png',
  './ALACR%C3%81N.mp4'
];

// -------- INSTALAR: toma control inmediato --------
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando versión:', VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // add() uno por uno para que sea tolerante si algún archivo no existe
      return Promise.all(
        RECURSOS.map((r) =>
          cache.add(r).catch((err) => {
            console.warn('[SW] No se pudo cachear:', r, err);
          })
        )
      );
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

// -------- FETCH --------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignorar externos (Firebase, Google, CDN)
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

  // Video → NETWORK FIRST (por si es pesado, no bloquear)
  if (req.destination === 'video' || url.pathname.endsWith('.mp4')) {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
          return resp;
        })
        .catch(() => caches.match(req))
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
