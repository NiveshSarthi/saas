import mongoose from 'mongoose';
import * as models from './models/index.js';

const { Department, ITTicket, User } = models;

const PROD_URI = 'mongodb://mongodb-prod:9Dc8fhahK7xC1dtQKbx9zXlYAM3YERTowwv18fu0J5g8AwamEW5n8k9C9Qvrny93@72.61.248.175:5435/?directConnection=true';

async function run() {
    try {
        await mongoose.connect(PROD_URI);
        console.log('Connected to PROD DB');

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

        console.log(`Found ${tickets.length} tickets to check`);

        for (const ticket of tickets) {
            const tech = await User.findOne({ email: ticket.assigned_to });
            if (tech) {
                ticket.assigned_to_name = tech.full_name || tech.email;
                await ticket.save();
                console.log(`Fixed ticket ${ticket.ticket_id}: ${ticket.assigned_to_name}`);
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
