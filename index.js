import yahooFinance from 'yahoo-finance2';

(async () => {
  const quote = await yahooFinance.quote('AAPL');
  console.log(quote);
})();
