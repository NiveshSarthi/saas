import { ITSLAConfig, Department, User } from '../models/index.js';

export const seedITSupportData = async () => {
    try {
        console.log('Seeding IT Support data...');

        // 1. Seed SLA Configs
        const slaConfigs = [
            { priority: 'low', sla_hours: 48 },
            { priority: 'medium', sla_hours: 24 },
            { priority: 'high', sla_hours: 8 },
            { priority: 'critical', sla_hours: 4 }
        ];

        for (const config of slaConfigs) {
            await ITSLAConfig.updateOne(
                { priority: config.priority },
                config,
                { upsert: true }
            );
        }
        console.log('SLA Configurations seeded.');

        // 2. Ensure IT Department exists (if not already handled by rbac_seed)
        const itDept = await Department.findOne({ name: /IT|Information Technology/i });
        if (!itDept) {
            itDept = await Department.create({
                name: 'IT Support',
                description: 'Internal IT Support and Infrastructure'
            });
            console.log('IT Support Department created.');
        }

        // 3. Assign IT users to the department
        await User.updateMany(
            { job_title: /IT|Tech|Support/i },
            { department_id: itDept._id.toString() }
        );
        console.log('IT Users linked to IT Support Department.');

        console.log('IT Support seeding complete.');
    } catch (error) {
        console.error('IT Support seeding failed:', error);
    }
};
