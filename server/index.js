/**
 * KR Virtual Exchange API server (Naver Finance scraper)
 * - Search: /api/search?q=삼성전자
 * - Top10:  /api/top?market=KOSPI (or KOSDAQ)
 * - Quote:  /api/quote?code=005930
 * - News:   /api/news?code=005930
 * - Static client served from / (../client)
 */
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import cheerio from 'cheerio';
import got from 'got';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

// Simple in-memory cache to reduce load on Naver
const cache = new Map(); // key -> { t, data }
const TTL = {
  quote: 800,   // ms
  top:  15000,  // 15s
  news: 60000,  // 60s
  search: 15000 // 15s
};

// Common headers for scraping
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const client = got.extend({
  headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7' },
  timeout: { request: 8000 },
  retry: { limit: 1 },
  https: { rejectUnauthorized: false }
});

function setCache(key, data) { cache.set(key, { t: Date.now(), data }); }
function getCache(key, ttl) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() - v.t > ttl) return null;
  return v.data;
}

// Utils
function parseNumber(str) {
  if (str == null) return null;
  return Number(String(str).replace(/[^0-9.-]/g, ''));
}
function marketFromCode(code) {
  // Heuristic only; client shows market label separately from top list
  return code.startsWith('0') ? 'KOSPI/KOSDAQ' : 'KOR';
}

// --- Search: Korean name -> code(s) ---
// Scrapes https://finance.naver.com/search/searchList.naver?query=...
// Returns top matches with Korean name and code
app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const key = `search:${q}`;
    const hit = getCache(key, TTL.search);
    if (hit) return res.json(hit);

    const url = `https://finance.naver.com/search/searchList.naver?query=${encodeURIComponent(q)}`;
    const html = await client.get(url).text();
    const $ = cheerio.load(html);

    const out = [];
    $('#content > div.section_search > div.search_area > div.search_results > table > tbody > tr').each((_, tr) => {
      const $tr = $(tr);
      const a = $tr.find('td.tit a');
      const name = a.text().trim();
      const href = a.attr('href') || '';
      const m = href.match(/code=(\d{6})/);
      const code = m ? m[1] : null;
      const type = $tr.find('td:nth-child(3)').text().trim(); // ex) 코스피, 코스닥
      if (code && (type.includes('코스피') || type.includes('코스닥'))) {
        out.push({ name, code, market: type });
      }
    });

    setCache(key, out);
    res.json(out);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'search_failed' });
  }
});

// --- Top 10 by market cap ---
// Scrape market summary page
app.get('/api/top', async (req, res) => {
  try {
    const market = (req.query.market || 'KOSPI').toUpperCase(); // KOSPI or KOSDAQ
    const key = `top:${market}`;
    const hit = getCache(key, TTL.top);
    if (hit) return res.json(hit);

    const base = 'https://finance.naver.com/sise/sise_market_sum.naver';
    const params = market === 'KOSDAQ' ? '?sosok=1&page=1' : '?sosok=0&page=1';
    const url = base + params;

    const html = await client.get(url).text();
    const $ = cheerio.load(html);
    const out = [];

    $('table.type_2 tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const nameCell = $tr.find('td:eq(1) a');
      const name = nameCell.text().trim();
      const href = nameCell.attr('href') || '';
      const m = href.match(/code=(\d{6})/);
      const code = m ? m[1] : null;
      const price = parseNumber($tr.find('td:eq(2)').text());
      const change = parseNumber($tr.find('td:eq(3)').text());
      const changePct = parseNumber($tr.find('td:eq(4)').text());
      if (name && code) {
        out.push({ name, code, price, change, changePct, market });
      }
    });

    const top10 = out.slice(0, 10);
    setCache(key, top10);
    res.json(top10);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'top_failed' });
  }
});

// --- Quote ---
// Scrape https://finance.naver.com/item/sise.naver?code=005930
// Extract #_nowVal, #_diff, #_rate, #time
app.get('/api/quote', async (req, res) => {
  try {
    const code = (req.query.code || '').replace(/[^0-9]/g, '');
    if (!code) return res.status(400).json({ error: 'code_required' });
    const key = `quote:${code}`;
    const hit = getCache(key, TTL.quote);
    if (hit) return res.json(hit);

    const url = `https://finance.naver.com/item/sise.naver?code=${code}`;
    const html = await client.get(url).text();
    const $ = cheerio.load(html);

    const price = parseNumber($('#_nowVal').text() || $('#_nowPrice').text());
    const change = parseNumber($('#_diff').text());
    const changePct = parseNumber($('#_rate').text());
    const timeText = $('#time').text().trim() || new Date().toISOString();

    const data = { code, price, change, changePct, time: timeText };
    setCache(key, data);
    res.json(data);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'quote_failed' });
  }
});

// --- News ---
// Scrape item news list
app.get('/api/news', async (req, res) => {
  try {
    const code = (req.query.code || '').replace(/[^0-9]/g, '');
    if (!code) return res.status(400).json({ error: 'code_required' });
    const key = `news:${code}`;
    const hit = getCache(key, TTL.news);
    if (hit) return res.json(hit);

    const url = `https://finance.naver.com/item/news_news.naver?code=${code}`;
    const html = await client.get(url).text();
    const $ = cheerio.load(html);

    const out = [];
    $('table.type5 tr').each((_, tr) => {
      const a = $(tr).find('td.title a');
      const title = a.text().trim();
      const href = a.attr('href');
      const date = $(tr).find('td.date').text().trim();
      if (title && href) {
        const link = href.startsWith('http') ? href : 'https://finance.naver.com' + href;
        out.push({ title, link, date });
      }
    });

    const top = out.slice(0, 12);
    setCache(key, top);
    res.json(top);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'news_failed' });
  }
});

// Serve static client
app.use('/', express.static(path.join(__dirname, '..', 'client'), { maxAge: '1h', index: 'index.html' }));

app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);
});
