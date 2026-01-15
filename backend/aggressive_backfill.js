
import mongoose from 'mongoose';
import { User, Department } from './models/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi_task_tracker';

async function aggressiveBackfill() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected.');

        const departments = await Department.find({});
        const deptMap = {};
        departments.forEach(d => deptMap[d.name.toLowerCase()] = d._id.toString());
        // Add "IT " with space if it exists in log "IT  (ID: ...)"
        // But map key logic: 'it'
        const itId = departments.find(d => d.name.trim() === 'IT')?._id.toString();
        const saasId = departments.find(d => d.name.trim() === 'SAAS')?._id.toString() || itId; // Fallback
        const marketingId = deptMap['marketing'];
        const hrId = deptMap['hr'];

        const users = await User.find({});
        let fixedCount = 0;

        for (const u of users) {
            let oldDept = u.department_id;
            let newDept = oldDept;

            if (!oldDept || oldDept === 'none' || oldDept === 'MISSING') {
                if (u.email === 'ratnakerkumar56@gmail.com') newDept = itId;
                else if (u.email === 'abhinav@niveshsarthi.com') newDept = saasId;
                else if (u.email === 'vishal@niveshsarthi.com') newDept = saasId;
                else if (u.email === 'jayant@niveshsarthi.com') newDept = marketingId;
                else if (u.email === 'nupur@niveshsarthi.com') newDept = marketingId;
                else if (u.email === 'admin@sarthi.com') newDept = itId;
                else if (u.email === 'hr@niveshsarthi.com') newDept = hrId;
            }

            if (newDept !== oldDept) {
                u.department_id = newDept;
                await u.save();
                console.log(`Updated ${u.email}: ${oldDept} -> ${newDept}`);
                fixedCount++;
            }
        }

        console.log(`Fixed ${fixedCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

aggressiveBackfill();
