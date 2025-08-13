const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { signToken, hashPassword, verifyPassword } = require('../utils/auth');

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
  try {
    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, balance',
      [username, hash]
    );
    const user = rows[0];
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 30*24*60*60*1000 });
    res.json({ user: { id: user.id, username: user.username, balance: Number(user.balance) } });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'USERNAME_TAKEN' });
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'MISSING_FIELDS' });
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    const token = signToken(user);
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 30*24*60*60*1000 });
    res.json({ user: { id: user.id, username: user.username, balance: Number(user.balance) } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  // Delete account & related data
  const token = req.cookies && req.cookies.token;
  if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const userId = decoded.id;
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    res.clearCookie('token');
    res.json({ ok: true });
  } catch (e) {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
});

module.exports = router;
