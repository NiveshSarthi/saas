
import mongoose from 'mongoose';
import { User, Task, Project, Role } from './models/index.js';
import dotenv from 'dotenv';
dotenv.config();

const checkDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sarthi_task_tracker');
        console.log('Connected to MongoDB');

        const userCount = await User.countDocuments();
        const taskCount = await Task.countDocuments();
        const projectCount = await Project.countDocuments();
        const roleCount = await Role.countDocuments();

        console.log('--- Database Stats ---');
        console.log(`Users: ${userCount}`);
        console.log(`Roles: ${roleCount}`);
        console.log(`Projects: ${projectCount}`);
        console.log(`Tasks: ${taskCount}`);
        console.log('----------------------');

        if (taskCount > 0) {
            const lastTask = await Task.findOne().sort({ created_at: -1 });
            console.log('Last Task Created:', lastTask.title);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error checking DB:', error);
        process.exit(1);
    }
};

checkDb();
