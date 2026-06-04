import React, { useState, useRef, useEffect } from 'react';
import { gradStr, fmtTime } from '../utils/constants.js';
import { Svg, I, EqBars } from './Icons.jsx';
import { Thumb } from './UI.jsx';
import useFocusTrap from '../hooks/useFocusTrap.js';
import useAuthStore from '../stores/authStore.js';

/* ── Auth Screen ──────────────────────────────────────── */
export function AuthScreen({ C, isMobile }) {
  const { mode, loading, waking, error, setMode, login, register } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const emailRef = useRef(null);

  // Focus email on mount
  useEffect(() => { setTimeout(() => emailRef.current?.focus(), 100); }, []);

  const set_ = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (mode === 'login') {
      await login({ email: form.email, password: form.password });
    } else {
      await register({ name: form.name, email: form.email, password: form.password });
    }
  };

  const inp = {
    background: C.bg3,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    color: C.text,
    fontSize: 14,
    outline: 'none',
    padding: '12px 14px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color .15s',
  };

  return (
    <div style={{
      minHeight: '100vh', background: C.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative', overflow: 'hidden',
    }}>
      {/* Gradient blobs */}
      {[0, 1, 2].map(i => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute', width: 380, height: 380, borderRadius: '50%',
          background: gradStr(i), opacity: 0.06, filter: 'blur(80px)', pointerEvents: 'none',
          top:  ['-10%', '55%', '25%'][i],
          left: ['-10%', '60%', '40%'][i],
        }} />
      ))}

      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 24, padding: isMobile ? '32px 24px' : '44px 40px',
        width: '100%', maxWidth: 420, position: 'relative',
        boxShadow: '0 40px 80px rgba(0,0,0,.45)',
        animation: 'fadeUp .3s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, borderRadius: 18, background: gradStr(0), marginBottom: 14,
          }}>
            <Svg d={I.music} size={28} fill="rgba(255,255,255,.3)" stroke="#fff" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: '0 0 6px' }}>
            Loqa Music
          </h1>
          <p style={{ color: C.text2, fontSize: 14, margin: 0 }}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} noValidate>
          {mode === 'signup' && (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="auth-name" style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
                Full name
              </label>
              <input id="auth-name" type="text" placeholder="Your name"
                autoComplete="name" required minLength={1}
                value={form.name} onChange={set_('name')} style={inp} />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label htmlFor="auth-email" style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
              Email address
            </label>
            <input id="auth-email" ref={emailRef} type="email"
              placeholder="you@example.com"
              autoComplete="email" required
              value={form.email} onChange={set_('email')} style={inp} />
          </div>

          <div style={{ marginBottom: (error || waking) ? 12 : 20 }}>
            <label htmlFor="auth-password" style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input id="auth-password"
                type={showPw ? 'text' : 'password'}
                placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required minLength={6}
                value={form.password} onChange={set_('password')}
                style={{ ...inp, paddingRight: 52 }} />
              <button type="button" onClick={() => setShowPw(p => !p)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.text3, fontSize: 12, fontFamily: 'inherit',
                }}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Waking up banner (Render free-tier cold start) */}
          {waking && !error && (
            <div role="status" style={{
              fontSize: 13, color: '#f59e0b',
              background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⏳</span>
              <span>Server is waking up — this takes ~15 seconds on first use…</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" style={{
              fontSize: 13, color: '#ef4444',
              background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '13px', background: gradStr(0),
              border: 'none', borderRadius: 12, color: '#fff',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'opacity .2s',
              fontFamily: 'inherit',
            }}>
            {waking ? 'Waking server…' : loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Switch mode */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: C.text2 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setForm({ name: '', email: '', password: '' }); }}
            style={{
              background: 'none', border: 'none', color: C.accent,
              cursor: 'pointer', fontWeight: 700, fontSize: 13,
              fontFamily: 'inherit', padding: 0,
            }}>
            {mode === 'login' ? 'Sign up free' : 'Sign in'}
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: C.text3, marginTop: 20, marginBottom: 0 }}>
          By continuing you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}

