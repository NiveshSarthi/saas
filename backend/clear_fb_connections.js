import mongoose from 'mongoose';
import { FacebookPageConnection } from './models/index.js';
import dotenv from 'dotenv';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        const result = await FacebookPageConnection.deleteMany({});
        console.log(`Deleted ${result.deletedCount} Facebook page connections.`);
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
