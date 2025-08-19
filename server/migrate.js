import { query } from './db.js';

const sql = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  balance BIGINT NOT NULL DEFAULT 10000000  -- 기본 1천만원
);

CREATE TABLE IF NOT EXISTS watchlist (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  PRIMARY KEY (user_id, code)
);

CREATE TABLE IF NOT EXISTS holdings (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  qty BIGINT NOT NULL DEFAULT 0,
  avg_price BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, code)
);

CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  side VARCHAR(10) NOT NULL, -- BUY/SELL
  qty BIGINT NOT NULL,
  price BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

(async () => {
  try {
    await query(sql);
    console.log("✅ Migration complete");
    process.exit(0);
  } catch (e) {
    console.error("Migration failed:", e);
    process.exit(1);
  }
})();
