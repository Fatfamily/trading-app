// Naver unofficial helpers (server-side fetch with proper headers)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
const REF = 'https://m.stock.naver.com/';
const LANG = 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7';

function headers(extra={}) {
  return {
    'User-Agent': UA,
    'Referer': REF,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': LANG,
    'Connection': 'keep-alive',
    ...extra
  };
}

// Search (autocomplete). Returns [{code, name, market}]
export async function searchStocks(keyword) {
  const q = encodeURIComponent(keyword.trim());
  // Naver finance autocomplete (returns JSONP unless r_format=json)
  const url = `https://ac.finance.naver.com/ac?q=${q}&st=111&r_format=json`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`naver search ${res.status}`);
  const data = await res.json();
  // data.items[0] elements like ["005930","삼성전자", ...] (structure can vary)
  const items = (data?.items?.[0] || []);
  return items.slice(0, 10).map(row => {
    const code = row[0];
    const name = row[1];
    const market = row[6] || row[5] || '';
    return { code, name, market };
  });
}

// Quote via realtime polling endpoint. Accepts array of codes (e.g. ['005930','000660'])
export async function getQuotes(codes) {
  if (!codes || codes.length === 0) return [];
  const query = 'SERVICE_ITEM:' + codes.join(',');
  const url = `https://polling.finance.naver.com/api/realtime?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`naver quotes ${res.status}`);
  const data = await res.json();
  const items = data?.result?.areas?.[0]?.datas || [];
  return items.map(x => ({
    code: x.cd,
    name: x.nm,
    price: x.nv,      // current price
    change: x.cv,     // change
    changeRate: x.cr, // change rate (%)
    volume: x.aq,     // accumulated volume
    high: x.hv,
    low: x.lv,
    open: x.ov,
    prevClose: x.pc
  }));
}

// News list for a single code
export async function getNews(code) {
  const url = `https://m.stock.naver.com/api/news/stock/${code}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`naver news ${res.status}`);
  const data = await res.json();
  const list = data?.newsList || data || [];
  return list.slice(0, 20).map(n => ({
    title: n.title || n.headline || '',
    link: (n?.officeLink) || (n?.linkUrl) || '',
    press: n.officeName || n.press || '',
    time: n.datetime || n.regDt || ''
  }));
}

// Try to fetch top market cap (fallback to curated list on failure)
export async function getTopKR() {
  try {
    // Attempt to use a public ranking endpoint (mobile)
// Some deployments block this. If so, fallback below.
    const url = 'https://m.stock.naver.com/api/stocks/KOSPI/top?category=MARKET_CAP&count=10';
    const res = await fetch(url, { headers: headers() });
    if (res.ok) {
      const data = await res.json();
      const list = data?.stocks || data || [];
      if (Array.isArray(list) && list.length) {
        return list.slice(0,10).map(s => ({
          code: s.itemCode || s.code,
          name: s.stockName || s.name
        }));
      }
    }
  } catch (e) {/* ignore */}

  // Fallback curated KOSPI/KOSDAQ leaders
  return [
    { code: '005930', name: '삼성전자' },
    { code: '000660', name: 'SK하이닉스' },
    { code: '035420', name: 'NAVER' },
    { code: '207940', name: '삼성바이오로직스' },
    { code: '051910', name: 'LG화학' },
    { code: '005380', name: '현대차' },
    { code: '068270', name: '셀트리온' },
    { code: '028260', name: '삼성물산' },
    { code: '105560', name: 'KB금융' },
    { code: '006400', name: '삼성SDI' },
  ];
}
