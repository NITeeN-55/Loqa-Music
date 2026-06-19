import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { body, validationResult } from 'express-validator';
import { User, UserPrefs } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Token strategy (audit fix — P10 security):
 *  - Access token:  15min, sent as HttpOnly cookie (XSS-safe)
 *  - Refresh token: 30d,   sent as separate HttpOnly cookie
 *  - Both cookies: SameSite=Strict, Secure in prod
 *
 * Backward compat: also returns token in JSON body so existing
 * localStorage-based clients keep working during transition.
 * Once all clients are updated, remove the body token.
 */
const COOKIE_OPTS = {
  httpOnly: true,
  secure:   IS_PROD,
  sameSite: 'strict',
  path:     '/',
};

function signAccess(userId, name, email) {
  return jwt.sign({ userId, name, email }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function signRefresh(userId) {
  return jwt.sign({ userId, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function setTokenCookies(res, userId, name, email) {
  const access  = signAccess(userId, name, email);
  const refresh = signRefresh(userId);
  res.cookie('lm_access',  access,  { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
  res.cookie('lm_refresh', refresh, { ...COOKIE_OPTS, maxAge: 30 * 24 * 60 * 60 * 1000 });
  // Legacy: also return token in body for existing localStorage clients
  return access;
}

function clearTokenCookies(res) {
  res.clearCookie('lm_access',  COOKIE_OPTS);
  res.clearCookie('lm_refresh', COOKIE_OPTS);
}

/* ── Register ─────────────────────────────────────────── */
router.post('/register',
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });

    const { name, email, password } = req.body;
    try {
      const exists = await User.findOne({ email });
      if (exists) return res.status(409).json({ error: 'Email already registered' });

      const id   = uuid();
      const hash = await bcrypt.hash(password, 12);
      const ci   = Math.floor(Math.random() * 8);

      await User.create({ _id: id, name, email, password_hash: hash, avatar_ci: ci });
      await UserPrefs.create({ _id: id, eq_bands: [0,0,0,0,0,0,0,0,0,0], app_settings: {}, volume: 80 });

      const user  = { id, name, email, avatarCi: ci };
      const token = setTokenCookies(res, id, name, email);
      res.status(201).json({ user, token });
    } catch (err) {
      console.error('register:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* ── Login ────────────────────────────────────────────── */
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: 'Invalid email or password' });

    const { email, password } = req.body;
    try {
      const user = await User.findOne({ email }).select('+password_hash');
      if (!user) return res.status(401).json({ error: 'Invalid email or password' });

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

      const u     = { id: user._id, name: user.name, email: user.email, avatarCi: user.avatar_ci };
      const token = setTokenCookies(res, user._id, user.name, user.email);
      res.json({ user: u, token });
    } catch (err) {
      console.error('login:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* ── Refresh token ─────────────────────────────────────── */
router.post('/refresh', async (req, res) => {
  // Accept refresh token from cookie OR body (for backward compat)
  const refreshToken = req.cookies?.lm_refresh || req.body?.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (decoded.type !== 'refresh') throw new Error('not a refresh token');

    const user = await User.findById(decoded.userId).select('name email');
    if (!user) return res.status(401).json({ error: 'User not found' });

    const token = setTokenCookies(res, user._id, user.name, user.email);
    res.json({ ok: true, token });
  } catch {
    clearTokenCookies(res);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/* ── Logout ────────────────────────────────────────────── */
router.post('/logout', (req, res) => {
  clearTokenCookies(res);
  res.json({ ok: true });
});

/* ── Me ───────────────────────────────────────────────── */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password_hash').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user._id, name: user.name, email: user.email, avatarCi: user.avatar_ci, createdAt: user.created_at });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ── Update profile ───────────────────────────────────── */
router.put('/me', requireAuth,
  body('name').trim().isLength({ min: 1, max: 100 }),
  async (req, res) => {
    const errs = validationResult(req);
    if (!errs.isEmpty()) return res.status(400).json({ error: errs.array()[0].msg });
    try {
      await User.findByIdAndUpdate(req.userId, { name: req.body.name.trim() });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* ── Change password ──────────────────────────────────── */
router.put('/password', requireAuth,
  body('current').notEmpty(),
  body('next').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const user = await User.findById(req.userId).select('+password_hash');
      if (!user) return res.status(404).json({ error: 'User not found' });
      const ok = await bcrypt.compare(req.body.current, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
      user.password_hash = await bcrypt.hash(req.body.next, 12);
      await user.save();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
