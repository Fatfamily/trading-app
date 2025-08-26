import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pg from "pg";
import fetch from "node-fetch";
import { LRUCache } from "lru-cache";

const { Pool } = pg;
const app = express();
app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// DB 연결
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// 캐시
const cache = new LRUCache({ max: 500, ttl: 1000 * 60 * 5 });

// JWT 유저 검증 미들웨어
function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: "no token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

function sign(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

// ------------------- 주가 API -------------------
async function fetchStockPrice(code) {
  const key = `price:${code}`;
  if (cache.has(key)) return cache.get(key);
  const url = `https://api.finance.naver.com/service/itemSummary.naver?itemcode=${code}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("주가 조회 실패");
  const data = await r.json();
  cache.set(key, data);
  return data;
}

// ------------------- 뉴스 API -------------------
async function fetchNews(code) {
  const key = `news:${code}`;
  if (cache.has(key)) return cache.get(key);
  const url = `https://finance.naver.com/item/news_news.nhn?code=${code}&sm=title_entity_id.basic&clusterId=`;
  const r = await fetch(url);
  const html = await r.text();

  const regex = /<a href="([^"]+)"[^>]*>(.*?)<\/a>.*?<span class="date">(.*?)<\/span>/gs;
  let m;
  const news = [];
  while ((m = regex.exec(html))) {
    news.push({
      title: m[2].replace(/<[^>]+>/g, ""),
      link: "https://finance.naver.com" + m[1],
      date: m[3],
    });
  }
  cache.set(key, news);
  return news;
}

// ------------------- 회원가입 -------------------
app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "필수 항목 누락" });

    const hash = await bcrypt.hash(password, 10);
    const u = await pool.query(
      "INSERT INTO users(email, password_hash) VALUES($1,$2) RETURNING id,email",
      [email, hash]
    );
    await pool.query("INSERT INTO balances(user_id, cash) VALUES($1,$2)", [
      u.rows[0].id,
      10000000,
    ]);

    const token = sign(u.rows[0]);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return res.json({ ok: true });
  } catch (e) {
    if (String(e).includes("duplicate key"))
      return res.status(409).json({ error: "이미 존재하는 이메일" });
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

// ------------------- 로그인 -------------------
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const q = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (!q.rows.length)
      return res.status(401).json({ error: "존재하지 않는 사용자" });
    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "비밀번호 불일치" });

    const token = sign(user);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 3600 * 1000,
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
});

// ------------------- 로그아웃 -------------------
app.post("/api/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ ok: true });
});

// ------------------- 유저 정보 -------------------
app.get("/api/me", auth, async (req, res) => {
  return res.json({ id: req.user.id, email: req.user.email });
});

// ------------------- 주식 데이터 -------------------
app.get("/api/stock/:code", async (req, res) => {
  try {
    const data = await fetchStockPrice(req.params.code);
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "주가 조회 실패" });
  }
});

// ------------------- 뉴스 데이터 -------------------
app.get("/api/news/:code", async (req, res) => {
  try {
    const news = await fetchNews(req.params.code);
    return res.json(news);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "뉴스 조회 실패" });
  }
});

// ------------------- 시작 -------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
