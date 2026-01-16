
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { LeaveType } from './models/index.js';

dotenv.config();

async function fixLeaveTypes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await LeaveType.deleteMany({});
        console.log(`Deleted ${result.deletedCount} existing leave types.`);

        console.log('Seeding defaults...');
        const types = await LeaveType.create([
            {
                name: 'Sick Leave',
                code: 'SL',
                description: 'For medical reasons',
                annual_quota: 10,
                is_active: true,
                is_paid: true,
                color: '#EF4444' // Red
            },
            {
                name: 'Casual Leave',
                code: 'CL',
                description: 'For personal matters',
                annual_quota: 12,
                is_active: true,
                is_paid: true,
                color: '#3B82F6' // Blue
            },
            {
                name: 'Privilege Leave',
                code: 'PL',
                description: 'Earned leave',
                annual_quota: 15,
                is_active: true,
                is_paid: true,
                carry_forward: true,
                max_carry_forward_days: 45,
                color: '#10B981' // Green
            },
            {
                name: 'Loss of Pay',
                code: 'LOP',
                description: 'Unpaid leave',
                annual_quota: 365,
                is_active: true,
                is_paid: false,
                color: '#6B7280'
            }
        ]);
        console.log(`Seeded ${types.length} default leave types.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixLeaveTypes();
