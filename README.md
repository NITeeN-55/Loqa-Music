# 🎵 Loqa Music

A full-stack music streaming web app powered by YouTube, built with React + Vite (frontend) and Express + MongoDB (backend).

- **Frontend** → Vercel
- **Backend** → Render (Node.js web service)
- **Database** → MongoDB Atlas

---

## 🚀 Deployment Guide

### Prerequisites
- [MongoDB Atlas](https://cloud.mongodb.com) cluster (free M0 tier works)
- [Render](https://render.com) account
- [Vercel](https://vercel.com) account

---

### Step 1 — Deploy Backend to Render

1. Push the repo to GitHub (just the `loqa-backend` folder, or the whole repo).

2. In Render → **New → Web Service** → connect your repo.

3. Set these **Build & Deploy** settings:
   - **Root Directory:** `loqa-backend`
   - **Build Command:** `npm install --omit=dev`
   - **Start Command:** `npm start`
   - **Runtime:** Node
   - **Plan:** Free

4. In **Environment** tab, add these variables:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | `mongodb+srv://...` (from Atlas) |
   | `JWT_SECRET` | Run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
   | `JWT_EXPIRES_IN` | `7d` |
   | `ALLOWED_ORIGINS` | *(leave blank for now — fill in after Vercel deploy)* |
   | `INNERTUBE_API_KEY` | `AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8` |
   | `RATE_LIMIT_WINDOW_MS` | `60000` |
   | `RATE_LIMIT_MAX` | `150` |

5. Deploy. Note your Render URL, e.g. `https://loqa-music-api.onrender.com`.

6. Test: `curl https://loqa-music-api.onrender.com/api/health`
   Should return `{"status":"ok",...}`.

> **Tip:** On the free Render tier, the service spins down after 15 minutes of inactivity. First request takes ~30s to wake up.

---

### Step 2 — Deploy Frontend to Vercel

1. In Vercel → **New Project** → import your repo.

2. Set **Root Directory** to `loqa-frontend`.

3. In **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | Your Render URL, e.g. `https://loqa-music-api.onrender.com` |
   | `VITE_APP_NAME` | `Loqa Music` |

4. Deploy. Note your Vercel URL, e.g. `https://loqa-music.vercel.app`.

---

### Step 3 — Wire CORS (Final Step)

Back in Render → your service → **Environment**:

Update `ALLOWED_ORIGINS` to your Vercel URL:
```
ALLOWED_ORIGINS=https://loqa-music.vercel.app
```

Trigger a **Manual Deploy** in Render so the new env var takes effect.

---

## 🛠 Local Development

### Backend
```bash
cd loqa-backend
npm install
# Edit .env — set your MongoDB URI
npm run dev
```
Runs on `http://localhost:3000`.

### Frontend
```bash
cd loqa-frontend
npm install
# .env already has VITE_API_URL pointing to Render — or change to http://localhost:3000 for local backend
npm run dev
```
Runs on `http://localhost:5173`. Vite proxies `/api/*` requests to the backend URL in `.env`.

---

## 📁 Project Structure

```
loqa-music/
├── loqa-backend/
│   ├── server/
│   │   ├── index.js          # Express app entry
│   │   ├── db.js             # MongoDB / Mongoose connection
│   │   ├── models.js         # All Mongoose schemas
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT middleware
│   │   └── routes/
│   │       ├── auth.js       # /api/auth/*
│   │       ├── library.js    # /api/library/*
│   │       ├── youtube.js    # /api/youtube/*
│   │       ├── recommendations.js
│   │       └── preferences.js
│   ├── .env                  # Local dev secrets (gitignored)
│   ├── .env.example          # Template — copy to .env
│   ├── render.yaml           # Render deployment config
│   └── package.json
│
└── loqa-frontend/
    ├── src/
    │   ├── stores/           # Zustand state (auth, player, library, etc.)
    │   ├── components/       # React components
    │   ├── hooks/            # Custom hooks
    │   └── utils/            # Constants, helpers
    ├── .env                  # Local dev env vars (gitignored)
    ├── .env.production       # Production env vars (gitignored)
    ├── .env.example          # Template
    ├── vercel.json           # Vercel SPA routing config
    └── vite.config.js
```

---

## 🔑 Environment Variables Reference

### Backend (Render)
| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `production` | ✅ |
| `MONGODB_URI` | MongoDB Atlas connection string | ✅ |
| `JWT_SECRET` | 64-byte random hex secret | ✅ |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `7d` | ✅ |
| `ALLOWED_ORIGINS` | Comma-separated Vercel URLs | ✅ |
| `INNERTUBE_API_KEY` | YouTube InnerTube key | ✅ |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | optional |
| `RATE_LIMIT_MAX` | Max requests per window | optional |

### Frontend (Vercel)
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Full Render backend URL | ✅ |
| `VITE_APP_NAME` | App display name | optional |
