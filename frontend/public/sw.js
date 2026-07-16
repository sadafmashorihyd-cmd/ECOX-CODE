// GaiaVolt Service Worker — PWA offline support
const CACHE_NAME = 'gaiavolt-v1';
const STATIC_ASSETS = [
    '/',
    '/verify',
    '/evolution',
    '/bridges',
    '/nfts',
    '/vault',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // API calls skip karo — offline mode mein cache nahi hongi
    if (
        e.request.method !== 'GET' ||
        e.request.url.includes('/api/') ||
        e.request.url.includes('hf.space') ||
        e.request.url.includes('127.0.0.1:8000') ||
        e.request.url.includes('chrome-extension')
    ) {
        return;
    }

    // Network first, cache fallback
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});