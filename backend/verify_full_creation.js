
import mongoose from 'mongoose';
import { Project, Task } from './models/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

async function verifyAllData() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Verify Projects
        const projects = await Project.find({ created_by: 'admin@sarthi.com' });
        console.log(`\nVerified Projects (${projects.length}):`);
        projects.forEach(p => console.log(`- ${p.name} (Members: ${p.members.length})`));

        // Verify Tasks
        const tasks = await Task.find({ created_by: 'admin@sarthi.com' });
        const parentTasks = tasks.filter(t => t.task_type === 'feature');
        const subtasks = tasks.filter(t => t.task_type === 'subtask');

        console.log(`\nVerified Parent Tasks (${parentTasks.length}):`);
        parentTasks.forEach(t => console.log(`- ${t.title} (Assigned: ${t.assignee_email})`));

        console.log(`\nVerified Subtasks (${subtasks.length}):`);
        subtasks.forEach(t => console.log(`- ${t.title} (Parent: ${t.parent_task_id}, Assigned: ${t.assignee_email})`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifyAllData();
