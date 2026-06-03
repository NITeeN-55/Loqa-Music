# Loqa Music Backend v4.0

Express API backed by **MongoDB** (Mongoose).

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB 6+ (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Local setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET

# 3. Create indexes (optional — Mongoose auto-creates on first start)
npm run setup-db

# 4. Start dev server
npm run dev
```

### MongoDB Atlas (cloud)
Set `MONGODB_URI` to your Atlas connection string:
```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/loqa_music?retryWrites=true&w=majority
```

## Collections
| Collection         | Description                              |
|--------------------|------------------------------------------|
| `users`            | Accounts — UUID `_id`, hashed password  |
| `playlists`        | Playlists with embedded songs array      |
| `liked_songs`      | Per-user liked tracks                    |
| `play_history`     | Play events (used for recommendations)   |
| `user_preferences` | EQ, volume, app settings                 |
| `song_cache`       | Shared YouTube metadata cache            |

## API Routes
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/me
PUT    /api/auth/password

GET    /api/library
POST   /api/library/playlists
PUT    /api/library/playlists/:id
DELETE /api/library/playlists/:id
POST   /api/library/playlists/:id/songs
DELETE /api/library/playlists/:id/songs/:songId
POST   /api/library/likes
GET    /api/library/likes
POST   /api/library/history
GET    /api/library/history
GET    /api/library/stats

GET    /api/preferences
PUT    /api/preferences

GET    /api/recommendations
GET    /api/youtube/search
GET    /api/health
```
