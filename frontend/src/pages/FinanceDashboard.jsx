import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, eachMonthOfInterval } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Calendar,
  DollarSign,
  CreditCard,
  PieChart as PieChartIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Brain,
  Receipt,
  Activity,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export default function FinanceDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const { data: receivables = [], isLoading: loadingReceivables } = useQuery({
    queryKey: ['receivables'],
    queryFn: () => base44.entities.PaymentReceivable.list('-payment_date', 1000),
  });

  const { data: payables = [], isLoading: loadingPayables } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.PaymentPayable.list('-due_date', 1000),
  });

  const { data: forecasts = [] } = useQuery({
    queryKey: ['forecasts'],
    queryFn: () => base44.entities.CashFlowForecast.list('-month', 12),
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['financial-alerts'],
    queryFn: () => base44.entities.FinancialAlert.filter({ status: 'active' }, '-created_date', 50),
  });

  const { data: marketingExpenses = [] } = useQuery({
    queryKey: ['marketing-expenses'],
    queryFn: () => base44.entities.MarketingExpense.list('-created_date', 500),
  });

  const { data: salaryRecords = [] } = useQuery({
    queryKey: ['salary-records'],
    queryFn: () => base44.entities.SalaryRecord.list('-month', 500),
  });

  const { data: pettyCash = [] } = useQuery({
    queryKey: ['petty-cash'],
    queryFn: () => base44.entities.PettyCashReimbursement.list('-created_date', 500),
  });

  // Calculate key metrics
  const metrics = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Helper to safely parse numbers
    const toNum = (val) => {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    };

    // Total receivables
    const totalReceivable = receivables.reduce((sum, r) => sum + toNum(r.amount), 0);
    const totalReceived = receivables.reduce((sum, r) => sum + toNum(r.received_amount), 0);
    const pendingReceivable = receivables.reduce((sum, r) => sum + toNum(r.pending_amount), 0);

    // Total payables
    const totalPayable = payables.reduce((sum, p) => sum + toNum(p.amount), 0);
    const totalPaid = payables.reduce((sum, p) => sum + toNum(p.paid_amount), 0);
    const pendingPayable = payables.reduce((sum, p) => sum + toNum(p.pending_amount), 0);

    // Current month receivables
    const monthReceivables = receivables.filter(r => {
      if (!r.payment_date) return false;
      const date = new Date(r.payment_date);
      return date >= monthStart && date <= monthEnd;
    });
    const monthExpectedInflow = monthReceivables.reduce((sum, r) => sum + toNum(r.amount), 0);

    // Current month payables
    const monthPayables = payables.filter(p => {
      if (!p.due_date) return false;
      const date = new Date(p.due_date);
      return date >= monthStart && date <= monthEnd;
    });
    let monthExpectedOutflow = monthPayables.reduce((sum, p) => sum + toNum(p.amount), 0);

    // Add current month salaries to outflow
    const currentMonthStr = format(today, 'yyyy-MM');
    const monthSalaries = salaryRecords.filter(s => s.month === currentMonthStr && s.status !== 'paid');
    monthExpectedOutflow += monthSalaries.reduce((sum, s) => sum + toNum(s.net_salary), 0);

    // Add approved petty cash reimbursements to outflow
    const pettyCashApproved = pettyCash.filter(p => p.status === 'approved');
    monthExpectedOutflow += pettyCashApproved.reduce((sum, p) => sum + toNum(p.amount), 0);

    // Overdue amounts
    const overdueReceivables = receivables.filter(r => 
      r.status === 'overdue' || (r.payment_date && new Date(r.payment_date) < today && r.status === 'pending')
    );
    const overduePayables = payables.filter(p => 
      p.status === 'overdue' || (p.due_date && new Date(p.due_date) < today && p.status === 'pending')
    );

    // Marketing spend
    const totalMarketingSpend = marketingExpenses.reduce((sum, m) => sum + toNum(m.spent_amount), 0);
    const marketingBudget = marketingExpenses.reduce((sum, m) => sum + toNum(m.allocated_budget), 0);

    // Salary spend
    const totalSalaryPaid = salaryRecords.filter(s => s.status === 'paid').reduce((sum, s) => sum + toNum(s.net_salary), 0);
    const totalSalaryPending = salaryRecords.filter(s => s.status !== 'paid').reduce((sum, s) => sum + toNum(s.net_salary), 0);

    // Petty cash reimbursements
    const pettyCashPending = pettyCash.filter(p => p.status === 'approved').reduce((sum, p) => sum + toNum(p.amount), 0);
    const pettyCashPaid = pettyCash.filter(p => p.status === 'paid').reduce((sum, p) => sum + toNum(p.amount), 0);

    // Current balance (simplified - received - paid)
    const currentBalance = totalReceived - totalPaid;

    // Net cash flow
    const netCashFlow = currentBalance;

    return {
      currentBalance,
      totalReceived,
      totalPaid,
      pendingReceivable,
      pendingPayable,
      monthExpectedInflow,
      monthExpectedOutflow,
      overdueReceivables: overdueReceivables.length,
      overduePayables: overduePayables.length,
      totalMarketingSpend,
      marketingBudget,
      totalSalaryPaid,
      totalSalaryPending,
      pettyCashPending,
      pettyCashPaid,
      netCashFlow,
      forecastNext3Months: forecasts.slice(0, 3).reduce((sum, f) => sum + toNum(f.net_cashflow), 0)
    };
  }, [receivables, payables, forecasts, marketingExpenses, salaryRecords, pettyCash]);

  // Chart data preparation
  const last6Months = eachMonthOfInterval({
    start: subMonths(new Date(), 5),
    end: new Date()
  });

  const monthlyData = last6Months.map(month => {
    const monthStr = format(month, 'yyyy-MM');
    const monthlyReceivables = receivables.filter(r => r.payment_date?.startsWith(monthStr));
    const monthlyPayables = payables.filter(p => p.due_date?.startsWith(monthStr));
    
    return {
      month: format(month, 'MMM'),
      inflow: monthlyReceivables.reduce((sum, r) => sum + (r.received_amount || 0), 0) / 1000,
      outflow: monthlyPayables.reduce((sum, p) => sum + (p.paid_amount || 0), 0) / 1000,
      net: (monthlyReceivables.reduce((sum, r) => sum + (r.received_amount || 0), 0) - 
            monthlyPayables.reduce((sum, p) => sum + (p.paid_amount || 0), 0)) / 1000
    };
  });

  const categoryExpenseData = [
    { name: 'Marketing', value: metrics.totalMarketingSpend, color: '#8b5cf6' },
    { name: 'Salaries', value: metrics.totalSalaryPaid, color: '#3b82f6' },
    { name: 'Petty Cash', value: metrics.pettyCashPaid, color: '#10b981' },
    { name: 'Other Payables', value: metrics.totalPaid - metrics.totalMarketingSpend - metrics.totalSalaryPaid - metrics.pettyCashPaid, color: '#f59e0b' }
  ].filter(item => item.value > 0);

  const cashFlowTrendData = forecasts.slice(0, 6).reverse().map(f => ({
    month: f.month ? format(new Date(f.month + '-01'), 'MMM') : 'N/A',
    inflow: (f.expected_inflow || 0) / 1000,
    outflow: (f.expected_outflow || 0) / 1000,
    balance: (f.closing_balance || 0) / 1000
  }));

  const statusData = [
    { name: 'Received', value: metrics.totalReceived / 1000, color: '#10b981' },
    { name: 'Pending Receivable', value: metrics.pendingReceivable / 1000, color: '#f59e0b' },
    { name: 'Paid', value: metrics.totalPaid / 1000, color: '#ef4444' }
  ];

  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const isLoading = loadingReceivables || loadingPayables;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                <Activity className="w-8 h-8 text-white" />
              </div>
              Financial Command Center
            </h1>
            <p className="text-indigo-200 mt-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Real-time insights • Predictive analytics • Smart forecasting
            </p>
          </div>
          <div className="flex gap-2">
            <Link to={createPageUrl('Receivables')}>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <TrendingUp className="w-4 h-4 mr-2" />
                Receivables
              </Button>
            </Link>
            <Link to={createPageUrl('Payables')}>
              <Button className="bg-red-600 hover:bg-red-700 text-white">
                <TrendingDown className="w-4 h-4 mr-2" />
                Payables
              </Button>
            </Link>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <Card className="border-orange-500 bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 mt-0.5 animate-pulse" />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-3">⚠️ Attention Required ({alerts.length})</h3>
                  <div className="space-y-2">
                    {alerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="flex items-center justify-between bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/20">
                        <div>
                          <span className="font-semibold">{alert.title}</span>
                          <p className="text-sm text-white/80">{alert.message}</p>
                        </div>
                        <Badge className={alert.severity === 'critical' ? 'bg-red-900 text-white' : 'bg-orange-900 text-white'}>
                          {alert.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-indigo-100 text-sm font-medium">Current Balance</span>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-4xl font-black mb-1">₹{((metrics.currentBalance || 0) / 1000).toFixed(1)}K</p>
              <p className="text-xs text-indigo-200 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Cash on hand
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-green-100 text-sm font-medium">Total Received</span>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <ArrowUpRight className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-4xl font-black mb-1">₹{((metrics.totalReceived || 0) / 1000).toFixed(1)}K</p>
              <p className="text-xs text-green-200">Pending: ₹{((metrics.pendingReceivable || 0) / 1000).toFixed(1)}K</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-red-100 text-sm font-medium">Total Paid</span>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <ArrowDownRight className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-4xl font-black mb-1">₹{((metrics.totalPaid || 0) / 1000).toFixed(1)}K</p>
              <p className="text-xs text-red-200">Pending: ₹{((metrics.pendingPayable || 0) / 1000).toFixed(1)}K</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 via-fuchsia-600 to-pink-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-100 text-sm font-medium">Marketing Spend</span>
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <PieChartIcon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-4xl font-black mb-1">₹{((metrics.totalMarketingSpend || 0) / 1000).toFixed(1)}K</p>
              <p className="text-xs text-purple-200">Budget: ₹{((metrics.marketingBudget || 0) / 1000).toFixed(1)}K</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Cash Flow Trend */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                6-Month Cash Flow Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#ffffff80" />
                  <YAxis stroke="#ffffff80" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => `₹${value.toFixed(0)}K`}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="inflow" stroke="#10b981" fillOpacity={1} fill="url(#colorInflow)" name="Inflow" />
                  <Area type="monotone" dataKey="outflow" stroke="#ef4444" fillOpacity={1} fill="url(#colorOutflow)" name="Outflow" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expense Breakdown */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-purple-400" />
                Expense Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryExpenseData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryExpenseData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Net Position Trend */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Net Cash Flow Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="month" stroke="#ffffff80" />
                  <YAxis stroke="#ffffff80" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => `₹${value.toFixed(0)}K`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="net" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', r: 6 }} name="Net Flow" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Overview */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                Financial Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="name" stroke="#ffffff80" />
                  <YAxis stroke="#ffffff80" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                    formatter={(value) => `₹${value.toFixed(0)}K`}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-orange-500/20 to-red-500/20 backdrop-blur-md border-orange-500/30 text-white">
            <CardContent className="p-4">
              <p className="text-sm text-orange-200">Overdue Receivables</p>
              <p className="text-3xl font-bold">{metrics.overdueReceivables}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-md border-red-500/30 text-white">
            <CardContent className="p-4">
              <p className="text-sm text-red-200">Overdue Payables</p>
              <p className="text-3xl font-bold">{metrics.overduePayables}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-md border-blue-500/30 text-white">
            <CardContent className="p-4">
              <p className="text-sm text-blue-200">3M Forecast</p>
              <p className={`text-3xl font-bold ${(metrics.forecastNext3Months || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ₹{((metrics.forecastNext3Months || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md border-purple-500/30 text-white">
            <CardContent className="p-4">
              <p className="text-sm text-purple-200">Petty Cash Pending</p>
              <p className="text-3xl font-bold">₹{((metrics.pettyCashPending || 0) / 1000).toFixed(0)}K</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to={createPageUrl('Receivables')}>
                <Button className="w-full bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Add Receivable
                </Button>
              </Link>
              <Link to={createPageUrl('Payables')}>
                <Button className="w-full bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white border-0 shadow-lg">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Add Payable
                </Button>
              </Link>
              <Link to={createPageUrl('CashFlowForecast')}>
                <Button className="w-full bg-gradient-to-br from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white border-0 shadow-lg">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Forecast
                </Button>
              </Link>
              <Link to={createPageUrl('MarketingExpenses')}>
                <Button className="w-full bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white border-0 shadow-lg">
                  <PieChartIcon className="w-4 h-4 mr-2" />
                  Marketing
                </Button>
              </Link>
              <Link to={createPageUrl('SalaryManagement')}>
                <Button className="w-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 shadow-lg">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Salaries
                </Button>
              </Link>
              <Link to={createPageUrl('FinancialReports')}>
                <Button className="w-full bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0 shadow-lg">
                  <PieChartIcon className="w-4 h-4 mr-2" />
                  Reports
                </Button>
              </Link>
              <Link to={createPageUrl('AIFinanceInsights')}>
                <Button className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-700 hover:via-pink-700 hover:to-red-700 text-white border-0 shadow-lg">
                  <Brain className="w-4 h-4 mr-2" />
                  AI Insights
                </Button>
              </Link>
              <Link to={createPageUrl('PettyCashReimbursement')}>
                <Button className="w-full bg-gradient-to-br from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white border-0 shadow-lg">
                  <Receipt className="w-4 h-4 mr-2" />
                  Petty Cash
                </Button>
              </Link>
              <Link to={createPageUrl('PaymentsCalendar')}>
                <Button className="w-full bg-gradient-to-br from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white border-0 shadow-lg">
                  <Calendar className="w-4 h-4 mr-2" />
                  Payment Calendar
                </Button>
              </Link>
              <Link to={createPageUrl('ProjectPnL')}>
                <Button className="w-full bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white border-0 shadow-lg">
                  <Building2 className="w-4 h-4 mr-2" />
                  Project P&L
                </Button>
              </Link>
              <Link to={createPageUrl('TeamCostRevenue')}>
                <Button className="w-full bg-gradient-to-br from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white border-0 shadow-lg">
                  <PieChartIcon className="w-4 h-4 mr-2" />
                  Team Cost/Revenue
                </Button>
              </Link>
              <Link to={createPageUrl('BudgetComparison')}>
                <Button className="w-full bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white border-0 shadow-lg">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Budget vs Actual
                </Button>
              </Link>
              </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}