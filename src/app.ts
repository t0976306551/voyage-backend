import 'reflect-metadata';
import './shared/types/auth.types';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import tripRouter from './modules/trips/trip.router';
import itineraryRouter from './modules/itinerary/itinerary.router';

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

app.use('/api/trips', tripRouter);
app.use('/api/trips/:tripId/itinerary', itineraryRouter);

const PORT = process.env.PORT ?? 4000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`voyage-backend running on port ${PORT}`);
  });
}

export default app;
