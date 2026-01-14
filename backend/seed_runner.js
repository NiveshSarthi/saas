import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { seedData } from './seeds/rbac_seed.js';
import { MongoMemoryServer } from 'mongodb-memory-server';

dotenv.config({ path: './.env' });

const run = async () => {
  let mongod;
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';
    try {
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB for seeding:', mongoUri);
    } catch (connErr) {
      console.warn('Could not connect to local MongoDB, starting in-memory MongoDB:', connErr.message);
      mongod = await MongoMemoryServer.create();
      const memUri = mongod.getUri();
      await mongoose.connect(memUri);
      console.log('Connected to in-memory MongoDB for seeding:', memUri);
    }

    await seedData();
    console.log('Seeding finished.');

    if (mongod) {
      // keep process alive momentarily so user can inspect if desired, then stop
      await mongoose.disconnect();
      await mongod.stop();
    }

    process.exit(0);
  } catch (e) {
    console.error('Seeding failed:', e);
    if (mongod) {
      try {
        await mongod.stop();
      } catch (_) {}
    }
    process.exit(1);
  }
};

run();
