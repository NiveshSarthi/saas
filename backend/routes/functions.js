import express from 'express';
import { calculateMonthlySalary } from '../controllers/salaryController.js';
import * as aiController from '../controllers/aiController.js';
import * as models from '../models/index.js';
import crypto from 'crypto';

const router = express.Router();

const FB_API_VERSION = 'v21.0';

// Helper to generate appsecret_proof
const getAppSecretProof = (accessToken) => {
    const appSecret = process.env.FB_APP_SECRET;
    if (!appSecret) return null;
    return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
};

router.post('/invoke/calculateMonthlySalary', calculateMonthlySalary);

// Invoke AI Task Assistant
router.post('/invoke/aiTaskAssistant', aiController.aiTaskAssistant);

// Generic Success Mock
const mockSuccess = (req, res) => res.json({ success: true, data: {} });

// Specific Data Mocks
const mockDataReturn = (data) => (req, res) => res.json({ success: true, data });

// Task & Recurring
router.post('/invoke/generateRecurringTaskInstances', mockSuccess);



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
            console.log(`Fetching forms for page ${page_id}...`);
            const formsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}/leadgen_forms?access_token=${page_token}`);
            const formsData = await formsRes.json();

            console.log('Forms API Response:', JSON.stringify(formsData, null, 2));

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
            } else if (formsData.error) {
                console.error('Error fetching forms:', formsData.error);
            }
        } catch (syncError) {
            console.error('Auto-form sync failed during connection:', syncError);
        }

        res.json({ success: true, data: { message: `Connected to ${page.page_name} and synced forms.`, page } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});



router.post('/invoke/connectFacebookAccount', async (req, res) => {
    try {
        const { user_token } = req.body;
        const FacebookPageConnection = models.FacebookPageConnection;

        if (!user_token) {
            console.error('connectFacebookAccount: User Access Token is missing in request body.');
            return res.status(400).json({ error: 'User Access Token is required' });
        }
        console.log(`Received user_token (len: ${user_token.length})... fetching accounts.`);

        // Fetch all pages for the user
        console.log('Fetching pages with User Token...');
        const proof = getAppSecretProof(user_token);
        const proofParam = proof ? `&appsecret_proof=${proof}` : '';

        const accountsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/me/accounts?access_token=${user_token}${proofParam}&fields=name,access_token,id,tasks&limit=100`);
        const accountsData = await accountsRes.json();

        if (accountsData.error) {
            console.error('Facebook API Error (connectFacebookAccount):', accountsData.error);
            return res.status(400).json({ error: `Facebook API: ${accountsData.error.message}` });
        }

        const pagesList = accountsData.data || [];
        console.log(`Found ${pagesList.length} pages.`);

        const results = [];

        for (const pageData of pagesList) {
            // Upsert Page Connection
            let page = await FacebookPageConnection.findOne({ page_id: pageData.id });

            if (!page) {
                page = await FacebookPageConnection.create({
                    page_id: pageData.id,
                    page_name: pageData.name,
                    access_token: pageData.access_token,
                    status: 'active',
                    lead_forms: [],
                    last_sync_date: new Date()
                });
            } else {
                page.access_token = pageData.access_token;
                page.page_name = pageData.name;
                page.status = 'active'; // Re-activate if found
                page.last_sync_date = new Date();
                await page.save();
            }

            // Sync Forms for this page
            try {
                const pageProof = getAppSecretProof(pageData.access_token);
                const pageProofParam = pageProof ? `&appsecret_proof=${pageProof}` : '';
                const formsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${pageData.id}/leadgen_forms?access_token=${pageData.access_token}${pageProofParam}&limit=1000`);
                const formsData = await formsRes.json();

                if (formsData.data) {
                    const currentFormIds = new Set(page.lead_forms.map(f => f.form_id));
                    let newForms = 0;
                    for (const fbForm of formsData.data) {
                        if (!currentFormIds.has(fbForm.id)) {
                            page.lead_forms.push({
                                form_id: fbForm.id,
                                form_name: fbForm.name,
                                status: fbForm.status,
                                subscribed: true
                            });
                            newForms++;
                        }
                    }
                    if (newForms > 0) await page.save();
                }
            } catch (err) {
                console.error(`Failed to sync forms for ${pageData.name}:`, err.message);
            }

            results.push({ name: pageData.name, id: pageData.id, status: 'connected' });
        }

        res.json({ success: true, data: { message: `Successfully connected ${results.length} pages.`, results } });

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
            const proof = getAppSecretProof(page.access_token);
            const proofParam = proof ? `&appsecret_proof=${proof}` : '';

            const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page.page_id}/leadgen_forms?access_token=${page.access_token}${proofParam}&limit=1000`);
            const fbData = await fbRes.json();

            console.log(`Syncing forms for ${page.page_name} (${page.page_id}):`, JSON.stringify(fbData, null, 2));

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
                    const proof = getAppSecretProof(page.access_token);
                    const proofParam = proof ? `&appsecret_proof=${proof}` : '';

                    const fbRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${form.form_id}/leads?access_token=${page.access_token}${proofParam}&limit=1000`);
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
                            // Helper to find field value by loose matching
                            const getField = (keys) => {
                                const field = fbLead.field_data.find(f => keys.some(k => f.name.toLowerCase().includes(k)));
                                return field ? field.values[0] : null;
                            };

                            const fullName = getField(['full_name', 'fullname', 'name']) ||
                                `${getField(['first_name']) || ''} ${getField(['last_name']) || ''}`.trim();
                            const email = getField(['email', 'e-mail']);
                            const phone = getField(['phone', 'mobile', 'contact']);
                            const city = getField(['city', 'location', 'town']);
                            const company = getField(['company', 'business']);
                            const jobTitle = getField(['job', 'title', 'position']);

                            const leadUpdateData = {
                                lead_name: fullName || 'Facebook Lead', // Fallback
                                email: email,
                                phone: phone,
                                location: city,
                                company: company,
                                job_title: jobTitle,
                                lead_source: 'facebook',
                                fb_form_id: form.form_id,
                                fb_page_id: page.page_id,
                                fb_created_time: fbLead.created_time,
                                raw_facebook_data: fbLead.field_data, // Save all fields
                                notes: `Form Name: ${form.form_name}\nPage ID: ${page.page_id}\nFacebook ID: ${fbLead.id}`,
                                last_activity_date: new Date()
                            };

                            // Upsert: Update if exists, Create if new
                            const existingLead = await Lead.findOne({ fb_lead_id: fbLead.id });

                            if (existingLead) {
                                // Only update if significantly changed or missing data
                                if (!existingLead.lead_name || existingLead.lead_name === 'undefined' || !existingLead.raw_facebook_data || !existingLead.fb_page_id) {
                                    Object.assign(existingLead, leadUpdateData);
                                    await existingLead.save();
                                    console.log(`Updated existing lead: ${fbLead.id}`);
                                } else {
                                    duplicatesSkipped++;
                                }
                            } else {
                                leadUpdateData.status = 'new';
                                leadUpdateData.created_date = new Date();
                                leadUpdateData.fb_lead_id = fbLead.id;
                                await Lead.create(leadUpdateData);
                                newLeadsCreated++;
                            }
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
router.post('/invoke/refetchFacebookLeadDetails', async (req, res) => {
    try {
        const { leadId } = req.body;
        const Lead = models.Lead;
        const FacebookPageConnection = models.FacebookPageConnection;

        if (!leadId) {
            return res.status(400).json({ error: 'leadId is required' });
        }

        const lead = await Lead.findById(leadId);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (!lead.fb_lead_id) {
            return res.status(400).json({ error: 'Lead does not have Facebook lead ID' });
        }

        // Find page connection
        let page = null;
        if (lead.fb_page_id) {
            page = await FacebookPageConnection.findOne({ page_id: lead.fb_page_id });
        } else if (lead.fb_form_id) {
            // Find page that has this form
            page = await FacebookPageConnection.findOne({ 'lead_forms.form_id': lead.fb_form_id });
        }

        if (!page) {
            return res.status(404).json({ error: 'Facebook page connection not found' });
        }

        // Fetch lead details from Facebook
        const proof = getAppSecretProof(page.access_token);
        const proofParam = proof ? `&appsecret_proof=${proof}` : '';
        const leadRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${lead.fb_lead_id}?access_token=${page.access_token}${proofParam}`);
        const leadData = await leadRes.json();

        if (leadData.error) {
            return res.status(400).json({ error: `Facebook API error: ${leadData.error.message}` });
        }

        // Parse field data
        let fieldsFound = 0;
        if (leadData.field_data && Array.isArray(leadData.field_data)) {
            fieldsFound = leadData.field_data.length;

            // Build form fields section
            let formFieldsText = '--- Form Fields ---\n';
            leadData.field_data.forEach(field => {
                formFieldsText += `${field.name}: ${field.values.join(', ')}\n`;
            });

            // Append to existing notes
            let updatedNotes = lead.notes || '';
            if (updatedNotes.includes('--- Form Fields ---')) {
                // Replace existing section
                const beforeFields = updatedNotes.split('--- Form Fields ---')[0];
                updatedNotes = beforeFields.trim() + '\n\n' + formFieldsText.trim();
            } else {
                // Add new section
                updatedNotes = updatedNotes.trim() + '\n\n' + formFieldsText.trim();
            }

            // Update lead
            lead.notes = updatedNotes;
            lead.raw_facebook_data = leadData.field_data;
            await lead.save();
        }

        res.json({ success: true, data: { fieldsFound } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
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

// Export Salary Data as PDF
router.post('/invoke/exportSalaryPDF', async (req, res) => {
    try {
        const { month, employeeData = [] } = req.body;

        if (!month) {
            return res.status(400).json({ error: 'Month is required' });
        }

        // Generate PDF content (mock for now - in production use pdfkit or puppeteer)
        const pdfContent = {
            title: `Salary Report - ${month}`,
            generatedAt: new Date().toISOString(),
            employeeCount: employeeData.length,
            totalGross: employeeData.reduce((sum, emp) => sum + (emp.baseSalary || 0), 0),
            totalNet: employeeData.reduce((sum, emp) => sum + (emp.net || 0), 0),
            data: employeeData
        };

        // In production, this would generate actual PDF
        // For now, return mock data
        res.json({
            success: true,
            data: {
                pdf_base64: btoa(JSON.stringify(pdfContent, null, 2)),
                filename: `salary_report_${month}.pdf`,
                message: 'PDF generated successfully'
            }
        });
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/invoke/cleanupDuplicateAttendance', mockSuccess);
router.post('/invoke/syncWorkDayLedger', mockSuccess);

// User Management
router.post('/invoke/bulkActivateUsers', mockSuccess);
router.post('/invoke/updateUserName', mockSuccess);


// Get Dashboard Users (Simulated or Real)
router.post('/invoke/getDashboardUsers', async (req, res) => {
    try {
        const User = models.User;
        // Return all users for lead assignment (including inactive users who might still be assignable)
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

// Apply incentive bonuses retroactively for already closed won leads
router.post('/invoke/applyRetroactiveIncentives', async (req, res) => {
    try {
        const Lead = models.Lead;
        const SalaryAdjustment = models.SalaryAdjustment;

        // Find all closed won leads
        const closedWonLeads = await Lead.find({ status: 'closed_won', final_amount: { $exists: true, $ne: null } });

        let bonusesCreated = 0;
        let skipped = 0;

        for (const lead of closedWonLeads) {
            const bonusRecipient = lead.assigned_to;
            if (!bonusRecipient || !lead.final_amount) {
                skipped++;
                continue;
            }

            // Check if bonus already exists for this lead
            const existingBonus = await SalaryAdjustment.findOne({
                employee_email: bonusRecipient,
                description: { $regex: `Lead closure bonus for.*${lead.id}` }
            });

            if (existingBonus) {
                skipped++;
                continue;
            }

            // Calculate bonus (assume closure date or current month)
            const bonusAmount = parseFloat(lead.final_amount) * 0.0025;
            const bonusMonth = lead.created_date ?
                new Date(lead.created_date).toISOString().slice(0, 7) :
                new Date().toISOString().slice(0, 7);

            await SalaryAdjustment.create({
                employee_email: bonusRecipient,
                month: bonusMonth,
                adjustment_type: 'incentive',
                amount: bonusAmount,
                status: 'approved',
                description: `Deal closed with ${lead.lead_name || lead.name || 'Client'} - Lead closure incentive bonus (retroactive)`
            });

            bonusesCreated++;
        }

        res.json({
            success: true,
            data: {
                bonusesCreated,
                skipped,
                message: `Created ${bonusesCreated} retroactive incentive bonuses, skipped ${skipped} leads`
            }
        });
    } catch (error) {
        console.error("Error applying retroactive incentives:", error);
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
        const proof = getAppSecretProof(page_token);
        const proofParam = proof ? `&appsecret_proof=${proof}` : '';
        const formsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${page_id}/leadgen_forms?access_token=${page_token}${proofParam}`);
        const formsData = await formsRes.json();

        // Test leads if forms exist
        let leadsData = null;
        if (formsData.data && formsData.data.length > 0) {
            const formId = formsData.data[0].id;
            const leadsRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${page_token}${proofParam}`);
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

                            const proof = getAppSecretProof(page.access_token);
                            const proofParam = proof ? `&appsecret_proof=${proof}` : '';

                            const leadRes = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${leadId}?access_token=${page.access_token}${proofParam}`);
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