/* ── Queue Panel ──────────────────────────────────────── */
export function QueuePanel({ C, queue, related, song: cur, playing, onPlay, onRemove, onClose, isMobile }) {
  const ref = useRef(null);
  useFocusTrap(ref, true);

  return (
    <div ref={ref} role="dialog" aria-label="Play queue" aria-modal="true"
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: isMobile ? '100%' : 320,
        background: C.surface,
        borderLeft: isMobile ? 'none' : `1px solid ${C.border}`,
        zIndex: 200, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,.4)',
        animation: 'fadeIn .2s ease',
      }}>
      {/* Header */}
      <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Up Next</div>
          <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
            {queue.length > 0 && `${queue.length} queued`}
            {queue.length > 0 && related.length > 0 && ' · '}
            {related.length > 0 && `${related.length} autoplay`}
            {queue.length === 0 && related.length === 0 && 'Nothing queued'}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close queue"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 6 }}>
          <Svg d={I.close} size={18} stroke="currentColor" />
        </button>
      </div>

      {/* Now playing */}
      {cur && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
          background: `rgba(${C.accentRgb},.07)` }}>
          <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase',
            letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>Now Playing</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Thumb song={cur} size={40} radius={8} playing={playing} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.accent,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cur.title}
              </div>
              <div style={{ fontSize: 11, color: C.text2 }}>{cur.artist}</div>
            </div>
            {playing && <EqBars size={16} color={C.accent} />}
          </div>
        </div>
      )}

      {/* Queue list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {queue.map((s, i) => (
          <QRow key={`q-${s.id}-${i}`} s={s} idx={i + 1} cur={cur} playing={playing} C={C}
            onPlay={() => onPlay(s, i)} onRemove={() => onRemove(i)} />
        ))}

        {related.length > 0 && (
          <>
            <div style={{ padding: '12px 14px 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: C.border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                background: `rgba(${C.accentRgb},.1)`, borderRadius: 20,
                border: `1px solid rgba(${C.accentRgb},.2)` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>
                  ✨ Autoplay
                </span>
                <span style={{ fontSize: 10, color: C.text3 }}>· {related.length} similar songs</span>
              </div>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            {related.slice(0, 8).map((s, i) => (
              <QRow key={`r-${s.id}`} s={s} idx={queue.length + i + 1}
                cur={cur} playing={playing} C={C}
                onPlay={() => onPlay(s)} onRemove={null} dimmed />
            ))}
            {related.length > 8 && (
              <div style={{ padding: '8px 14px', fontSize: 12, color: C.text3, textAlign: 'center' }}>
                + {related.length - 8} more similar songs
              </div>
            )}
          </>
        )}

        {queue.length === 0 && related.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text2 }}>
            <Svg d={I.queue} size={40} stroke={C.text3} /><br /><br />
            <div style={{ fontWeight: 600, color: C.text, marginBottom: 6 }}>Queue is empty</div>
            <div style={{ fontSize: 12, lineHeight: 1.6 }}>
              Play any song and similar tracks will<br />
              appear here automatically as Autoplay
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QRow({ s, idx, cur, playing, C, onPlay, onRemove, dimmed }) {
  const [hov, setHov] = useState(false);
  const active = cur?.id === s.id;
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
        borderBottom: `1px solid ${C.border}`,
        opacity: dimmed && !hov ? 0.65 : 1,
        background: active ? `rgba(${C.accentRgb},.08)` : hov ? C.bg3 : 'transparent',
        transition: 'all .15s',
      }}>
      <span style={{ width: 20, textAlign: 'center', fontSize: 11, color: C.text3, flexShrink: 0 }}>{idx}</span>
      <Thumb song={s} size={36} radius={7} playing={active && playing} />
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={onPlay} role="button" tabIndex={0}
        aria-label={`Play ${s.title}`}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlay(); } }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: active ? C.accent : C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
        <div style={{ fontSize: 11, color: C.text2 }}>{s.artist} · {fmtTime(s.dur)}</div>
      </div>
      {onRemove && hov && (
        <button onClick={onRemove} aria-label="Remove from queue"
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            color: C.text3, padding: 4, borderRadius: 6, flexShrink: 0 }}>
          <Svg d={I.close} size={12} stroke="currentColor" />
        </button>
      )}
    </div>
  );
}

/* ── Playlist Modal ───────────────────────────────────── */
export function PlaylistModal({ C, mode, pl, onSave, onClose }) {
  const [name, setName] = useState(pl?.name || '');
  const [desc, setDesc] = useState(pl?.desc || '');
  const ref = useRef(null);
  useFocusTrap(ref, true);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div ref={ref}
        style={{ background: C.surface, borderRadius: 20, padding: 32, width: '100%', maxWidth: 380,
          border: `1px solid ${C.border}`, boxShadow: '0 40px 80px rgba(0,0,0,.5)',
          animation: 'fadeUp .2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
            {mode === 'edit' ? 'Edit Playlist' : 'New Playlist'}
          </span>
          <button onClick={onClose} aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 4 }}>
            <Svg d={I.close} size={18} stroke="currentColor" />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSave(name.trim(), desc.trim()); }}>
          <label htmlFor="pl-name" style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
            Name
          </label>
          <input id="pl-name" value={name} onChange={e => setName(e.target.value)}
            placeholder="Playlist name" autoFocus required
            style={{ width: '100%', padding: '12px 14px', background: C.bg3,
              border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
              fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 12 }} />
          <label htmlFor="pl-desc" style={{ display: 'block', fontSize: 12, color: C.text2, marginBottom: 6, fontWeight: 500 }}>
            Description <span style={{ color: C.text3 }}>(optional)</span>
          </label>
          <input id="pl-desc" value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Add a description"
            style={{ width: '100%', padding: '12px 14px', background: C.bg3,
              border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
              fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 20 }} />
          <button type="submit" disabled={!name.trim()}
            style={{ width: '100%', padding: 13, background: gradStr(0), border: 'none',
              borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5,
              fontFamily: 'inherit' }}>
            {mode === 'edit' ? 'Save Changes' : 'Create Playlist'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Account Tab (inside SettingsModal) ──────────────── */
function AccountTab({ C, user }) {
  const updateProfile  = useAuthStore(s => s.updateProfile);
  const changePassword = useAuthStore(s => s.changePassword);

  // Name edit
  const [name,     setName]     = useState(user?.name || '');
  const [nameMsg,  setNameMsg]  = useState('');
  const [nameBusy, setNameBusy] = useState(false);

  // Password change
  const [pwForm,   setPwForm]   = useState({ current: '', next: '', confirm: '' });
  const [pwMsg,    setPwMsg]    = useState('');
  const [pwBusy,   setPwBusy]   = useState(false);
  const [showPw,   setShowPw]   = useState(false);

  const inp = {
    width: '100%', padding: '11px 13px', background: C.bg3,
    border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === user?.name) return;
    setNameBusy(true); setNameMsg('');
    const res = await updateProfile(name.trim());
    setNameBusy(false);
    setNameMsg(res.ok ? '✓ Name updated!' : `⚠ ${res.err}`);
    setTimeout(() => setNameMsg(''), 3000);
  };

  const savePw = async () => {
    if (!pwForm.current || !pwForm.next) return;
    if (pwForm.next !== pwForm.confirm) { setPwMsg('⚠ New passwords do not match'); return; }
    if (pwForm.next.length < 6)        { setPwMsg('⚠ Password must be at least 6 characters'); return; }
    setPwBusy(true); setPwMsg('');
    const res = await changePassword(pwForm.current, pwForm.next);
    setPwBusy(false);
    if (res.ok) {
      setPwMsg('✓ Password changed!');
      setPwForm({ current: '', next: '', confirm: '' });
    } else {
      setPwMsg(`⚠ ${res.err}`);
    }
    setTimeout(() => setPwMsg(''), 4000);
  };

  const msgStyle = (msg) => ({
    fontSize: 12, marginTop: 6, fontWeight: 500,
    color: msg?.startsWith('✓') ? '#22c55e' : '#ef4444',
  });

  return (
    <div>
      {/* Avatar + email row */}
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
          background: C.bg3, borderRadius: 14, marginBottom: 20 }}>
          <div style={{ width: 50, height: 50, borderRadius: '50%',
            background: gradStr(user.avatarCi ?? 0), flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,.9)' }}>
            {user.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>{user.name}</div>
            <div style={{ color: C.text2, fontSize: 12 }}>{user.email}</div>
            <div style={{ color: C.text3, fontSize: 11, marginTop: 2 }}>
              Member since {user.createdAt ? new Date(user.createdAt).getFullYear() : '—'}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Name ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>Display Name</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            placeholder="Your display name" style={{ ...inp, flex: 1 }} />
          <button onClick={saveName} disabled={nameBusy || !name.trim() || name.trim() === user?.name}
            style={{
              padding: '11px 16px', background: gradStr(0), border: 'none', borderRadius: 10,
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
              opacity: (nameBusy || !name.trim() || name.trim() === user?.name) ? 0.5 : 1,
              fontFamily: 'inherit',
            }}>
            {nameBusy ? '…' : 'Save'}
          </button>
        </div>
        {nameMsg && <div style={msgStyle(nameMsg)}>{nameMsg}</div>}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: C.border, margin: '0 0 20px' }} />

      {/* ── Change Password ── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 10 }}>Change Password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <input type={showPw ? 'text' : 'password'} placeholder="Current password"
              value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))}
              style={{ ...inp, paddingRight: 50 }} />
            <button type="button" onClick={() => setShowPw(p => !p)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: C.text3,
                fontSize: 11, fontFamily: 'inherit' }}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          <input type={showPw ? 'text' : 'password'} placeholder="New password (min 6 chars)"
            value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}
            style={inp} />
          <input type={showPw ? 'text' : 'password'} placeholder="Confirm new password"
            value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && savePw()}
            style={inp} />
        </div>
        {pwMsg && <div style={msgStyle(pwMsg)}>{pwMsg}</div>}
        <button onClick={savePw}
          disabled={pwBusy || !pwForm.current || !pwForm.next || !pwForm.confirm}
          style={{
            width: '100%', marginTop: 10, padding: '11px', background: C.bg3,
            border: `1px solid ${C.border}`, borderRadius: 10, color: C.text,
            fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            opacity: (pwBusy || !pwForm.current || !pwForm.next || !pwForm.confirm) ? 0.5 : 1,
            transition: 'all .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surface2}
          onMouseLeave={e => e.currentTarget.style.background = C.bg3}>
          {pwBusy ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}

/* ── Settings Modal ───────────────────────────────────── */
export function SettingsModal({ C, settings, onSave, onClose, user }) {
  const [s, setS] = useState({ ...settings });
  const [tab, setTab] = useState('app');
  const ref = useRef(null);
  useFocusTrap(ref, true);

  const toggle = k => setS(p => ({ ...p, [k]: !p[k] }));

  const appItems = [
    { k: 'autoplay',    label: 'Autoplay Similar Songs', desc: 'Automatically queue related tracks when the queue ends' },
    { k: 'showWave',    label: 'Show Waveform',          desc: 'Animate the waveform visualiser in the player' },
    { k: 'reducedMotion',label:'Reduced Motion',         desc: 'Minimise animations for better accessibility' },
    { k: 'highContrast', label:'High Contrast',          desc: 'Increase contrast for better readability' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.overlay, zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}>
      <div ref={ref}
        style={{ background: C.surface, borderRadius: 20, padding: 32, width: '100%', maxWidth: 460,
          border: `1px solid ${C.border}`, boxShadow: '0 40px 80px rgba(0,0,0,.5)',
          maxHeight: '90vh', overflowY: 'auto', animation: 'fadeUp .2s ease' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Settings</span>
          <button onClick={onClose} aria-label="Close settings"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 4 }}>
            <Svg d={I.close} size={18} stroke="currentColor" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.bg3,
          borderRadius: 12, padding: 4 }}>
          {['app', 'account'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: tab === t ? C.surface : 'transparent',
                color: tab === t ? C.text : C.text2,
                fontWeight: tab === t ? 600 : 400, fontSize: 13,
                textTransform: 'capitalize', fontFamily: 'inherit', transition: 'all .15s' }}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'app' && appItems.map(({ k, label, desc }) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', background: C.bg3, borderRadius: 12,
            border: `1px solid ${C.border}`, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{label}</div>
              <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{desc}</div>
            </div>
            <button role="switch" aria-checked={s[k]} aria-label={label}
              onClick={() => toggle(k)}
              style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                padding: 0, background: s[k] ? C.accent : C.bg4,
                position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: s[k] ? 20 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
            </button>
          </div>
        ))}

        {tab === 'account' && <AccountTab C={C} user={user} />}

        <button onClick={() => { onSave(s); onClose(); }}
          style={{ width: '100%', padding: 13, background: gradStr(0), border: 'none',
            borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', marginTop: 16, fontFamily: 'inherit' }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}
