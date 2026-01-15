
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

async function createSubtasks() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const startDate = new Date('2026-01-15');
        const dueDate = new Date('2026-01-17');
        const creator = 'admin@sarthi.com';

        // Fetch parent tasks to get their IDs and project info
        const parentTasks = await Task.find({
            task_type: 'feature',
            parent_task_id: { $exists: false },
            created_by: creator
        });

        const subtasksToCreate = [
            { parentTitle: 'SAAS - HRMS Initial Setup', title: 'Attendance module design', email: 'jayant@niveshsarthi.com' },
            { parentTitle: 'SAAS - HRMS Initial Setup', title: 'Payroll logic implementation', email: 'ratnakerkumar56@gmail.com' },
            { parentTitle: 'SAAS - IMS Initial Setup', title: 'Warehouse inventory tracking setup', email: 'jayant@niveshsarthi.com' },
            { parentTitle: 'SAAS - IMS Initial Setup', title: 'Inventory low-stock alerts', email: 'abhinav@niveshsarthi.com' },
            { parentTitle: 'SAAS - Lead Mgmt Initial Setup', title: 'Lead source integration (FB/Web)', email: 'jayant@niveshsarthi.com' },
            { parentTitle: 'SAAS - Lead Mgmt Initial Setup', title: 'Conversion pipeline visualization', email: 'abhinav@niveshsarthi.com' },
            { parentTitle: 'SAAS - MMS Initial Setup', title: 'Marketing campaign analytics', email: 'nupur@niveshsarthi.com' },
            { parentTitle: 'SAAS - MMS Initial Setup', title: 'Content scheduling engine', email: 'vishal@niveshsarthi.com' },
            { parentTitle: 'Website - Landing Pages Initial Setup', title: 'CMS integration for Builders', email: 'jayant@niveshsarthi.com' },
            { parentTitle: 'Website - Landing Pages Initial Setup', title: 'UI/UX design for Samarpan', email: 'ratnakerkumar56@gmail.com' },
            { parentTitle: 'Website - Full Stack Portal Initial Setup', title: 'User authentication and roles', email: 'jayant@niveshsarthi.com' },
            { parentTitle: 'Website - Full Stack Portal Initial Setup', title: 'Backend API for portal data', email: 'vishal@niveshsarthi.com' },
            { parentTitle: 'Marketing & Design Initial Setup', title: 'Lead Gen campaign setup', email: 'jayant@niveshsarthi.com' },
            { parentTitle: 'Marketing & Design Initial Setup', title: 'Content strategy for Growth', email: 'nupur@niveshsarthi.com' },
            { parentTitle: 'Marketing & Design Initial Setup', title: 'Graphic assets for campaigns', email: 'vishal@niveshsarthi.com' }
        ];

        for (const st of subtasksToCreate) {
            const parent = parentTasks.find(p => p.title === st.parentTitle);
            if (parent) {
                await Task.create({
                    title: st.title,
                    parent_task_id: parent._id.toString(),
                    project_id: parent.project_id,
                    project_name: parent.project_name,
                    assignee_email: st.email,
                    assignees: [st.email],
                    reporter_email: creator,
                    created_by: creator,
                    start_date: startDate,
                    due_date: dueDate,
                    status: 'todo',
                    priority: 'medium',
                    task_type: 'subtask'
                });
                console.log(`Created Subtask: "${st.title}" for parent "${st.parentTitle}"`);
            } else {
                console.warn(`Parent task "${st.parentTitle}" not found.`);
            }
        }

        console.log('SUCCESS: All subtasks created.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

createSubtasks();
