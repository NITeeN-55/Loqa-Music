/**
 * Loqa Music — Mongoose Models v4.0
 * Single source of truth for all collections.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

/* ── Users ──────────────────────────────────────────────── */
const UserSchema = new Schema({
  _id:           { type: String },          // UUID
  name:          { type: String, required: true, trim: true, maxlength: 100 },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  avatar_ci:     { type: Number, default: 0 },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

/* ── Playlists (metadata only — songs in separate collection) ── */
const PlaylistSongEmbeddedSchema = new Schema({
  song_id:     { type: String, required: true },
  song_title:  { type: String, default: 'Unknown' },
  song_artist: { type: String, default: 'Unknown' },
  song_thumb:  { type: String, default: '' },
  song_dur:    { type: Number, default: 0 },
  position:    { type: Number, default: 0 },
  added_at:    { type: Date,   default: Date.now },
}, { _id: false });

const PlaylistSchema = new Schema({
  _id:         { type: String },            // UUID
  user_id:     { type: String, required: true, index: true },
  name:        { type: String, required: true, maxlength: 255 },
  description: { type: String, default: '' },
  ci:          { type: Number, default: 0 },
  // Legacy embedded songs array — kept for backward compat during migration.
  // New songs are written to playlist_songs collection.
  // TODO: run migration script, then drop this field.
  songs:       { type: [PlaylistSongEmbeddedSchema], default: [] },
  // Metadata fields for future sharing & analytics
  is_public:        { type: Boolean, default: false },
  is_collaborative: { type: Boolean, default: false },
  followers_count:  { type: Number,  default: 0 },
  cover_url:        { type: String,  default: '' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

/**
 * PlaylistSongs — separate collection replacing embedded songs array.
 *
 * Benefits vs embedding:
 *  - No 16MB document limit (supports playlists with 10,000+ songs)
 *  - Efficient pagination via skip/limit on position index
 *  - Supports collaborative playlists (added_by field)
 *  - Atomic song add/remove without rewriting entire playlist doc
 *
 * Migration: run `scripts/migrate-playlist-songs.js` to copy existing
 * embedded songs into this collection, then update library routes.
 */
const PlaylistSongsSchema = new Schema({
  playlist_id: { type: String, required: true },
  song_id:     { type: String, required: true },
  song_title:  { type: String, default: 'Unknown' },
  song_artist: { type: String, default: 'Unknown' },
  song_thumb:  { type: String, default: '' },
  song_dur:    { type: Number, default: 0 },
  position:    { type: Number, required: true },
  added_by:    { type: String, default: '' },  // user_id — for collaborative playlists
  added_at:    { type: Date,   default: Date.now },
}, { _id: false });

PlaylistSongsSchema.index({ playlist_id: 1, position: 1 });
PlaylistSongsSchema.index({ playlist_id: 1, song_id: 1 }, { unique: true });

/* ── Liked Songs ────────────────────────────────────────── */
const LikedSongSchema = new Schema({
  user_id:     { type: String, required: true },
  song_id:     { type: String, required: true },
  song_title:  { type: String, default: 'Unknown' },
  song_artist: { type: String, default: 'Unknown' },
  song_thumb:  { type: String, default: '' },
  song_dur:    { type: Number, default: 0 },
  liked_at:    { type: Date,   default: Date.now },
});
LikedSongSchema.index({ user_id: 1, song_id: 1 }, { unique: true });
LikedSongSchema.index({ user_id: 1, liked_at: -1 });

/* ── Play History ───────────────────────────────────────── */
const PlayHistorySchema = new Schema({
  user_id:     { type: String, required: true },
  song_id:     { type: String, required: true },
  song_title:  { type: String, default: 'Unknown' },
  song_artist: { type: String, default: '' },
  song_thumb:  { type: String, default: '' },
  played_at:   { type: Date,   default: Date.now },
});
PlayHistorySchema.index({ user_id: 1, played_at: -1 });
PlayHistorySchema.index({ user_id: 1, song_id: 1 });
// TTL: auto-delete history entries older than 90 days (prevents unbounded growth)
PlayHistorySchema.index({ played_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

/* ── User Preferences ───────────────────────────────────── */
const UserPrefsSchema = new Schema({
  _id:          { type: String },           // = user_id
  eq_preset:    { type: String, default: 'flat' },
  eq_bands:     { type: [Number], default: [0,0,0,0,0,0,0,0,0,0] },
  app_settings: { type: Schema.Types.Mixed, default: {} },
  volume:       { type: Number, default: 80 },
}, { timestamps: { updatedAt: 'updated_at' } });

/* ── Song Cache ─────────────────────────────────────────── */
const SongCacheSchema = new Schema({
  _id:       { type: String },              // = song_id (YouTube videoId)
  title:     { type: String, default: '' },
  artist:    { type: String, default: '', index: true },
  thumbnail: { type: String, default: '' },
  duration:  { type: Number, default: 0 },
  cached_at: { type: Date,   default: Date.now },
});
// TTL: auto-delete song cache entries older than 30 days
SongCacheSchema.index({ cached_at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const User          = mongoose.model('User',          UserSchema,         'users');
export const Playlist      = mongoose.model('Playlist',      PlaylistSchema,     'playlists');
export const PlaylistSongs = mongoose.model('PlaylistSongs', PlaylistSongsSchema,'playlist_songs');
export const LikedSong     = mongoose.model('LikedSong',     LikedSongSchema,    'liked_songs');
export const PlayHistory   = mongoose.model('PlayHistory',   PlayHistorySchema,  'play_history');
export const UserPrefs     = mongoose.model('UserPrefs',     UserPrefsSchema,    'user_preferences');
export const SongCache     = mongoose.model('SongCache',     SongCacheSchema,    'song_cache');
