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
import { LRUCache } from 'lru-cache';
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

// ✅ lru-cache 최신 문법
const cache = new LRUCache({ max: 500, ttl: 1000 });

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

// 이하 나머지 API 라우트들은 네가 준 코드 그대로 유지
// (register, login, logout, portfolio, watchlist, trade, top, quote, candles, search, news 등)

app.post('/api/register', async (req,res) => { ... });
app.post('/api/login', async (req,res) => { ... });
app.post('/api/logout', (req,res) => { ... });
app.delete('/api/account', auth, async (req,res) => { ... });
app.get('/api/me', auth, async (req,res) => { ... });

// (중략 - 나머지 코드 동일)

app.use('/', express.static(path.join(__dirname, '../client'), { index: 'index.html' }));
app.get('/healthz', (req,res)=>res.json({ok:true}));
app.listen(PORT, ()=>console.log('Server listening on ' + PORT));
