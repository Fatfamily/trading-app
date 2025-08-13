import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

const DEFAULT_SYMBOLS = (process.env.SYMBOLS || 'AAPL,MSFT,NVDA,AMZN,GOOGL,META,TSLA,JPM,V,UNH')
  .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

const USE_MOCK = process.env.USE_MOCK === 'true';

// --- helpers ---
function round(n, d=2){ return Math.round(n * 10**d) / 10**d; }
function toQuote(sym, q){
  if (!q) return null;
  const price = q.regularMarketPrice ?? q.postMarketPrice ?? q.preMarketPrice ?? q.ask ?? q.bid;
  const change = q.regularMarketChange ?? (q.regularMarketChangePercent ? price * (q.regularMarketChangePercent/100) : 0) ?? 0;
  const changePercent = q.regularMarketChangePercent ?? (price ? (change / (price - change)) * 100 : 0);
  return { symbol: sym, price: round(price||0), change: round(change||0), changePercent: round(changePercent||0) };
}

const mockState = new Map();
function mockQuote(sym){
  const last = mockState.get(sym) ?? (100 + Math.random()*900);
  const delta = (Math.random()-0.5)*5;
  const price = Math.max(1, last + delta);
  mockState.set(sym, price);
  return { symbol: sym, price: round(price), change: round(delta), changePercent: round((price ? (delta/(price-delta))*100 : 0)) };
}

// --- routes ---
app.get('/api/top10', async (req, res) => {
  try {
    if (USE_MOCK) {
      const data = DEFAULT_SYMBOLS.map(s => mockQuote(s));
      return res.json(data);
    }
    const quotes = await Promise.all(DEFAULT_SYMBOLS.map(async s => {
      try {
        const q = await yahooFinance.quote(s);
        return toQuote(s, q);
      } catch (e) {
        return mockQuote(s);
      }
    }));
    res.json(quotes.filter(Boolean));
  } catch (e) {
    res.json(DEFAULT_SYMBOLS.map(s => mockQuote(s)));
  }
});

app.get('/api/quote', async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({error:'symbol required'});
  try {
    if (USE_MOCK) return res.json(mockQuote(symbol));
    const q = await yahooFinance.quote(symbol);
    const t = toQuote(symbol, q) || mockQuote(symbol);
    res.json(t);
  } catch (e) {
    res.json(mockQuote(symbol));
  }
});

// Optional: simple news endpoint using yahoo-finance2 search (limited info)
app.get('/api/news', async (req, res) => {
  const q = (req.query.q || 'stock').toString();
  try {
    const sr = await yahooFinance.search(q);
    const news = (sr.news || []).slice(0, 10).map(n => ({
      title: n.title,
      link: n.link,
      publisher: n.publisher,
      pubDate: n.providerPublishTime ? new Date(n.providerPublishTime*1000).toISOString() : null
    }));
    res.json(news);
  } catch (e) {
    res.json([]);
  }
});

// static
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req,res)=>{
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
