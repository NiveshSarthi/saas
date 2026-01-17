
import express from 'express';
import * as accountsController from '../controllers/accountsController.js';

const router = express.Router();

// Chart of Accounts
router.get('/chart-of-accounts', accountsController.getChartOfAccounts);
router.post('/chart-of-accounts', accountsController.createAccount);

// Vendors
router.get('/vendors', accountsController.getVendors);
router.post('/vendors', accountsController.createVendor);

// Clients
router.get('/clients', accountsController.getClients);
router.post('/clients', accountsController.createClient);

// Invoices
router.get('/invoices', accountsController.getInvoices);
router.post('/invoices', accountsController.createInvoice);

// Bills
router.get('/bills', accountsController.getBills);
router.post('/bills', accountsController.createBill);

// Reports
router.get('/reports/summary', accountsController.getFinancialSummary);
router.get('/reports/ledger', accountsController.getGeneralLedger);

// PDF Downloads
router.get('/invoices/:id/pdf', accountsController.downloadInvoicePDF);
router.get('/reports/:type/pdf', accountsController.downloadReportPDF);

export default router;
