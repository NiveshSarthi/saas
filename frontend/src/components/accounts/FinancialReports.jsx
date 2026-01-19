import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
    FileText,
    Download,
    PieChart,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Calendar,
    Filter,
    ArrowRight,
    Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function FinancialReports() {
    const [dateRange, setDateRange] = useState('current_month');

    // Queries
    const { data: invoices = [] } = useQuery({
        queryKey: ['reports-invoices'],
        queryFn: () => base44.entities.Invoice.list(),
    });

    const { data: bills = [] } = useQuery({
        queryKey: ['reports-bills'],
        queryFn: () => base44.entities.Bill.list(),
    });

    const { data: salaries = [] } = useQuery({
        queryKey: ['reports-salaries'],
        queryFn: () => base44.entities.SalaryRecord.list(),
    });

    const { data: marketing = [] } = useQuery({
        queryKey: ['reports-marketing'],
        queryFn: () => base44.entities.MarketingExpense.list(),
    });

    // Calculation Logic
    const reportData = useMemo(() => {
        let startDate, endDate;
        const now = new Date();

        if (dateRange === 'current_month') {
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
        } else if (dateRange === 'last_month') {
            startDate = startOfMonth(subMonths(now, 1));
            endDate = endOfMonth(subMonths(now, 1));
        } else {
            startDate = new Date(2020, 0, 1);
            endDate = new Date(2030, 0, 1);
        }

        const filterByDate = (date) => {
            if (!date) return false;
            const d = new Date(date);
            return d >= startDate && d <= endDate;
        };

        const periodInvoices = Array.isArray(invoices) ? invoices.filter(inv => filterByDate(inv.date)) : [];
        const periodBills = Array.isArray(bills) ? bills.filter(b => filterByDate(b.date)) : [];

        const income = periodInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const taxCollected = periodInvoices.reduce((sum, inv) => sum + (inv.tax_total || 0), 0);

        const vendorExpenses = periodBills.reduce((sum, b) => sum + (b.total || 0), 0);
        const salaryExpenses = Array.isArray(salaries) ? salaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.net_salary || 0), 0) : 0;
        const marketingExpenses = Array.isArray(marketing) ? marketing.reduce((sum, m) => sum + (m.spent_amount || 0), 0) : 0;

        const totalExpenses = vendorExpenses + salaryExpenses + marketingExpenses;

        return {
            income,
            taxCollected,
            vendorExpenses,
            salaryExpenses,
            marketingExpenses,
            totalExpenses,
            netProfit: income - totalExpenses,
            invoiceCount: periodInvoices.length,
            billCount: periodBills.length
        };
    }, [invoices, bills, salaries, marketing, dateRange]);

    const exportToExcel = () => {
        const wsData = [
            ['Financial Report', format(new Date(), 'PPP')],
            ['Date Range', dateRange],
            [],
            ['Category', 'Amount (₹)'],
            ['Total Income (Invoices)', reportData.income],
            ['Tax Collected (GST)', reportData.taxCollected],
            ['Vendor Expenses (Bills)', reportData.vendorExpenses],
            ['Payroll (Salaries)', reportData.salaryExpenses],
            ['Marketing Spend', reportData.marketingExpenses],
            ['Total Expenses', reportData.totalExpenses],
            ['Net Profit/Loss', reportData.netProfit]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Financial Summary');
        XLSX.writeFile(wb, `financial_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
        toast.success('Excel report exported');
    };

    const exportToPDF = () => {
        try {
            const doc = new jsPDF();
            doc.setFontSize(20);
            doc.text('Financial Statement', 20, 20);
            doc.setFontSize(10);
            doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 20, 30);
            doc.text(`Period: ${dateRange}`, 20, 35);

            const tableData = [
                ['Description', 'Value (INR)'],
                ['Total Revenue', reportData.income.toLocaleString()],
                ['GST Collected', reportData.taxCollected.toLocaleString()],
                ['Vendor Liabilities', reportData.vendorExpenses.toLocaleString()],
                ['Payroll Cost', reportData.salaryExpenses.toLocaleString()],
                ['Growth Marketing', reportData.marketingExpenses.toLocaleString()],
                ['Total Operating Expenses', reportData.totalExpenses.toLocaleString()],
                ['Net Profit/Loss', reportData.netProfit.toLocaleString()]
            ];

            doc.autoTable({
                startY: 45,
                head: [tableData[0]],
                body: tableData.slice(1),
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229] }
            });

            doc.save(`financial_statement_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            toast.success('PDF report exported');
        } catch (e) {
            console.error(e);
            toast.error('PDF export failed');
        }
    };

    return (
        <div className="space-y-8 pb-12">
            {/* Configuration Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-4 pl-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 transition-all hover:rotate-6">
                        <BarChart3 className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Financial Intelligence</h2>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            Real-time Reporting & Tax Analytics
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 pr-2">
                    <select
                        className="h-11 px-5 bg-slate-100 border-0 rounded-xl text-xs font-bold uppercase tracking-wide text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-inner min-w-[180px]"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="current_month">Current Billing Cycle</option>
                        <option value="last_month">Previous Billing Cycle</option>
                        <option value="all_time">Lifetime Aggregates</option>
                    </select>
                    <Button variant="outline" className="h-11 rounded-xl border-slate-200 text-slate-500 font-bold text-[10px] tracking-wide uppercase hover:bg-slate-50 active:scale-95 transition-all shadow-sm flex-shrink-0" onClick={exportToExcel}>
                        <Download className="w-4 h-4 mr-2" /> .XLSX
                    </Button>
                    <Button className="h-11 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold uppercase tracking-wide shadow-xl shadow-indigo-50 active:scale-95 transition-all px-8 flex-shrink-0" onClick={exportToPDF}>
                        <FileText className="w-4 h-4 mr-2" /> PDF Statement
                    </Button>
                </div>
            </div>

            {/* Main P&L Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-2 border-0 shadow-2xl rounded-[48px] bg-white/80 backdrop-blur-xl overflow-hidden border border-white/40">
                    <CardHeader className="p-10 border-b border-slate-50 bg-slate-50/20">
                        <CardTitle className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-4">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-lg shadow-indigo-300 animate-pulse" />
                            Operating Profit & Loss Statement
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableBody>
                                <TableRow className="hover:bg-transparent border-slate-50 border-b">
                                    <TableCell className="py-8 pl-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-sm">
                                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg uppercase tracking-tight">Revenue Inflow (Gross)</div>
                                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Total value of all finalized invoices</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-8 text-right pr-10">
                                        <div className="font-bold text-slate-900 text-2xl tracking-tight">₹{reportData.income.toLocaleString()}</div>
                                        <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wide mt-2">{reportData.invoiceCount} Valid Records</div>
                                    </TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-transparent border-slate-50 border-b">
                                    <TableCell className="py-8 pl-10">
                                        <div className="flex items-center gap-5">
                                            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100 shadow-sm">
                                                <TrendingDown className="w-6 h-6 text-rose-500" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-lg uppercase tracking-tight">Operational Capital Burn</div>
                                                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Aggregate of bills, payroll & growth</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-8 text-right pr-10">
                                        <div className="font-bold text-slate-900 text-2xl tracking-tight">₹{reportData.totalExpenses.toLocaleString()}</div>
                                        <div className="text-[10px] text-rose-500 font-bold uppercase tracking-wide mt-2 underline decoration-2 decoration-rose-100">Cumulative Liability</div>
                                    </TableCell>
                                </TableRow>
                                <TableRow className="hover:bg-indigo-50/50 border-0 transition-all bg-indigo-50/20">
                                    <TableCell className="py-10 pl-10">
                                        <div className="flex items-center gap-6">
                                            <div className="w-14 h-14 rounded-[22px] bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-200 ring-4 ring-white">
                                                <PieChart className="w-7 h-7 text-white" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 text-xl uppercase tracking-wide decoration-indigo-400 decoration-4 underline underline-offset-8">Net EBITDA Surplus</div>
                                                <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wide mt-3">Bottom-line realization</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-10 text-right pr-10">
                                        <div className={`text-5xl font-bold tracking-tight ${reportData.netProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                            ₹{reportData.netProfit.toLocaleString()}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mt-2">Before Tax & Depreciation</div>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* GST Highlights */}
                <Card className="border-0 shadow-3xl rounded-[48px] bg-slate-900 text-white overflow-hidden flex flex-col border border-white/5 relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[60px] rounded-full -mr-16 -mt-16" />
                    <CardHeader className="p-10 border-b border-white/5">
                        <CardTitle className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-4">
                            <Info className="w-4 h-4" />
                            Tax Compliance Shield
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10 flex-1 flex flex-col justify-between space-y-12 relative z-10">
                        <div className="space-y-10">
                            <div className="group cursor-default">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3 group-hover:text-indigo-400 transition-colors">Cumulative Output Tax</p>
                                <div className="flex items-baseline gap-2">
                                    <h4 className="text-5xl font-bold tracking-tight text-emerald-400">₹{reportData.taxCollected.toLocaleString()}</h4>
                                    <span className="text-xs text-slate-500 font-semibold">GSTIN</span>
                                </div>
                                <p className="text-[9px] text-slate-500 font-semibold uppercase mt-2 tracking-wide opacity-60">Settlement liability towards GOI</p>
                            </div>
                            <div className="group cursor-default">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3 group-hover:text-indigo-400 transition-colors">Eligible Input Tax Credit</p>
                                <div className="flex items-baseline gap-2">
                                    <h4 className="text-5xl font-bold tracking-tight text-slate-700">₹0</h4>
                                    <span className="text-xs text-slate-800 font-semibold">RECOVER</span>
                                </div>
                                <p className="text-[9px] text-slate-500 font-semibold uppercase mt-2 tracking-wide opacity-60">Potential settlement offset via bills</p>
                            </div>
                        </div>

                        <div className="pt-10 border-t border-white/10 mt-auto">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide underline decoration-slate-700 underline-offset-4 decoration-2">Ledger Health</span>
                                <div className="flex items-center px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold tracking-wide uppercase">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-lg shadow-emerald-500/50" />
                                    Good Standing
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-600 font-bold mt-6 leading-relaxed italic opacity-80">
                                * Estimates calculated using real-time itemized logs. Final compliance values should be verified by a certified Chartered Accountant.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Expense Breakdown List */}
            <Card className="border-0 shadow-2xl rounded-[48px] bg-white/50 backdrop-blur-xl overflow-hidden border border-white">
                <CardHeader className="p-10 border-b border-slate-50 bg-slate-50/30 flex flex-row items-center justify-between">
                    <CardTitle className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-4">
                        <div className="p-2 bg-indigo-50 rounded-lg"><ArrowRight className="w-4 h-4 text-indigo-500" /></div>
                        Expense Ledger Dissection
                    </CardTitle>
                    <div className="flex items-center gap-4 bg-white px-5 py-2 rounded-2xl shadow-sm border border-slate-100">
                        <Filter className="w-4 h-4 text-slate-300" />
                        <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">Detail Matrix View</span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableBody>
                            <TableRow className="hover:bg-white border-slate-50/50 transition-all group border-b last:border-0 hover:shadow-lg hover:shadow-slate-100">
                                <TableCell className="py-8 pl-10">
                                    <div className="font-bold text-slate-800 text-base uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Vendor Liabilities (Purchase Ledger)</div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Settlements pending or paid to external vendors</div>
                                </TableCell>
                                <TableCell className="py-8 text-right pr-10 font-bold text-slate-900 text-2xl tracking-tight">₹{reportData.vendorExpenses.toLocaleString()}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-white border-slate-50/50 transition-all group border-b last:border-0 hover:shadow-lg hover:shadow-slate-100">
                                <TableCell className="py-8 pl-10">
                                    <div className="font-bold text-slate-800 text-base uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Financial Human Resource (Payroll)</div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Net salary disbursement for all locked records</div>
                                </TableCell>
                                <TableCell className="py-8 text-right pr-10 font-bold text-slate-900 text-2xl tracking-tight">₹{reportData.salaryExpenses.toLocaleString()}</TableCell>
                            </TableRow>
                            <TableRow className="hover:bg-white border-slate-50/50 transition-all group border-b last:border-0 hover:shadow-lg hover:shadow-slate-100">
                                <TableCell className="py-8 pl-10">
                                    <div className="font-bold text-slate-800 text-base uppercase tracking-tight group-hover:text-indigo-600 transition-colors">Growth Capital Burn (Marketing)</div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-1">Investment in campaigns and acquisition channels</div>
                                </TableCell>
                                <TableCell className="py-8 text-right pr-10 font-bold text-slate-900 text-2xl tracking-tight">₹{reportData.marketingExpenses.toLocaleString()}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
