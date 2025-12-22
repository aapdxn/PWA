const CACHE_VERSION = 'v2.2.1'; // Increment version
const CACHE_NAME = `vault-budget-${CACHE_VERSION}`;

// Cache only local files that exist
const urlsToCache = [
    './',
    './index.html',
    './css/styles.css',
    './app.js',
    './js/security-manager.js',
    './js/database.js',
    './js/csv-importer.js',
    './manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('[SW] Installing:', CACHE_VERSION);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell');
                return Promise.all(
                    urlsToCache.map(url => 
                        cache.add(url).catch(err => {
                            console.warn('[SW] Failed to cache:', url);
                            return null;
                        })
                    )
                );
            })
            .then(() => {
                console.log('[SW] Install complete');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Install failed:', err);
            })
    );
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating:', CACHE_VERSION);
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((name) => {
                        if (name !== CACHE_NAME) {
                            console.log('[SW] Deleting cache:', name);
                            return caches.delete(name);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - network first for HTML, cache first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Skip non-http and external requests
    if (!url.protocol.startsWith('http') || url.hostname !== location.hostname) {
        return;
    }
    
    // Network first for HTML
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }
    
    // Cache first for assets
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});

// Message handler
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
