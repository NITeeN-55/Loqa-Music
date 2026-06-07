/**
 * Loqa Music — Mongoose Models v5.0
 * Single source of truth for all collections.
 *
 * CHANGELOG v5.0:
 *  - play_history: added TTL index (90 days) to prevent unbounded growth
 *  - song_cache: added TTL index (30 days) to purge stale metadata
 *  - playlists: added is_public, is_collaborative, cover_url for Phase 2
 *  - users: added subscription + social fields for premium/social features
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
  bio:           { type: String, default: '', maxlength: 280 },
  // Premium subscription
  subscription: {
    plan:       { type: String, enum: ['free', 'premium'], default: 'free' },
    expires_at: { type: Date },
    provider:   { type: String, enum: ['razorpay', 'stripe', 'promo', null], default: null },
    provider_id:{ type: String },
  },
  // Social
  followers_count: { type: Number, default: 0 },
  following_count: { type: Number, default: 0 },
  is_public:       { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

/* ── Playlists (songs embedded — v5: add sharing fields) ──── */
const PlaylistSongSchema = new Schema({
  song_id:     { type: String, required: true },
  song_title:  { type: String, default: 'Unknown' },
  song_artist: { type: String, default: 'Unknown' },
  song_thumb:  { type: String, default: '' },
  song_dur:    { type: Number, default: 0 },
  position:    { type: Number, default: 0 },
  added_at:    { type: Date,   default: Date.now },
}, { _id: false });

const PlaylistSchema = new Schema({
  _id:               { type: String },      // UUID
  user_id:           { type: String, required: true, index: true },
  name:              { type: String, required: true, maxlength: 255 },
  description:       { type: String, default: '' },
  ci:                { type: Number, default: 0 },
  cover_url:         { type: String, default: '' },   // custom cover
  is_public:         { type: Boolean, default: false },
  is_collaborative:  { type: Boolean, default: false },
  songs:             { type: [PlaylistSongSchema], default: [] },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

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
// ✅ TTL index: auto-delete play history older than 90 days
PlayHistorySchema.index({ played_at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

/* ── User Preferences ───────────────────────────────────── */
const UserPrefsSchema = new Schema({
  _id:          { type: String },           // = user_id
  eq_preset:    { type: String, default: 'flat' },
  eq_bands:     { type: [Number], default: [0,0,0,0,0,0,0,0,0,0] },
  app_settings: { type: Schema.Types.Mixed, default: {} },
  volume:       { type: Number, default: 80 },
  sleep_timer:  { type: Number, default: 0 },  // minutes, 0 = off
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
// ✅ TTL index: auto-purge stale song metadata after 30 days
SongCacheSchema.index({ cached_at: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

/* ── Social: User Follows ───────────────────────────────── */
const UserFollowSchema = new Schema({
  follower_id:  { type: String, required: true },
  following_id: { type: String, required: true },
  created_at:   { type: Date, default: Date.now },
}, { _id: false });
UserFollowSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });
UserFollowSchema.index({ following_id: 1 });
UserFollowSchema.index({ follower_id:  1 });

export const User        = mongoose.model('User',        UserSchema,       'users');
export const Playlist    = mongoose.model('Playlist',    PlaylistSchema,   'playlists');
export const LikedSong   = mongoose.model('LikedSong',   LikedSongSchema,  'liked_songs');
export const PlayHistory = mongoose.model('PlayHistory', PlayHistorySchema,'play_history');
export const UserPrefs   = mongoose.model('UserPrefs',   UserPrefsSchema,  'user_preferences');
export const SongCache   = mongoose.model('SongCache',   SongCacheSchema,  'song_cache');
export const UserFollow  = mongoose.model('UserFollow',  UserFollowSchema, 'user_follows');
