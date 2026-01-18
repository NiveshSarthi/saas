
import * as models from '../models/index.js';

// Helper for error handling
const handleError = (res, error) => {
    console.error('Accounts API Error:', error);
    res.status(500).json({ success: false, error: error.message });
};

// ==========================================
// Chart of Accounts
// ==========================================
export const getChartOfAccounts = async (req, res) => {
    try {
        const accounts = await models.ChartOfAccount.find({}).sort('code');
        res.json({ success: true, data: accounts });
    } catch (e) { handleError(res, e); }
};

export const createAccount = async (req, res) => {
    try {
        const account = await models.ChartOfAccount.create(req.body);
        res.json({ success: true, data: account });
    } catch (e) { handleError(res, e); }
};

// ==========================================
// Vendors
// ==========================================
export const getVendors = async (req, res) => {
    try {
        const vendors = await models.Vendor.find({}).sort('name');
        res.json({ success: true, data: vendors });
    } catch (e) { handleError(res, e); }
};

export const createVendor = async (req, res) => {
    try {
        const vendor = await models.Vendor.create(req.body);
        res.json({ success: true, data: vendor });
    } catch (e) { handleError(res, e); }
};

// ==========================================
// Clients
// ==========================================
export const getClients = async (req, res) => {
    try {
        const clients = await models.Client.find({}).sort('name');
        res.json({ success: true, data: clients });
    } catch (e) { handleError(res, e); }
};

export const createClient = async (req, res) => {
    try {
        const client = await models.Client.create(req.body);
        res.json({ success: true, data: client });
    } catch (e) { handleError(res, e); }
};

// ==========================================
// Invoices
// ==========================================
export const getInvoices = async (req, res) => {
    try {
        const invoices = await models.Invoice.find({}).sort('-date');
        res.json({ success: true, data: invoices });
    } catch (e) { handleError(res, e); }
};

export const createInvoice = async (req, res) => {
    try {
        const invoice = await models.Invoice.create({
            ...req.body,
            created_by: req.user?.email || 'system'
        });

        // TODO: Post to General Ledger (Transactions)

        res.json({ success: true, data: invoice });
    } catch (e) { handleError(res, e); }
};

// ==========================================
// Bills
// ==========================================
export const getBills = async (req, res) => {
    try {
        const bills = await models.Bill.find({}).sort('-date');
        res.json({ success: true, data: bills });
    } catch (e) { handleError(res, e); }
};

export const createBill = async (req, res) => {
    try {
        const bill = await models.Bill.create({
            ...req.body,
            created_by: req.user?.email || 'system'
        });
        res.json({ success: true, data: bill });
    } catch (e) { handleError(res, e); }
};

// ==========================================
// Reports
// ==========================================
export const getFinancialSummary = async (req, res) => {
    try {
        // Simple aggregation for dashboard
        const totalReceivables = await models.Invoice.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$amount_paid' } } }
        ]);

        const totalPayables = await models.Bill.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$amount_paid' } } }
        ]);

        res.json({
            success: true,
            data: {
                receivables: totalReceivables[0] || { total: 0, paid: 0 },
                payables: totalPayables[0] || { total: 0, paid: 0 }
            }
        });
    } catch (e) { handleError(res, e); }
};

export const getGeneralLedger = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = {};
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // Fetch Invoices and Bills as "Transactions" for now since we haven't fully implemented the Journal Ledger
        // In a real system, we would query the Transaction model.
        // For this demo/MVP, we combine Invoices and Bills.

        const invoices = await models.Invoice.find(query).lean().then(docs => docs.map(d => ({
            ...d,
            type: 'Invoice', // Credit (Revenue)
            amount: d.total,
            description: `Invoice #${d.invoice_number} - ${d.client_name}`
        })));

        const bills = await models.Bill.find(query).lean().then(docs => docs.map(d => ({
            ...d,
            type: 'Bill', // Debit (Expense)
            amount: d.total,
            description: `Bill #${d.bill_number} - ${d.vendor_name}`
        })));

        res.json({ success: true, data: transactions });
    } catch (e) { handleError(res, e); }
};

// ==========================================
// PDF GENERATION
// ==========================================
import PDFDocument from 'pdfkit';

