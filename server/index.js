require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const { migrate } = require('./db');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/stocks', require('./routes/stocks'));

// 정적 파일 (client 빌드/소스)
app.use(express.static(path.join(__dirname, '..', 'client')));

// client 라우팅
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

const PORT = process.env.PORT || 10000;

(async () => {
  await migrate();
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
})();
