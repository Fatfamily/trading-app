import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import pool from './db.js';
import { ok, bad } from './utils.js';
import { searchStocks, getQuotes, getNews, getTopKR } from './services.naver.js';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// auth middleware
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = (h.startsWith('Bearer ') ? h.slice(7) : null) || req.cookies?.token;
  if (!token) return bad(res, 'UNAUTHORIZED', 401);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, email: payload.email };
    next();
  } catch (e) {
    return bad(res, 'INVALID_TOKEN', 401);
  }
}

// health
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    ok(res, { db: r.rows[0].ok, time: new Date().toISOString() });
  } catch (e) {
    bad(res, e.message, 500);
  }
});

// auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return bad(res, 'email/password required');
    const hash = await bcrypt.hash(password, 10);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const r = await c.query('INSERT INTO users(email, password_hash) VALUES($1,$2) RETURNING id,email', [email, hash]);
      const user = r.rows[0];
      await c.query('INSERT INTO portfolios(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [user.id]);
      await c.query('COMMIT');
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, { httpOnly: false, sameSite: 'lax' });
      ok(res, { token, user });
    } catch (e) {
      await c.query('ROLLBACK');
      if (String(e).includes('unique')) return bad(res, 'EMAIL_EXISTS', 409);
      throw e;
    } finally {
      c.release();
    }
  } catch (e) {
    bad(res, e.message, 500);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await pool.query('SELECT id,email,password_hash FROM users WHERE email=$1', [email]);
    if (!r.rowCount) return bad(res, 'NO_USER', 404);
    const u = r.rows[0];
    const okPw = await bcrypt.compare(password, u.password_hash);
    if (!okPw) return bad(res, 'BAD_PASSWORD', 401);
    const token = jwt.sign({ id: u.id, email: u.email }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: false, sameSite: 'lax' });
    ok(res, { token, user: { id: u.id, email: u.email } });
  } catch (e) {
    bad(res, e.message, 500);
  }
});

// stocks
app.get('/api/stocks/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return ok(res, []);
    const items = await searchStocks(q);
    ok(res, items);
  } catch (e) {
    bad(res, e.message, 500);
  }
});

app.get('/api/stocks/top', async (req, res) => {
  try {
    const list = await getTopKR();
    const quotes = await getQuotes(list.map(x => x.code));
    // merge
    const map = new Map(quotes.map(q => [q.code, q]));
    const merged = list.map(it => ({ ...it, ...(map.get(it.code) || {}) }));
    ok(res, merged);
  } catch (e) {
    bad(res, e.message, 500);
  }
});

app.get('/api/stocks/quotes', async (req, res) => {
  try {
    const codes = String(req.query.codes || '').split(',').map(s => s.trim()).filter(Boolean);
    const q = await getQuotes(codes);
    ok(res, q);
  } catch (e) {
    bad(res, e.message, 500);
  }
});

app.get('/api/stocks/news', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return bad(res, 'code required');
    const news = await getNews(code);
    ok(res, news);
  } catch (e) {
    bad(res, e.message, 500);
  }
});

// watchlist
app.get('/api/watchlist', auth, async (req, res) => {
  const r = await pool.query('SELECT code,name FROM watchlist WHERE user_id=$1 ORDER BY name', [req.user.id]);
  ok(res, r.rows);
});
app.post('/api/watchlist', auth, async (req, res) => {
  try {
    const { code, name } = req.body;
    await pool.query('INSERT INTO watchlist(user_id,code,name) VALUES($1,$2,$3) ON CONFLICT (user_id,code) DO NOTHING', [req.user.id, code, name]);
    ok(res, true);
  } catch (e) {
    bad(res, e.message, 500);
  }
});
app.delete('/api/watchlist/:code', auth, async (req, res) => {
  await pool.query('DELETE FROM watchlist WHERE user_id=$1 AND code=$2', [req.user.id, req.params.code]);
  ok(res, true);
});

