const CACHE_NAME = 'tulip-calc-v6';
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

// ✅ 所有匯率 API 的 hostname 清單
const API_HOSTNAMES = [
  'open.er-api.com',
  'api.frankfurter.app',
  'api.exchangerate-api.com',
  'api.exchangeratesapi.io',
  'cdn.jsdelivr.net'
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

  // ✅ 所有匯率 API 永遠走網路，不快取、不攔截
  if (API_HOSTNAMES.includes(url.hostname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch((err) => {
          console.warn('[SW] API fetch 失敗:', url.hostname, err.message);
          // 回傳一個空的錯誤 Response，讓前端自己處理 fallback
          return new Response(JSON.stringify({ error: 'network_fail' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // ✅ Google Fonts 等外部資源：直接走網路，失敗就算了
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 408 }))
    );
    return;
  }

  // ✅ 靜態資源：Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);
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

// ✅ Background Sync（網路恢復時自動同步）
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-exchange-rate') {
    event.waitUntil(
      fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
        .then(response => response.json())
        .then(data => {
          console.log('[SW] Background Sync 匯率更新成功', data);
        })
        .catch(err => {
          console.error('[SW] Background Sync 失敗', err);
        })
    );
  }
});

// ✅ Periodic Background Sync（定期自動同步匯率）
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-exchange-rate') {
    event.waitUntil(
      fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
        .then(response => response.json())
        .then(data => {
          console.log('[SW] Periodic Sync 匯率更新成功', data);
        })
        .catch(err => {
          console.error('[SW] Periodic Sync 失敗', err);
        })
    );
  }
});
