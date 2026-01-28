
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { Lead, SalesActivity, User } from './models/index.js';

const run = async () => {
    try {
        console.log('Connecting to DB...', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        // Check User Hierarchies
        const usersToCheck = ['client@sarthi.com', 'admin@sarthi.com', 'sales.manager@sarthi.com'];
        const users = await User.find({ email: { $in: usersToCheck } });

        console.log('\n--- User Hierarchy Check ---');
        users.forEach(u => {
            console.log(`User: ${u.email}, Reports To: ${u.reports_to}, Role: ${u.role}`);
        });

        // Check for leads updated TODAY (Jan 28 2026)
        const startOfDay = new Date('2026-01-28T00:00:00.000Z');
        const leads = await Lead.find({
            updated_at: { $gte: startOfDay }
        }).limit(20);

        console.log(`\nFound ${leads.length} leads updated today.`);

        leads.forEach((lead, index) => {
            console.log(`\n--- Lead ${index + 1} ---`);
            console.log(JSON.stringify({
                id: lead._id,
                name: lead.lead_name,
                email: lead.email,
                assigned_to: lead.assigned_to,
                status: lead.status,
                payment_date: lead.payment_date,
                updated_at: lead.updated_at,
                created_date: lead.created_date,
                payment_amount: lead.payment_amount,
                final_amount: lead.final_amount,
                fb_page_id: lead.fb_page_id // check if it's social
            }, null, 2));
        });

        if (leads.length === 0) {
            console.log("No completed leads found. Dumping first 3 leads of ANY status:");
            const allLeads = await Lead.find({}).limit(3);
            console.log(JSON.stringify(allLeads, null, 2));
        }

        // Also check SalesActivity
        console.log("\n--- Sales Activities (Last 5) ---");
        const activities = await SalesActivity.find({}).sort({ timestamp: -1 }).limit(5);
        console.log(JSON.stringify(activities, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
