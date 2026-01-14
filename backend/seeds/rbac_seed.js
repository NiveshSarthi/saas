
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Role, Department, Project, Group, TaskGroup, Sprint, Tag } from '../models/index.js';
import dotenv from 'dotenv';
dotenv.config();

// Permissions constants copied from frontend to ensure sync
export const MODULES = [
    'project', 'tasks', 'subtasks', 'sprints', 'calendar',
    'dashboard', 'comments', 'gantt', 'time_tracking',
    'worklog', 'backlog', 'reports', 'files', 'users', 'groups',
    'finance_dashboard', 'receivables', 'payables', 'cash_flow',
    'financial_reports', 'marketing_expenses', 'salary_management',
    'timesheet_approval', 'freelancer_reports'
];

export const ACTIONS = ['create', 'read', 'update', 'delete', 'assign', 'manage_password'];

export const ROLES_DATA = {
    super_admin: {
        id: 'super_admin',
        name: 'Super Admin',
        description: 'Full access to all features',
        is_system: true,
        priority: 100,
        permissions: MODULES.reduce((acc, mod) => {
            acc[mod] = ACTIONS.reduce((a, act) => ({ ...a, [act]: true }), {});
            return acc;
        }, {})
    },
    admin: {
        id: 'admin',
        name: 'Admin',
        description: 'Administrative access',
        is_system: true,
        priority: 90,
        permissions: MODULES.reduce((acc, mod) => {
            acc[mod] = ACTIONS.reduce((a, act) => ({ ...a, [act]: true }), {});
            return acc;
        }, {})
    },
    project_manager: {
        id: 'project_manager',
        name: 'Project Manager',
        description: 'Manage projects and team members',
        is_system: true,
        priority: 70,
        permissions: {
            project: { create: true, read: true, update: true, delete: false, assign: true },
            tasks: { create: true, read: true, update: true, delete: true, assign: true },
            subtasks: { create: true, read: true, update: true, delete: true, assign: true },
            sprints: { create: true, read: true, update: true, delete: true, assign: true },
            calendar: { create: true, read: true, update: true, delete: true, assign: false },
            dashboard: { create: false, read: true, update: false, delete: false, assign: false },
            comments: { create: true, read: true, update: true, delete: true, assign: false },
            gantt: { create: false, read: true, update: true, delete: false, assign: false },
            time_tracking: { create: true, read: true, update: true, delete: true, assign: false },
            worklog: { create: true, read: true, update: true, delete: true, assign: false },
            backlog: { create: true, read: true, update: true, delete: true, assign: true },
            reports: { create: true, read: true, update: false, delete: false, assign: false },
            files: { create: true, read: true, update: true, delete: true, assign: false },
            users: { create: false, read: true, update: false, delete: false, assign: true },
            groups: { create: true, read: true, update: true, delete: true, assign: true },
            finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
            receivables: { create: false, read: false, update: false, delete: false, assign: false },
            payables: { create: false, read: false, update: false, delete: false, assign: false },
            cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
            financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
            marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
            salary_management: { create: false, read: false, update: false, delete: false, assign: false }
        }
    },
    team_member: {
        id: 'team_member',
        name: 'Team Member',
        description: 'Regular team member',
        is_system: true,
        priority: 50,
        permissions: {
            project: { create: false, read: true, update: false, delete: false, assign: false },
            tasks: { create: true, read: true, update: true, delete: false, assign: false },
            subtasks: { create: true, read: true, update: true, delete: false, assign: false },
            sprints: { create: false, read: true, update: false, delete: false, assign: false },
            calendar: { create: true, read: true, update: true, delete: true, assign: false },
            dashboard: { create: false, read: true, update: false, delete: false, assign: false },
            comments: { create: true, read: true, update: true, delete: true, assign: false },
            gantt: { create: false, read: true, update: false, delete: false, assign: false },
            time_tracking: { create: true, read: true, update: true, delete: false, assign: false },
            worklog: { create: true, read: true, update: true, delete: false, assign: false },
            backlog: { create: false, read: true, update: false, delete: false, assign: false },
            reports: { create: false, read: true, update: false, delete: false, assign: false },
            files: { create: true, read: true, update: false, delete: false, assign: false },
            users: { create: false, read: false, update: false, delete: false, assign: false },
            groups: { create: false, read: true, update: false, delete: false, assign: false },
            finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
            receivables: { create: false, read: false, update: false, delete: false, assign: false },
            payables: { create: false, read: false, update: false, delete: false, assign: false },
            cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
            financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
            marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
            salary_management: { create: false, read: false, update: false, delete: false, assign: false }
        }
    },
    freelancer: {
        id: 'freelancer',
        name: 'Freelancer',
        description: 'External freelancer with time tracking access',
        is_system: true,
        priority: 20,
        permissions: {
            project: { create: false, read: true, update: false, delete: false, assign: false },
            tasks: { create: false, read: true, update: true, delete: false, assign: false },
            subtasks: { create: false, read: true, update: false, delete: false, assign: false },
            sprints: { create: false, read: true, update: false, delete: false, assign: false },
            calendar: { create: false, read: true, update: false, delete: false, assign: false },
            dashboard: { create: false, read: true, update: false, delete: false, assign: false },
            comments: { create: true, read: true, update: true, delete: false, assign: false },
            gantt: { create: false, read: true, update: false, delete: false, assign: false },
            time_tracking: { create: true, read: true, update: true, delete: true, assign: false },
            worklog: { create: true, read: true, update: true, delete: true, assign: false },
            backlog: { create: false, read: true, update: false, delete: false, assign: false },
            reports: { create: false, read: true, update: false, delete: false, assign: false },
            files: { create: false, read: true, update: false, delete: false, assign: false },
            users: { create: false, read: false, update: false, delete: false, assign: false },
            groups: { create: false, read: false, update: false, delete: false, assign: false },
            finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
            receivables: { create: false, read: false, update: false, delete: false, assign: false },
            payables: { create: false, read: false, update: false, delete: false, assign: false },
            cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
            financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
            marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
            salary_management: { create: false, read: false, update: false, delete: false, assign: false }
        }
    },
    hr: {
        id: 'hr',
        name: 'HR Manager',
        description: 'Human Resources management access',
        is_system: true,
        priority: 60,
        permissions: {
            project: { create: false, read: true, update: false, delete: false, assign: false },
            tasks: { create: false, read: true, update: false, delete: false, assign: false },
            subtasks: { create: false, read: true, update: false, delete: false, assign: false },
            sprints: { create: false, read: true, update: false, delete: false, assign: false },
            calendar: { create: false, read: true, update: false, delete: false, assign: false },
            dashboard: { create: false, read: true, update: false, delete: false, assign: false },
            comments: { create: false, read: true, update: false, delete: false, assign: false },
            gantt: { create: false, read: true, update: false, delete: false, assign: false },
            time_tracking: { create: false, read: true, update: false, delete: false, assign: false },
            worklog: { create: false, read: true, update: false, delete: false, assign: false },
            backlog: { create: false, read: true, update: false, delete: false, assign: false },
            reports: { create: true, read: true, update: false, delete: false, assign: false },
            files: { create: true, read: true, update: true, delete: true, assign: false },
            users: { create: true, read: true, update: true, delete: false, assign: true },
            groups: { create: true, read: true, update: true, delete: true, assign: true },
            finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
            receivables: { create: false, read: false, update: false, delete: false, assign: false },
            payables: { create: false, read: false, update: false, delete: false, assign: false },
            cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
            financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
            marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
            salary_management: { create: true, read: true, update: true, delete: true, assign: true },
            timesheet_approval: { create: true, read: true, update: true, delete: true, assign: true },
            freelancer_reports: { create: true, read: true, update: false, delete: false, assign: false }
        }
    },
    client: {
        id: 'client',
        name: 'Client',
        description: 'Read-only access',
        is_system: true,
        priority: 10,
        restrict_project_visibility: true,
        permissions: {
            project: { create: false, read: true, update: false, delete: false, assign: false },
            tasks: { create: false, read: true, update: false, delete: false, assign: false },
            subtasks: { create: false, read: true, update: false, delete: false, assign: false },
            sprints: { create: false, read: true, update: false, delete: false, assign: false },
            calendar: { create: false, read: true, update: false, delete: false, assign: false },
            dashboard: { create: false, read: true, update: false, delete: false, assign: false },
            comments: { create: true, read: true, update: false, delete: false, assign: false },
            gantt: { create: false, read: true, update: false, delete: false, assign: false },
            time_tracking: { create: false, read: true, update: false, delete: false, assign: false },
            worklog: { create: false, read: true, update: false, delete: false, assign: false },
            backlog: { create: false, read: true, update: false, delete: false, assign: false },
            reports: { create: false, read: true, update: false, delete: false, assign: false },
            files: { create: false, read: true, update: false, delete: false, assign: false },
            users: { create: false, read: false, update: false, delete: false, assign: false },
            groups: { create: false, read: false, update: false, delete: false, assign: false },
            finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
            receivables: { create: false, read: false, update: false, delete: false, assign: false },
            payables: { create: false, read: false, update: false, delete: false, assign: false },
            cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
            financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
            marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
            salary_management: { create: false, read: false, update: false, delete: false, assign: false }
        }
    }
};

