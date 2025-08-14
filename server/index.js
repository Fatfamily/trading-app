import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch'; // Node 20 has global fetch but this keeps it explicit on some hosts
import { z } from 'zod';

dotenv.config();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')
    ? { rejectUnauthorized: false }
    : undefined
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '사용자',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS portfolios (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      name_kr TEXT NOT NULL,
      avg_price NUMERIC NOT NULL DEFAULT 0,
      quantity NUMERIC NOT NULL DEFAULT 0,
      UNIQUE(user_id, symbol)
    );
    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      name_kr TEXT NOT NULL,
      UNIQUE(user_id, symbol)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
      quantity NUMERIC NOT NULL,
      price NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS balances (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cash NUMERIC NOT NULL DEFAULT 100000000
    );
    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
}

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));
app.use(express.static('../client'));

// ------------------------ Auth helpers ------------------------
function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ------------------------ KR Symbols (demo list) ------------------------
// Minimal curated list for reliability without external catalogs
const KR_LIST = [
  { symbol: '005930', name: '삼성전자' },
  { symbol: '000660', name: 'SK하이닉스' },
  { symbol: '005380', name: '현대차' },
  { symbol: '373220', name: 'LG에너지솔루션' },
  { symbol: '035420', name: 'NAVER' },
  { symbol: '035720', name: '카카오' },
  { symbol: '005490', name: 'POSCO홀딩스' },
  { symbol: '207940', name: '삼성바이오로직스' },
  { symbol: '000270', name: '기아' },
  { symbol: '006400', name: '삼성SDI' },
  { symbol: '277810', name: '레이보우로보틱스' }
];

function normalizeQuery(q) {
  return q.replace(/\s+/g, '').toLowerCase();
}
function searchKR(q) {
  const key = normalizeQuery(q)
    .replace(/삼성 일렉트릭|samsung electric/gi, '삼성전자')
    .replace(/samsung/gi, '삼성');
  // very simple typo fix
  const typo = key.replace(/레이보우|레인보우/gi, '레이보우');
  const cand = KR_LIST.map(x => ({
    ...x,
    score:
      (x.name.replace(/\s+/g, '').toLowerCase().includes(typo) ? 2 : 0) +
      (x.symbol.includes(q) ? 1 : 0)
  }));
  return cand.filter(c => c.score>0).sort((a,b)=>b.score-a.score);
}

// ------------------------ Quote Provider (Naver HTML) ------------------------
async function fetchQuoteNaver(symbol) {
  // Naver Finance page
  const url = `https://finance.naver.com/item/main.nhn?code=${symbol}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const priceTxt = $('#chart_area .rate_info .today .no_today .blind').first().text().replace(/,/g,'');
  const changeTxt = $('#chart_area .rate_info .today .no_exday .blind').eq(1).text().replace(/,/g,'');
  const name = $('.wrap_company h2').text().trim() || KR_LIST.find(k=>k.symbol===symbol)?.name || symbol;
  const price = Number(priceTxt || '0');
  const change = Number(changeTxt || '0');
  return { symbol, name, price, change, time: Date.now() };
}

async function fetchQuotes(symbols) {
  // Fetch sequentially to be gentle
  const out = [];
  for (const s of symbols) {
    try {
      out.push(await fetchQuoteNaver(s));
    } catch (e) {
      out.push({ symbol: s, name: s, price: 0, change: 0, time: Date.now(), error: e.message });
    }
  }
  return out;
}

// ------------------------ News Provider (Naver) ------------------------
async function fetchNewsNaver(symbol) {
  const url = `https://finance.naver.com/item/news_news.naver?code=${symbol}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];
  $('#news_table tr').each((_, tr) => {
    const a = $(tr).find('a');
    const title = a.text().trim();
    const href = a.attr('href');
    const source = $(tr).find('.info').text().trim();
    const date = $(tr).find('.date').text().trim();
    if (title && href) {
      const link = new URL(href, 'https://finance.naver.com').toString();
      items.push({ title, link, source, date });
    }
  });
  return items.slice(0, 15);
}

