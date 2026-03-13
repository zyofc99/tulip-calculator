const CACHE_NAME = 'tulip-calc-v4';
const urlsToCache = [
  '/tulip-calculator/',
  '/tulip-calculator/calculator.html',
  '/tulip-calculator/manifest.json',
  '/tulip-calculator/icon-192x192.png',
  '/tulip-calculator/icon-512x512.png',
  '/tulip-calculator/screenshot-1.jpg',
  '/tulip-calculator/screenshot-2.jpg'
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
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 攔截請求：網路優先，失敗才用快取（匯率API需要即時資料）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 匯率 API 永遠走網路，不快取
  if (url.hostname === 'open.er-api.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 其他資源：快取優先
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});
