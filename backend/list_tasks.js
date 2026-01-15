
import mongoose from 'mongoose';
import { Task } from './models/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

async function listParentTasks() {
    try {
        await mongoose.connect(mongoUri);
        const tasks = await Task.find({ task_type: 'feature', parent_task_id: { $exists: false } }, '_id title project_name assignee_email assignees');
        console.log(JSON.stringify(tasks, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listParentTasks();
