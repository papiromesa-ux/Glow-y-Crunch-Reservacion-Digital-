// =====================================================
// Service Worker — Glow & Crunch Admin
// Versión: gc-admin-v8-pdf-iframe
// =====================================================

const VERSION = 'gc-admin-v8-pdf-iframe';

const CACHE_NAME = 'glow-crunch-' + VERSION;
const RECURSOS = [
  './',
  './index.html',
  './manifest.json',
  './firma.png',
  './ALACR%C3%81N.mp4'
];

// -------- INSTALAR --------
self.addEventListener('install', function(event) {
  console.log('[SW] Instalando versión:', VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        RECURSOS.map(function(r) {
          return cache.add(r).catch(function(err) {
            console.warn('[SW] No se pudo cachear:', r, err);
          });
        })
      );
    })
  );
});

// -------- ACTIVAR --------
self.addEventListener('activate', function(event) {
  console.log('[SW] Activando versión:', VERSION);
  event.waitUntil(
    caches.keys().then(function(nombres) {
      return Promise.all(
        nombres.map(function(nombre) {
          if (nombre !== CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', nombre);
            return caches.delete(nombre);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// -------- FETCH --------
self.addEventListener('fetch', function(event) {
  var req = event.request;
  var url = new URL(req.url);

  // Ignorar externos (Firebase, Google, CDN)
  if (
    url.hostname.indexOf('firebase') !== -1 ||
    url.hostname.indexOf('google') !== -1 ||
    url.hostname.indexOf('gstatic') !== -1 ||
    url.hostname.indexOf('cdnjs') !== -1 ||
    url.hostname.indexOf('jsdelivr') !== -1
  ) {
    return;
  }

  // Solo GET del mismo origen
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // HTML → NETWORK FIRST
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(function(resp) {
          var copia = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, copia);
          });
          return resp;
        })
        .catch(function() {
          return caches.match(req).then(function(r) {
            return r || caches.match('./index.html');
          });
        })
    );
    return;
  }

  // Video → NETWORK FIRST
  if (req.destination === 'video' || url.pathname.indexOf('.mp4') !== -1) {
    event.respondWith(
      fetch(req)
        .then(function(resp) {
          var copia = resp.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, copia);
          });
          return resp;
        })
        .catch(function() {
          return caches.match(req);
        })
    );
    return;
  }

  // Resto → CACHE FIRST
  event.respondWith(
    caches.match(req).then(function(cacheado) {
      return cacheado || fetch(req).then(function(resp) {
        var copia = resp.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, copia);
        });
        return resp;
      });
    })
  );
});

// -------- Mensaje para forzar skipWaiting --------
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
