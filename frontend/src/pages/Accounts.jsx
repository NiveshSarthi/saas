import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Building,
  BarChart3,
  FileText,
  Users,
  CreditCard,
  PieChart as PieChartIcon,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  TrendingDown,
  ChevronRight,
  LayoutDashboard,
  Wallet
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// New Sub-components
import ClientManagement from '@/components/accounts/ClientManagement';
import InvoiceManagement from '@/components/accounts/InvoiceManagement';
import ExpenseManagement from '@/components/accounts/ExpenseManagement';
import FinancialReports from '@/components/accounts/FinancialReports';

export default function AccountsPage({ defaultTab = 'dashboard', onNavigate }) {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState(defaultTab);

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

  // Fetch Summary Data for Dashboard
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-summary'],
    queryFn: () => base44.entities.Invoice.list(),
    enabled: !!user,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ['bills-summary'],
    queryFn: () => base44.entities.Bill.list(),
    enabled: !!user,
  });

  const { data: pettyCashDrawers = [] } = useQuery({
    queryKey: ['petty-cash-drawers'],
    queryFn: () => base44.entities.PettyCashDrawer.list(),
    enabled: !!user,
  });

  const { data: pettyCashTransactions = [] } = useQuery({
    queryKey: ['petty-cash-transactions-summary'],
    queryFn: () => base44.entities.PettyCashReimbursement.list(),
    enabled: !!user,
  });

  const summary = React.useMemo(() => {
    const revenue = Array.isArray(invoices) ? invoices.reduce((sum, inv) => sum + (inv.total || 0), 0) : 0;
    const expenses = Array.isArray(bills) ? bills.reduce((sum, b) => sum + (b.total || 0), 0) : 0;
    const pendingAr = Array.isArray(invoices) ? invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + (i.total || 0), 0) : 0;

    const pettyCashLiquidity = Array.isArray(pettyCashDrawers) ? pettyCashDrawers.reduce((sum, d) => sum + (d.balance || 0), 0) : 0;
    const pettyCashDisbursed = Array.isArray(pettyCashTransactions) ? pettyCashTransactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0) : 0;

    return { revenue, expenses, cash: revenue - expenses, pendingAr, pettyCashLiquidity, pettyCashDisbursed };
  }, [invoices, bills, pettyCashDrawers, pettyCashTransactions]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-10 space-y-10">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 group overflow-hidden">
              <Building className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
            </div>
            Accounting <span className="text-indigo-600">&</span> Finance
          </h1>
          <p className="text-sm font-medium text-slate-500 pl-1">Hyper-growth Financial Infrastructure</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Net Cash Position</span>
            <span className="text-xl font-bold text-indigo-600">₹{(summary.cash / 100000).toFixed(2)}L</span>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Open Receivables</span>
            <span className="text-xl font-bold text-rose-500">₹{(summary.pendingAr / 100000).toFixed(2)}L</span>
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center group cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => onNavigate?.('petty_cash')}>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Petty Cash Liquidity</span>
            <span className="text-xl font-bold text-amber-600">₹{summary.pettyCashLiquidity?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
        <div className="sticky top-4 z-20 overflow-x-auto pb-2">
          <TabsList className="bg-white/80 backdrop-blur-md p-1 rounded-xl h-auto border border-slate-200 shadow-sm inline-flex flex-nowrap min-w-max outline-none">
            <TabsTrigger value="dashboard" className="rounded-lg font-semibold text-sm h-10 px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <LayoutDashboard className="w-4 h-4" /> Operations Hub
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-lg font-semibold text-sm h-10 px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <Users className="w-4 h-4" /> Client Accounts
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg font-semibold text-sm h-10 px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <FileText className="w-4 h-4" /> Revenue & Billing
            </TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg font-semibold text-sm h-10 px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <CreditCard className="w-4 h-4" /> Expense Management
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-lg font-semibold text-sm h-10 px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <PieChartIcon className="w-4 h-4" /> Intelligence
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Dashboard Content */}
        <TabsContent value="dashboard" className="space-y-8 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl border-0 shadow-xl shadow-indigo-100 overflow-hidden relative group transform transition-all hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
              <CardContent className="p-6 space-y-4 relative z-10">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <Badge className="bg-white/20 text-white border-0 hover:bg-white/30 rounded-full font-bold text-[10px] tracking-wide px-2 py-1">LIVE_SYNC</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Aggregate Revenue</p>
                  <h3 className="text-3xl font-bold tracking-tight">₹{(summary.revenue / 100000).toFixed(2)}L</h3>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-[72%]" />
                    </div>
                    <span className="text-xs font-semibold whitespace-nowrap">72% Goal</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-1">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-rose-50 rounded-lg group-hover:bg-rose-500 transition-colors border border-rose-100">
                    <TrendingDown className="w-5 h-5 text-rose-500 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-rose-500 text-xs font-bold uppercase tracking-wide">+4.2% Delta</span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Capital Outflow</p>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">₹{(summary.expenses / 100000).toFixed(2)}L</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wide">Liability tracking Active</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-1">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-600 transition-colors border border-emerald-100">
                    <DollarSign className="w-5 h-5 text-emerald-500 group-hover:text-white transition-colors" />
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 rounded-full font-bold text-[10px] tracking-wide px-2 py-1">SOLVENT</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Pre-Tax Profits</p>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">₹{((summary.revenue - summary.expenses) / 100000).toFixed(2)}L</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wide">Net Value Realization</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-1 relative">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-500 transition-colors border border-amber-100">
                    <ShoppingBag className="w-5 h-5 text-amber-500 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-amber-500 text-xs font-bold uppercase tracking-wide">Awaiting Float</span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Float Value (AR)</p>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">₹{(summary.pendingAr / 100000).toFixed(2)}L</h3>
                  <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wide">Aging Collections</p>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-400" />
            </Card>

            {/* Petty Cash Operations Card */}
            <Card className="bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-1 relative cursor-pointer" onClick={() => onNavigate?.('petty_cash')}>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-600 transition-colors border border-indigo-100">
                    <Wallet className="w-5 h-5 text-indigo-500 group-hover:text-white transition-colors" />
                  </div>
                  <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 rounded-full font-bold text-[10px] tracking-wide px-2 py-1">OPERATIONAL</Badge>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Petty Cash Status</p>
                  <h3 className="text-3xl font-bold text-slate-900 tracking-tight">₹{summary.pettyCashLiquidity?.toLocaleString()}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Available Balance</p>
                    <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest">Disbursed: ₹{summary.pettyCashDisbursed?.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600" />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-6 border-b border-slate-50">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    Critical Inflow Monitor
                  </h3>
                  <Button
                    variant="ghost"
                    className="text-indigo-600 font-semibold text-xs uppercase tracking-wide hover:bg-indigo-50 px-4 h-9 rounded-lg"
                    onClick={() => setActiveTab('invoices')}
                  >
                    View High-Value Invoices <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="p-4 space-y-3">
                  {invoices.filter(i => i.total > 10000).slice(0, 5).map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-lg hover:shadow-indigo-100/20 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center font-bold text-indigo-600 text-[10px] group-hover:border-indigo-200 transition-all">
                          <FileText className="w-4 h-4 mb-0.5 opacity-40" />
                          {inv.invoice_number?.slice(-3)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">{inv.client_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] font-semibold text-slate-400 font-mono">{inv.invoice_number}</p>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <p className="text-[10px] font-semibold text-slate-400">{inv.date ? format(new Date(inv.date), 'MMM d') : '-'} Issued</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900 text-lg">₹{inv.total?.toLocaleString()}</p>
                        <div className="mt-1">
                          {inv.status === 'paid' ?
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 font-bold text-[10px] px-2 py-0.5">Settled</Badge> :
                            <Badge className="bg-amber-100 text-amber-700 border-0 font-bold text-[10px] px-2 py-0.5">Active Float</Badge>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                  {invoices.length === 0 && (
                    <div className="py-16 flex flex-col items-center justify-center opacity-40">
                      <ShoppingBag className="w-12 h-12 mb-3 text-slate-400" />
                      <p className="font-medium text-sm text-slate-500">No enterprise activity detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-slate-900 text-white rounded-2xl border-0 shadow-2xl p-6 relative overflow-hidden group flex flex-col justify-between h-[300px]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 blur-[80px] rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10 space-y-4">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 border-b border-white/10 pb-3 inline-block">Taxation Intelligence</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold tracking-tight text-white">₹0</span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Est. ITC</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium leading-relaxed">System-estimated Input Tax Credit based on logged vendor liabilities.</p>
                </div>
                <Button className="w-full h-12 bg-white hover:bg-indigo-600 text-slate-900 hover:text-white font-bold text-sm rounded-xl transition-all shadow-lg active:scale-95 relative z-10">
                  Download Tax Ledger
                </Button>
              </Card>

              <Card className="bg-indigo-600 text-white rounded-2xl border-0 shadow-2xl p-6 relative overflow-hidden group h-[280px] flex flex-col justify-between">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/20 blur-[80px] rounded-full -ml-24 -mb-24 group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10 space-y-4">
                  <div className="p-3 bg-white/20 rounded-xl w-fit shadow-lg border border-white/20">
                    <LayoutDashboard className="w-6 h-6" />
                  </div>
                  <h4 className="text-2xl font-bold tracking-tight leading-tight text-white">Run Liquidity Simulations</h4>
                  <p className="text-xs text-white/70 font-medium leading-relaxed">Analyze 120-day runway based on historical burn & projected inflow.</p>
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="outline-none">
          <ClientManagement onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="invoices" className="outline-none">
          <InvoiceManagement onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="expenses" className="outline-none">
          <ExpenseManagement onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="reports" className="outline-none">
          <FinancialReports onNavigate={setActiveTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}