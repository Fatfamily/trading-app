const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Basic middlewares
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

const clientURL = process.env.CLIENT_URL || '*';
app.use(cors({
  origin: clientURL === '*' ? true : [clientURL],
  credentials: true,
}));

// Rate limiter for auth endpoints
const limiter = rateLimit({ windowMs: 60 * 1000, limit: 100 });
app.use('/api/', limiter);

// Simple file store (for demo; replace with DB in production)
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Auth helpers
function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  let token = null;
  if (header && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token && req.cookies && req.cookies.token) token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Seed default user if none
function ensureDefaultUser() {
  const users = readJSON(USERS_FILE);
  if (users.length === 0) {
    const passwordHash = bcrypt.hashSync('demo1234', 10);
    users.push({ id: uuidv4(), username: 'demo', passwordHash });
    writeJSON(USERS_FILE, users);
    console.log('Seeded default user: demo / demo1234');
  }
}
ensureDefaultUser();

// -------- Auth routes --------
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });
  const users = readJSON(USERS_FILE);
  if (users.find(u => u.username === username)) return res.status(409).json({ message: 'User exists' });
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = { id: uuidv4(), username, passwordHash };
  users.push(user);
  writeJSON(USERS_FILE, users);
  const token = signToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  return res.json({ token, user: { id: user.id, username: user.username } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'username and password required' });
  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = signToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax' });
  return res.json({ token, user: { id: user.id, username: user.username } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// -------- Trading demo endpoints --------
// Quotes (fake data with random walk)
let SYMBOLS = ['005930', '000660', '035420', '068270', '051910']; // Samsung, SK Hynix, NAVER, Celltrion, LG Chem
let lastPrices = Object.fromEntries(SYMBOLS.map(s => [s, 100000 + Math.floor(Math.random()*20000)]));

app.get('/api/quotes', authMiddleware, (req, res) => {
  // Simulate a small random change each call
  const quotes = SYMBOLS.map(s => {
    const delta = Math.floor((Math.random() - 0.5) * 2000);
    lastPrices[s] = Math.max(1000, lastPrices[s] + delta);
    const price = lastPrices[s];
    return { symbol: s, price, change: delta, time: Date.now() };
  });
  res.json({ quotes });
});

app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = readJSON(ORDERS_FILE).filter(o => o.userId === req.user.id);
  res.json({ orders });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { symbol, side, price, qty } = req.body || {};
  if (!symbol || !side || !price || !qty) return res.status(400).json({ message: 'symbol, side, price, qty required' });
  if (!SYMBOLS.includes(symbol)) return res.status(400).json({ message: 'Unknown symbol' });
  const order = {
    id: uuidv4(),
    userId: req.user.id,
    symbol, side, price: Number(price), qty: Number(qty),
    status: 'filled',
    createdAt: Date.now()
  };
  const orders = readJSON(ORDERS_FILE);
  orders.push(order);
  writeJSON(ORDERS_FILE, orders);
  res.json({ order });
});

// Serve static client (after build)
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
} else {
  app.get('/', (_, res) => res.send('Server is running. Build the client to enable UI.'));
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
