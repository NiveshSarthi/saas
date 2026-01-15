
import mongoose from 'mongoose';
import { User, Task, Project, Department } from './models/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

async function debugAndFix() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // 1. Check Users and Departments
        const users = await User.find({});
        const departments = await Department.find({});
        console.log(`\n--- Users (${users.length}) ---`);
        users.forEach(u => {
            console.log(`- ${u.email} | Dept: ${u.department_id || 'MISSING'} | Role: ${u.role}`);
        });

        console.log(`\n--- Departments (${departments.length}) ---`);
        departments.forEach(d => console.log(`- ${d.name} (ID: ${d._id})`));

        // Map department names to IDs for fixing
        const deptMap = {};
        departments.forEach(d => deptMap[d.name.toLowerCase()] = d._id.toString());

        // Fix Users missing departments or specific users mentioned in chart
        console.log('\n--- Fixing User Departments ---');
        for (const u of users) {
            let needsSave = false;

            // Logic to assign departments based on email/role if missing
            if (!u.department_id) {
                if (u.email.includes('admin')) {
                    // Admin usually doesn't need specific dept, but for filter consistency:
                    // u.department_id = deptMap['management'] || deptMap['it'];
                } else if (u.email === 'ratnakerkumar56@gmail.com' || u.email === 'abhinav@niveshsarthi.com' || u.email === 'vishal@niveshsarthi.com') {
                    // IT / SAAS
                    u.department_id = deptMap['it'] || deptMap['saas'];
                    needsSave = true;
                    console.log(`Assigning IT to ${u.email}`);
                } else if (u.email === 'jayant@niveshsarthi.com' || u.email === 'nupur@niveshsarthi.com') {
                    // Marketing
                    u.department_id = deptMap['marketing'];
                    needsSave = true;
                    console.log(`Assigning Marketing to ${u.email}`);
                }
            }

            if (needsSave) await u.save();
        }


        // 2. Check Tasks
        const tasks = await Task.find({});
        console.log(`\n--- Tasks (${tasks.length}) ---`);
        let tasksFixed = 0;

        for (const t of tasks) {
            let needsSave = false;

            // Fix missing assignee_email if assignees array exists
            if (!t.assignee_email && t.assignees && t.assignees.length > 0) {
                t.assignee_email = t.assignees[0];
                needsSave = true;
            }

            // Attempt to look up project if missing (simple heuristic)
            if (!t.project_id && t.project_name) {
                const p = await Project.findOne({ name: t.project_name });
                if (p) {
                    t.project_id = p._id.toString();
                    needsSave = true;
                }
            }

            if (needsSave) {
                await t.save();
                tasksFixed++;
            }
        }
        console.log(`Fixed ${tasksFixed} tasks.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugAndFix();
