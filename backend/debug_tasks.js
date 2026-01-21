import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Task, Activity } from './models/index.js';
import fs from 'fs';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const logStream = fs.createWriteStream('debug_output.txt');

        logStream.write('Connected to DB\n');

        const tasks = await Task.find({}).limit(10).sort({ _id: -1 }); // Get latest 10 tasks

        logStream.write('--- Inspecting Tasks & Activities ---\n');
        for (const task of tasks) {
            logStream.write(`ID: ${task._id}\n`);
            logStream.write(`Title: ${task.title}\n`);
            logStream.write(`Created By: ${task.created_by}\n`);

            // Find activity for this task
            const activity = await Activity.findOne({
                $or: [{ entity_id: task._id }, { task_id: task._id }],
                action: 'created'
            });

            if (activity) {
                logStream.write(`Activity Found: Yes\n`);
                logStream.write(`Activity User Email: ${activity.user_email}\n`);
                logStream.write(`Activity Actor Email: ${activity.actor_email}\n`); // Check if stored casually
                logStream.write(`Activity Keys: ${Object.keys(activity.toObject()).join(', ')}\n`);
            } else {
                logStream.write(`Activity Found: No\n`);
            }
            logStream.write('-------------------------\n');
        }

        logStream.end();
        console.log("Done writing to file");

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
