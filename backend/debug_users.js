import mongoose from 'mongoose';
import * as models from './models/index.js';

const MONGODB_URI = 'mongodb://127.0.0.1:27017/saas_db';

async function debugUsers() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('\n--- USERS ---');
        const users = await models.User.find({});
        users.forEach(u => {
            console.log(`Email: ${u.email}, Name: ${u.full_name}, Role: ${u.role}, Dept: ${u.department_id}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

debugUsers();
