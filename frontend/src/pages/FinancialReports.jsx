import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function FinancialReports() {
  const { can } = usePermissions();

  if (!can('financial_reports', 'read')) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to view Financial Reports.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.PaymentReceivable.list('-payment_date', 1000),
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.PaymentPayable.list('-due_date', 1000),
  });

  const { data: marketingExpenses = [] } = useQuery({
    queryKey: ['marketing-expenses'],
    queryFn: () => base44.entities.MarketingExpense.list('-created_date', 500),
  });

  const summary = useMemo(() => {
    const totalReceived = receivables.reduce((sum, r) => sum + (r.received_amount || 0), 0);
    const totalPaid = payables.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
    const pendingReceivables = receivables.reduce((sum, r) => sum + (r.pending_amount || 0), 0);
    const pendingPayables = payables.reduce((sum, p) => sum + (p.pending_amount || 0), 0);

    const categoryBreakdown = payables.reduce((acc, p) => {
      const cat = p.category || 'other';
      acc[cat] = (acc[cat] || 0) + (p.paid_amount || 0);
      return acc;
    }, {});

    return {
      totalReceived,
      totalPaid,
      netPosition: totalReceived - totalPaid,
      pendingReceivables,
      pendingPayables,
      categoryBreakdown
    };
  }, [receivables, payables]);

  const handleExport = () => {
    const data = [
      ['Financial Summary Report'],
      ['Generated:', format(new Date(), 'PPP')],
      [''],
      ['Income Summary'],
      ['Total Received', `₹${summary.totalReceived.toLocaleString()}`],
      ['Pending Receivables', `₹${summary.pendingReceivables.toLocaleString()}`],
      [''],
      ['Expense Summary'],
      ['Total Paid', `₹${summary.totalPaid.toLocaleString()}`],
      ['Pending Payables', `₹${summary.pendingPayables.toLocaleString()}`],
      [''],
      ['Category-wise Expenses'],
      ...Object.entries(summary.categoryBreakdown).map(([cat, amt]) => [
        cat.replace('_', ' ').toUpperCase(),
        `₹${amt.toLocaleString()}`
      ])
    ];

    const csv = data.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-600" />
            Financial Reports
          </h1>
          <p className="text-slate-600 mt-1">Comprehensive financial analysis and insights</p>
        </div>
        <Button onClick={handleExport} className="bg-indigo-600 hover:bg-indigo-700">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Received</p>
                <p className="text-2xl font-bold text-green-600">₹{(summary.totalReceived / 100000).toFixed(2)}L</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Paid</p>
                <p className="text-2xl font-bold text-red-600">₹{(summary.totalPaid / 100000).toFixed(2)}L</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Net Position</p>
                <p className={`text-2xl font-bold ${summary.netPosition >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{(summary.netPosition / 100000).toFixed(2)}L
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Expense Breakdown by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(summary.categoryBreakdown).map(([category, amount]) => (
                <TableRow key={category}>
                  <TableCell className="capitalize">{category.replace('_', ' ')}</TableCell>
                  <TableCell>₹{amount.toLocaleString()}</TableCell>
                  <TableCell>
                    {((amount / summary.totalPaid) * 100).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Pending Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              ₹{(summary.pendingReceivables / 100000).toFixed(2)}L
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Outstanding payments to be received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              ₹{(summary.pendingPayables / 100000).toFixed(2)}L
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Outstanding payments to be made
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}