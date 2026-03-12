const CACHE_NAME = 'tulip-calc-v3';
const urlsToCache = [
  '/tulip-calculator/',
  '/tulip-calculator/index.html',
  '/tulip-calculator/calculator.html',
  '/tulip-calculator/manifest.json',
  '/tulip-calculator/icon-192.png',
  '/tulip-calculator/icon-512.png'
];

// 安裝時快取檔案
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// 啟動時清除舊快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
                  .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 攔截請求，優先使用快取
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
