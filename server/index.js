import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import * as cheerio from 'cheerio';      // ✅ 수정됨
import { LRUCache } from 'lru-cache';    // ✅ 수정됨
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

// ✅ 캐시 인스턴스
const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60
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

function parseNum(s) {
  if (!s) return null;
  const t = (''+s).replace(/[^\d.-]/g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

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

// ===========================
// 이하의 로직 (getQuoteRemote, DB upsert, 뉴스 크롤링, 인증, API 라우트, 백그라운드 업데이트 등)
// 전부 기존 버전 그대로 유지하시면 됩니다.
// ===========================

let updating = false;
async function updateAllQuotes() { /* ... 기존 코드 그대로 ... */ }
let updatingNews = false;
async function updateNewsForTracked() { /* ... 기존 코드 그대로 ... */ }

setInterval(updateAllQuotes, 1000);
setInterval(updateNewsForTracked, 60000);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.listen(PORT, () => {
  console.log('Server listening on', PORT);
});
