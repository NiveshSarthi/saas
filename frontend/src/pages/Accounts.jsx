import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Users,
  Building,
  CreditCard,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Download,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Target,
  PieChart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function AccountsPage() {
  const [user, setUser] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not authenticated');
      }
    };
    fetchUser();
  }, []);

  // Fetch all financial data
  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables-all'],
    queryFn: () => base44.entities.PaymentReceivable.list('-expected_date', 500),
    enabled: !!user,
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables-all'],
    queryFn: () => base44.entities.PaymentPayable.list('-due_date', 500),
    enabled: !!user,
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries-all'],
    queryFn: () => base44.entities.SalaryRecord.list('-month', 100),
    enabled: !!user,
  });

  const { data: marketingExpenses = [] } = useQuery({
    queryKey: ['marketing-expenses-all'],
    queryFn: () => base44.entities.MarketingExpense.list('-expense_date', 500),
    enabled: !!user,
  });

  const { data: cashFlowForecasts = [] } = useQuery({
    queryKey: ['cash-flow-forecasts'],
    queryFn: () => base44.entities.CashFlowForecast.list('month'),
    enabled: !!user,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['financial-alerts'],
    queryFn: () => base44.entities.FinancialAlert.filter({ is_resolved: false }),
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-finance'],
    queryFn: () => base44.entities.Project.list('name'),
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users-finance'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data?.users || [];
    },
    enabled: !!user,
  });

  // Calculate real-time cash position
  const totalReceived = receivables
    .filter(r => r.status === 'received')
    .reduce((sum, r) => sum + (r.received_amount || r.amount || 0), 0);

  const pendingReceivables = receivables
    .filter(r => r.status === 'pending' || r.status === 'partial')
    .reduce((sum, r) => sum + (r.pending_amount || ((r.amount || 0) - (r.received_amount || 0))), 0);

  const totalPaidPayables = payables
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.paid_amount || p.amount || 0), 0);

  const totalPaidSalaries = salaries
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + (s.net_salary || 0), 0);

  const totalPaidMarketing = marketingExpenses
    .reduce((sum, e) => sum + (e.spent_amount || 0), 0);

  const totalPaid = totalPaidPayables + totalPaidSalaries + totalPaidMarketing;

  const pendingPayables = payables
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + (p.pending_amount || ((p.amount || 0) - (p.paid_amount || 0))), 0);

  const currentCashPosition = totalReceived - totalPaid;

  // Upcoming payments (next 30 days)
  const today = new Date();
  const next30Days = new Date();
  next30Days.setDate(today.getDate() + 30);

  const upcomingReceivables = receivables.filter(r => {
    if (r.status === 'received') return false;
    const expectedDate = new Date(r.expected_date);
    return isAfter(expectedDate, today) && isBefore(expectedDate, next30Days);
  });

  const upcomingPayables = payables.filter(p => {
    if (p.status === 'paid') return false;
    const dueDate = new Date(p.due_date);
    return isAfter(dueDate, today) && isBefore(dueDate, next30Days);
  });

  const overduePayables = payables.filter(p => {
    if (p.status === 'paid') return false;
    const dueDate = new Date(p.due_date);
    return isBefore(dueDate, today);
  });

  // Monthly totals
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  // Salary data - get current month's salaries
  const currentMonth = format(new Date(), 'yyyy-MM');
  const monthlySalaryCost = salaries
    .filter(s => {
      // Handle both 'YYYY-MM' and 'Month YYYY' formats
      if (!s.month) return false;
      if (s.month === currentMonth) return true;
      // Also check if month starts with current month
      return s.month.startsWith(currentMonth);
    })
    .reduce((sum, s) => sum + (s.net_salary || 0), 0);

  // Marketing ROI - total all time
  const totalMarketingSpent = marketingExpenses
    .reduce((sum, e) => sum + (e.spent_amount || 0), 0);

  const monthlyIncome = receivables
    .filter(r => {
      if (r.status !== 'received') return false;
      const date = new Date(r.received_date || r.payment_date || r.created_date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    })
    .reduce((sum, r) => sum + (r.received_amount || r.amount || 0), 0);

  const monthlyPayables = payables
    .filter(p => {
      if (p.status !== 'paid') return false;
      const date = new Date(p.paid_date || p.due_date || p.created_date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    })
    .reduce((sum, p) => sum + (p.paid_amount || p.amount || 0), 0);

  const monthlyMarketingExpenses = marketingExpenses
    .filter(e => {
      const date = new Date(e.expense_date || e.created_date);
      return date >= currentMonthStart && date <= currentMonthEnd;
    })
    .reduce((sum, e) => sum + (e.spent_amount || 0), 0);

  const monthlyExpenses = monthlyPayables + monthlySalaryCost + monthlyMarketingExpenses;

  // Category breakdown
  const expensesByCategory = payables
    .filter(p => p.status === 'paid')
    .reduce((acc, p) => {
      const category = p.category || 'Other';
      acc[category] = (acc[category] || 0) + (p.amount || 0);
      return acc;
    }, {});

  const categoryData = Object.entries(expensesByCategory).map(([name, value]) => ({
    name,
    value
  }));

  // Project-wise P&L
  const projectPnL = projects.map(project => {
    const income = receivables
      .filter(r => r.project_id === project.id && r.status === 'received')
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const expenses = payables
      .filter(p => p.project_id === project.id && p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    return {
      name: project.name,
      income,
      expenses,
      profit: income - expenses
    };
  }).filter(p => p.income > 0 || p.expenses > 0);

  // Next 6 months forecast
  const forecastData = [];
  for (let i = 0; i < 6; i++) {
    const month = format(addMonths(new Date(), i), 'yyyy-MM');
    const forecast = cashFlowForecasts.find(f => f.month === month);
    
    forecastData.push({
      month: format(addMonths(new Date(), i), 'MMM yyyy'),
      inflow: forecast?.expected_inflow || 0,
      outflow: forecast?.expected_outflow || 0,
      net: (forecast?.expected_inflow || 0) - (forecast?.expected_outflow || 0)
    });
  }

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const handleExportReport = () => {
    const reportData = {
      cashPosition: currentCashPosition,
      totalReceived,
      totalPaid,
      pendingReceivables,
      pendingPayables,
      monthlyIncome,
      monthlyExpenses,
      monthlySalaryCost,
      totalMarketingSpent
    };

    const csv = [
      ['Financial Report', format(new Date(), 'PPP')],
      [],
      ['Cash Position', currentCashPosition],
      ['Total Received', totalReceived],
      ['Total Paid', totalPaid],
      ['Pending Receivables', pendingReceivables],
      ['Pending Payables', pendingPayables],
      [],
      ['This Month'],
      ['Income', monthlyIncome],
      ['Expenses', monthlyExpenses],
      ['Salary Cost', monthlySalaryCost],
      ['Marketing Spent', totalMarketingSpent]
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6 overflow-x-hidden w-full">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
              <Building className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-600 flex-shrink-0" />
              <span className="truncate">Real Estate Accounts</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">Financial Management & Forecasting</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleExportReport} className="flex-1 sm:flex-initial" size="sm">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Export Report</span>
            </Button>
          </div>
        </div>

        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Critical Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alerts.slice(0, 3).map(alert => (
                  <div key={alert.id} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                    <Bell className="w-4 h-4 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">{alert.alert_type}</div>
                      <div className="text-sm text-slate-600">{alert.message}</div>
                    </div>
                    <Badge variant="destructive">{alert.severity}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm opacity-90">Cash Position</div>
                  <div className="text-2xl sm:text-3xl font-bold mt-1 sm:mt-2 truncate">
                    ₹{(currentCashPosition / 100000).toFixed(2)}L
                  </div>
                  <div className="text-[10px] sm:text-xs mt-1 sm:mt-2 opacity-75">Real-time balance</div>
                </div>
                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 md:p-6">
              <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                  <div className="text-xs sm:text-sm text-slate-600">Total Received</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-600 mt-1 sm:mt-2 truncate">
                    ₹{(totalReceived / 100000).toFixed(2)}L
                  </div>
                  <div className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 truncate">
                    Pending: ₹{(pendingReceivables / 100000).toFixed(2)}L
                  </div>
                </div>
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-slate-600">Total Paid</div>
                  <div className="text-2xl font-bold text-red-600 mt-2">
                    ₹{(totalPaid / 100000).toFixed(2)}L
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Pending: ₹{(pendingPayables / 100000).toFixed(2)}L
                  </div>
                </div>
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-slate-600">This Month</div>
                  <div className={`text-2xl font-bold mt-2 ${monthlyIncome - monthlyExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ₹{((monthlyIncome - monthlyExpenses) / 100000).toFixed(2)}L
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Income: ₹{(monthlyIncome / 100000).toFixed(1)}L
                  </div>
                </div>
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Overview</TabsTrigger>
            <TabsTrigger value="upcoming" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Upcoming</TabsTrigger>
            <TabsTrigger value="projects" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Projects</TabsTrigger>
            <TabsTrigger value="expenses" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Expenses</TabsTrigger>
            <TabsTrigger value="forecast" className="text-xs sm:text-sm px-2 sm:px-3 py-2">Forecast</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

              {/* Cash Flow Trend */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-base sm:text-lg">6-Month Cash Flow Forecast</CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-4 md:p-6">
                  <div className="overflow-x-auto">
                    <div className="min-w-[500px]">
                      <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₹${(value / 100000).toFixed(2)}L`} />
                      <Legend />
                      <Line type="monotone" dataKey="inflow" stroke="#10B981" name="Inflow" />
                      <Line type="monotone" dataKey="outflow" stroke="#EF4444" name="Outflow" />
                      <Line type="monotone" dataKey="net" stroke="#4F46E5" name="Net" strokeWidth={2} />
                    </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${(value / 100000).toFixed(2)}L`} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-slate-400">
                      No expense data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600">Monthly Salary Cost</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">
                        ₹{(monthlySalaryCost / 100000).toFixed(2)}L
                      </div>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                  <Link to={createPageUrl('Salary')}>
                    <Button variant="link" className="p-0 mt-2 text-xs">
                      View Details →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600">Marketing Spent</div>
                      <div className="text-2xl font-bold text-slate-900 mt-1">
                        ₹{(totalMarketingSpent / 100000).toFixed(2)}L
                      </div>
                    </div>
                    <Target className="w-8 h-8 text-purple-600" />
                  </div>
                  <Link to={createPageUrl('MarketingExpenses')}>
                    <Button variant="link" className="p-0 mt-2 text-xs">
                      View Details →
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600">Overdue Payments</div>
                      <div className="text-2xl font-bold text-red-600 mt-1">
                        {overduePayables.length}
                      </div>
                    </div>
                    <Clock className="w-8 h-8 text-red-600" />
                  </div>
                  <Link to={createPageUrl('Payables')}>
                    <Button variant="link" className="p-0 mt-2 text-xs">
                      View Details →
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Upcoming Tab */}
          <TabsContent value="upcoming" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Upcoming Receivables */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-base sm:text-lg">
                    <span className="truncate">Upcoming Receivables (30 days)</span>
                    <Badge variant="outline">{upcomingReceivables.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 md:p-6">
                  <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
                    {upcomingReceivables.slice(0, 10).map(item => (
                      <div key={item.id} className="flex items-start sm:items-center justify-between p-2 sm:p-3 bg-slate-50 rounded-lg gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs sm:text-sm truncate">{item.description || item.client_name}</div>
                          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                            {format(new Date(item.expected_date), 'dd MMM yyyy')}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-green-600 text-sm sm:text-base">
                            ₹{(item.amount / 1000).toFixed(0)}K
                          </div>
                          <Badge variant="outline" className="text-[10px] sm:text-xs mt-1">{item.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {upcomingReceivables.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        No upcoming receivables
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Upcoming Payables */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Upcoming Payables (30 days)</span>
                    <Badge variant="outline">{upcomingPayables.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {upcomingPayables.slice(0, 10).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.description || item.vendor_name}</div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(item.due_date), 'dd MMM yyyy')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">
                            ₹{(item.amount / 1000).toFixed(0)}K
                          </div>
                          <Badge variant="outline" className="text-xs">{item.category}</Badge>
                        </div>
                      </div>
                    ))}
                    {upcomingPayables.length === 0 && (
                      <div className="text-center py-8 text-slate-400">
                        No upcoming payables
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle>Project-wise Profitability</CardTitle>
              </CardHeader>
              <CardContent>
                {projectPnL.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={projectPnL}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₹${(value / 100000).toFixed(2)}L`} />
                      <Legend />
                      <Bar dataKey="income" fill="#10B981" name="Income" />
                      <Bar dataKey="expenses" fill="#EF4444" name="Expenses" />
                      <Bar dataKey="profit" fill="#4F46E5" name="Profit" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    No project data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expenses Tab */}
          <TabsContent value="expenses">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              {Object.entries(expensesByCategory).map(([category, amount]) => (
                <Card key={category}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-slate-600">{category}</div>
                        <div className="text-2xl font-bold text-slate-900 mt-1">
                          ₹{(amount / 100000).toFixed(2)}L
                        </div>
                      </div>
                      <CreditCard className="w-8 h-8 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Forecast Tab */}
          <TabsContent value="forecast">
            <Card>
              <CardHeader>
                <CardTitle>6-Month Financial Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {forecastData.map((month, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-slate-900">{month.month}</div>
                        <Badge className={month.net >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          Net: ₹{(month.net / 100000).toFixed(2)}L
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-600">Expected Inflow</div>
                          <div className="font-medium text-green-600">₹{(month.inflow / 100000).toFixed(2)}L</div>
                        </div>
                        <div>
                          <div className="text-slate-600">Expected Outflow</div>
                          <div className="font-medium text-red-600">₹{(month.outflow / 100000).toFixed(2)}L</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}