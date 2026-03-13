const CACHE_NAME = 'tulip-calc-v5';
const urlsToCache = [
  '/tulip-calculator/',
  '/tulip-calculator/calculator.html',
  '/tulip-calculator/manifest.json',
  '/tulip-calculator/icon-192x192.png',
  '/tulip-calculator/icon-512x512.png',
  '/tulip-calculator/icon-maskable-512x512.png',
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

// 攔截請求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 匯率 API 永遠走網路，不快取
  if (url.hostname === 'open.er-api.com') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 靜態資源：Stale-While-Revalidate（先回傳快取，背景更新）
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        }).catch(() => cachedResponse); // 網路失敗時回傳快取

        return cachedResponse || fetchPromise;
      });
    })
  );
});

// ✅ Push 通知支援
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {
    title: '🌷 鬱金香計算機',
    body: '有新通知！'
  };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/tulip-calculator/icon-192x192.png',
      badge: '/tulip-calculator/icon-192x192.png'
    })
  );
});

// ✅ 通知點擊事件
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/tulip-calculator/calculator.html')
  );
});
