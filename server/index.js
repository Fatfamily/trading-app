
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import iconv from 'iconv-lite';
import cheerio from 'cheerio';
import LRU from 'lru-cache';
import path from 'path';
import fs from 'fs';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const app = express();

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan('tiny'));

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const { Pool } = pkg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('DATABASE_URL not set.');
}
const pool = connectionString ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } }) : null;

async function ensureSchema() {
  if (!pool) return;
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}
await ensureSchema();

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  try {
    const token = req.cookies.token || (req.headers.authorization?.split(' ')[1]);
    if (!token) return res.status(401).json({ error: 'unauthorized' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

const CODE_MAP = {"005930": "삼성전자", "000660": "SK하이닉스", "035420": "NAVER", "373220": "LG에너지솔루션", "035720": "카카오", "005380": "현대차", "068270": "셀트리온", "207940": "삼성바이오로직스", "055550": "신한지주", "051910": "LG화학", "005490": "POSCO홀딩스", "006400": "삼성SDI", "028260": "삼성물산", "000270": "기아", "105560": "KB금융", "034730": "SK", "096770": "SK이노베이션", "003550": "LG", "066570": "LG전자", "028300": "HLB", "091990": "셀트리온헬스케어", "086520": "에코프로", "051900": "LG생활건강"};
const cache = new LRU({ max: 500, ttl: 1000 });

async function fetchQuotes(codes) {
  const key = 'quotes:' + codes.join(',');
  const cached = cache.get(key);
  if (cached) return cached;
  const query = codes.map(c => 'SERVICE_ITEM:' + c).join(',');
  const url = 'https://polling.finance.naver.com/api/realtime?query=' + encodeURIComponent(query);
  const resp = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0' } });
  const data = await resp.json();
  const result = {}
  if (data?.result?.areas) {
    for (const area of data.result.areas) {
      for (const item of (area.datas||[])) {
        result[item.cd] = {
          code: item.cd,
          name: CODE_MAP[item.cd] || item.nm || item.cd,
          price: item.nv,
          change: item.cv,
          changeRate: item.cr,
          high: item.hv,
          low: item.lv,
          prevClose: item.pc,
          volume: item.aq,
          time: Date.now()
        }
      }
    }
  }
  cache.set(key, result);
  return result;
}

async function searchNaver(q) {
  try {
    const url = 'https://ac.finance.naver.com/ac?q=' + encodeURIComponent(q) + '&st=111&r_lt=111';
    const resp = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0' } });
    const txt = await resp.text();
    const jsonStr = txt.replace(/^.*?\(({.*})\).*$/s, '$1');
    const obj = JSON.parse(jsonStr);
    const list = [];
    for (const it of (obj.items?.[0] || [])) {
      const name = it[0][0];
      const code = it[1][0];
      if (/^\d{6}$/.test(code)) list.push({ code, name });
    }
    if (list.length) return list;
  } catch(e) { }
  const qq = q.replace(/\s/g,'').toLowerCase();
  return Object.entries(CODE_MAP)
    .filter(([code,name]) => name.replace(/\s/g,'').toLowerCase().includes(qq) || code.includes(qq))
    .slice(0,10)
    .map(([code,name]) => ({ code, name }));
}

async function fetchNews(code) {
  const key = 'news:' + code;
  const cached = cache.get(key);
  if (cached) return cached;
  const url = 'https://finance.naver.com/item/news_news.nhn?code=' + code + '&page=1&sm=title_entity_id.basic';
  const resp = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0' } });
  const buf = await resp.arrayBuffer();
  const html = iconv.decode(Buffer.from(buf), 'EUC-KR');
  const $ = cheerio.load(html);
  const rows = [];
  $('table.type5 tr').each((_, tr) => {
    const tds = $(tr).find('td');
    const a = $(tds[0]).find('a').first();
    const title = a.text().trim();
    const href = a.attr('href');
    if (title && href) {
      const link = href.startsWith('http') ? href : 'https://finance.naver.com' + href;
      const date = $(tds[2]).text().trim();
      rows.push({ title, link, date });
    }
  });
  const out = rows.slice(0,10);
  cache.set(key, out, { ttl: 60_000 });
  return out;
}

app.post('/api/register', async (req,res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '필수 항목 누락' });
    const hash = await bcrypt.hash(password, 10);
    const u = await pool.query('INSERT INTO users(email, password_hash) VALUES($1,$2) RETURNING id,email', [email, hash]);
    await pool.query('INSERT INTO balances(user_id, cash) VALUES($1,$2)', [u.rows[0].id, 10000000]);
    const token = sign(u.rows[0]);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7*24*3600*1000 });
    return res.json({ ok: true });
  } catch (e) {
    if (String(e).includes('duplicate key')) return res.status(409).json({ error: '이미 존재하는 이메일' });
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
});

