# Stock Virtual Exchange (Render-Ready, Docker)

## Features
- Top 10 symbols, search, watchlist
- F5: Chart, F6: Watchlist, F7: Holdings, F8: News
- Yahoo Finance API via `yahoo-finance2` (no API key required)
- Works on Render (Docker)

## Run locally
```
npm install
npm start
# open http://localhost:8080
```

## Deploy on Render
- New Web Service → Environment: Docker
- Root Directory: (blank)
- Dockerfile Path: `Dockerfile`
- (Optional) Set `USE_MOCK=true` to use mock prices
