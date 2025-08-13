const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authMiddleware } = require('../utils/auth');
const { getQuotes } = require('../utils/market');
const Parser = require('rss-parser');
const parser = new Parser();

// 상위 10개 (환경변수 기반)
router.get('/top', authMiddleware, async (req, res) => {
  const symbolsEnv = process.env.TOP_SYMBOLS || '005930.KS,000660.KS,035420.KS,AAPL,TSLA,MSFT,GOOGL,AMZN';
  const symbols = symbolsEnv.split(',').map(s => s.trim()).slice(0, 10);
  const quotes = await getQuotes(symbols);
  res.json({ quotes });
});

// 개별/다중 시세
router.get('/quote', authMiddleware, async (req, res) => {
  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'NO_SYMBOLS' });
  const list = symbols.split(',').map(s => s.trim());
  const quotes = await getQuotes(list);
  res.json({ quotes });
});

// 보유 종목
router.get('/positions', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { rows } = await pool.query(`
    SELECT h.quantity, s.symbol, s.name
    FROM holdings h
    JOIN stocks s ON s.id = h.stock_id
    WHERE h.user_id=$1 AND h.quantity > 0
    ORDER BY s.symbol ASC
  `, [userId]);
  res.json({ positions: rows.map(r => ({ symbol: r.symbol, name: r.name, quantity: Number(r.quantity) })) });
});

// 체결 로그
router.get('/logs', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { rows } = await pool.query(`
    SELECT t.side, t.price, t.quantity, t.created_at, s.symbol, s.name
    FROM transactions t
    JOIN stocks s ON s.id = t.stock_id
    WHERE t.user_id=$1
    ORDER BY t.created_at DESC
    LIMIT 200
  `, [userId]);
  res.json({ logs: rows.map(r => ({
    side: r.side, price: Number(r.price), quantity: Number(r.quantity),
    symbol: r.symbol, name: r.name, created_at: r.created_at
  })) });
});

// 뉴스 (간단 RSS, 국내/해외 혼합)
router.get('/news', authMiddleware, async (req, res) => {
  const feeds = [
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,TSLA,MSFT,GOOGL,AMZN&region=US&lang=en-US',
    'https://www.hankyung.com/feed/all-news'
  ];
  try {
    const results = [];
    for (const url of feeds) {
      try {
        const feed = await parser.parseURL(url);
        for (const item of (feed.items || []).slice(0, 10)) {
          results.push({
            title: item.title,
            link: item.link,
            pubDate: item.pubDate || item.isoDate,
            source: feed.title
          });
        }
      } catch (e) { /* ignore per-feed errors */ }
    }
    // 최신순 정렬
    results.sort((a,b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));
    res.json({ news: results.slice(0, 20) });
  } catch (e) {
    res.json({ news: [] });
  }
});

// 주문 (매수/매도/풀매수/풀매도)
router.post('/order', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { symbol, name, side, quantity, mode } = req.body;
  const qty = Number(quantity || 0);
  if (!symbol || !side) return res.status(400).json({ error: 'INVALID_ORDER' });

  const quotes = await getQuotes([symbol]);
  const q = quotes[symbol];
  if (!q || !q.price) return res.status(400).json({ error: 'NO_PRICE' });
  const price = Number(q.price);

  try {
    await pool.query('BEGIN');

    // 종목 보장
    let { rows } = await pool.query('SELECT id FROM stocks WHERE symbol=$1', [symbol]);
    let stockId;
    if (rows.length === 0) {
      ({ rows } = await pool.query('INSERT INTO stocks(symbol, name) VALUES ($1,$2) RETURNING id', [symbol, name || symbol]));
      stockId = rows[0].id;
    } else {
      stockId = rows[0].id;
    }

    // 사용자/보유/잔고
    const { rows: userRows } = await pool.query('SELECT id, balance FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const user = userRows[0];
    const { rows: holdRows } = await pool.query('SELECT id, quantity FROM holdings WHERE user_id=$1 AND stock_id=$2 FOR UPDATE', [userId, stockId]);
    let holding = holdRows[0];

    if (!holding) {
      const insert = await pool.query('INSERT INTO holdings(user_id, stock_id, quantity) VALUES ($1,$2,0) RETURNING id, quantity',[userId, stockId]);
      holding = insert.rows[0];
    }

    let tradeQty = qty;
    if (mode === 'FULL_BUY') {
      tradeQty = Math.floor(Number(user.balance) / price);
      if (tradeQty <= 0) throw new Error('INSUFFICIENT_BALANCE');
    } else if (mode === 'FULL_SELL') {
      tradeQty = Number(holding.quantity);
      if (tradeQty <= 0) throw new Error('NO_POSITION');
    } else if (!tradeQty || tradeQty <= 0) {
      throw new Error('INVALID_QUANTITY');
    }

    if (side === 'BUY') {
      const cost = Math.ceil(price * tradeQty);
      if (Number(user.balance) < cost) throw new Error('INSUFFICIENT_BALANCE');
      await pool.query('UPDATE users SET balance = balance - $1 WHERE id=$2', [cost, userId]);
      await pool.query('UPDATE holdings SET quantity = quantity + $1 WHERE id=$2', [tradeQty, holding.id]);
      await pool.query('INSERT INTO transactions(user_id, stock_id, side, price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [userId, stockId, 'BUY', price, tradeQty]);
    } else if (side === 'SELL') {
      if (Number(holding.quantity) < tradeQty) throw new Error('INSUFFICIENT_QUANTITY');
      const proceeds = Math.floor(price * tradeQty);
      await pool.query('UPDATE users SET balance = balance + $1 WHERE id=$2', [proceeds, userId]);
      await pool.query('UPDATE holdings SET quantity = quantity - $1 WHERE id=$2', [tradeQty, holding.id]);
      await pool.query('INSERT INTO transactions(user_id, stock_id, side, price, quantity) VALUES ($1,$2,$3,$4,$5)',
        [userId, stockId, 'SELL', price, tradeQty]);
    } else {
      throw new Error('INVALID_SIDE');
    }

    await pool.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await pool.query('ROLLBACK');
    const msg = e.message || 'ORDER_ERROR';
    res.status(400).json({ error: msg });
  }
});

module.exports = router;
