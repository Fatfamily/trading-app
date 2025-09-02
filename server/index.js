import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cheerio from 'cheerio';
import { LRUCache } from 'lru-cache';   // ✅ 수정된 부분
import path from 'path';
import { fileURLToPath } from 'url';
import iconv from 'iconv-lite';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: true, credentials: true, allowedHeaders: ['Content-Type','Authorization'] }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('tiny'));

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const DATABASE_URL = process.env.DATABASE_URL || '';

const pool = new Pool({
  connectionString: DATABASE_URL || undefined,
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Run simple migrations
async function initTables(){
  const sql = (await import('fs/promises')).readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    const s = await sql;
    await client.query(s);
    console.log('DB schema ensured');
  } catch(e){
    console.error('initTables err', e);
  } finally {
    client.release();
  }
}
initTables().catch(console.error);

// ✅ LRU 캐시 인스턴스
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60  // 1시간 TTL
});

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 KR Trading Demo' }});
  const buf = new Uint8Array(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  if (ct.toLowerCase().includes('charset=euc-kr') || ct.toLowerCase().includes('euc-kr')) {
    return iconv.decode(Buffer.from(buf), 'euc-kr');
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

/** UTIL: parse number like "72,300" -> 72300 */
function parseNum(s) {
  if (!s) return null;
  const t = (''+s).replace(/[^\d.-]/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Popular KOSPI tickers (fallback list)
const POPULAR = [
  { code: '005930', name: '삼성전자' },
  { code: '000660', name: 'SK하이닉스' },
  { code: '035420', name: 'NAVER' },
  { code: '373220', name: 'LG에너지솔루션' },
  { code: '207940', name: '삼성바이오로직스' },
  { code: '051910', name: 'LG화학' },
  { code: '005490', name: 'POSCO홀딩스' },
  { code: '006400', name: '삼성SDI' },
  { code: '035720', name: '카카오' },
  { code: '068270', name: '셀트리온' }
];

async function getQuoteRemote(code) {
  const cacheKey = `remote:${code}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  try {
    const url = `https://finance.naver.com/item/main.nhn?code=${code}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    let price = null;
    const og = $('meta[property="og:description"]').attr('content') || '';
    const m = og.match(/현재가\s*([0-9,]+)원/);
    if (m && m[1]) price = parseNum(m[1]);

    if (!price) {
      const txt = $('#_nowVal').text() || $('#chart_area .rate_info .today .blind').text();
      price = parseNum(txt);
    }

    if (!price) {
      try {
        const murl = `https://m.stock.naver.com/api/stock/${code}/basic`;
        const mtxt = await fetchText(murl);
        const obj = JSON.parse(mtxt);
        price = parseNum(obj?.now || obj?.closePrice);
      } catch(e){ /* ignore */ }
    }

    const name = $('title').text().split(':')[0].trim() || POPULAR.find(x=>x.code===code)?.name || '종목';
    const res = { code, name, price };
    cache.set(cacheKey, res, { ttl: 1000 * 10 }); // 10초 캐시
    return res;
  } catch(e) {
    console.error('getQuoteRemote err', e);
    throw e;
  }
}

// Upsert quote in DB
async function upsertQuoteDb(q) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO quotes(code, name, price, updated_at) VALUES($1,$2,$3,now())
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, price = EXCLUDED.price, updated_at = now()`,
      [q.code, q.name, q.price]
    );
  } finally {
    client.release();
  }
}

// Get latest quote from DB or remote
async function getQuote(code) {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT * FROM quotes WHERE code=$1', [code]);
    if (r.rowCount > 0) {
      return { code: r.rows[0].code, name: r.rows[0].name, price: Number(r.rows[0].price), updated_at: r.rows[0].updated_at };
    }
  } finally {
    client.release();
  }
  const q = await getQuoteRemote(code);
  if (q.price != null) await upsertQuoteDb(q);
  return q;
}

// News fetcher and DB upsert
async function fetchNewsAndStore(code) {
  try {
    const url = `https://finance.naver.com/item/news_news.nhn?code=${code}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);
    const rows = $('#news_area table tr').toArray();
    const items = [];
    for (const tr of rows) {
      const a = $(tr).find('a');
      const title = a.text().trim();
      let href = a.attr('href') || '';
      if (href && href.startsWith('/')) href = 'https://finance.naver.com' + href;
      const when = $(tr).find('td.date').text().trim();
      const source = $(tr).find('td.info').text().trim();
      if (title) items.push({ title, url: href, source, time: when });
    }
    const client = await pool.connect();
    try {
      for (const it of items.slice(0,20)) {
        try {
          await client.query(
            `INSERT INTO news(code,title,url,source,time_text,fetched_at) 
             VALUES($1,$2,$3,$4,$5,now()) 
             ON CONFLICT (code,url) DO NOTHING`,
            [code, it.title, it.url, it.source, it.time]
          );
        } catch(e){ /* ignore per-item */ }
      }
    } finally {
      client.release();
    }
    return items;
  } catch(e) {
    console.error('fetchNews err', e);
    return [];
  }
}

// Auth helpers
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  const ah = req.headers.authorization || '';
  const m = ah.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'unauth' });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.user = payload;
    return next();
  } catch(e) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

// Serve static client
app.use('/', express.static(path.join(__dirname, '../client'), { index: 'index.html' }));