// ------------------------ Routes ------------------------
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Auth
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(1)
});
app.post('/api/auth/register', async (req,res)=>{
  try {
    const { email, password, displayName } = registerSchema.parse(req.body);
    const { rows: exist } = await pool.query('SELECT id FROM users WHERE email=$1',[email]);
    if (exist.length) return res.status(409).json({ error: '이미 가입된 이메일' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users(email,password_hash,display_name) VALUES($1,$2,$3) RETURNING id,email,display_name',
      [email, hash, displayName]
    );
    const u = rows[0];
    await pool.query('INSERT INTO balances(user_id,cash) VALUES($1,$2)', [u.id, 100_000_000]);
    const token = sign(u);
    res.json({ token, user: { id: u.id, email: u.email, displayName: u.display_name } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
app.post('/api/auth/login', async (req,res)=>{
  try {
    const { email, password } = loginSchema.parse(req.body);
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1',[email]);
    if (!rows.length) return res.status(401).json({ error: '이메일/비번 확인' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: '이메일/비번 확인' });
    const token = sign(user);
    res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Reset account
app.post('/api/account/reset', auth, async (req,res)=>{
  const uid = req.user.id;
  await pool.query('DELETE FROM portfolios WHERE user_id=$1',[uid]);
  await pool.query('DELETE FROM watchlists WHERE user_id=$1',[uid]);
  await pool.query('DELETE FROM orders WHERE user_id=$1',[uid]);
  await pool.query('DELETE FROM logs WHERE user_id=$1',[uid]);
  await pool.query('INSERT INTO balances(user_id,cash) VALUES($1,100000000) ON CONFLICT (user_id) DO UPDATE SET cash=EXCLUDED.cash',[uid]);
  res.json({ ok: true });
});

// Catalog & Search
app.get('/api/search', (req,res)=>{
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);
  const results = searchKR(q).slice(0, 10);
  res.json(results);
});

app.get('/api/top', async (req,res)=>{
  // Return curated top list with live quotes
  const syms = KR_LIST.slice(0,10).map(x=>x.symbol);
  const quotes = await fetchQuotes(syms);
  res.json(quotes);
});

// Quotes
app.get('/api/quotes', async (req,res)=>{
  const symbols = (req.query.symbols || '').toString().split(',').map(s=>s.trim()).filter(Boolean);
  const quotes = await fetchQuotes(symbols);
  res.json(quotes);
});

// News
app.get('/api/news/:symbol', async (req,res)=>{
  try {
    const items = await fetchNewsNaver(req.params.symbol);
    res.json(items);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Watchlist
app.get('/api/watchlist', auth, async (req,res)=>{
  const uid = req.user.id;
  const { rows } = await pool.query('SELECT symbol,name_kr FROM watchlists WHERE user_id=$1 ORDER BY name_kr',[uid]);
  res.json(rows);
});
app.post('/api/watchlist', auth, async (req,res)=>{
  const uid = req.user.id;
  const { symbol, name_kr } = req.body;
  await pool.query('INSERT INTO watchlists(user_id,symbol,name_kr) VALUES($1,$2,$3) ON CONFLICT (user_id,symbol) DO NOTHING',[uid,symbol,name_kr]);
  res.json({ ok: true });
});
app.delete('/api/watchlist/:symbol', auth, async (req,res)=>{
  const uid = req.user.id;
  await pool.query('DELETE FROM watchlists WHERE user_id=$1 AND symbol=$2',[uid, req.params.symbol]);
  res.json({ ok: true });
});

// Portfolio & Orders (market)
app.get('/api/portfolio', auth, async (req,res)=>{
  const uid = req.user.id;
  const { rows } = await pool.query('SELECT symbol,name_kr,avg_price,quantity FROM portfolios WHERE user_id=$1 ORDER BY name_kr',[uid]);
  const bal = await pool.query('SELECT cash FROM balances WHERE user_id=$1',[uid]);
  res.json({ positions: rows, cash: Number(bal.rows[0]?.cash || 0) });
});

const orderSchema = z.object({
  symbol: z.string().min(1),
  name_kr: z.string().min(1),
  side: z.enum(['BUY','SELL']),
  quantity: z.number().positive()
});
app.post('/api/order', auth, async (req,res)=>{
  try {
    const { symbol, name_kr, side, quantity } = orderSchema.parse(req.body);
    const [quote] = await fetchQuotes([symbol]);
    const price = quote?.price || 0;
    if (!price) return res.status(400).json({ error: '시세 조회 실패' });

    await pool.query('BEGIN');
    const balRes = await pool.query('SELECT cash FROM balances WHERE user_id=$1 FOR UPDATE',[req.user.id]);
    const cash = Number(balRes.rows[0]?.cash || 0);
    if (side === 'BUY') {
      const cost = price * quantity;
      if (cash < cost) { await pool.query('ROLLBACK'); return res.status(400).json({ error: '현금 부족' }); }
      await pool.query('UPDATE balances SET cash=cash-$1 WHERE user_id=$2',[cost, req.user.id]);
      // upsert position
      const pos = await pool.query('SELECT avg_price,quantity FROM portfolios WHERE user_id=$1 AND symbol=$2',[req.user.id, symbol]);
      if (pos.rows.length) {
        const oldQty = Number(pos.rows[0].quantity);
        const oldAvg = Number(pos.rows[0].avg_price);
        const newQty = oldQty + quantity;
        const newAvg = (oldQty*oldAvg + cost) / newQty;
        await pool.query('UPDATE portfolios SET quantity=$1, avg_price=$2 WHERE user_id=$3 AND symbol=$4',[newQty, newAvg, req.user.id, symbol]);
      } else {
        await pool.query('INSERT INTO portfolios(user_id,symbol,name_kr,avg_price,quantity) VALUES($1,$2,$3,$4,$5)',[req.user.id, symbol, name_kr, price, quantity]);
      }
    } else { // SELL
      const pos = await pool.query('SELECT avg_price,quantity FROM portfolios WHERE user_id=$1 AND symbol=$2 FOR UPDATE',[req.user.id, symbol]);
      const qty = Number(pos.rows[0]?.quantity || 0);
      if (qty < quantity) { await pool.query('ROLLBACK'); return res.status(400).json({ error: '보유수량 부족' }); }
      const proceeds = price * quantity;
      const newQty = qty - quantity;
      if (newQty === 0) {
        await pool.query('DELETE FROM portfolios WHERE user_id=$1 AND symbol=$2',[req.user.id, symbol]);
      } else {
        await pool.query('UPDATE portfolios SET quantity=$1 WHERE user_id=$2 AND symbol=$3',[newQty, req.user.id, symbol]);
      }
      await pool.query('UPDATE balances SET cash=cash+$1 WHERE user_id=$2',[proceeds, req.user.id]);
    }
    await pool.query('INSERT INTO orders(user_id,symbol,side,quantity,price) VALUES($1,$2,$3,$4,$5)',
      [req.user.id, symbol, side, quantity, price]);
    await pool.query('COMMIT');
    res.json({ ok: true, filledPrice: price });
  } catch (e) {
    await pool.query('ROLLBACK').catch(()=>{});
    res.status(400).json({ error: e.message });
  }
});

// Static fallthrough
app.get('*', (req,res)=>{
  res.sendFile(new URL('../client/index.html', import.meta.url).pathname);
});

// Start
initDb().then(()=>{
  app.listen(PORT, ()=> console.log(`✅ Server running on ${PORT}`));
}).catch(err=>{
  console.error('DB init error', err);
  process.exit(1);
});
