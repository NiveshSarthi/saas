
import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

// Connection string provided by user
const uri = "mongodb://task-tracker-dev:BIh2wpRoyRFxrUD3pBK83gd31BUI1LDgq0ChnbqHV60bnE0r0tRD3uEWY4SXnMR7@72.61.248.175:5434/?directConnection=true";

async function checkUser() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(uri);
        console.log('Connected.');

        const collection = mongoose.connection.db.collection('users');
        const user = await collection.findOne({ email: 'heena@niveshsarthi.com' });

        if (user) {
            console.log('User Found:');
            console.log('Email:', user.email);
            console.log('Role ID:', user.role_id);
            console.log('Role (legacy):', user.role);
            console.log('Department ID:', user.department_id);
            console.log('Department Name (on user):', user.department_name);

            // Also fetch department details if we have an ID
            if (user.department_id) {
                const deptCollection = mongoose.connection.db.collection('departments');
                // Try Object ID and String
                let dept = await deptCollection.findOne({ _id: user.department_id });
                if (!dept) {
                    try {
                        dept = await deptCollection.findOne({ _id: new ObjectId(user.department_id) });
                    } catch (e) { console.log('Invalid ObjectID conversion'); }
                }

                if (dept) {
                    console.log('Department Found via ID:', dept.name);
                } else {
                    console.log('Department NOT found via ID:', user.department_id);
                }
            }

        } else {
            console.log('User heena@niveshsarthi.com NOT found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

checkUser();
