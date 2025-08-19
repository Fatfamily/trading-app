import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import stockRoutes from './routes/stocks.js';
import tradeRoutes from './routes/trade.js';
import accountRoutes from './routes/account.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// Static client
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/account', accountRoutes);

app.get('/api/health', (_, res) => res.json({ ok: true }));

// SPA fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 10000;
app.listen(port, () => console.log('✅ Server running on ' + port));
