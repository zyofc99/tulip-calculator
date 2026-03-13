<!-- 只替換 <script> 內的匯率相關部分 -->

/* ══ 即時匯率（多 API 備援 + Timeout + 略過SW快取）══ */
let RATES = {};
let fxFrom = 'TWD', fxTo = 'JPY', fxExpr = '';

// 加上 timeout 的 fetch 包裝
function fetchWithTimeout(url, options = {}, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchFromFrankfurter() {
  const res = await fetchWithTimeout(
    'https://api.frankfurter.app/latest?from=USD&to=TWD,JPY',
    { cache: 'no-store' },
    8000
  );
  const data = await res.json();
  if (!data.rates) throw new Error('Frankfurter 失敗');
  return { usdTwd: data.rates['TWD'], usdJpy: data.rates['JPY'], date: data.date };
}

async function fetchFromOpenER() {
  const res = await fetchWithTimeout(
    'https://open.er-api.com/v6/latest/USD',
    { cache: 'no-store' },
    8000
  );
  const data = await res.json();
  if (data.result !== 'success') throw new Error('OpenER 失敗');
  const utcDate = new Date(data.time_last_update_utc);
  const twDate  = new Date(utcDate.getTime() + 8*60*60*1000);
  const date = `${twDate.getFullYear()}/${String(twDate.getMonth()+1).padStart(2,'0')}/${String(twDate.getDate()).padStart(2,'0')}`;
  return { usdTwd: data.rates['TWD'], usdJpy: data.rates['JPY'], date };
}

// 新增第三個備援 API
async function fetchFromExchangeRate() {
  const res = await fetchWithTimeout(
    'https://api.exchangerate-api.com/v4/latest/USD',
    { cache: 'no-store' },
    8000
  );
  const data = await res.json();
  if (!data.rates) throw new Error('ExchangeRate 失敗');
  return { usdTwd: data.rates['TWD'], usdJpy: data.rates['JPY'], date: data.date };
}

async function fetchRates() {
  const bar = document.getElementById('fx-rate-bar');
  let result = null;

  const apis = [fetchFromFrankfurter, fetchFromOpenER, fetchFromExchangeRate];

  for (const apiFn of apis) {
    try {
      result = await apiFn();
      if (result) break;
    } catch(e) {
      console.warn('API 嘗試失敗:', e.message);
    }
  }

  if (result) {
    const { usdTwd, usdJpy, date } = result;
    RATES['USD_TWD'] = usdTwd;
    RATES['TWD_USD'] = 1 / usdTwd;
    RATES['USD_JPY'] = usdJpy;
    RATES['JPY_USD'] = 1 / usdJpy;
    RATES['TWD_JPY'] = usdJpy / usdTwd;
    RATES['JPY_TWD'] = usdTwd / usdJpy;

    // 存到 localStorage 當備用
    localStorage.setItem('lastRates', JSON.stringify(RATES));
    localStorage.setItem('lastRateDate', date);

    const dateStr = typeof date === 'string' && date.includes('-')
      ? date.replace(/-/g, '/')
      : date;

    bar.innerHTML = `
      <div>🇺🇸 1 USD = <span>${usdTwd.toFixed(2)}</span> TWD</div>
      <div>🇹🇼 1 TWD = <span>${RATES['TWD_JPY'].toFixed(4)}</span> JPY</div>
      <div>🇯🇵 1 JPY = <span>${RATES['JPY_TWD'].toFixed(4)}</span> TWD</div>
      <div class="rate-update">📅 即時匯率 ${dateStr} ✅</div>
    `;
  } else {
    // 先嘗試讀取上次快取的匯率
    const cached = localStorage.getItem('lastRates');
    const cachedDate = localStorage.getItem('lastRateDate');

    if (cached) {
      RATES = JSON.parse(cached);
      bar.innerHTML = `
        <div>🇺🇸 1 USD = <span>${RATES['USD_TWD'].toFixed(2)}</span> TWD</div>
        <div>🇹🇼 1 TWD = <span>${RATES['TWD_JPY'].toFixed(4)}</span> JPY</div>
        <div>🇯🇵 1 JPY = <span>${RATES['JPY_TWD'].toFixed(4)}</span> TWD</div>
        <div class="rate-update">📦 上次快取匯率 ${cachedDate || ''}</div>
      `;
    } else {
      // 最終備用靜態匯率
      RATES = { 'TWD_JPY':4.987,'JPY_TWD':0.2005,'TWD_USD':0.03143,'USD_TWD':31.81,'USD_JPY':154.2,'JPY_USD':0.00648 };
      bar.innerHTML = `
        <div>🇺🇸 1 USD = <span>31.81</span> TWD</div>
        <div>🇹🇼 1 TWD = <span>4.987</span> JPY</div>
        <div>🇯🇵 1 JPY = <span>0.2005</span> TWD</div>
        <div class="rate-update">⚠️ 網路異常，使用備用匯率</div>
      `;
    }
  }
  fxConvert();
}
fetchRates();
