# KR Trading (Auth-enabled)

This version adds user authentication (Postgres), favorites, a 1-second quote updater, and news caching.

## Env variables (.env)
- DATABASE_URL=postgres://user:pass@host:port/dbname
- PORT=10000
- JWT_SECRET=change_this_to_a_strong_secret

## Run locally
```bash
cd server
npm install
# Ensure DATABASE_URL is set and DB is reachable, then:
node index.js
# Open http://localhost:10000
```

## Deploy to Render
- Use Docker deployment (Dockerfile in repo root).
- Set environment variables on Render service (DATABASE_URL, JWT_SECRET).
- Port: 10000 (exposed in Dockerfile)
- Important: background updater fetches quotes/news periodically; be mindful of rate limits and scraping policies.

## Database
A simple migration script is included in `server/schema.sql`.
