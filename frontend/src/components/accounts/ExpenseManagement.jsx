import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Plus,
    Search,
    CreditCard,
    ShoppingBag,
    Users,
    Target,
    ArrowUpRight,
    Filter,
    Trash2,
    Edit,
    Eye,
    CheckCircle,
    MoreVertical,
    ChevronRight,
    Wallet,
    AlertCircle,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

export default function ExpenseManagement({ onNavigate }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('bills');
    const [billDialogOpen, setBillDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const queryClient = useQueryClient();

    // Queries
    const { data: bills = [], isLoading: billsLoading } = useQuery({
        queryKey: ['bills'],
        queryFn: () => base44.entities.Bill.list('-date'),
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: () => base44.entities.Vendor.list('name'),
    });

    const { data: salaries = [] } = useQuery({
        queryKey: ['salaries-expenses'],
        queryFn: () => base44.entities.SalaryRecord.list('-month'),
    });

    const { data: marketing = [] } = useQuery({
        queryKey: ['marketing-expenses'],
        queryFn: () => base44.entities.MarketingExpense.list('-date'),
    });

    // Mutations
    const createBillMutation = useMutation({
        mutationFn: (data) => base44.entities.Bill.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            setBillDialogOpen(false);
            resetBillForm();
            toast.success('Bill recorded successfully');
        },
        onError: (err) => {
            toast.error('Failed to record bill: ' + err.message);
        }
    });

    const deleteBillMutation = useMutation({
        mutationFn: (id) => base44.entities.Bill.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            toast.success('Bill deleted permanentaly');
        },
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => base44.entities.Bill.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bills'] });
            toast.success('Payment status updated');
        },
    });

    // Form State for new bill
    const [billFormData, setBillFormData] = useState({
        vendor_id: '',
        vendor_name: '',
        bill_number: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        items: [{ description: '', amount: 0 }],
        status: 'received'
    });

    const resetBillForm = () => {
        setBillFormData({
            vendor_id: '',
            vendor_name: '',
            bill_number: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            due_date: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
            items: [{ description: '', amount: 0 }],
            status: 'received'
        });
    };

    const handleAddBill = (e) => {
        e.preventDefault();
        const total = billFormData.items.reduce((sum, i) => sum + i.amount, 0);
        createBillMutation.mutate({ ...billFormData, total });
    };

    const totals = useMemo(() => {
        const billTotal = Array.isArray(bills) ? bills.reduce((sum, b) => sum + (b.total || 0), 0) : 0;
        const salaryTotal = Array.isArray(salaries) ? salaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.net_salary || 0), 0) : 0;
        const marketingTotal = Array.isArray(marketing) ? marketing.reduce((sum, m) => sum + (m.spent_amount || 0), 0) : 0;
        return { billTotal, salaryTotal, marketingTotal, all: billTotal + salaryTotal + marketingTotal };
    }, [bills, salaries, marketing]);

    const filteredBills = Array.isArray(bills) ? bills.filter(b =>
        b.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.bill_number?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-100 shadow-sm border-l-4 border-l-rose-500 overflow-hidden transform transition-all hover:scale-[1.02]">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Burn Rate</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter italic">₹{(totals.all / 100000).toFixed(2)}L</h3>
                                <p className="text-[10px] text-slate-400 mt-1 font-bold italic underline decoration-rose-200">Total Operational Cost</p>
                            </div>
                            <div className="p-2.5 bg-rose-50 rounded-xl shadow-inner">
                                <ArrowUpRight className="w-5 h-5 text-rose-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-100 shadow-sm border-l-4 border-l-indigo-500 overflow-hidden transform transition-all hover:scale-[1.02]">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Direct Vendor Pay</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">₹{(totals.billTotal / 100000).toFixed(2)}L</h3>
                                <p className="text-[10px] text-indigo-500 mt-1 font-black uppercase tracking-widest">{bills.length} Invoices</p>
                            </div>
                            <div className="p-2.5 bg-indigo-50 rounded-xl shadow-inner">
                                <ShoppingBag className="w-5 h-5 text-indigo-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-100 shadow-sm border-l-4 border-l-emerald-500 overflow-hidden transform transition-all hover:scale-[1.02]">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Payroll Disbursement</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">₹{(totals.salaryTotal / 100000).toFixed(2)}L</h3>
                                <p className="text-[10px] text-emerald-500 mt-1 font-black uppercase tracking-widest">Active Payroll</p>
                            </div>
                            <div className="p-2.5 bg-emerald-50 rounded-xl shadow-inner">
                                <Users className="w-5 h-5 text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-100 shadow-sm border-l-4 border-l-amber-500 overflow-hidden transform transition-all hover:scale-[1.02]">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Marketing Acquisition</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">₹{(totals.marketingTotal / 100000).toFixed(2)}L</h3>
                                <p className="text-[10px] text-amber-500 mt-1 font-black tracking-widest">Growth Capital</p>
                            </div>
                            <div className="p-2.5 bg-amber-50 rounded-xl shadow-inner">
                                <Target className="w-5 h-5 text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="bills" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-sm p-2 rounded-2xl border border-slate-100 shadow-xl shadow-slate-100/50">
                    <TabsList className="bg-slate-50 p-1 rounded-xl h-auto border-0">
                        <TabsTrigger value="bills" className="rounded-lg font-black text-[10px] uppercase tracking-wider h-10 px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 border-0 transition-all outline-none">
                            Vendor Bills
                        </TabsTrigger>
                        <TabsTrigger value="salaries" className="rounded-lg font-black text-[10px] uppercase tracking-wider h-10 px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 border-0 transition-all outline-none">
                            Payroll
                        </TabsTrigger>
                        <TabsTrigger value="marketing" className="rounded-lg font-black text-[10px] uppercase tracking-wider h-10 px-8 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-indigo-600 border-0 transition-all outline-none">
                            Marketing
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2 w-full sm:w-auto px-1">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                placeholder="Quick search records..."
                                className="pl-9 h-10 border-slate-200 rounded-xl text-xs font-semibold w-full sm:w-64 bg-slate-50 border-0 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {activeTab === 'bills' && (
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all" onClick={() => setBillDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Log Bill
                            </Button>
                        )}
                    </div>
                </div>

                <TabsContent value="bills" className="mt-6 space-y-4 outline-none">
                    <Card className="border-0 shadow-2xl rounded-[40px] overflow-hidden bg-white/90 backdrop-blur-2xl">
                        <Table>
                            <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                                <TableRow className="hover:bg-transparent border-0">
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] tracking-widest py-6 pl-10">Payee / Merchant Identity</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] tracking-widest py-6">Timeline</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] tracking-widest py-6">Due Expiry</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] tracking-widest py-6 text-right">Invoice Sum</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] tracking-widest py-6 text-center">Settlement</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] tracking-widest py-6 text-right pr-10">Control</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBills.map(bill => (
                                    <TableRow key={bill.id} className="hover:bg-indigo-50/30 transition-all group border-slate-50 last:border-0 border-b">
                                        <TableCell className="py-6 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-[18px] bg-white border border-slate-100 flex items-center justify-center text-slate-900 font-black text-xs uppercase shadow-xl shadow-slate-200 group-hover:rotate-6 transition-transform">
                                                    {bill.vendor_name?.substring(0, 2)}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="font-black text-slate-900 text-base tracking-tighter uppercase italic group-hover:text-indigo-600 transition-colors">{bill.vendor_name}</h4>
                                                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase font-mono">No: {bill.bill_number || 'TRX-99'}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 font-bold text-slate-600 text-[13px]">{bill.date ? format(new Date(bill.date), 'MMM dd, yyyy') : '-'}</TableCell>
                                        <TableCell className="py-6">
                                            <div className="flex items-center gap-2 font-black text-rose-500 text-[10px] uppercase tracking-widest bg-rose-50/50 px-3 py-1.5 rounded-full w-fit border border-rose-100 italic">
                                                Exp: {bill.due_date ? format(new Date(bill.due_date), 'MMM d, yy') : '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-6">
                                            <div className="font-black text-slate-900 text-xl italic tracking-tighter">₹{(bill.total || 0).toLocaleString()}</div>
                                        </TableCell>
                                        <TableCell className="py-6">
                                            <div className="flex justify-center">
                                                <Badge className={`rounded-[12px] px-5 py-2 font-black text-[9px] uppercase tracking-widest border-0 shadow-lg transition-all ${bill.status === 'paid' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                                    bill.status === 'overdue' ? 'bg-rose-500 text-white shadow-rose-200 animate-pulse' :
                                                        'bg-amber-400 text-white shadow-amber-100'
                                                    }`}>
                                                    {bill.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-6 pr-10">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-emerald-50 hover:text-emerald-600 rounded-2xl shadow-sm hover:shadow-emerald-100" onClick={() => statusMutation.mutate({ id: bill.id, status: 'paid' })}>
                                                    <CheckCircle className="w-5 h-5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-rose-50 hover:text-rose-500 rounded-2xl shadow-sm hover:shadow-rose-100" onClick={() => {
                                                    if (confirm('Purge this record?')) deleteBillMutation.mutate(bill.id);
                                                }}>
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!billsLoading && filteredBills.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-96 text-center border-0 hover:bg-transparent">
                                            <div className="flex flex-col items-center justify-center p-12 bg-slate-50/40 rounded-[40px] border-4 border-dashed border-slate-100 mx-10 my-16 group hover:bg-slate-50 transition-all">
                                                <div className="w-24 h-24 bg-white rounded-[40px] flex items-center justify-center mb-8 rotate-12 group-hover:rotate-0 transition-all shadow-2xl shadow-slate-200">
                                                    <ShoppingBag className="w-12 h-12 text-slate-100 group-hover:text-indigo-200 transition-colors" />
                                                </div>
                                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2 italic underline decoration-indigo-200 underline-offset-8">Account Balance Equilibrium</h3>
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px] max-w-xs leading-relaxed">No outstanding liabilities detected in the system.</p>
                                                <Button className="mt-8 bg-slate-900 hover:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl h-14 px-12 shadow-2xl transition-all active:scale-95" onClick={() => setBillDialogOpen(true)}>
                                                    <Plus className="w-5 h-5 mr-3" /> Start Expense Logging
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="salaries" className="mt-6 outline-none">
                    <Card className="border-0 shadow-2xl rounded-[40px] overflow-hidden bg-white/70 backdrop-blur-xl">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-0">
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 pl-10 tracking-widest">Personnel Identity</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 tracking-widest">Pay Period</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 text-right tracking-widest">Disbursement Sum</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 text-center tracking-widest">State</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 text-right pr-10 tracking-widest">Navigation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salaries.map(sal => (
                                    <TableRow key={sal.id} className="hover:bg-white transition-all group border-slate-50 last:border-0 border-b">
                                        <TableCell className="py-6 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs border border-emerald-100">
                                                    {sal.employee_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-900 text-base uppercase italic tracking-tighter underline underline-offset-4 decoration-emerald-100 decoration-4 group-hover:decoration-emerald-400 transition-all">{sal.employee_name}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1 font-mono">{sal.employee_email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 font-black text-slate-600 uppercase italic tracking-widest text-xs">{sal.month}</TableCell>
                                        <TableCell className="py-6 text-right">
                                            <div className="font-black text-slate-900 text-lg italic tracking-tighter italic">₹{sal.net_salary?.toLocaleString()}</div>
                                        </TableCell>
                                        <TableCell className="py-6">
                                            <div className="flex justify-center">
                                                <Badge className={`rounded-xl px-4 py-1.5 font-black text-[9px] uppercase tracking-widest border-0 ${sal.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {sal.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 text-right pr-10">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-10 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:bg-slate-900 hover:text-white shadow-sm transition-all active:scale-95 group-hover:shadow-lg"
                                                onClick={() => navigate('/Salary')}
                                            >
                                                Deep Dive <ChevronRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="marketing" className="mt-6 outline-none">
                    <Card className="border-0 shadow-2xl rounded-[40px] overflow-hidden bg-white/70 backdrop-blur-xl">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow className="border-0">
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 pl-10 tracking-widest">Campaign Assets</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 tracking-widest">Record Timestamp</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 text-right tracking-widest">Direct Capital Burn</TableHead>
                                    <TableHead className="font-black text-slate-400 uppercase text-[9px] py-6 text-right pr-10 tracking-widest">Cap Allocation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {marketing.map(mt => (
                                    <TableRow key={mt.id} className="hover:bg-white transition-all border-slate-50 border-b last:border-0 group transition-all">
                                        <TableCell className="py-6 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-black text-xs border border-amber-100 group-hover:scale-110 transition-all">
                                                    MT
                                                </div>
                                                <div className="font-black text-slate-900 uppercase italic tracking-tighter text-base">
                                                    {mt.campaign_name || 'Generic Growth Ops'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-6 text-slate-500 font-bold text-sm">
                                            {mt.date ? format(new Date(mt.date), 'MMM dd, yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="py-6 text-right">
                                            <div className="font-black text-rose-500 text-xl italic tracking-tighter">₹{mt.spent_amount?.toLocaleString()}</div>
                                        </TableCell>
                                        <TableCell className="py-6 text-right pr-10 font-black text-slate-300 italic text-sm tracking-tighter">
                                            {mt.allocated_budget ? `₹${mt.allocated_budget.toLocaleString()}` : 'OVER_LIMIT'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* New Bill Dialog */}
            <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
                <DialogContent className="max-w-2xl bg-slate-50 border-0 shadow-3xl p-0 overflow-hidden rounded-[48px] animate-in zoom-in-95 duration-200">
                    <div className="bg-white px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                        <DialogTitle className="text-2xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-4">
                            <div className="p-3 bg-red-50 rounded-[20px] shadow-sm">
                                <ShoppingBag className="w-6 h-6 text-red-600" />
                            </div>
                            Register Expense Bill
                        </DialogTitle>
                        <button onClick={() => setBillDialogOpen(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={handleAddBill} className="p-10 space-y-8">
                        <div className="grid grid-cols-2 gap-6 bg-white p-8 rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100">
                            <div className="space-y-2 col-span-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Merchant / Vendor Identity</Label>
                                <Input
                                    required
                                    className="h-14 border-0 bg-slate-50 rounded-[22px] px-6 text-base font-black text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500 transition-all"
                                    placeholder="e.g. AWS, Local Stationery, Maintenance Corp"
                                    value={billFormData.vendor_name}
                                    onChange={(e) => setBillFormData({ ...billFormData, vendor_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Vendor Ref #</Label>
                                <Input
                                    className="h-12 border-0 bg-slate-50 rounded-[20px] px-4 font-mono text-sm font-bold text-slate-600 focus:ring-2 focus:ring-red-500 transition-all"
                                    placeholder="INV-XX-001"
                                    value={billFormData.bill_number}
                                    onChange={(e) => setBillFormData({ ...billFormData, bill_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Bill Total Sum</Label>
                                <Input
                                    type="number"
                                    required
                                    className="h-12 border-0 bg-slate-100 rounded-[20px] px-4 font-black text-red-600 text-lg italic shadow-inner outline-none"
                                    placeholder="0.00"
                                    value={billFormData.items[0].amount}
                                    onChange={(e) => {
                                        const newItems = [...billFormData.items];
                                        newItems[0].amount = parseFloat(e.target.value) || 0;
                                        setBillFormData({ ...billFormData, items: newItems });
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Issue Date</Label>
                                <Input
                                    type="date"
                                    required
                                    className="h-12 border-0 bg-slate-50 rounded-[20px] px-4 font-bold text-slate-600 focus:ring-2 focus:ring-red-500 transition-all"
                                    value={billFormData.date}
                                    onChange={(e) => setBillFormData({ ...billFormData, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2">Due Expiry</Label>
                                <Input
                                    type="date"
                                    required
                                    className="h-12 border-0 bg-slate-50 rounded-[20px] px-4 font-bold text-slate-600 focus:ring-2 focus:ring-red-500 transition-all"
                                    value={billFormData.due_date}
                                    onChange={(e) => setBillFormData({ ...billFormData, due_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="bg-amber-50/50 p-6 rounded-[32px] border border-amber-100 flex gap-4 text-amber-700 shadow-sm shadow-amber-50">
                            <AlertCircle className="w-6 h-6 flex-shrink-0" />
                            <p className="text-[11px] font-black uppercase leading-relaxed tracking-tight py-1">
                                Security Warning: This bill will be logged as an untracked liability in your P&L statement until the settlement flow is finalized.
                            </p>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <Button type="button" variant="ghost" className="flex-1 rounded-[24px] h-14 font-black uppercase tracking-widest text-slate-400 hover:bg-slate-100 transition-all" onClick={() => setBillDialogOpen(false)}>Abort Transition</Button>
                            <Button type="submit" className="flex-1 rounded-[24px] h-14 bg-slate-900 hover:bg-red-600 text-white font-black uppercase tracking-widest shadow-2xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50" disabled={createBillMutation.isPending}>
                                Commit Record <ArrowUpRight className="w-5 h-5 ml-2" />
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
