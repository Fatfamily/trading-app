import express from "express";
import yahooFinance from "yahoo-finance2";

const app = express();

// 데이터 가져오는 엔드포인트
app.get("/", async (req, res) => {
  try {
    const result = await yahooFinance.quote("AAPL");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
