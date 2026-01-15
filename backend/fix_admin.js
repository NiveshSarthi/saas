const mongoose = require('mongoose');
const { User, Role } = require('./models/index.js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI;

const MODULES = [
    'project', 'tasks', 'subtasks', 'sprints', 'calendar', 'dashboard', 'comments', 'gantt',
    'time_tracking', 'worklog', 'backlog', 'reports', 'files', 'users', 'groups',
    'finance_dashboard', 'receivables', 'payables', 'cash_flow', 'financial_reports',
    'marketing_expenses', 'salary_management', 'timesheet_approval', 'freelancer_reports',
    'marketing_category', 'video_workflow', 'admin'
];

const ACTIONS = ['create', 'read', 'update', 'delete', 'assign', 'manage_password'];

async function fix() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to DB');

        // 1. Create/Update Super Admin Role
        const permissions = {};
        MODULES.forEach(mod => {
            permissions[mod] = {};
            ACTIONS.forEach(act => {
                permissions[mod][act] = true;
            });
        });

        await Role.updateOne(
            { id: 'super_admin' },
            {
                $set: {
                    name: 'Super Admin',
                    permissions,
                    is_system: true,
                    priority: 100
                }
            },
            { upsert: true }
        );
        console.log('Super Admin role updated/created');

        // 2. Fix Admin User
        await User.updateOne(
            { email: 'admin@sarthi.com' },
            {
                $set: {
                    role: 'admin',
                    role_id: 'super_admin',
                    is_active: true
                }
            }
        );
        console.log('admin@sarthi.com updated to super_admin');

        console.log('DONE! Please restart backend if needed and refresh frontend.');
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

fix();
