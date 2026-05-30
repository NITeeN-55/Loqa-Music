import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import { initDatabase } from './db.js';
import authMW              from './middleware/auth.js';
import authRoutes          from './routes/auth.js';
import libraryRoutes       from './routes/library.js';
import youtubeRoutes       from './routes/youtube.js';
import recommendRoutes     from './routes/recommendations.js';
import prefsRoutes         from './routes/preferences.js';

const PORT   = process.env.PORT || 3000;
const IS_DEV = process.env.NODE_ENV !== 'production';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));

/* ── Security ─────────────────────────────────────────── */
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));

/* ── CORS ─────────────────────────────────────────────── */
const origins = IS_DEV
  ? true
  : (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins, credentials: true }));

/* ── Rate limiting ────────────────────────────────────── */
app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 150,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
}));
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60_000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many auth attempts — try again in 15 minutes.' },
}));

/* ── Auth middleware ──────────────────────────────────── */
app.use(authMW);

/* ── Request logger (dev) ─────────────────────────────── */
if (IS_DEV) {
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/'))
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

/* ── Routes ───────────────────────────────────────────── */
app.use('/api/auth',            authRoutes);
app.use('/api/library',         libraryRoutes);
app.use('/api/youtube',         youtubeRoutes);
app.use('/api/recommendations', recommendRoutes);
app.use('/api/preferences',     prefsRoutes);

/* ── Health ───────────────────────────────────────────── */
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', version: '4.0.0', uptime: process.uptime(), ts: new Date().toISOString() })
);

/* ── 404 ──────────────────────────────────────────────── */
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/', (_req, res) => res.json({ name: 'Loqa Music API', version: '4.0.0', health: '/api/health' }));

/* ── Error handler ────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('Unhandled:', err);
  res.status(500).json({ error: IS_DEV ? err.message : 'Internal server error' });
});

/* ── Start ────────────────────────────────────────────── */
initDatabase().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║  🎵  Loqa Music API  v4.0.0             ║`);
    console.log(`║  🟢  http://0.0.0.0:${PORT}                ║`);
    console.log(`║  🍃  MongoDB  •  ${IS_DEV ? 'Development' : 'Production'}          ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
  });

  /* Graceful shutdown — Render sends SIGTERM before stopping */
  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      try {
        const mongoose = (await import('mongoose')).default;
        await mongoose.disconnect();
        console.log('MongoDB disconnected. Bye 👋');
      } catch {}
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
});
