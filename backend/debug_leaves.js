import mongoose from 'mongoose';
import * as models from './models/index.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/saas_db';

async function debugLeaves() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('\n--- LEAVE TYPES ---');
        const types = await models.LeaveType.find({});
        types.forEach(t => {
            console.log(JSON.stringify(t.toJSON(), null, 2));
        });

        console.log('\n--- LEAVE BALANCES ---');
        const balances = await models.LeaveBalance.find({});
        balances.forEach(b => {
            console.log(JSON.stringify(b.toJSON(), null, 2));
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugLeaves();
