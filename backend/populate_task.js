
import mongoose from 'mongoose';
import { User, Project, Task } from './models/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

async function createProjectAndTasks() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Create Project
        const project = await Project.create({
            name: 'SAAS - Task Tracker',
            description: 'Task Tracker module for the SAAS category (Lead: Ratnaker).',
            status: 'active',
            members: ['admin@sarthi.com', 'ratnakerkumar56@gmail.com'],
            start_date: new Date('2026-01-15'),
            end_date: new Date('2027-01-15'),
            created_by: 'admin@sarthi.com'
        });
        console.log('Created Project:', project._id);

        // 2. Create Main Task
        const mainTask = await Task.create({
            title: 'Framework setup for Task Tracker',
            description: 'Initialize the base framework and project structure for the Task Tracker module as per the IT Department organization chart.',
            project_id: project._id.toString(),
            project_name: project.name,
            assignee_email: 'ratnakerkumar56@gmail.com',
            assignees: ['ratnakerkumar56@gmail.com'],
            reporter_email: 'admin@sarthi.com',
            created_by: 'admin@sarthi.com',
            start_date: new Date('2026-01-15'),
            due_date: new Date('2026-01-17'),
            status: 'todo',
            priority: 'medium',
            task_type: 'feature'
        });
        console.log('Created Main Task:', mainTask._id);

        // 3. Create Subtasks
        const subtask1 = await Task.create({
            title: 'Define data models for Task Tracking',
            parent_task_id: mainTask._id.toString(),
            project_id: project._id.toString(),
            project_name: project.name,
            assignee_email: 'ratnakerkumar56@gmail.com',
            assignees: ['ratnakerkumar56@gmail.com'],
            reporter_email: 'admin@sarthi.com',
            created_by: 'admin@sarthi.com',
            start_date: new Date('2026-01-15'),
            due_date: new Date('2026-01-17'),
            status: 'todo',
            priority: 'medium',
            task_type: 'subtask'
        });
        console.log('Created Subtask 1:', subtask1._id);

        const subtask2 = await Task.create({
            title: 'Setup basic API routes for Task CRUD operations',
            parent_task_id: mainTask._id.toString(),
            project_id: project._id.toString(),
            project_name: project.name,
            assignee_email: 'ratnakerkumar56@gmail.com',
            assignees: ['ratnakerkumar56@gmail.com'],
            reporter_email: 'admin@sarthi.com',
            created_by: 'admin@sarthi.com',
            start_date: new Date('2026-01-15'),
            due_date: new Date('2026-01-17'),
            status: 'todo',
            priority: 'medium',
            task_type: 'subtask'
        });
        console.log('Created Subtask 2:', subtask2._id);

        console.log('SUCCESS: All entries created.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

createProjectAndTasks();
