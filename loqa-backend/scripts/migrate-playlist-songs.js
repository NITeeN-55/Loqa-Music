#!/usr/bin/env node
/**
 * Migration: Embedded Playlist Songs → playlist_songs Collection
 *
 * Run once after deploying the PlaylistSongs schema.
 * Safe to re-run (idempotent — uses upsert).
 *
 * Usage:
 *   MONGODB_URI=<your-uri> node scripts/migrate-playlist-songs.js
 *
 * After verifying migration is complete and routes are updated,
 * remove the `songs` field from PlaylistSchema.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('MONGODB_URI not set'); process.exit(1); }

await mongoose.connect(MONGODB_URI);
console.log('Connected to MongoDB');

const db = mongoose.connection.db;
const playlists     = db.collection('playlists');
const playlistSongs = db.collection('playlist_songs');

// Ensure indexes exist
await playlistSongs.createIndex({ playlist_id: 1, position: 1 });
await playlistSongs.createIndex({ playlist_id: 1, song_id: 1 }, { unique: true });

let totalPlaylists = 0, totalSongs = 0, errors = 0;

const cursor = playlists.find({ songs: { $exists: true, $not: { $size: 0 } } });

for await (const pl of cursor) {
  const songs = pl.songs || [];
  if (!songs.length) continue;

  totalPlaylists++;
  const ops = songs.map((s, i) => ({
    updateOne: {
      filter: { playlist_id: pl._id, song_id: s.song_id },
      update: {
        $setOnInsert: {
          playlist_id: pl._id,
          song_id:     s.song_id,
          song_title:  s.song_title  || 'Unknown',
          song_artist: s.song_artist || 'Unknown',
          song_thumb:  s.song_thumb  || '',
          song_dur:    s.song_dur    || 0,
          position:    s.position    ?? i,
          added_by:    pl.user_id,
          added_at:    s.added_at || new Date(),
        },
      },
      upsert: true,
    },
  }));

  try {
    const result = await playlistSongs.bulkWrite(ops, { ordered: false });
    totalSongs += result.upsertedCount;
    process.stdout.write(`\r  ✓ ${totalPlaylists} playlists, ${totalSongs} songs migrated...`);
  } catch (err) {
    errors++;
    console.error(`\n  ✗ Error migrating playlist ${pl._id}:`, err.message);
  }
}

console.log(`\n\nMigration complete:`);
console.log(`  Playlists processed: ${totalPlaylists}`);
console.log(`  Songs inserted:      ${totalSongs}`);
console.log(`  Errors:              ${errors}`);
console.log(`\nNext steps:`);
console.log(`  1. Verify data in playlist_songs collection`);
console.log(`  2. Update library routes to use PlaylistSongs model`);
console.log(`  3. Remove "songs" embedded array from PlaylistSchema`);

await mongoose.disconnect();
process.exit(errors > 0 ? 1 : 0);
