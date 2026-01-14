import mongoose from 'mongoose';
import { seedData } from './rbac_seed.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected! Running seed...');

        await seedData();

        console.log('Done! Disconnecting...');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
};

run();
