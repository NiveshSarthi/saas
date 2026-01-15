
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

async function populateAllTasks() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const startDate = new Date('2026-01-15');
        const dueDate = new Date('2026-01-17');
        const creator = 'admin@sarthi.com';

        const projectsData = [
            { name: 'SAAS - HRMS', desc: 'HR Management System module', lead: 'ratnakerkumar56@gmail.com', support: ['jayant@niveshsarthi.com'], tags: ['IT', 'SAAS', 'HRMS'] },
            { name: 'SAAS - IMS', desc: 'Inventory Management System', lead: 'abhinav@niveshsarthi.com', support: ['jayant@niveshsarthi.com'], tags: ['IT', 'SAAS', 'IMS'] },
            { name: 'SAAS - Lead Mgmt', desc: 'Lead Management Software', lead: 'abhinav@niveshsarthi.com', support: ['jayant@niveshsarthi.com'], tags: ['IT', 'SAAS', 'Lead Mgmt'] },
            { name: 'SAAS - MMS', desc: 'Marketing Management System', lead: 'vishal@niveshsarthi.com', support: ['nupur@niveshsarthi.com'], tags: ['IT', 'SAAS', 'MMS'] },
            { name: 'Website - Landing Pages', desc: 'Samarpan/Builders landing pages', lead: 'ratnakerkumar56@gmail.com', support: ['jayant@niveshsarthi.com'], tags: ['Website', 'IT'] },
            { name: 'Website - Full Stack Portal', desc: 'Syndicate Nivesh portal', lead: 'vishal@niveshsarthi.com', support: ['jayant@niveshsarthi.com'], tags: ['Website', 'IT'] },
            { name: 'Marketing & Design', desc: 'Marketing collateral and campaigns', lead: 'jayant@niveshsarthi.com', support: ['nupur@niveshsarthi.com', 'vishal@niveshsarthi.com'], tags: ['Marketing', 'Design'] }
        ];

        for (const p of projectsData) {
            const project = await Project.create({
                name: p.name,
                description: p.desc,
                status: 'active',
                members: [creator, p.lead, ...p.support],
                start_date: startDate,
                end_date: new Date('2027-01-15'),
                created_by: creator
            });
            console.log(`Created Project: ${p.name}`);

            const mainTask = await Task.create({
                title: `${p.name} Initial Setup`,
                description: `Setup and coordination for ${p.name} as per organizational chart.`,
                project_id: project._id.toString(),
                project_name: project.name,
                assignee_email: p.lead,
                assignees: [p.lead, ...p.support],
                reporter_email: creator,
                created_by: creator,
                start_date: startDate,
                due_date: dueDate,
                status: 'todo',
                priority: 'medium',
                task_type: 'feature',
                tags: p.tags
            });
            console.log(`  Created Task for ${p.lead}`);
        }

        console.log('SUCCESS: All chart-based entries created.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

populateAllTasks();
