-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, code)
);

-- Quotes cache (latest)
CREATE TABLE IF NOT EXISTS quotes (
  code VARCHAR(6) PRIMARY KEY,
  name TEXT,
  price NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- News cache
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  code VARCHAR(6),
  title TEXT,
  url TEXT,
  source TEXT,
  time_text TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(code, url)
);
