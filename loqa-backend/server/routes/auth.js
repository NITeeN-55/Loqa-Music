import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { body, validationResult } from 'express-validator';
import { User, UserPrefs } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const sign = (userId, name, email) =>
  jwt.sign({ userId, name, email }, process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

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

      // Create default preferences
      await UserPrefs.create({
        _id:          id,
        eq_bands:     [0,0,0,0,0,0,0,0,0,0],
        app_settings: {},
        volume:       80,
      });

      const user  = { id, name, email, avatarCi: ci };
      const token = sign(id, name, email);
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
      const token = sign(user._id, user.name, user.email);
      res.json({ user: u, token });
    } catch (err) {
      console.error('login:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

/* ── Me ───────────────────────────────────────────────── */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password_hash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id:        user._id,
      name:      user.name,
      email:     user.email,
      avatarCi:  user.avatar_ci,
      createdAt: user.created_at,
    });
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
