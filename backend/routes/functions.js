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

// Leads & Marketing
router.post('/invoke/connectFacebookPage', async (req, res) => {
    try {
        // Simulate connection
        const FacebookPageConnection = models.FacebookPageConnection;

        // Create dummy page if not exists
        const pageId = '100000000000001';
        let page = await FacebookPageConnection.findOne({ page_id: pageId });

        if (!page) {
            page = await FacebookPageConnection.create({
                page_id: pageId,
                page_name: 'Sarthi Real Estate Demo',
                access_token: 'mock_token_' + Date.now(),
                status: 'active',
                lead_forms: [
                    { form_id: 'SALE_001', form_name: 'Project Enquiries', status: 'active', subscribed: true },
                    { form_id: 'SALE_002', form_name: 'Newsletter Signups', status: 'active', subscribed: true }
                ],
                last_sync_date: new Date()
            });
        }
        res.json({ success: true, data: { message: 'Connected to Sarthi Real Estate Demo' } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/invoke/syncFacebookForms', async (req, res) => {
    try {
        const FacebookPageConnection = models.FacebookPageConnection;
        const pages = await FacebookPageConnection.find();
        let newFormsCount = 0;

        for (const page of pages) {
            // Simulate finding a new form occasionally
            if (page.lead_forms.length < 5) {
                const newId = `FORM_${Date.now()}`;
                page.lead_forms.push({
                    form_id: newId,
                    form_name: `New Campaign ${new Date().toLocaleDateString()}`,
                    status: 'active',
                    subscribed: true
                });
                page.last_sync_date = new Date();
                await page.save();
                newFormsCount++;
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
        const newLeads = [];

        // Create 2 dummy leads
        for (let i = 0; i < 2; i++) {
            const leadData = {
                lead_name: `FB Lead ${Math.floor(Math.random() * 1000)}`,
                email: `lead${Date.now()}_${i}@example.com`,
                phone: `+9198765${Math.floor(10000 + Math.random() * 90000)}`,
                lead_source: 'facebook',
                status: 'new',
                notes: 'Form: Project Enquiries\nPage ID: 100000000000001',
                created_date: new Date(),
                fb_created_time: new Date()
            };
            const created = await Lead.create(leadData);
            newLeads.push(created);
        }

        res.json({
            success: true,
            data: {
                newLeadsCreated: newLeads.length,
                duplicatesSkipped: 0,
                errors: []
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

export default router;
