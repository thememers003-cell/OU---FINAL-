// ============================================================
// XPOS API Server — Main entry point
// ============================================================

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { prisma } from '@xpos/database';
import { createStorageService } from '@xpos/storage';
import { createPaymentProvider } from '@xpos/payment';
import { createPrinterService } from '@xpos/printer';

import { sessionRoutes } from './routes/sessions';
import { kioskRoutes } from './routes/kiosks';
import { fileRoutes } from './routes/files';
import { pricingRoutes } from './routes/pricing';
import { jobRoutes } from './routes/jobs';
import { paymentRoutes } from './routes/payments';
import { printCodeRoutes } from './routes/print-codes';
import { adminRoutes } from './routes/admin';
import { setupWebSocket } from './websocket';
import { startWorkers } from './workers';

const app = express();
const httpServer = createServer(app);

// ── CORS ──
app.use(cors({
  origin: (origin, callback) => {
    // Allow all origins on local network/Wi-Fi
    callback(null, true);
  },
  credentials: true,
}));

// ── Security ──
app.use(helmet({ crossOriginResourcePolicy: false }));

// ── Rate Limiting ──
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── Body parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Initialize Services ──
const storage = createStorageService();
const payment = createPaymentProvider();
const printer = createPrinterService();

// Store services in app locals for route handlers
app.locals.prisma = prisma;
app.locals.storage = storage;
app.locals.payment = payment;
app.locals.printer = printer;

// Run SQLite WAL cleanup
prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE);').catch(() => {});

// ── Socket.IO ──
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
});
app.locals.io = io;

// ── Routes ──
app.use('/api/sessions', sessionRoutes);
app.use('/api/kiosks', kioskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/print-codes', printCodeRoutes);
app.use('/api/admin', adminRoutes);

// ── Health check ──
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'xpos-api', timestamp: new Date().toISOString() });
});

// ── Error handler ──
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ──
const PORT = parseInt(process.env.API_PORT || '4000');

async function start() {
  try {
    // Initialize storage bucket
    await storage.initialize();
    console.log('📦 Storage initialized');

    // Setup WebSocket handlers
    setupWebSocket(io, prisma);
    console.log('🔌 WebSocket ready');

    // Start background workers
    startWorkers(prisma, storage);
    console.log('⚙️ Workers started');

    // Start HTTP server on all interfaces (0.0.0.0)
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 XPOS API running on http://0.0.0.0:${PORT}`);
      console.log(`📡 WebSocket ready for all Wi-Fi clients`);
      console.log(`\n🖨️  XPOS — Print On Screen\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start XPOS API:', error);
    process.exit(1);
  }
}

start();

export { app, io };
