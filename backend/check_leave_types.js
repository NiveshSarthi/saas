
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { LeaveType } from './models/index.js';

dotenv.config();

async function checkLeaveTypes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const types = await LeaveType.find({});
        console.log(`Found ${types.length} leave types`);
        types.forEach(t => {
            console.log(`- ${t.name} (${t.code}): Active=${t.is_active}, Paid=${t.is_paid}`);
        });

        if (types.length === 0) {
            console.log('No leave types found. Seeding defaults...');
            await LeaveType.create([
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
            console.log('Seeded default leave types.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkLeaveTypes();
