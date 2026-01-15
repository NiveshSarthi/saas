
import mongoose from 'mongoose';
import { User, Project } from './models/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

async function checkData() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const users = await User.find({}, 'email full_name');
        console.log('--- USERS ---');
        console.log(JSON.stringify(users, null, 2));

        const projects = await Project.find({});
        console.log('--- PROJECTS ---');
        console.log(JSON.stringify(projects, null, 2));

        const collections = mongoose.connection.collections;
        console.log('--- COLLECTION COUNTS ---');
        for (const key in collections) {
            const count = await collections[key].countDocuments();
            console.log(`${key}: ${count}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
