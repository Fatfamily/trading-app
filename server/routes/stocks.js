import express from 'express';
import { load as cheerioLoad } from 'cheerio';

const router = express.Router();

// Helpers
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

// 가격 조회 (네이버 실시간 폴링 API)
router.get('/price/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
    const data = await fetchJson(url);
    const stock = data?.result?.areas?.[0]?.datas?.[0];
    if (!stock) return res.status(404).json({ error: 'no data' });
    res.json({
      code,
      name: stock.nm,
      price: stock.nv,
      diff: stock.cv,
      rate: stock.cr,
      volume: stock.aq,
      time: stock.nvtt
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 다중 종목 조회
router.post('/prices', async (req, res) => {
  try {
    const { codes } = req.body;
    if (!Array.isArray(codes) || codes.length === 0) return res.json([]);
    const q = codes.map(c => `SERVICE_ITEM:${c}`).join(',');
    const url = `https://polling.finance.naver.com/api/realtime?query=${encodeURIComponent(q)}`;
    const data = await fetchJson(url);
    const items = data?.result?.areas?.[0]?.datas || [];
    res.json(items.map(s => ({
      code: s.cd, name: s.nm, price: s.nv, diff: s.cv, rate: s.cr, volume: s.aq, time: s.nvtt
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 뉴스 크롤링
router.get('/news/:code', async (req, res) => {
  try {
    const html = await fetchText(`https://finance.naver.com/item/news_news.nhn?code=${req.params.code}`);
    const $ = cheerioLoad(html);
    const news = [];
    $('table.type5 tr').each((_, el) => {
      const a = $(el).find('a');
      const title = a.text().trim();
      const href = a.attr('href');
      const date = $(el).find('td.date').text().trim();
      if (title && href) news.push({ title, link: 'https://finance.naver.com' + href, date });
    });
    res.json(news.slice(0, 20));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 종목 검색 (네이버 오토컴플릿 JSONP 파싱)
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const url = `https://ac.finance.naver.com/ac?q=${encodeURIComponent(q)}&st=111&r_lt=111`;
    const txt = await fetchText(url);
    // JSONP 예: window.__jindo2_callback._({...});
    const jsonStr = txt.replace(/^\s*window\.__jindo2_callback\.[^(]+\(/, '').replace(/\)\s*;?\s*$/, '');
    const obj = JSON.parse(jsonStr);
    const list = (obj.items?.[0] || []).map(arr => ({
      name: arr[0][0],
      code: arr[1][0],
      market: arr[3]?.[0] || ''
    }));
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
