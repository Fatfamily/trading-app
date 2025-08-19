
import fetch from 'node-fetch';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const headers = { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'ko,en;q=0.9', 'Referer': 'https://m.stock.naver.com' };

/** Helper to safely fetch JSON */
async function getJSON(url) {
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/** Quote from polling.finance (realtime) */
export async function getQuote(symbol) {
  // symbol should be 6-digit like 005930
  const code = symbol.replace(/[^\d]/g,'').padStart(6,'0');
  // realtime endpoint
  const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
  const j = await getJSON(url);
  const items = j?.result?.areas?.[0]?.datas || j?.result?.areas?.[0]?.data || j?.result?.quotes || [];
  const item = Array.isArray(items) ? items[0] : items;
  if (!item) throw new Error('No quote');
  // normalize fields
  const price = Number(item.nv ?? item.now ?? item.rn ?? item.close ?? 0);
  const prev = Number(item.pc ?? item.pcp ?? item.prev ?? 0);
  const diff = price - prev;
  const rate = prev ? diff / prev * 100 : 0;
  return {
    symbol: code,
    name: item.nm || item.name || code,
    price,
    prevClose: prev,
    change: diff,
    changeRate: rate,
    time: Date.now()
  };
}

/** Search stocks (fallback dictionary + Naver auto) */
export async function searchStocks(q) {
  const query = encodeURIComponent(q.trim());
  const url = `https://ac.search.naver.com/nx/ac?frm=stock&q=${query}&st=111&r_format=json&r_enc=UTF-8&r_lt=111&r_unicode=1`;
  try {
    const j = await getJSON(url);
    const items = j?.items?.[0] || [];
    // items entries like ["삼성전자","005930",...]
    return items.slice(0,10).map(row => ({
      name: row[0],
      symbol: (row[1]||'').toString().padStart(6,'0')
    }));
  } catch(_) {
    // minimal fallback dictionary
    const dict = [
      { name:'삼성전자', symbol:'005930' }, { name:'SK하이닉스', symbol:'000660' },
      { name:'NAVER', symbol:'035420' }, { name:'LG에너지솔루션', symbol:'373220' },
      { name:'카카오', symbol:'035720' }, { name:'현대차', symbol:'005380' }
    ];
    return dict.filter(x=>x.name.includes(q)).slice(0,5);
  }
}

/** News list by symbol */
export async function getNews(symbol) {
  const code = symbol.replace(/[^\d]/g,'').padStart(6,'0');
  const url = `https://m.stock.naver.com/api/news/list?size=10&category=stock&symbol=${code}`;
  const j = await getJSON(url);
  const arr = j?.result?.newsList || j?.newsList || j || [];
  return arr.slice(0,10).map(n => ({
    id: n?.id || n?.aid || String(n?.articleId || n?.oid || Math.random()),
    title: n?.title || n?.tit || '',
    publisher: n?.officeName || n?.press || '',
    link: n?.url || n?.linkUrl || n?.link || '',
    time: n?.datetime || n?.time || n?.writetime || Date.now()
  }));
}

/** Top list (KOSPI bluechips) */
export const DEFAULT_LIST = [
  '005930','000660','035420','373220','035720','005380','068270','207940','055550','051910'
];