const generateHeader = (doc, title) => {
    doc.fillColor('#444444')
        .fontSize(20)
        .text('ACME Corp', 110, 57)
        .fontSize(10)
        .text('123 Business St.', 200, 65, { align: 'right' })
        .text('New York, NY, 10025', 200, 80, { align: 'right' })
        .moveDown();

    doc.fillColor('#000000')
        .fontSize(20)
        .text(title, 50, 120);

    return doc;
};

const generateFooter = (doc) => {
    doc.fontSize(10)
        .text(
            'Payment is due within 15 days. Thank you for your business.',
            50,
            780,
            { align: 'center', width: 500 }
        );
};

export const downloadInvoicePDF = async (req, res) => {
    try {
        const invoice = await models.Invoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${invoice.invoice_number}.pdf`);

        doc.pipe(res);

        // Header
        generateHeader(doc, 'INVOICE');

        // Customer Details
        doc.fontSize(10)
            .text(`Invoice Number: ${invoice.invoice_number}`, 50, 160)
            .text(`Invoice Date: ${invoice.date.toDateString()}`, 50, 175)
            .text(`Due Date: ${invoice.due_date.toDateString()}`, 50, 190)
            .text(invoice.client_name, 300, 160, { align: 'right' })
            .moveDown();

        // Table Header
        const tableTop = 250;
        doc.font('Helvetica-Bold');
        doc.text('Item', 50, tableTop)
            .text('Quantity', 250, tableTop)
            .text('Price', 350, tableTop, { width: 90, align: 'right' })
            .text('Total', 450, tableTop, { width: 90, align: 'right' });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Items
        let i = 0;
        doc.font('Helvetica');
        let position = 0;

        if (invoice.items && invoice.items.length > 0) {
            for (i = 0; i < invoice.items.length; i++) {
                const item = invoice.items[i];
                position = tableTop + 30 + (i * 30);

                doc.text(item.description || 'Service', 50, position)
                    .text(item.quantity || 1, 250, position)
                    .text((item.unit_price || 0).toFixed(2), 350, position, { width: 90, align: 'right' })
                    .text((item.amount || 0).toFixed(2), 450, position, { width: 90, align: 'right' });

                doc.moveTo(50, position + 20).lineTo(550, position + 20).opacity(0.5).stroke().opacity(1);
            }
        }

        // Totals
        const subtotalPosition = position + 40;
        doc.font('Helvetica-Bold');
        doc.text('Total:', 350, subtotalPosition, { width: 90, align: 'right' })
            .text((invoice.total || 0).toFixed(2), 450, subtotalPosition, { width: 90, align: 'right' });

        // Footer
        generateFooter(doc);

        doc.end();

    } catch (e) { handleError(res, e); }
};

export const downloadReportPDF = async (req, res) => {
    try {
        const { type } = req.params; // 'summary' or 'ledger'
        const doc = new PDFDocument({ margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Report-${type}-${Date.now()}.pdf`);

        doc.pipe(res);

        if (type === 'summary') {
            generateHeader(doc, 'Financial Summary Report');

            // Re-use logic nicely
            const totalReceivables = await models.Invoice.aggregate([
                { $match: { status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]);
            const totalPayables = await models.Bill.aggregate([
                { $match: { status: { $ne: 'cancelled' } } },
                { $group: { _id: null, total: { $sum: '$total' } } }
            ]);
            const receivables = totalReceivables[0]?.total || 0;
            const payables = totalPayables[0]?.total || 0;
            const net = receivables - payables;

            doc.fontSize(12)
                .text('Total Receivables:', 50, 160)
                .text(receivables.toFixed(2), 200, 160, { align: 'right' });

            doc.text('Total Payables:', 50, 180)
                .text(payables.toFixed(2), 200, 180, { align: 'right' });

            doc.moveTo(50, 200).lineTo(250, 200).stroke();

            doc.font('Helvetica-Bold')
                .text('Net Position:', 50, 210)
                .text(net.toFixed(2), 200, 210, { align: 'right' });

        } else if (type === 'ledger') {
            generateHeader(doc, 'General Ledger');
            // Similar content to getGeneralLedger logic, but simplified for PDF demo
            doc.fontSize(12).text('Feature in progress... Check web view for details.', 50, 160);
        }

        generateFooter(doc);
        doc.end();
    } catch (e) { handleError(res, e); }
};
