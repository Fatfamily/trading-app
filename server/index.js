
/**
 * KR Virtual Exchange - Server
 * Naver Finance scraper (KR-only): price, search, top10, news
 * Poll from client every 1.2s
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const chardet = require('chardet');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Utility: fetch & decode (handles EUC-KR/UTF-8 automatically)
async function fetchDecoded(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'ko,en;q=0.8'
    },
    timeout: 10000
  });
  const buf = Buffer.from(res.data);
  let enc = chardet.detect(buf) || 'UTF-8';
  if (Array.isArray(enc)) enc = enc[0];
  if (typeof enc !== 'string') enc = 'UTF-8';
  const decoded = iconv.decode(buf, enc);
  return decoded;
}

// Normalize Korean name spacing issues (e.g., 레이보우→레인보우)
function normalizeKoreanName(name) {
  return name.replace(/\s+/g, '').replace(/ㆍ/g, '·');
}

// Extract code from Naver link like /item/main.naver?code=005930
function extractCodeFromHref(href) {
  const m = href && href.match(/code=(\d{6})/);
  return m ? m[1] : null;
}

// GET /api/top10  (KOSPI market cap ranking page 1)
app.get('/api/top10', async (req, res) => {
  try {
    const html = await fetchDecoded('https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=1');
    const $ = cheerio.load(html);
    const rows = [];
    $('table.type_2 tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const link = $tr.find('a.tltle').attr('href');
      const name = $tr.find('a.tltle').text().trim();
      const code = extractCodeFromHref(link);
      const priceTxt = $tr.find('td.number').eq(1).text().replace(/,/g, '').trim();
      if (code && name) {
        rows.push({
          code,
          name,
          price: priceTxt ? Number(priceTxt) : null
        });
      }
    });
    res.json(rows.slice(0, 10));
  } catch (e) {
    console.error('top10 error', e.message);
    res.status(500).json({ error: 'failed_top10', message: e.message });
  }
});

// GET /api/search?q=삼성전자  -> return best match {code,name}
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const url = 'https://finance.naver.com/search/searchList.naver?query=' + encodeURIComponent(q);
    const html = await fetchDecoded(url);
    const $ = cheerio.load(html);
    const results = [];
    $('table > tbody > tr').each((_, tr) => {
      const $tr = $(tr);
      const a = $tr.find('td.tit > a');
      const name = normalizeKoreanName(a.text().trim());
      const href = a.attr('href');
      const code = extractCodeFromHref(href);
      if (code && name) {
        results.push({ code, name });
      }
    });
    // De-dup and return top 5
    const uniq = [];
    const seen = new Set();
    for (const r of results) {
      const key = r.code + r.name;
      if (!seen.has(key)) { seen.add(key); uniq.push(r); }
    }
    res.json(uniq.slice(0, 5));
  } catch (e) {
    console.error('search error', e.message);
    res.status(500).json({ error: 'failed_search', message: e.message });
  }
});

// GET /api/quote?code=005930
app.get('/api/quote', async (req, res) => {
  const code = (req.query.code || '').replace(/[^\d]/g, '').padStart(6, '0');
  if (!code) return res.status(400).json({ error: 'code_required' });
  try {
    const url = `https://finance.naver.com/item/sise.naver?code=${code}`;
    const html = await fetchDecoded(url);
    const $ = cheerio.load(html);
    // Current price is in .no_today .blind or .no_exday spans
    let price = null;
    $('.no_today .blind').each((_, el) => {
      const t = $(el).text().replace(/,/g, '').trim();
      if (/^\d+(\.\d+)?$/.test(t)) price = Number(t);
    });
    const name = $('.wrap_company h2 a').first().text().trim() || $('.wrap_company h2').text().trim();
    // Change & rate
    let change = null, rate = null;
    const changeTxt = $('.no_exday .blind').eq(0).text().replace(/,/g, '').trim();
    const rateTxt = $('.no_exday .blind').eq(1).text().replace('%','').trim();
    if (changeTxt && !isNaN(Number(changeTxt))) change = Number(changeTxt);
    if (rateTxt && !isNaN(Number(rateTxt))) rate = Number(rateTxt);

    res.json({ code, name: normalizeKoreanName(name), price, change, rate, ts: Date.now() });
  } catch (e) {
    console.error('quote error', e.message);
    res.status(500).json({ error: 'failed_quote', message: e.message });
  }
});

// GET /api/news?code=005930  -> [{title, link, press, time}]
app.get('/api/news', async (req, res) => {
  const code = (req.query.code || '').replace(/[^\d]/g, '').padStart(6, '0');
  if (!code) return res.status(400).json({ error: 'code_required' });
  try {
    const url = `https://finance.naver.com/item/news_news.naver?code=${code}&page=1`;
    const html = await fetchDecoded(url);
    const $ = cheerio.load(html);
    const items = [];
    $('table.type5 tr').each((_, tr) => {
      const atag = $(tr).find('td.title a');
      const title = atag.text().trim();
      const link = atag.attr('href') ? new URL(atag.attr('href'), 'https://finance.naver.com').href : null;
      const press = $(tr).find('td.info').text().trim();
      const time = $(tr).find('td.date').text().trim();
      if (title && link) items.push({ title, link, press, time });
    });
    res.json(items.slice(0, 15));
  } catch (e) {
    console.error('news error', e.message);
    res.status(500).json({ error: 'failed_news', message: e.message });
  }
});

// Serve client (static) when deployed together
app.use('/', express.static(__dirname + '/../client'));

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