app.get('/healthz', (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

// Auth routes
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing' });
  const client = await pool.connect();
  try {
    const hashed = await bcrypt.hash(password, 10);
    const r = await client.query('INSERT INTO users(email,password) VALUES($1,$2) RETURNING id,email', [email, hashed]);
    const user = r.rows[0];
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch(e) {
    if (e.code === '23505') return res.status(400).json({ error: 'exists' });
    console.error('register err', e);
    res.status(500).json({ error: 'register_failed' });
  } finally {
    client.release();
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing' });
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT id,email,password FROM users WHERE email=$1', [email]);
    if (r.rowCount === 0) return res.status(400).json({ error: 'no_user' });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(401).json({ error: 'bad_password' });
    const token = signToken(u);
    res.json({ token, user: { id: u.id, email: u.email } });
  } catch(e) {
    console.error('login err', e);
    res.status(500).json({ error: 'login_failed' });
  } finally {
    client.release();
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT id,email,created_at FROM users WHERE id=$1', [req.user.id]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    res.json(r.rows[0]);
  } finally {
    client.release();
  }
});

// Favorites
app.get('/api/favorites', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT code,name,created_at FROM favorites WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json(r.rows);
  } finally {
    client.release();
  }
});

app.post('/api/favorites', authMiddleware, async (req, res) => {
  const { code, name } = req.body || {};
  if (!code) return res.status(400).json({ error: 'missing_code' });
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO favorites(user_id,code,name) VALUES($1,$2,$3) ON CONFLICT (user_id,code) DO UPDATE SET name=EXCLUDED.name',
      [req.user.id, code, name || null]
    );
    res.json({ ok: true });
  } catch(e) {
    console.error('fav err', e);
    res.status(500).json({ error: 'fav_failed' });
  } finally {
    client.release();
  }
});

app.delete('/api/favorites', authMiddleware, async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!code) return res.status(400).json({ error: 'missing_code' });
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM favorites WHERE user_id=$1 AND code=$2', [req.user.id, code]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: 'del_failed' });
  } finally {
    client.release();
  }
});

// GET /api/top
app.get('/api/top', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const codes = POPULAR.map(p=>p.code);
      const r = await client.query(`SELECT code, name, price, updated_at FROM quotes WHERE code = ANY($1)`, [codes]);
      const map = new Map(r.rows.map(row=>[row.code, row]));
      const out = POPULAR.map(p=>{
        const q = map.get(p.code);
        return { code: p.code, name: p.name, price: q ? Number(q.price) : null, updated_at: q ? q.updated_at : null };
      });
      res.json(out);
    } finally { client.release(); }
  } catch(e) {
    console.error('top err', e);
    res.status(500).json({ error: 'top_failed' });
  }
});

// GET /api/search?q=
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const cacheKey = `search:${q}`;
  const hit = cache.get(cacheKey);
  if (hit) return res.json(hit);
  try {
    const url = `https://ac.finance.naver.com/ac?q=${encodeURIComponent(q)}&q_enc=utf-8&t_koreng=1&st=111&r_fmt=json`;
    const txt = await fetchText(url);
    const jsonStr = txt.replace(/^.*?\(({.*})\).*$/s, '$1');
    const obj = JSON.parse(jsonStr);
    const list = [];
    for (const it of (obj.items?.[0] || [])) {
      const name = it[0][0];
      const code = it[1][0];
      if (/^\d{6}$/.test(code)) list.push({ code, name });
    }
    cache.set(cacheKey, list, { ttl: 1000 * 60 * 10 });
    res.json(list);
  } catch (e) {
    const qq = q.replace(/\s/g,'').toLowerCase();
    const list = POPULAR.filter(x => x.name.replace(/\s/g,'').toLowerCase().includes(qq) || x.code.includes(qq));
    res.json(list);
  }
});

// GET /api/quote?code=005930
app.get('/api/quote', async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'invalid_code' });
  try {
    const q = await getQuote(code);
    res.json(q);
  } catch (e) {
    res.status(500).json({ error: 'quote_failed', detail: e.message });
  }
});

// GET /api/news?code=005930
app.get('/api/news', async (req, res) => {
  const code = (req.query.code || '').trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'invalid_code' });
  try {
    const client = await pool.connect();
    try {
      const r = await client.query(
        'SELECT title,url,source,time_text,fetched_at FROM news WHERE code=$1 ORDER BY fetched_at DESC LIMIT 50',
        [code]
      );
      if (r.rowCount > 0) {
        return res.json(r.rows);
      }
    } finally { client.release(); }
    const items = await fetchNewsAndStore(code);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: 'news_failed', detail: e.message });
  }
});

// Background update loops
let updating = false;
async function updateAllQuotes() {
  if (updating) return;
  updating = true;
  try {
    const client = await pool.connect();
    try {
      const favRows = await client.query('SELECT DISTINCT code FROM favorites');
      const favCodes = favRows.rows.map(r=>r.code);
      const codes = Array.from(new Set([...POPULAR.map(p=>p.code), ...favCodes]));
      for (const code of codes) {
        try {
          const q = await getQuoteRemote(code);
          if (q && q.price != null) await upsertQuoteDb(q);
        } catch(e){ /* ignore per-code errors */ }
      }
    } finally { client.release(); }
  } catch(e){ console.error('updateAllQuotes err', e); }
  updating = false;
}

// News updater
let updatingNews = false;
async function updateNewsForTracked() {
  if (updatingNews) return;
  updatingNews = true;
  try {
    const client = await pool.connect();
    try {
      const favRows = await client.query('SELECT DISTINCT code FROM favorites');
      const favCodes = favRows.rows.map(r=>r.code);
      const codes = Array.from(new Set([...POPULAR.map(p=>p.code), ...favCodes]));
      for (const code of codes) {
        try { await fetchNewsAndStore(code); } catch(e){}
      }
    } finally { client.release(); }
  } catch(e){ console.error('updateNews err', e); }
  updatingNews = false;
}

// Start background tasks
setInterval(updateAllQuotes, 1000);       // 1초마다 시세 갱신
setInterval(updateNewsForTracked, 60000); // 60초마다 뉴스 갱신

// fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log('Server listening on', PORT);
});
