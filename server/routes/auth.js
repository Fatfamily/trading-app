import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email/password required' });
    const hash = await bcrypt.hash(password, 10);
    const result = await query('INSERT INTO users(email, password_hash) VALUES ($1,$2) RETURNING id,email', [email, hash]);
    const user = result.rows[0];
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email } });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'email exists' });
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await query('SELECT * FROM users WHERE email=$1', [email]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'invalid credentials' });
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, balance: user.balance } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export function authMiddleware(req, res, next) {
  const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'no token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

export default router;
