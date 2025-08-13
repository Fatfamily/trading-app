const yahooFinance = require('yahoo-finance2').default;

/**
 * Get quote for symbols (array).
 * Fallback: if Yahoo fails, generate pseudo-prices.
 */
async function getQuotes(symbols) {
  const out = {};
  try {
    const quotes = await yahooFinance.quote(symbols);
    const list = Array.isArray(quotes) ? quotes : [quotes];
    for (const q of list) {
      if (!q || !q.symbol) continue;
      out[q.symbol] = {
        symbol: q.symbol,
        name: q.shortName || q.longName || q.displayName || q.symbol,
        price: Number(q.regularMarketPrice || q.postMarketPrice || q.preMarketPrice) || null,
        currency: q.currency || 'USD'
      };
    }
  } catch (e) {
    // fallback
    symbols.forEach(s => {
      out[s] = {
        symbol: s,
        name: s,
        price: Number((100 + Math.random() * 1000).toFixed(2)),
        currency: 'KRW'
      };
    });
  }
  return out;
}

module.exports = { getQuotes };
