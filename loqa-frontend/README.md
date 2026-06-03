# Loqa Music — Frontend v3.0

React + Vite music streaming app with YouTube integration, Web Audio EQ, local file player, and personalised recommendations.

## Features
- 🎵 YouTube music streaming (server-side InnerTube proxy, no API key needed)
- 🔍 Real-time search with autocomplete suggestions
- ⭐ Personalised recommendations based on listening history
- 🎛️ 10-band Web Audio API equalizer (real-time for local files)
- 📁 Local music player (MP3, WAV, FLAC, AAC, OGG)
- 📚 Playlists + liked songs synced to MySQL backend
- 🔐 Real user accounts — no demo login
- 🌙 Dark / Light theme
- 📱 Mobile responsive with swipe gestures
- ⌨️ Full keyboard navigation
- 🔊 MediaSession API (lock screen controls)

## Setup

### 1. Make sure the backend is running
```bash
cd ../loqa-backend
npm install && npm run setup-db && npm run dev
# Backend on http://localhost:3000
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start dev server
```bash
npm run dev
# Opens http://localhost:5173
# /api calls proxy to http://localhost:3000
```

### 4. Build for production
```bash
# Same-origin deployment (serve both from backend):
npm run build
cp -r dist/ ../loqa-backend/public/

# Separate deployment (Vercel + Railway):
VITE_API_URL=https://api.yourdomain.com npm run build
```

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | Previous / Next track |
| `Shift+←` / `Shift+→` | Seek ±5 seconds |
| `↑` / `↓` | Volume up / down |
| `0`–`9` | Jump to 0%–90% of track |
| `L` | Like / Unlike current song |
| `S` | Toggle Shuffle |
| `R` | Toggle Repeat |
| `M` | Mute / Unmute |
| `Q` | Open / Close Queue |

## Local Music Player

Click **📁 Local Files** in the sidebar or Home screen.

- **Add files**: Supports MP3, WAV, FLAC, AAC, OGG, M4A, Opus
- **EQ**: Full 10-band real-time equalizer via Web Audio API
- **Persistent**: Tracks metadata stored in IndexedDB
- **File System Access API**: Chrome/Edge 86+ remembers file paths; other browsers need to re-select files each session

## Equalizer

Click the **🎛️ EQ** button in the header.

- 10 frequency bands: 32Hz → 16kHz
- 9 presets: Flat, Bass, Treble, Vocal, Pop, Rock, Hip Hop, Electronic, Lo-Fi
- Real audio processing for local files
- Visual-only for YouTube (browser CORS prevents capturing cross-origin audio)
- Settings synced to your account
