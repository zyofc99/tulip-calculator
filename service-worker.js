/* 🌷 鬱金香計算機 Service Worker v9 */
const CACHE_NAME = 'tulip-calc-v9';
const RATES_CACHE_KEY = 'tulip-fx-rates';

const PRECACHE_URLS = [
  '/tulip-calculator/',
  '/tulip-calculator/index.html',
  '/tulip-calculator/calculator.html',
  '/tulip-calculator/manifest.json',
];

/* ══ 安裝：預先快取靜態資源 ══ */
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

/* ══ 啟動：刪除舊版快取 + 註冊 Periodic Sync ══ */
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
    ).then(async () => {
      await self.clients.claim();

      // ✅ 註冊 Periodic Background Sync（每小時自動更新匯率）
      try {
        const reg = await self.registration;
        if ('periodicSync' in reg) {
          await reg.periodicSync.register('update-fx-rates', {
            minInterval: 60 * 60 * 1000 // 最短間隔 1 小時
          });
          console.log('[SW] Periodic Sync 已註冊：每小時更新匯率');
        }
      } catch (e) {
        console.warn('[SW] Periodic Sync 註冊失敗（瀏覽器不支援或未授權）:', e.message);
      }
    })
  );
});

/* ══ Periodic Background Sync：定時自動抓匯率 ══ */
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-fx-rates') {
    console.log('[SW] Periodic Sync 觸發：開始更新匯率...');
    event.waitUntil(updateRatesInBackground());
  }
});

/* ══ Background Sync：網路恢復時補傳匯率請求 ══ */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-fx-rates') {
    console.log('[SW] Background Sync 觸發：網路恢復，補抓匯率...');
    event.waitUntil(updateRatesInBackground());
  }
});

/* ══ 背景抓匯率核心函式 ══ */
async function updateRatesInBackground() {
  const apis = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    (() => {
      const d = new Date();
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${ds}/v1/currencies/usd.json`;
    })(),
    'https://api.frankfurter.app/latest?from=USD&to=TWD,JPY',
    'https://open.er-api.com/v6/latest/USD',
    'https://api.exchangerate-api.com/v4/latest/USD'
  ];

  for (const url of apis) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();

      let usdTwd, usdJpy;

      // Fawaz 格式
      if (data.usd) {
        usdTwd = data.usd['twd'];
        usdJpy = data.usd['jpy'];
      }
      // Frankfurter 格式
      else if (data.rates && data.rates['TWD']) {
        usdTwd = data.rates['TWD'];
        usdJpy = data.rates['JPY'];
      }
      // OpenER 格式
      else if (data.result === 'success') {
        usdTwd = data.rates['TWD'];
        usdJpy = data.rates['JPY'];
      }

      if (!usdTwd || !usdJpy) continue;

      const today = new Date();
      const date = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;

      const rates = {
        USD_TWD: usdTwd,
        TWD_USD: 1 / usdTwd,
        USD_JPY: usdJpy,
        JPY_USD: 1 / usdJpy,
        TWD_JPY: usdJpy / usdTwd,
        JPY_TWD: usdTwd / usdJpy,
        _date: date
      };

      // 通知所有開啟的頁面更新匯率
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({
          type: 'FX_RATES_UPDATED',
          rates,
          date
        });
      });

      console.log('[SW] 背景匯率更新成功，來源:', url);
      return; // 成功就停止
    } catch (e) {
      console.warn('[SW] 背景匯率 API 失敗:', url, e.message);
    }
  }
  console.warn('[SW] 所有背景匯率 API 均失敗');
}

/* ══ 攔截請求：網路優先策略 ══ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 外部 API：完全不快取，直接走網路
  const externalAPIs = [
    'api.frankfurter.app',
    'open.er-api.com',
    'api.exchangerate-api.com',
    'cdn.jsdelivr.net'
  ];
  if (externalAPIs.some(api => url.hostname.includes(api))) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // 網路失敗時，觸發 Background Sync 排隊
        self.registration.sync.register('sync-fx-rates')
          .catch(e => console.warn('[SW] Background Sync 排隊失敗:', e));
        return new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
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

  // 本地靜態資源：網路優先，失敗才用快取
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
