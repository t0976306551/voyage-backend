import 'reflect-metadata';
import './shared/types/auth.types';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { authMiddleware } from './shared/middleware/auth.middleware';
import { ok } from './shared/types/response.types';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// stub for auth tests — will be replaced by real router in Task 5
app.get('/api/trips', authMiddleware, (_req, res) => { res.json(ok([])); });

const PORT = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`voyage-backend running on port ${PORT}`);
  });
}

export default app;
