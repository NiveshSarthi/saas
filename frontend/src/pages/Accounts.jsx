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
  LayoutDashboard
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

export default function AccountsPage({ defaultTab = 'dashboard' }) {
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

  const summary = React.useMemo(() => {
    const revenue = Array.isArray(invoices) ? invoices.reduce((sum, inv) => sum + (inv.total || 0), 0) : 0;
    const expenses = Array.isArray(bills) ? bills.reduce((sum, b) => sum + (b.total || 0), 0) : 0;
    const pendingAr = Array.isArray(invoices) ? invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + (i.total || 0), 0) : 0;
    return { revenue, expenses, cash: revenue - expenses, pendingAr };
  }, [invoices, bills]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-10 space-y-10">
      {/* Premium Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-[1000] text-slate-900 tracking-tighter flex items-center gap-4 italic uppercase">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200 rotate-3 group overflow-hidden">
              <Building className="w-6 h-6 text-white group-hover:scale-125 transition-transform" />
            </div>
            Accounting <span className="text-indigo-600 not-italic">&</span> Finance
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em] pl-1">Hyper-growth Financial Infrastructure</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Cash Position</span>
            <span className="text-lg font-black text-indigo-600 italic tracking-tighter">₹{(summary.cash / 100000).toFixed(2)}L</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Open Receivables</span>
            <span className="text-lg font-black text-rose-500 italic tracking-tighter">₹{(summary.pendingAr / 100000).toFixed(2)}L</span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-10">
        <div className="sticky top-4 z-20 overflow-x-auto pb-4">
          <TabsList className="bg-white/80 backdrop-blur-xl p-2 rounded-[28px] h-auto border border-white shadow-2xl shadow-slate-200/50 inline-flex flex-nowrap min-w-max outline-none">
            <TabsTrigger value="dashboard" className="rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] h-12 px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <LayoutDashboard className="w-4 h-4" /> Operations Hub
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] h-12 px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <Users className="w-4 h-4" /> Client Accounts
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] h-12 px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <FileText className="w-4 h-4" /> Revenue & Billing
            </TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] h-12 px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <CreditCard className="w-4 h-4" /> Expense Management
            </TabsTrigger>
            <TabsTrigger value="reports" className="rounded-2xl font-black text-[10px] uppercase tracking-[0.1em] h-12 px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-none border-0 transition-all flex items-center gap-2 outline-none">
              <PieChartIcon className="w-4 h-4" /> Intelligence
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Dashboard Content */}
        <TabsContent value="dashboard" className="space-y-10 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-[40px] border-0 shadow-2xl shadow-indigo-100 overflow-hidden relative group transform transition-all hover:-translate-y-2">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-[40px] rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-700" />
              <CardContent className="p-8 space-y-6 relative z-10">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <Badge className="bg-white/20 text-white border-0 hover:bg-white/30 rounded-full font-black text-[8px] tracking-widest px-3 py-1">LIVE_SYNC</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Aggregate Revenue</p>
                  <h3 className="text-4xl font-black italic tracking-tighter">₹{(summary.revenue / 100000).toFixed(2)}L</h3>
                  <div className="flex items-center gap-2 mt-5">
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 w-[72%]" />
                    </div>
                    <span className="text-[10px] font-black italic whitespace-nowrap">72% Goal</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-[40px] border-0 shadow-2xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-2">
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-rose-50 rounded-2xl group-hover:bg-rose-500 transition-colors border border-rose-100">
                    <TrendingDown className="w-6 h-6 text-rose-500 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-rose-500 text-[10px] font-black uppercase tracking-widest italic">+4.2% Delta</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Capital Outflow</p>
                  <h3 className="text-4xl font-[1000] text-slate-900 tracking-tighter italic">₹{(summary.expenses / 100000).toFixed(2)}L</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">Liability tracking Active</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-[40px] border-0 shadow-2xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-2">
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-600 transition-colors border border-emerald-100">
                    <DollarSign className="w-6 h-6 text-emerald-500 group-hover:text-white transition-colors" />
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 rounded-full font-black text-[8px] tracking-widest px-3 py-1">SOLVENT</Badge>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Pre-Tax Profits</p>
                  <h3 className="text-4xl font-[1000] text-slate-900 tracking-tighter italic">₹{((summary.revenue - summary.expenses) / 100000).toFixed(2)}L</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest italic decoration-emerald-400 underline underline-offset-4 decoration-2">Net Value Realization</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-[40px] border-0 shadow-2xl shadow-slate-200/50 overflow-hidden group transform transition-all hover:-translate-y-2 relative">
              <CardContent className="p-8 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-amber-50 rounded-2xl group-hover:bg-amber-500 transition-colors border border-amber-100">
                    <ShoppingBag className="w-6 h-6 text-amber-500 group-hover:text-white transition-colors" />
                  </div>
                  <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest italic">Awaiting Float</span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Float Value (AR)</p>
                  <h3 className="text-4xl font-[1000] text-slate-900 tracking-tighter italic">₹{(summary.pendingAr / 100000).toFixed(2)}L</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">Aging Collections</p>
                </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-400" />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-white rounded-[48px] border-0 shadow-2xl shadow-slate-200/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-10 border-b border-slate-50">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-4 underline decoration-indigo-500 underline-offset-8 decoration-4">
                    <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                    Critical Inflow Monitor
                  </h3>
                  <Button
                    variant="ghost"
                    className="text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-50 px-6 h-11 rounded-xl"
                    onClick={() => setActiveTab('invoices')}
                  >
                    View High-Value Invoices <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                <div className="p-6 space-y-3">
                  {invoices.filter(i => i.total > 10000).slice(0, 5).map(inv => (
                    <div key={inv.id} className="flex items-center justify-between p-6 bg-slate-50/40 rounded-[28px] border border-slate-100/50 hover:bg-white hover:shadow-2xl hover:shadow-indigo-100/40 transition-all group scale-[0.98] hover:scale-100">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center font-black text-indigo-600 text-[10px] group-hover:border-indigo-200 transition-all">
                          <FileText className="w-5 h-5 mb-0.5 opacity-20" />
                          {inv.invoice_number?.slice(-3)}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 uppercase tracking-tighter text-lg group-hover:text-indigo-600 transition-colors italic">{inv.client_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">{inv.invoice_number}</p>
                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{inv.date ? format(new Date(inv.date), 'MMM d') : '-'} Issued</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900 italic tracking-tighter text-2xl">₹{inv.total?.toLocaleString()}</p>
                        <div className="mt-2 scale-110 origin-right">
                          {inv.status === 'paid' ?
                            <Badge className="bg-emerald-500 text-white border-0 font-black text-[8px] uppercase tracking-widest px-3">Settled</Badge> :
                            <Badge className="bg-amber-400 text-white border-0 font-black text-[8px] uppercase tracking-widest px-3">Active Float</Badge>
                          }
                        </div>
                      </div>
                    </div>
                  ))}
                  {invoices.length === 0 && (
                    <div className="py-24 flex flex-col items-center justify-center opacity-30 grayscale translate-y-4">
                      <ShoppingBag className="w-16 h-16 mb-4 text-slate-400" />
                      <p className="font-black uppercase tracking-[0.3em] text-xs text-slate-500 italic">No enterprise activity detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-8">
              <Card className="bg-slate-900 text-white rounded-[48px] border-0 shadow-3xl p-10 relative overflow-hidden group flex flex-col justify-between h-[340px]">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/20 blur-[80px] rounded-full -mr-24 -mt-24 group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10 space-y-4">
                  <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-6 border-b border-white/10 pb-4 inline-block">Taxation Intelligence</h4>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-black italic tracking-tighter text-white">₹0</span>
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest italic">Est. ITC</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] leading-relaxed">System-estimated Input Tax Credit based on logged vendor liabilities.</p>
                </div>
                <Button className="w-full h-16 bg-white hover:bg-indigo-600 text-slate-900 hover:text-white font-black uppercase tracking-widest rounded-3xl transition-all shadow-2xl shadow-black active:scale-95 text-xs relative z-10">
                  Download Tax Ledger
                </Button>
              </Card>

              <Card className="bg-indigo-600 text-white rounded-[48px] border-0 shadow-3xl p-10 relative overflow-hidden group h-[320px] flex flex-col justify-between">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/20 blur-[80px] rounded-full -ml-24 -mb-24 group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10 space-y-4">
                  <div className="p-4 bg-white/20 rounded-[24px] w-fit shadow-xl border border-white/20">
                    <LayoutDashboard className="w-7 h-7" />
                  </div>
                  <h4 className="text-2xl font-[1000] italic uppercase tracking-tighter leading-[1.1] text-white/95">Run Liquidity <br /> Simulations</h4>
                  <p className="text-[10px] text-white/60 font-black uppercase tracking-[0.2em] leading-relaxed">Analyze 120-day runway based on historical burn & projected inflow.</p>
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