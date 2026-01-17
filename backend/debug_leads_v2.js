import mongoose from 'mongoose';
import { Lead, FacebookPageConnection } from './models/index.js';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const DEBUG_API_VERSION = 'v21.0';

// Helper for sequential async
const delay = ms => new Promise(res => setTimeout(res, ms));

const fetchUrl = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('--- DB DIAGNOSTIC ---');

        const leadCount = await Lead.countDocuments();
        console.log(`Total Leads in DB: ${leadCount}`);

        console.log('\n--- FACEBOOK CONNECTION ---');
        const pages = await FacebookPageConnection.find();
        console.log(`Connected Pages: ${pages.length}`);

        for (const page of pages) {
            console.log(`\n--------------------------------------------------`);
            console.log(`PAGE: ${page.page_name} (Status: ${page.status})`);
            console.log(`ID: ${page.page_id}`);
            console.log(`Access Token: ${page.access_token ? page.access_token.substring(0, 10) + '...' : 'MISSING'}`);
            console.log(`Stored Forms: ${page.lead_forms.length}`);

            if (page.status !== 'active') {
                console.log('Skipping inactive page.');
                continue;
            }

            // Test LIVE forms fetch
            console.log(`\n[API TEST] Fetching Live Forms list...`);
            try {
                const formsUrl = `https://graph.facebook.com/${DEBUG_API_VERSION}/${page.page_id}/leadgen_forms?access_token=${page.access_token}`;
                const formsData = await fetchUrl(formsUrl);

                if (formsData.error) {
                    console.error('!! FORMS FETCH ERROR:', formsData.error.message);
                } else {
                    const liveForms = formsData.data || [];
                    console.log(`Live Forms Found: ${liveForms.length}`);

                    for (const form of liveForms) {
                        console.log(`\n  > FORM: ${form.name} (${form.id})`);
                        console.log(`    Status: ${form.status}`);

                        // Test LEADS fetch for this form
                        const leadsUrl = `https://graph.facebook.com/${DEBUG_API_VERSION}/${form.id}/leads?access_token=${page.access_token}`;
                        const leadsData = await fetchUrl(leadsUrl);

                        if (leadsData.error) {
                            console.error('    !! LEADS ERROR:', leadsData.error.message);
                        } else {
                            const leadsArray = leadsData.data || [];
                            console.log(`    LIVE LEADS COUNT: ${leadsArray.length}`);
                            if (leadsArray.length > 0) {
                                console.log(`    Latest Lead ID: ${leadsArray[0].id}, Time: ${leadsArray[0].created_time}`);
                            } else {
                                console.log(`    (No leads returned by API)`);
                            }
                        }
                    }
                }

            } catch (e) {
                console.error('!! NETWORK/API FAIL:', e.message);
            }

            await delay(500); // polite delay
        }

        console.log('\n--------------------------------------------------');
        console.log('Done.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Setup Error:', err);
        process.exit(1);
    });
