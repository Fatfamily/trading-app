import express from 'express';
import { authMiddleware } from './auth.js';
import { query } from '../db.js';

const router = express.Router();

router.use(authMiddleware);

// 자산/보유/관심 조회
router.get('/me', async (req, res) => {
  const uid = req.userId;
  const u = await query('SELECT id,email,balance FROM users WHERE id=$1', [uid]);
  const holdings = await query('SELECT code, qty, avg_price FROM holdings WHERE user_id=$1 ORDER BY code', [uid]);
  const watchlist = await query('SELECT code FROM watchlist WHERE user_id=$1 ORDER BY code', [uid]);
  res.json({ user: u.rows[0], holdings: holdings.rows, watchlist: watchlist.rows.map(r=>r.code) });
});

// 관심종목 추가/삭제
router.post('/watchlist/add', async (req, res) => {
  const { code } = req.body;
  await query('INSERT INTO watchlist(user_id, code) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.userId, code]);
  res.json({ ok: true });
});
router.post('/watchlist/remove', async (req, res) => {
  const { code } = req.body;
  await query('DELETE FROM watchlist WHERE user_id=$1 AND code=$2', [req.userId, code]);
  res.json({ ok: true });
});

// 초기화
router.post('/reset', async (req, res) => {
  const uid = req.userId;
  await query('UPDATE users SET balance=10000000 WHERE id=$1', [uid]);
  await query('DELETE FROM trades WHERE user_id=$1', [uid]);
  await query('DELETE FROM holdings WHERE user_id=$1', [uid]);
  res.json({ ok: true });
});

export default router;
