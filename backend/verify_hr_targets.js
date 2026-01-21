
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { HRTarget } from './models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const connectDB = async () => {
    let mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';
    try {
        await mongoose.connect(mongoUri);
        console.log(`Connected to MongoDB at ${mongoUri}`);
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }
};

const verifyTargets = async () => {
    await connectDB();

    try {
        const allTargets = await HRTarget.find({});
        console.log(`Total Targets Found: ${allTargets.length}`);

        const activeTargets = await HRTarget.find({ status: 'active' });
        console.log(`Active Targets Found: ${activeTargets.length}`);

        if (allTargets.length > 0) {
            console.log('Sample Target:', JSON.stringify(allTargets[0], null, 2));
        } else {
            console.log('No targets found in the database. Try creating one via the UI first (even if it doesn\'t show up).');
        }

    } catch (error) {
        console.error('Error verifying targets:', error);
    } finally {
        await mongoose.disconnect();
    }
};

verifyTargets();
