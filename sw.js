const CACHE_NAME = 'tulip-calculator-v2';
const STATIC_ASSETS = [
  '/tulip-calculator/',
  '/tulip-calculator/calculator.html',
  '/tulip-calculator/icon-192x192.png',
  '/tulip-calculator/icon-512x512.png',
  '/tulip-calculator/icon-maskable-512x512.png',
  '/tulip-calculator/manifest.json'
];

// ✅ 安裝：預先快取靜態資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] 預先快取靜態資源');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ✅ 啟動：清除舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ✅ 攔截請求：分策略處理
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 匯率 API → Network First（確保即時資料）
  if (url.hostname.includes('api') || url.pathname.includes('rate')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // 靜態資源 → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// 策略一：Network First
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    return caches.match(request);
  }
}

// 策略二：Stale-While-Revalidate
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    cache.put(request, response.clone());
    return response;
  });

  return cached || fetchPromise;
}

// ✅ 推播通知支援（加分項目）
self.addEventListener('push', event => {
  const data = event.data?.json() ?? { title: '計算機', body: '有新通知！' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/tulip-calculator/icon-192x192.png',
      badge: '/tulip-calculator/icon-192x192.png'
    })
  );
});