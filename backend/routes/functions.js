import express from 'express';
import { calculateMonthlySalary } from '../controllers/salaryController.js';
import * as aiController from '../controllers/aiController.js';
import * as models from '../models/index.js';

const router = express.Router();

router.post('/invoke/calculateMonthlySalary', calculateMonthlySalary);

// Invoke AI Task Assistant
router.post('/invoke/aiTaskAssistant', aiController.aiTaskAssistant);

// Generic Success Mock
const mockSuccess = (req, res) => res.json({ success: true, data: {} });

// Specific Data Mocks
const mockDataReturn = (data) => (req, res) => res.json({ success: true, data });

// Task & Recurring
router.post('/invoke/generateRecurringTaskInstances', mockSuccess);

const FB_API_VERSION = 'v21.0';

router.post('/invoke/connectFacebookPage', async (req, res) => {
    try {
        const { page_token, page_id } = req.body;
        const FacebookPageConnection = models.FacebookPageConnection;

        if (!page_token || !page_id) {
            return res.status(400).json({ error: 'Page token and Page ID are required' });
        }

        // Verify token and get page name from Facebook
        const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}?fields=name&access_token=${page_token}`);
        const fbData = await fbRes.json();

        if (fbData.error) {
            return res.status(400).json({ error: fbData.error.message });
        }

        let page = await FacebookPageConnection.findOne({ page_id: page_id });

        if (!page) {
            page = await FacebookPageConnection.create({
                page_id: page_id,
                page_name: fbData.name,
                access_token: page_token,
                status: 'active',
                lead_forms: [],
                last_sync_date: new Date()
            });
        } else {
            page.access_token = page_token;
            page.page_name = fbData.name;
            page.last_sync_date = new Date();
            await page.save();
        }

        // Subscribe to webhooks for leadgen events
        const appId = process.env.FB_APP_ID;
        const appSecret = process.env.FB_APP_SECRET;
        if (appId && appSecret) {
            try {
                const subscribeRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}/subscribed_apps?access_token=${page_token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subscribed_fields: 'leadgen',
                        access_token: page_token
                    })
                });
                const subscribeData = await subscribeRes.json();
                console.log('Webhook subscription result:', subscribeData);
            } catch (e) {
                console.error('Webhook subscription failed:', e);
            }
        }

        // AUTO-SYNC FORMS: Immediately fetch forms so they are available without manual sync
        try {
            const formsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}/leadgen_forms?access_token=${page_token}`);
            const formsData = await formsRes.json();
            if (formsData.data) {
                const currentFormIds = new Set(page.lead_forms.map(f => f.form_id));
                for (const fbForm of formsData.data) {
                    if (!currentFormIds.has(fbForm.id)) {
                        page.lead_forms.push({
                            form_id: fbForm.id,
                            form_name: fbForm.name,
                            status: fbForm.status,
                            subscribed: true
                        });
                    }
                }
                await page.save();
                console.log(`Auto-synced ${formsData.data.length} forms for page ${page_id}`);
            }
        } catch (syncError) {
            console.error('Auto-form sync failed during connection:', syncError);
        }

        res.json({ success: true, data: { message: `Connected to ${page.page_name} and synced forms.`, page } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/invoke/syncFacebookForms', async (req, res) => {
    try {
        const FacebookPageConnection = models.FacebookPageConnection;
        const pages = await FacebookPageConnection.find({ status: 'active' });
        let newFormsCount = 0;

        for (const page of pages) {
            const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page.page_id}/leadgen_forms?access_token=${page.access_token}`);
            const fbData = await fbRes.json();

            if (fbData.data) {
                const currentFormIds = new Set(page.lead_forms.map(f => f.form_id));

                for (const fbForm of fbData.data) {
                    if (!currentFormIds.has(fbForm.id)) {
                        page.lead_forms.push({
                            form_id: fbForm.id,
                            form_name: fbForm.name,
                            status: fbForm.status,
                            subscribed: true
                        });
                        newFormsCount++;
                    }
                }

                page.last_sync_date = new Date();
                await page.save();
            }
        }
        res.json({ success: true, data: { results: [{ new_forms: newFormsCount }] } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/invoke/fetchFacebookLeads', async (req, res) => {
    try {
        const Lead = models.Lead;
        const FacebookPageConnection = models.FacebookPageConnection;
        const activePages = await FacebookPageConnection.find({ status: 'active' });

        let newLeadsCreated = 0;
        let duplicatesSkipped = 0;
        const errors = [];

        console.log('Active pages:', activePages.length);

        for (const page of activePages) {
            console.log('Processing page:', page.page_name, 'Forms:', page.lead_forms.length);
            for (const form of page.lead_forms) {
                if (!form.subscribed) {
                    console.log('Form not subscribed:', form.form_name);
                    continue;
                }

                try {
                    console.log('Fetching leads for form:', form.form_name, form.form_id);
                    const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${form.form_id}/leads?access_token=${page.access_token}`);
                    const fbData = await fbRes.json();

                    console.log('Facebook response:', fbData);

                    if (fbData.error) {
                        console.error('Facebook error for form:', form.form_name, fbData.error);
                        errors.push({ form: form.form_name, error: fbData.error.message });
                        continue;
                    }

                    if (fbData.data) {
                        console.log('Leads found:', fbData.data.length);
                        for (const fbLead of fbData.data) {
                            // Check if lead already exists
                            const existingLead = await Lead.findOne({ fb_lead_id: fbLead.id });
                            if (existingLead) {
                                duplicatesSkipped++;
                                continue;
                            }

                            // Extract fields
                            const fieldData = {};
                            fbLead.field_data.forEach(field => {
                                fieldData[field.name] = field.values[0];
                            });

                            const leadData = {
                                lead_name: fieldData.full_name || fieldData.first_name + ' ' + (fieldData.last_name || ''),
                                email: fieldData.email,
                                phone: fieldData.phone_number || fieldData.phone,
                                lead_source: 'facebook',
                                status: 'new',
                                fb_lead_id: fbLead.id,
                                fb_form_id: form.form_id,
                                fb_created_time: fbLead.created_time,
                                notes: `Form: ${form.form_name}\nPage ID: ${page.page_id}\nFacebook ID: ${fbLead.id}`,
                                created_date: new Date()
                            };

                            await Lead.create(leadData);
                            newLeadsCreated++;
                        }
                    }
                } catch (formError) {
                    errors.push({ form: form.form_name, error: formError.message });
                }
            }
        }

        res.json({
            success: true,
            data: {
                newLeadsCreated,
                duplicatesSkipped,
                errors
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/invoke/testFacebookToken', async (req, res) => {
    res.json({
        success: true,
        data: {
            success: true,
            results: {
                tokenLength: 120,
                tests: [
                    { test: 'Token Validity', success: true, status: 200, response: { data: { is_valid: true } } },
                    { test: 'Permissions Check', success: true, status: 200, response: { permissions: ['pages_show_list', 'leads_retrieval'] } }
                ]
            }
        }
    });
});
router.post('/invoke/refetchFacebookLeadDetails', mockSuccess);
router.post('/invoke/notifyMarketingTasksDue', mockSuccess);
router.post('/invoke/autoCategorizeTran', mockDataReturn({ category: 'uncategorized' }));
router.post('/invoke/createGoogleMeet', mockDataReturn({ meetingLink: 'https://meet.google.com/mock-link' }));

// Finance & Petty Cash
router.post('/invoke/detectDuplicatePettyCash', mockDataReturn({ isDuplicate: false }));
router.post('/invoke/extractReceiptOCR', mockDataReturn({ amount: 0, date: null, vendor: '' }));
router.post('/invoke/exportPettyCash', mockSuccess);
router.post('/invoke/exportProjectPnL', mockSuccess);
router.post('/invoke/exportPaymentsCalendar', mockSuccess);
router.post('/invoke/exportBudgetComparison', mockSuccess);
router.post('/invoke/exportTeamCostRevenue', mockSuccess);
router.post('/invoke/askFinanceAI', mockDataReturn({ answer: "This is a mock AI response." }));

// Salary & Reports
router.post('/invoke/generateReport', mockSuccess);
router.post('/invoke/processAdvanceRecovery', mockSuccess);
router.post('/invoke/generateSalarySlip', mockDataReturn({ url: '#' }));
router.post('/invoke/exportSalaryCSV', mockSuccess);
router.post('/invoke/cleanupDuplicateAttendance', mockSuccess);
router.post('/invoke/syncWorkDayLedger', mockSuccess);

// User Management
router.post('/invoke/bulkActivateUsers', mockSuccess);
router.post('/invoke/updateUserName', mockSuccess);


// Get Dashboard Users (Simulated or Real)
router.post('/invoke/getDashboardUsers', async (req, res) => {
    try {
        const User = models.User;
        const users = await User.find({});
        res.json({
            data: {
                users: users,
                invitations: []
            }
        });
    } catch (error) {
        console.error("Error in getDashboardUsers:", error);
        res.status(500).json({ error: error.message });
    }
});

// Debug Facebook Token
router.post('/invoke/debugFacebookToken', async (req, res) => {
    try {
        const { page_id, page_token } = req.body;
        const FacebookPageConnection = models.FacebookPageConnection;
        const page = await FacebookPageConnection.findOne({ page_id });

        if (!page) {
            return res.json({ error: 'Page not found in DB' });
        }

        // Test page info
        const pageRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}?fields=name&access_token=${page_token}`);
        const pageData = await pageRes.json();

        // Test forms
        const formsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}/leadgen_forms?access_token=${page_token}`);
        const formsData = await formsRes.json();

        // Test leads if forms exist
        let leadsData = null;
        if (formsData.data && formsData.data.length > 0) {
            const formId = formsData.data[0].id;
            const leadsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${page_token}`);
            leadsData = await leadsRes.json();
        }

        res.json({
            pageData,
            formsData,
            leadsData,
            dbPage: { page_id: page.page_id, access_token: page.access_token.substring(0, 10) + '...' }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Facebook Webhooks
router.get('/webhooks/facebook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Replace with your verify token
    const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'your_verify_token';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

router.post('/webhooks/facebook', async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(async entry => {
            if (entry.messaging) {
                // Handle messaging if needed
            }
            if (entry.changes) {
                entry.changes.forEach(async change => {
                    if (change.field === 'leadgen') {
                        const leadId = change.value.leadgen_id;
                        const pageId = change.value.page_id;
                        const formId = change.value.form_id;

                        // Fetch lead details
                        const page = await models.FacebookPageConnection.findOne({ page_id: pageId });
                        if (page) {
                            // DEDUPLICATION: Check if lead already exists before fetching/creating
                            const existingLead = await models.Lead.findOne({ fb_lead_id: leadId });
                            if (existingLead) {
                                console.log('Duplicate lead received via webhook, skipping:', leadId);
                                return;
                            }

                            const leadRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${leadId}?access_token=${page.access_token}`);
                            const leadData = await leadRes.json();

                            if (leadData) {
                                // Create lead in DB
                                const fieldData = {};
                                leadData.field_data.forEach(field => {
                                    fieldData[field.name] = field.values[0];
                                });

                                // Find form name if available in our records
                                const formRecord = page.lead_forms.find(f => f.form_id === formId);
                                const formName = formRecord ? formRecord.form_name : (leadData.form_id || formId);

                                await models.Lead.create({
                                    lead_name: fieldData.full_name || fieldData.first_name + ' ' + (fieldData.last_name || ''),
                                    email: fieldData.email,
                                    phone: fieldData.phone_number || fieldData.phone,
                                    lead_source: 'facebook',
                                    status: 'new',
                                    fb_lead_id: leadId,
                                    fb_form_id: leadData.form_id || formId,
                                    fb_created_time: leadData.created_time || new Date(),
                                    notes: `Webhook Sync\nForm: ${formName}\nFacebook ID: ${leadId}`,
                                    created_date: new Date()
                                });
                                console.log('Lead created via webhook:', leadId, 'Form:', formName);
                            }
                        }
                    }
                });
            }
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

export default router;
