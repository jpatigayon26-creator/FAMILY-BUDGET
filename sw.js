const CACHE = 'family-budget-v2';

// On install — cache the main HTML page
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll([
        '/',
        '/budget_standalone.html',
        '/index.html',
      ]).catch(() => {
        // If some fail, still install
      });
    }).then(() => self.skipWaiting())
  );
});

// On activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// On fetch — serve from cache first, fall back to network, cache new responses
self.addEventListener('fetch', e => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  // Don't intercept Supabase or external API calls — those need live network
  const url = new URL(e.request.url);
  const isExternal = url.hostname.includes('supabase.co') ||
                     url.hostname.includes('exchangerate-api.com') ||
                     url.hostname.includes('sheetjs.com');
  if (isExternal) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Serve from cache, but also refresh in background
        const fetchPromise = fetch(e.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE).then(cache => cache.put(e.request, response.clone()));
          }
          return response;
        }).catch(() => {});
        return cached;
      }

      // Not in cache — fetch from network and cache it
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => caches.match('/budget_standalone.html'));
    })
  );
});