const DUMMY_USERS = [
    {
        email: 'admin@sarthi.com',
        full_name: 'Admin User',
        role: 'admin',
        role_id: 'admin',
        job_title: 'Administrator',
        is_active: true
    },
    {
        email: 'pm@sarthi.com',
        full_name: 'Project Manager',
        role: 'user', // System role
        role_id: 'project_manager',
        job_title: 'PM',
        is_active: true
    },
    {
        email: 'user@sarthi.com',
        full_name: 'Regular User',
        role: 'user',
        role_id: 'team_member',
        job_title: 'Developer',
        is_active: true
    },
    {
        email: 'client@sarthi.com',
        full_name: 'Client User',
        role: 'user',
        role_id: 'client',
        job_title: 'Client Stakeholder',
        is_active: true
    },
    {
        email: 'sales.manager@sarthi.com',
        full_name: 'Sales Manager',
        role: 'user',
        role_id: 'team_member', // Assuming custom role eventually, but uses team permissions + specific code checks
        job_title: 'Sales Manager', // Code checks this specific string
<<<<<<< HEAD
        department_id: 'dept_sales',
        is_active: true
=======
        department_id: 'dept_sales'
    },
    {
        email: 'freelancer@sarthi.com',
        full_name: 'Test Freelancer',
        role: 'user',
        role_id: 'freelancer',
        job_title: 'Freelancer'
    },
    {
        email: 'hr@niveshsarthi.com',
        full_name: 'HR Manager',
        role: 'user',
        role_id: 'hr',
        job_title: 'HR Manager',
        department_id: 'dept_hr'
>>>>>>> origin/main
    }
];


