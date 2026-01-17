import mongoose from 'mongoose';
import { Organization } from './models/index.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const count = await Organization.countDocuments();
        if (count === 0) {
            console.log('No organization found. Creating default...');
            await Organization.create({
                name: 'My Organization',
                settings: {
                    autoAssignPaused: false
                }
            });
            console.log('Default organization created.');
        } else {
            console.log('Organization already exists.');
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
