import express from 'express';
import { authMiddleware } from './auth.js';
import { query } from '../db.js';

const router = express.Router();
router.use(authMiddleware);

async function getPrice(code) {
  const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  const data = await res.json();
  const s = data?.result?.areas?.[0]?.datas?.[0];
  if (!s) throw new Error('price not found');
  return { price: s.nv, name: s.nm };
}

router.post('/order', async (req, res) => {
  const { code, side, qty } = req.body; // side: BUY/SELL
  const uid = req.userId;
  if (!code || !qty || !['BUY','SELL'].includes(side)) return res.status(400).json({ error: 'bad params' });
  try {
    const { price, name } = await getPrice(code);
    const total = price * qty;

    // get user
    const u = await query('SELECT id,balance FROM users WHERE id=$1', [uid]);
    if (u.rowCount === 0) return res.status(404).json({ error: 'user not found' });
    let balance = Number(u.rows[0].balance);

    if (side === 'BUY') {
      if (total > balance) return res.status(400).json({ error: 'not enough balance' });
      balance -= total;
      await query('INSERT INTO trades(user_id, code, side, qty, price) VALUES ($1,$2,$3,$4,$5)', [uid, code, side, qty, price]);
      const h = await query('SELECT qty, avg_price FROM holdings WHERE user_id=$1 AND code=$2', [uid, code]);
      if (h.rowCount === 0) {
        await query('INSERT INTO holdings(user_id, code, qty, avg_price) VALUES ($1,$2,$3,$4)', [uid, code, qty, price]);
      } else {
        const cur = h.rows[0];
        const newQty = Number(cur.qty) + qty;
        const newAvg = Math.round((Number(cur.avg_price) * Number(cur.qty) + total) / newQty);
        await query('UPDATE holdings SET qty=$1, avg_price=$2 WHERE user_id=$3 AND code=$4', [newQty, newAvg, uid, code]);
      }
      await query('UPDATE users SET balance=$1 WHERE id=$2', [balance, uid]);
    } else {
      const h = await query('SELECT qty, avg_price FROM holdings WHERE user_id=$1 AND code=$2', [uid, code]);
      const curQty = h.rowCount ? Number(h.rows[0].qty) : 0;
      if (qty > curQty) return res.status(400).json({ error: 'not enough shares' });
      const newQty = curQty - qty;
      balance += total;
      await query('INSERT INTO trades(user_id, code, side, qty, price) VALUES ($1,$2,$3,$4,$5)', [uid, code, side, qty, price]);
      if (newQty === 0) {
        await query('DELETE FROM holdings WHERE user_id=$1 AND code=$2', [uid, code]);
      } else {
        await query('UPDATE holdings SET qty=$1 WHERE user_id=$2 AND code=$3', [newQty, uid, code]);
      }
      await query('UPDATE users SET balance=$1 WHERE id=$2', [balance, uid]);
    }

    res.json({ ok: true, price, name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
