import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors());
app.use(helmet());
app.use(express.json());

// 테스트 라우트
app.get("/", (req, res) => {
  res.json({ message: "Server is running 🚀" });
});

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
