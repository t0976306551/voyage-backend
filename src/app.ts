import 'reflect-metadata';
import './shared/types/auth.types';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import * as path from 'path';
import { createServer } from 'http';
import tripRouter from './modules/trips/trip.router';
import authRouter from './modules/auth/auth.router';
import { userRouter } from './modules/users/user.controller';
import { authMiddleware } from './shared/middleware/auth.middleware';
import { initSocketIO } from './socket/socket.service';
import { AppDataSource } from './data-source';

dotenv.config();

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Static uploads — referenced from trip.coverImage etc.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '7d',
  fallthrough: true,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/trips', tripRouter);
app.use('/api/users', authMiddleware, userRouter);

export const httpServer = createServer(app);

const PORT = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== 'test') {
  AppDataSource.initialize()
    .then(() => {
      initSocketIO(httpServer);
      httpServer.listen(PORT, () => {
        console.log(`voyage-backend running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('DataSource initialization failed:', err);
      process.exit(1);
    });
}

export default app;
