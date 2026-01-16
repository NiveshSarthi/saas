import mongoose from 'mongoose';
import * as models from './models/index.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/saas_db';

async function inspectBalances() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Assuming the user email from the screenshot (ratnakerkumar56@gmail.com)
        // or just list all balances to be safe
        const balances = await models.LeaveBalance.find({});

        console.log(`Found ${balances.length} balance records.`);

        for (const b of balances) {
            console.log(`User: ${b.user_email}, Type: ${b.leave_type_id}, Total: ${b.total_allocated}, Avail: ${b.available}, Used: ${b.used}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

inspectBalances();
