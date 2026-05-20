import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import v1Router from './routes/v1.js';

dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: '@seo/api' });
});

app.use('/v1', v1Router);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal_server_error', code: 'INTERNAL_SERVER_ERROR' });
});

export default app;