// portfolio + orders
async function getNowPrice(code) {
  const q = await getQuotes([code]);
  return q[0]?.price || 0;
}

app.get('/api/portfolio', auth, async (req, res) => {
  const c1 = await pool.query('SELECT cash_balance FROM portfolios WHERE user_id=$1', [req.user.id]);
  const cash = Number(c1.rows?.[0]?.cash_balance || 0);
  const h = await pool.query('SELECT code,name,quantity,avg_price FROM holdings WHERE user_id=$1 ORDER BY name', [req.user.id]);
  ok(res, { cash, holdings: h.rows });
});

app.post('/api/order', auth, async (req, res) => {
  try {
    const { code, name, side, quantity } = req.body;
    const qty = Number(quantity);
    if (!code || !name || !['BUY','SELL'].includes(side) || !Number.isFinite(qty) || qty <= 0) {
      return bad(res, 'invalid order');
    }
    const price = await getNowPrice(code);
    if (!price) return bad(res, 'price not available');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // cash
      const pr = await client.query('SELECT cash_balance FROM portfolios WHERE user_id=$1 FOR UPDATE', [req.user.id]);
      let cash = Number(pr.rows?.[0]?.cash_balance || 0);
      if (side === 'BUY') {
        const cost = price * qty;
        if (cash < cost) throw new Error('INSUFFICIENT_CASH');
        cash -= cost;
        await client.query('UPDATE portfolios SET cash_balance=$1 WHERE user_id=$2', [cash, req.user.id]);
        // holding upsert
        const exist = await client.query('SELECT id,quantity,avg_price FROM holdings WHERE user_id=$1 AND code=$2', [req.user.id, code]);
        if (exist.rowCount) {
          const qOld = Number(exist.rows[0].quantity);
          const avgOld = Number(exist.rows[0].avg_price);
          const qNew = qOld + qty;
          const avgNew = (qOld*avgOld + qty*price)/qNew;
          await client.query('UPDATE holdings SET quantity=$1, avg_price=$2 WHERE user_id=$3 AND code=$4', [qNew, avgNew, req.user.id, code]);
        } else {
          await client.query('INSERT INTO holdings(user_id,code,name,quantity,avg_price) VALUES($1,$2,$3,$4,$5)',
            [req.user.id, code, name, qty, price]);
        }
      } else {
        // SELL
        const exist = await client.query('SELECT id,quantity,avg_price FROM holdings WHERE user_id=$1 AND code=$2 FOR UPDATE', [req.user.id, code]);
        const qOld = Number(exist.rows?.[0]?.quantity || 0);
        if (qOld < qty) throw new Error('INSUFFICIENT_QTY');
        const qNew = qOld - qty;
        const proceeds = price * qty;
        cash += proceeds;
        await client.query('UPDATE portfolios SET cash_balance=$1 WHERE user_id=$2', [cash, req.user.id]);
        if (qNew === 0) {
          await client.query('DELETE FROM holdings WHERE user_id=$1 AND code=$2', [req.user.id, code]);
        } else {
          await client.query('UPDATE holdings SET quantity=$1 WHERE user_id=$2 AND code=$3', [qNew, req.user.id, code]);
        }
      }
      await client.query('INSERT INTO orders(user_id,code,name,side,quantity,price,status) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [req.user.id, code, name, side, qty, price, 'FILLED']);
      await client.query('COMMIT');
      ok(res, { filledPrice: price });
    } catch (e) {
      await client.query('ROLLBACK');
      return bad(res, e.message, 400);
    } finally {
      client.release();
    }
  } catch (e) {
    bad(res, e.message, 500);
  }
});

// serve client
app.use('/', express.static(path.join(__dirname, '../client')));

app.use((err, req, res, next) => {
  console.error(err);
  bad(res, 'SERVER_ERROR', 500);
});

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log('DB_OK');
  } catch (e) {
    console.error('DB_FAIL', e.message);
  }
  console.log(`Server listening on ${PORT}`);
});