app.post('/api/login', async (req,res) => {
  try {
    const { email, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (!r.rowCount) return res.status(401).json({ error: '이메일/비밀번호 확인' });
    const u = r.rows[0];
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: '이메일/비밀번호 확인' });
    const token = sign(u);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 7*24*3600*1000 });
    return res.json({ ok: true });
  } catch(e) {
    console.error(e); return res.status(500).json({ error: 'server' });
  }
});

app.post('/api/logout', (req,res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.delete('/api/account', auth, async (req,res) => { await pool.query('DELETE FROM users WHERE id=$1', [req.user.id]); res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/me', auth, async (req,res) => { const r = await pool.query('SELECT id,email FROM users WHERE id=$1', [req.user.id]); res.json(r.rows[0]); });

app.get('/api/portfolio', auth, async (req,res) => {
  const [h, b] = await Promise.all([
    pool.query('SELECT code,name,qty,avg_price FROM holdings WHERE user_id=$1 ORDER BY name', [req.user.id]),
    pool.query('SELECT cash FROM balances WHERE user_id=$1', [req.user.id])
  ]);
  res.json({ holdings: h.rows, balance: b.rows[0]?.cash ?? 0 });
});

app.post('/api/watchlist', auth, async (req,res) => { const { code, name } = req.body; await pool.query('INSERT INTO watchlist(user_id, code, name) VALUES($1,$2,$3) ON CONFLICT (user_id,code) DO NOTHING', [req.user.id, code, name || CODE_MAP[code] || code]); res.json({ ok: true }); });
app.delete('/api/watchlist/:code', auth, async (req,res) => { await pool.query('DELETE FROM watchlist WHERE user_id=$1 AND code=$2', [req.user.id, req.params.code]); res.json({ ok: true }); });
app.get('/api/watchlist', auth, async (req,res) => { const r = await pool.query('SELECT code,name FROM watchlist WHERE user_id=$1 ORDER BY name', [req.user.id]); res.json(r.rows); });

app.post('/api/trade', auth, async (req,res) => {
  const { code, name, side, qty, price } = req.body;
  if (!code || !side || !qty) return res.status(400).json({ error: 'bad request' });
  const nm = name || CODE_MAP[code] || code;
  const pr = price || (await fetchQuotes([code]))[code]?.price;
  if (!pr) return res.status(400).json({ error: 'notradable' });
  const q = Math.max(1, Math.floor(Number(qty)));
  const p = Math.max(1, Math.floor(Number(pr)));
  const total = q * p;
  await pool.query('BEGIN');
  try {
    const bal = await pool.query('SELECT cash FROM balances WHERE user_id=$1 FOR UPDATE', [req.user.id]);
    let cash = bal.rows[0]?.cash ?? 0;
    if (side === 'BUY') {
      if (cash < total) throw new Error('잔고부족');
      cash -= total;
      await pool.query('INSERT INTO holdings(user_id,code,name,qty,avg_price) VALUES($1,$2,$3,$4,$5) ON CONFLICT (user_id,code) DO UPDATE SET qty = holdings.qty + $4, avg_price = ((holdings.avg_price*holdings.qty)+($5*$4))/(holdings.qty+$4)', [req.user.id, code, nm, q, p]);
    } else if (side === 'SELL') {
      const h = await pool.query('SELECT qty,avg_price FROM holdings WHERE user_id=$1 AND code=$2 FOR UPDATE', [req.user.id, code]);
      const have = h.rowCount ? Number(h.rows[0].qty) : 0;
      if (have < q) throw new Error('수량부족');
      const left = have - q;
      if (left === 0) { await pool.query('DELETE FROM holdings WHERE user_id=$1 AND code=$2', [req.user.id, code]); }
      else { await pool.query('UPDATE holdings SET qty=$3 WHERE user_id=$1 AND code=$2', [req.user.id, code, left]); }
      cash += total;
    } else throw new Error('invalid side');
    await pool.query('UPDATE balances SET cash=$2 WHERE user_id=$1', [req.user.id, cash]);
    await pool.query('INSERT INTO trades(user_id,code,name,side,qty,price) VALUES($1,$2,$3,$4,$5,$6)', [req.user.id, code, nm, side === 'BUY' ? 'BUY' : 'SELL', q, p]);
    await pool.query('COMMIT');
    res.json({ ok: true });
  } catch(e) {
    await pool.query('ROLLBACK');
    return res.status(400).json({ error: String(e.message || e) });
  }
});

app.get('/api/top', async (req,res) => { const codes = Object.keys(CODE_MAP).slice(0, 10); const q = await fetchQuotes(codes); const list = codes.map(c => q[c] || { code: c, name: CODE_MAP[c] || c }); res.set('Content-Type','application/json; charset=utf-8'); res.json(list); });
app.get('/api/quote/:code', async (req,res) => { const code = req.params.code; const q = await fetchQuotes([code]); res.set('Content-Type','application/json; charset=utf-8'); res.json(q[code] || { code, name: CODE_MAP[code] || code }); });

app.get('/api/candles/:code', async (req,res) => {
  const code = req.params.code;
  const count = Math.min(500, Number(req.query.count || 120));
  try {
    const url = 'https://api.finance.naver.com/siseJson.naver?symbol=' + code + '&requestType=1&timeframe=day';
    const resp = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0' } });
    const txt = await resp.text();
    const arr = JSON.parse(JSON.stringify(eval(txt)));
    const rows = [];
    for (const row of arr) {
      if (Array.isArray(row) && typeof row[0] === 'string' && /\d{4}-\d{2}-\d{2}/.test(row[0])) {
        rows.push({ t: row[0], o:+row[1], h:+row[2], l:+row[3], c:+row[4], v:+row[5] });
      }
    }
    if (rows.length) return res.json(rows.slice(-count));
  } catch(e) { }
  const now = Date.now();
  const base = cache.get('series:' + code) || [];
  if (!cache.has('series:' + code)) cache.set('series:' + code, base, { ttl: 60_000 });
  const q = await fetchQuotes([code]);
  const price = q[code]?.price || 0;
  base.push({ t: now, o: price, h: price, l: price, c: price, v: 0 });
  while (base.length > count) base.shift();
  res.json(base);
});

app.get('/api/search', async (req,res) => { const q = String(req.query.q||'').trim(); if(!q) return res.json([]); const list = await searchNaver(q); res.set('Content-Type','application/json; charset=utf-8'); res.json(list); });
app.get('/api/news/:code', async (req,res) => { const code = req.params.code; const n = await fetchNews(code); res.set('Content-Type','application/json; charset=utf-8'); res.json(n); });

app.use('/', express.static(path.join(__dirname, '../client'), { index: 'index.html' }));
app.get('/healthz', (req,res)=>res.json({ok:true}));
app.listen(PORT, ()=>console.log('Server listening on ' + PORT));
