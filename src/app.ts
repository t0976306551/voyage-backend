import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`voyage-backend running on port ${PORT}`);
  });
}

export default app;
