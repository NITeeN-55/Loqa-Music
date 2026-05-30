/**
 * Loqa Music — MongoDB Index Setup v4.0
 * Run once: node server/setup-db.js
 *
 * Mongoose auto-creates indexes on first sync, but this script
 * ensures they exist explicitly and reports their status.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Playlist, LikedSong, PlayHistory, UserPrefs, SongCache } from './models.js';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loqa_music';

async function setup() {
  try {
    await mongoose.connect(URI);
    console.log('✅ Connected to MongoDB\n');

    // Sync all indexes defined in schemas
    await Promise.all([
      User.syncIndexes(),
      Playlist.syncIndexes(),
      LikedSong.syncIndexes(),
      PlayHistory.syncIndexes(),
      UserPrefs.syncIndexes(),
      SongCache.syncIndexes(),
    ]);

    const collections = ['users', 'playlists', 'liked_songs', 'play_history', 'user_preferences', 'song_cache'];
    console.log('📦 Collections & indexes ready:');
    for (const name of collections) {
      const indexes = await mongoose.connection.collection(name).indexes();
      console.log(`   ${name}: ${indexes.length} index(es)`);
    }

    console.log('\n✅ Database setup complete!');
    console.log('   You can now start the server: npm run dev\n');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

setup();
