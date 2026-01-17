import mongoose from 'mongoose';
import { Lead, FacebookPageConnection } from './models/index.js';
import dotenv from 'dotenv';

dotenv.config();

const DEBUG_API_VERSION = 'v21.0';

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('--- DB DIAGNOSTIC ---');

        // 1. Check Lead Count
        const leadCount = await Lead.countDocuments();
        console.log(`Total Leads in DB: ${leadCount}`);

        if (leadCount > 0) {
            const sample = await Lead.findOne();
            console.log('Sample Lead:', JSON.stringify(sample, null, 2));
        }

        // 2. Check Connection
        console.log('\n--- FACEBOOK CONNECTION ---');
        const pages = await FacebookPageConnection.find();
        console.log(`Connected Pages: ${pages.length}`);

        for (const page of pages) {
            console.log(`Page: ${page.page_name} (ID: ${page.page_id}) - Status: ${page.status}`);
            console.log(`Forms detected: ${page.lead_forms.length}`);

            // 3. Test API for each form
            if (page.status === 'active' && page.lead_forms.length > 0) {
                for (const form of page.lead_forms) {
                    console.log(`\nTesting Form: ${form.form_name} (${form.form_id})`);
                    try {
                        const url = `https://graph.facebook.com/${DEBUG_API_VERSION}/${form.form_id}/leads?access_token=${page.access_token}`;
                        // console.log(`Fetching: ${url}`); // Don't log full token in artifact if possible, but safe here locally

                        const res = await fetch(url);
                        const data = await res.json();

                        if (data.error) {
                            console.error('API Error:', data.error.message);
                        } else {
                            console.log(`API Lead Count: ${data.data ? data.data.length : 0}`);
                            if (data.data && data.data.length > 0) {
                                console.log('First Lead ID:', data.data[0].id);
                                console.log('First Lead Created Time:', data.data[0].created_time);
                            }
                        }
                    } catch (e) {
                        console.error('Fetch Failed:', e.message);
                    }
                }
            }
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Setup Error:', err);
        process.exit(1);
    });
