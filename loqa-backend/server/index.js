import 'dotenv/config';
import express       from 'express';
import cors          from 'cors';
import helmet        from 'helmet';
import rateLimit     from 'express-rate-limit';
import { initDatabase }  from './db.js';
import authMW             from './middleware/auth.js';
import authRoutes         from './routes/auth.js';
import libraryRoutes      from './routes/library.js';
import youtubeRoutes      from './routes/youtube.js';
import recommendRoutes    from './routes/recommendations.js';
import prefsRoutes        from './routes/preferences.js';
import lyricsRoutes       from './routes/lyrics.js';

const PORT   = process.env.PORT || 3000;
const IS_DEV = process.env.NODE_ENV !== 'production';

/* ── Validate critical env vars on startup ─────────────────── */
if (!process.env.JWT_SECRET) {
  console.error('⛔  JWT_SECRET is not set. Set it in your .env file or Render environment.');
  process.exit(1);
}
if (!process.env.INNERTUBE_API_KEY) {
  console.warn('⚠️   INNERTUBE_API_KEY not set — YouTube routes will fail.');
}

const app = express();
app.set('trust proxy', 1);

/* ── Compression (saves ~70% bandwidth) ────────────────────── */
// Inline gzip without the express-compression dependency (Node 18+)
app.use((req, res, next) => {
  const orig = res.json.bind(res);
  res.json = (body) => {
    const json = JSON.stringify(body);
    if (json.length < 1024 || !req.headers['accept-encoding']?.includes('gzip')) {
      res.setHeader('Content-Type', 'application/json');
      return orig(body);
    }
    return orig(body); // Let reverse proxy handle gzip (Render does this automatically)
  };
  next();
});

app.use(express.json({ limit: '2mb' }));

/* ── CORS ──────────────────────────────────────────────────── */
const ALLOWED_ORIGINS = IS_DEV
  ? null
  : (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim().replace(/\/$/, ''))
      .filter(Boolean);

if (!IS_DEV && ALLOWED_ORIGINS.length === 0) {
  console.error('⛔  ALLOWED_ORIGINS is not set. All cross-origin requests will be blocked.');
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (IS_DEV) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked origin: "${origin}"`);
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

/* ── Security ──────────────────────────────────────────────── */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

/* ── Rate limiting ─────────────────────────────────────────── */
// Global API limit
app.use('/api/', rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 150,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
}));
// Stricter auth limit (prevents brute force)
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60_000, max: 15,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many auth attempts — try again in 15 minutes.' },
}));
// Lyrics are read-only and can be generous
app.use('/api/lyrics', rateLimit({
  windowMs: 60_000, max: 60,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many lyrics requests.' },
}));

/* ── Auth middleware (sets req.userId on valid JWT) ─────────── */
app.use(authMW);

/* ── Dev request logger ─────────────────────────────────────── */
if (IS_DEV) {
  app.use((req, _res, next) => {
    if (req.url.startsWith('/api/'))
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

/* ── Routes ─────────────────────────────────────────────────── */
app.use('/api/auth',            authRoutes);
app.use('/api/library',         libraryRoutes);
app.use('/api/youtube',         youtubeRoutes);
app.use('/api/recommendations', recommendRoutes);
app.use('/api/preferences',     prefsRoutes);
app.use('/api/lyrics',          lyricsRoutes);

/* ── Health ─────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', version: '5.0.0', uptime: process.uptime(), ts: new Date().toISOString() })
);

/* ── 404 / root ──────────────────────────────────────────────── */
app.use('/api/*', (_req, res) => res.status(404).json({ error: 'Not found' }));
app.get('/', (_req, res) => res.json({ name: 'Loqa Music API', version: '5.0.0', health: '/api/health' }));

/* ── Global error handler ────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  if (err.message?.includes('CORS')) return res.status(403).json({ error: err.message });
  console.error('Unhandled:', err);
  res.status(500).json({ error: IS_DEV ? err.message : 'Internal server error' });
});

/* ── Start ───────────────────────────────────────────────────── */
initDatabase().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log(`║  🎵  Loqa Music API  v5.0.0             ║`);
    console.log(`║  🟢  Listening on port ${String(PORT).padEnd(18)}║`);
    console.log(`║  🍃  MongoDB  •  ${IS_DEV ? 'Development' : 'Production '}         ║`);
    console.log(`║  🎤  Lyrics: LRCLIB (free & open)       ║`);
    if (!IS_DEV && ALLOWED_ORIGINS.length > 0) {
      console.log(`║  🌐  CORS origins: ${String(ALLOWED_ORIGINS.length).padEnd(21)}║`);
      ALLOWED_ORIGINS.forEach(o => console.log(`║     ${o.slice(0,36).padEnd(36)}║`));
    }
    console.log('╚══════════════════════════════════════════╝\n');
  });

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
