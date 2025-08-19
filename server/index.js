
import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';
import { getQuote, searchStocks, getNews, DEFAULT_LIST } from './services.naver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit:'1mb' }));
app.use(cookieParser());
app.use(morgan('tiny'));
app.use(cors({ origin: true, credentials: true }));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

function send(res, data) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.send(JSON.stringify(data));
}

function auth(req,res,next){
  const token = req.cookies.token || (req.headers.authorization||'').replace('Bearer ','').trim();
  if (!token) return res.status(401).json({error:'NO_AUTH'});
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch(_){
    return res.status(401).json({error:'BAD_TOKEN'});
  }
}

app.get('/api/health', async (req,res)=>{
  try {
    const r = await query('select 1 as ok');
    send(res,{ db: r.rows[0].ok, time: Date.now() });
  } catch(e){ res.status(500).json({ error: 'DB_FAIL', detail: String(e) }); }
});

// auth
app.post('/api/auth/register', async (req,res)=>{
  const { email, password } = req.body||{};
  if (!email || !password) return res.status(400).json({error:'BAD_INPUT'});
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await query('insert into users(email,password_hash) values($1,$2) returning id',[email,hash]);
    await query('insert into portfolios(user_id,cash) values($1,$2)', [r.rows[0].id, 10000000]);
  } catch(e){
    if (String(e).includes('duplicate')) return res.status(409).json({error:'EMAIL_EXISTS'});
    return res.status(500).json({error:'DB', detail: String(e)});
  }
  const user = { id: (await query('select id from users where email=$1',[email])).rows[0].id, email };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '14d' });
  res.cookie('token', token, { httpOnly: true, sameSite:'lax', secure: true, maxAge: 1209600000 });
  send(res,{ user, token });
});

app.post('/api/auth/login', async (req,res)=>{
  const { email, password } = req.body||{};
  const r = await query('select * from users where email=$1',[email]);
  if (r.rowCount===0) return res.status(401).json({error:'NO_USER'});
  const ok = await bcrypt.compare(password, r.rows[0].password_hash);
  if (!ok) return res.status(401).json({error:'BAD_PASS'});
  const user = { id: r.rows[0].id, email };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '14d' });
  res.cookie('token', token, { httpOnly: true, sameSite:'lax', secure: true, maxAge: 1209600000 });
  send(res,{ user, token });
});

app.post('/api/auth/logout', (req,res)=>{
  res.clearCookie('token');
  send(res,{ ok:1 });
});

app.get('/api/me', auth, async (req,res)=>{
  const uid = req.user.id;
  const cash = (await query('select cash from portfolios where user_id=$1',[uid])).rows?.[0]?.cash ?? 0;
  const holdings = (await query('select symbol,name,qty,avg_price from holdings where user_id=$1',[uid])).rows;
  const watch = (await query('select symbol,name from watchlist where user_id=$1',[uid])).rows;
  send(res,{ user: req.user, cash, holdings, watch });
});

// market API
app.get('/api/search', async (req,res)=>{
  try {
    const q = String(req.query.q||'').trim();
    const list = q ? await searchStocks(q) : [];
    send(res, list);
  } catch(e){ res.status(500).json({error:'SEARCH_FAIL', detail:String(e)}); }
});

app.get('/api/quote/:symbol', async (req,res)=>{
  try {
    send(res, await getQuote(req.params.symbol));
  } catch(e){ res.status(500).json({error:'QUOTE_FAIL', detail:String(e)}); }
});

app.get('/api/news/:symbol', async (req,res)=>{
  try {
    send(res, await getNews(req.params.symbol));
  } catch(e){ res.status(500).json({error:'NEWS_FAIL', detail:String(e)}); }
});

app.get('/api/top', async (_req,res)=>{
  try {
    const out = [];
    for (const s of DEFAULT_LIST) {
      try { out.push(await getQuote(s)); } catch(_){}
    }
    send(res,out);
  } catch(e){ res.status(500).json({error:'TOP_FAIL', detail:String(e)}); }
});

// trading
app.post('/api/watch/toggle', auth, async (req,res)=>{
  const { symbol, name } = req.body||{};
  const uid = req.user.id;
  const ex = await query('select 1 from watchlist where user_id=$1 and symbol=$2',[uid,symbol]);
  if (ex.rowCount) {
    await query('delete from watchlist where user_id=$1 and symbol=$2',[uid,symbol]);
    send(res,{ watched:false });
  } else {
    await query('insert into watchlist(user_id,symbol,name) values($1,$2,$3)',[uid,symbol,name||symbol]);
    send(res,{ watched:true });
  }
});

app.post('/api/order', auth, async (req,res)=>{
  const { symbol, name, side, qty, price } = req.body||{};
  const uid = req.user.id;
  const q = Number(qty||0);
  const p = Number(price||0);
  if (!symbol || !q || !p || !['BUY','SELL'].includes(side)) return res.status(400).json({error:'BAD_ORDER'});

  const port = await query('select cash from portfolios where user_id=$1',[uid]);
  let cash = Number(port.rows[0].cash||0);

  if (side==='BUY') {
    const need = q*p;
    if (cash < need) return res.status(400).json({error:'NO_CASH'});
    cash -= need;
    await query('insert into orders(user_id,symbol,name,side,qty,price) values($1,$2,$3,$4,$5,$6)',[uid,symbol,name,side,q,p]);
    const h = await query('select qty,avg_price from holdings where user_id=$1 and symbol=$2',[uid,symbol]);
    if (h.rowCount===0){
      await query('insert into holdings(user_id,symbol,name,qty,avg_price) values($1,$2,$3,$4,$5)',[uid,symbol,name,q,p]);
    } else {
      const cq = Number(h.rows[0].qty), ca = Number(h.rows[0].avg_price);
      const newQty = cq + q;
      const newAvg = Math.round((cq*ca + q*p)/newQty);
      await query('update holdings set qty=$3, avg_price=$4 where user_id=$1 and symbol=$2',[uid,symbol,newQty,newAvg]);
    }
  } else {
    const h = await query('select qty,avg_price from holdings where user_id=$1 and symbol=$2',[uid,symbol]);
    const have = Number(h.rows?.[0]?.qty||0);
    if (have < q) return res.status(400).json({error:'NO_SHARES'});
    cash += q*p;
    await query('insert into orders(user_id,symbol,name,side,qty,price) values($1,$2,$3,$4,$5,$6)',[uid,symbol,name,side,q,p]);
    const left = have - q;
    if (left===0) await query('delete from holdings where user_id=$1 and symbol=$2',[uid,symbol]);
    else await query('update holdings set qty=$3 where user_id=$1 and symbol=$2',[uid,symbol,left]);
  }
  await query('update portfolios set cash=$2 where user_id=$1',[uid,cash]);
  send(res,{ ok:1, cash });
});

// static client
app.use('/', express.static(path.join(__dirname,'../client')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log(`Server running on :${PORT}`));
