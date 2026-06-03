import { Router } from 'express';
import { UserPrefs } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    let prefs = await UserPrefs.findById(req.userId);
    if (!prefs) {
      prefs = await UserPrefs.create({
        _id:          req.userId,
        eq_preset:    'flat',
        eq_bands:     [0,0,0,0,0,0,0,0,0,0],
        app_settings: {},
        volume:       80,
      });
    }
    res.json({
      eqPreset:    prefs.eq_preset || 'flat',
      eqBands:     prefs.eq_bands  || [0,0,0,0,0,0,0,0,0,0],
      appSettings: prefs.app_settings || {},
      volume:      prefs.volume ?? 80,
    });
  } catch (err) {
    console.error('prefs GET:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', async (req, res) => {
  const { eqPreset, eqBands, appSettings, volume } = req.body;
  try {
    await UserPrefs.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          eq_preset:    eqPreset    || 'flat',
          eq_bands:     eqBands     || [0,0,0,0,0,0,0,0,0,0],
          app_settings: appSettings || {},
          volume:       volume ?? 80,
          updated_at:   new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('prefs PUT:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
