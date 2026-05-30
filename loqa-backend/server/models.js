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

/* ── Playlists (songs embedded) ─────────────────────────── */
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
  _id:         { type: String },            // UUID
  user_id:     { type: String, required: true, index: true },
  name:        { type: String, required: true, maxlength: 255 },
  description: { type: String, default: '' },
  ci:          { type: Number, default: 0 },
  songs:       { type: [PlaylistSongSchema], default: [] },
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

export const User        = mongoose.model('User',        UserSchema,       'users');
export const Playlist    = mongoose.model('Playlist',    PlaylistSchema,   'playlists');
export const LikedSong   = mongoose.model('LikedSong',   LikedSongSchema,  'liked_songs');
export const PlayHistory = mongoose.model('PlayHistory', PlayHistorySchema,'play_history');
export const UserPrefs   = mongoose.model('UserPrefs',   UserPrefsSchema,  'user_preferences');
export const SongCache   = mongoose.model('SongCache',   SongCacheSchema,  'song_cache');
