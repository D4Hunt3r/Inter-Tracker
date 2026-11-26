/* CA Intermediate Study Tracker — Offline-First Auto-Updating Service Worker */
const CACHE_NAME = 'ca-inter-tracker-pwa-v11-0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // NEVER intercept GitHub API / Gist Cloud Sync calls — always go live to network
  if (url.hostname === 'api.github.com' || url.hostname.endsWith('.githubusercontent.com') || url.hostname === 'github.com') {
    return;
  }

  // Same-origin navigation / HTML / manifest: Network-First so GitHub Pages updates apply automatically,
  // with instant Cache fallback when offline.
  if (url.origin === self.location.origin) {
    const isDoc = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('manifest.json');
    if (isDoc) {
      event.respondWith(
        fetch(req, { cache: 'no-cache' })
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(c => {
                c.put(req, copy.clone());
                if (req.mode === 'navigate') c.put('./index.html', copy);
              });
            }
            return res;
          })
          .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html') || caches.match('./')))
      );
      return;
    }

    // Static icons / same-origin assets: Cache-First with background refresh
    event.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
    return;
  }

  // Optional Google Fonts: Cache-First with silent offline fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => new Response('', { status: 204 })))
    );
  }
});
