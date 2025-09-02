# Full-Stack Kiwoom-Style Trading App

- First screen shows a login page (id/pw) like your screenshot.
- After login, a Kiwoom-like dashboard appears with watchlist, chart, and order panel.
- Backend is Express (JWT auth). Frontend is React + Vite + Tailwind.
- Single Docker image or Render deploy (server statically serves built client).

## Quick Start (Local)
```bash
# Server
cd server
npm install
cp .env.example .env  # set JWT_SECRET
npm run dev
# Client (in a new terminal)
cd ../client
npm install
npm run dev
```
- Open http://localhost:5173 and login with **demo / demo1234**.

## Build + Serve from the server
```bash
cd server
npm install
cp .env.example .env
npm run build-client
npm start
# Open http://localhost:10000
```

## Docker
```bash
docker build -t kiwoom-trader .
docker run -p 10000:10000 -e JWT_SECRET='your_secret' kiwoom-trader
```

## Render (single app)
- Root directory: `server`
- Build Command: `npm run render-build`
- Start Command: `npm start`
- Environment:
  - `JWT_SECRET` = long random string
  - `PORT` = 10000 (optional)
- The server will serve the UI at `/`.
