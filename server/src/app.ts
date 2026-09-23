import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import hpp from 'hpp';
import { rateLimit } from 'express-rate-limit';

import authRoutes from './routes/auth.routes';
import sevakRoutes from './routes/sevak.routes';
import bookRoutes from './routes/book.routes';
import receiptRoutes from './routes/receipt.routes';
import prasadRoutes from './routes/prasad.routes';
import reportsRoutes from './routes/reports.routes';
import dashboardRoutes from './routes/dashboard.routes';
import morganMiddleware from './utils/morgan';
import logger from './utils/logger';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL,
  process.env.LIVE_CLIENT_URL,
].filter(Boolean) as string[];

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.some((allowed) => origin === allowed) ||
        origin.endsWith('.vercel.app');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.use(hpp());
app.use(morganMiddleware);
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1', apiLimiter);

app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/sevaks', sevakRoutes);
app.use('/api/v1/books', bookRoutes);
app.use('/api/v1/receipts', receiptRoutes);
app.use('/api/v1/prasad', prasadRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

app.use((_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
