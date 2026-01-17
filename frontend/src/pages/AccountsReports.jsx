
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, DollarSign, Download, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AccountsReports() {
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    const { data: summary, isLoading: isSummaryLoading } = useQuery({
        queryKey: ['financial-summary'],
        queryFn: async () => {
            const res = await fetch('http://localhost:3001/api/accounts/reports/summary');
            const json = await res.json();
            return json.data || { receivables: { total: 0, paid: 0 }, payables: { total: 0, paid: 0 } };
        }
    });

    const { data: transactions = [], isLoading: isLedgerLoading } = useQuery({
        queryKey: ['general-ledger', dateRange],
        queryFn: async () => {
            const query = new URLSearchParams({ startDate: dateRange.start, endDate: dateRange.end });
            const res = await fetch(`http://localhost:3001/api/accounts/reports/ledger?${query}`);
            const json = await res.json();
            return json.data || [];
        }
    });

    const generatePDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text("Financial Report", 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Period: ${format(new Date(dateRange.start), 'dd MMM yyyy')} - ${format(new Date(dateRange.end), 'dd MMM yyyy')}`, 14, 30);

        // Summary Section
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Summary", 14, 45);

        const receivables = summary?.receivables?.total || 0;
        const payables = summary?.payables?.total || 0;
        const net = receivables - payables;

        const summaryData = [
            ['Total Receivables', `INR ${receivables.toLocaleString()}`],
            ['Total Payables', `INR ${payables.toLocaleString()}`],
            ['Net Position', `INR ${net.toLocaleString()}`]
        ];

        autoTable(doc, {
            startY: 50,
            head: [['Metric', 'Amount']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [79, 70, 229] }
        });

        // Transactions Section
        let finalY = doc.lastAutoTable.finalY || 50;
        doc.text("Detailed Transactions", 14, finalY + 15);

        const tableData = transactions.map(t => [
            format(new Date(t.date), 'dd MMM'),
            t.type,
            t.description,
            t.status?.toUpperCase() || '-',
            `INR ${t.amount.toLocaleString()}`
        ]);

        autoTable(doc, {
            startY: finalY + 20,
            head: [['Date', 'Type', 'Description', 'Status', 'Amount']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [50, 50, 50] },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });

        // Footer
        doc.setFontSize(10);
        doc.text(`Generated on ${format(new Date(), 'PPpp')}`, 14, doc.internal.pageSize.height - 10);

        doc.save(`Financial_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
    };

    if (isSummaryLoading) {
        return <div className="p-6">Loading reports...</div>;
    }

    const receivables = summary?.receivables || { total: 0, paid: 0 };
    const payables = summary?.payables || { total: 0, paid: 0 };
    const netPosition = receivables.total - payables.total;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
                    <p className="text-muted-foreground">Overview of your financial health.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-2 rounded-md shadow-sm border">
                    <span className="text-sm text-slate-500 pl-2">Period:</span>
                    <Input
                        type="date"
                        className="w-auto h-8 text-xs border-0 focus-visible:ring-0"
                        value={dateRange.start}
                        onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
                    />
                    <span className="text-slate-400">-</span>
                    <Input
                        type="date"
                        className="w-auto h-8 text-xs border-0 focus-visible:ring-0"
                        value={dateRange.end}
                        onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
                    />
                    <Button size="sm" onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-700 ml-2">
                        <Download className="mr-2 h-4 w-4" /> Export PDF
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {receivables.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Paid: {receivables.paid.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Payables</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {payables.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Paid: {payables.paid.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Position</CardTitle>
                        <DollarSign className="h-4 w-4 text-indigo-500" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netPosition.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Receivables - Payables
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Transaction Ledger</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLedgerLoading ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading ledger...</TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No transactions found in this period.</TableCell></TableRow>
                            ) : (
                                transactions.map((t, idx) => (
                                    <TableRow key={t._id || idx}>
                                        <TableCell>{format(new Date(t.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                        ${t.type === 'Invoice' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {t.type}
                                            </span>
                                        </TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className="text-xs">{t.status?.toUpperCase()}</TableCell>
                                        <TableCell className={`text-right font-mono ${t.type === 'Invoice' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'Bill' ? '-' : ''}{t.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
