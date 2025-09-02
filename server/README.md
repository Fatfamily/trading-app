# Kiwoom Trader Server

Express server with JWT auth, simple file storage, and demo trading endpoints.
- `POST /api/auth/register` { username, password }
- `POST /api/auth/login` { username, password }
- `GET /api/auth/me` (Bearer token)
- `GET /api/quotes` (Bearer token)
- `GET /api/orders` (Bearer token)
- `POST /api/orders` (Bearer token) { symbol, side, price, qty }

## Development
1) `npm install`
2) `cp .env.example .env` and set `JWT_SECRET`
3) `npm run dev`

## Build client into server
- From the root: `cd server && npm run build-client` (this installs and builds the React client and copies `dist` into `server/public`).
