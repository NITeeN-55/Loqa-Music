/**
 * MongoDB connection — Loqa Music v4.0
 * Uses Mongoose for schema validation and query helpers.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loqa_music';

export async function initDatabase() {
  try {
    await mongoose.connect(URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    const host = mongoose.connection.host;
    const db   = mongoose.connection.name;
    console.log(`✅ MongoDB connected → ${host}/${db}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Check MONGODB_URI in .env');
    console.error('   Local default: mongodb://localhost:27017/loqa_music');
    process.exit(1);
  }
}

// Re-export all models so routes can import from one place
export * from './models.js';
