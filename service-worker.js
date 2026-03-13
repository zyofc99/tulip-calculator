/* 🌷 鬱金香計算機 Service Worker v8 */
const CACHE_NAME = 'tulip-calc-v8';  // ← 每次改版就把數字+1

const PRECACHE_URLS = [
  '/tulip-calculator/',
  '/tulip-calculator/index.html',
  '/tulip-calculator/calculator.html',
  '/tulip-calculator/manifest.json',
];

/* ══ 安裝：預先快取靜態資源 ══ */
self.addEventListener('install', event => {
  self.skipWaiting(); // 立即接管，不等舊 SW
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

/* ══ 啟動：刪除舊版快取 ══ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] 刪除舊快取:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // 立即接管所有頁面
  );
});

/* ══ 攔截請求：網路優先策略 ══ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 外部 API 請求：完全不快取，直接走網路
  const externalAPIs = [
    'api.frankfurter.app',
    'open.er-api.com',
    'api.exchangerate-api.com'
  ];
  if (externalAPIs.some(api => url.hostname.includes(api))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Google Fonts：網路優先，失敗才用快取
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 本地靜態資源：網路優先，失敗才用快取（離線模式）
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 成功就更新快取
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // 離線時用快取
  );
});
