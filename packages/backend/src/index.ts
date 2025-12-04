import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { SERVER_CONFIG } from './config';
import { initializeDatabase, closeDatabase } from './db/database';
import { sessionMiddleware } from './middleware/session';
import { startHoldCleanupJob, stopHoldCleanupJob } from './services/holdCleanupJob';

// Routes
import concertsRouter from './routes/concerts';
import holdsRouter from './routes/holds';
import bookingsRouter from './routes/bookings';
import sessionRouter from './routes/session';

const app = express();

// Middleware
app.use(cors({
  origin: SERVER_CONFIG.corsOrigin,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

// API Routes
app.use('/api/concerts', concertsRouter);
app.use('/api/holds', holdsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/session', sessionRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// Initialize and start server
function start(): void {
  // Initialize database
  initializeDatabase();

  // Start background jobs
  startHoldCleanupJob();

  // Start server
  const server = app.listen(SERVER_CONFIG.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Ticket Booking System - Backend                  ║
╠═══════════════════════════════════════════════════════════╣
║  Server: http://localhost:${SERVER_CONFIG.port}                           ║
║  Holds created at checkout, 10min timeout                  ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down gracefully...');
    stopHoldCleanupJob();
    closeDatabase();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();

export { app };