const DUMMY_DEPARTMENTS = [
    { name: 'Engineering', description: 'Software Development', manager_email: 'pm@sarthi.com' },
    { name: 'Sales', description: 'Sales and Marketing', manager_email: 'sales.manager@sarthi.com' },
    { name: 'HR', description: 'Human Resources', manager_email: 'admin@sarthi.com' },
    { name: 'Marketing', description: 'Digital Marketing & Content', manager_email: 'admin@sarthi.com' }
];

const DUMMY_PROJECTS = [
    {
        name: 'Syndicate',
        description: 'Main Task Tracker Project',
        status: 'active',
        color: '#6366F1',
        members: ['admin@sarthi.com', 'pm@sarthi.com', 'user@sarthi.com'],
        start_date: new Date(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    },
    {
        name: 'Website Redesign',
        description: 'New Corporate Website',
        status: 'active',
        color: '#EC4899',
        members: ['admin@sarthi.com', 'user@sarthi.com.com'],
        start_date: new Date(),
        end_date: new Date(new Date().setMonth(new Date().getMonth() + 3))
    },
    {
        name: 'Marketing_Collateral',
        description: 'Marketing Videos and Content',
        status: 'active',
        color: '#8B5CF6',
        members: ['admin@sarthi.com', 'sales.manager@sarthi.com'],
        start_date: new Date(),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    }
];

const DUMMY_GROUPS = [
    { name: 'Frontend Team', members: ['user@sarthi.com'] },
    { name: 'Backend Team', members: ['pm@sarthi.com'] },
    { name: 'Digital Marketing', members: ['sales.manager@sarthi.com', 'admin@sarthi.com'] }
];

const DUMMY_TAGS = [
    { name: 'urgent', color: 'red', project_id: null },
    { name: 'bug', color: 'orange', project_id: null },
    { name: 'feature', color: 'blue', project_id: null },
    { name: 'marketing', color: 'purple', project_id: null }
];

export const seedData = async () => {
    try {
        console.log('Starting seed operation...');

        // Upsert Roles
        for (const roleKey in ROLES_DATA) {
            const role = ROLES_DATA[roleKey];
            await Role.updateOne({ id: role.id }, role, { upsert: true });
            console.log(`Upserted Role: ${role.name}`);
        }

        // Upsert Departments
        for (const dept of DUMMY_DEPARTMENTS) {
            let d = await Department.findOne({ name: dept.name });
            if (!d) {
                d = await Department.create(dept);
                console.log(`Created Department: ${dept.name}`);
            }
            // Update users with department IDs
            if (dept.name === 'Sales') {
                await User.updateOne({ email: 'sales.manager@sarthi.com' }, { department_id: d._id.toString() });
            }
            if (dept.name === 'HR') {
                await User.updateOne({ email: 'hr@niveshsarthi.com' }, { department_id: d._id.toString() });
            }
        }

        // Upsert Projects
        for (const proj of DUMMY_PROJECTS) {
            const existing = await Project.findOne({ name: proj.name });
            if (!existing) {
                const newProj = await Project.create(proj);
                console.log(`Created Project: ${proj.name}`);

                // Add default Task Groups for Syndicate
                if (proj.name === 'Syndicate') {
                    await TaskGroup.create([
                        { name: 'Backlog', project_id: newProj._id, color: '#94a3b8', order: 0 },
                        { name: 'To Do', project_id: newProj._id, color: '#3b82f6', order: 1 },
                        { name: 'In Progress', project_id: newProj._id, color: '#f59e0b', order: 2 },
                        { name: 'Done', project_id: newProj._id, color: '#10b981', order: 3 }
                    ]);
                }
            }
        }

        // Upsert Groups
        for (const group of DUMMY_GROUPS) {
            await Group.updateOne({ name: group.name }, group, { upsert: true });
            console.log(`Upserted Group: ${group.name}`);
        }

        // Upsert Tags
        for (const tag of DUMMY_TAGS) {
            await Tag.updateOne({ name: tag.name }, tag, { upsert: true });
        }

        // Upsert Users (Last to ensure refs might exist, though we mainly rely on strings)
        for (const user of DUMMY_USERS) {
            await User.updateOne({ email: user.email }, user, { upsert: true });
            console.log(`Upserted User: ${user.email}`);
        }

        console.log('Seeding complete');
    } catch (error) {
        console.error('Seeding failed:', error);
        throw error;
    }
};
