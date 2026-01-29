import mongoose from 'mongoose';
import * as models from './models/index.js';
import dotenv from 'dotenv';
dotenv.config();

const { Department, ITTicket, User } = models;

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        // 1. Update IT Department manager
        const result = await Department.updateOne(
            { name: /IT|Information Technology|Tech/i },
            { $set: { manager_email: 'satpal@niveshsarthi.com' } }
        );
        console.log('Department update:', result);

        // 2. Fix existing tickets missing assigned_to_name
        const tickets = await ITTicket.find({
            assigned_to: { $exists: true, $ne: null }
        });

        console.log(`Found ${tickets.length} tickets to fix`);

        for (const ticket of tickets) {
            const tech = await User.findOne({ email: ticket.assigned_to });
            if (tech) {
                ticket.assigned_to_name = tech.full_name || tech.email;
                await ticket.save();
                console.log(`Fixed ticket ${ticket.ticket_id}`);
            }
        }

        console.log('Update complete');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
