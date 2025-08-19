
import { query } from './db.js';

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS portfolios (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cash BIGINT NOT NULL DEFAULT 10000000
);
CREATE TABLE IF NOT EXISTS holdings (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  qty BIGINT NOT NULL,
  avg_price BIGINT NOT NULL,
  PRIMARY KEY(user_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings(user_id);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (user_id, symbol)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  side TEXT NOT NULL,
  qty BIGINT NOT NULL,
  price BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
`;

try {
  await query(sql);
  console.log('MIGRATION_OK');
  process.exit(0);
} catch (e) {
  console.error('MIGRATION_FAIL', e);
  process.exit(1);
}
