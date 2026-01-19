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
                                <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-1">Total Burn Rate</p>
                                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">₹{(totals.all / 100000).toFixed(2)}L</h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium">Total Operational Cost</p>
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
                                <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-1">Direct Vendor Pay</p>
                                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">₹{(totals.billTotal / 100000).toFixed(2)}L</h3>
                                <p className="text-xs text-indigo-500 mt-1 font-bold uppercase tracking-wide">{bills.length} Invoices</p>
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
                                <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-1">Payroll Disbursement</p>
                                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">₹{(totals.salaryTotal / 100000).toFixed(2)}L</h3>
                                <p className="text-xs text-emerald-500 mt-1 font-bold uppercase tracking-wide">Active Payroll</p>
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
                                <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-1">Marketing Acquisition</p>
                                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">₹{(totals.marketingTotal / 100000).toFixed(2)}L</h3>
                                <p className="text-xs text-amber-500 mt-1 font-bold tracking-wide">Growth Capital</p>
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
                        <TabsTrigger value="bills" className="rounded-lg font-bold text-xs uppercase tracking-wide h-10 px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 border-0 transition-all outline-none">
                            Vendor Bills
                        </TabsTrigger>
                        <TabsTrigger value="salaries" className="rounded-lg font-bold text-xs uppercase tracking-wide h-10 px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 border-0 transition-all outline-none">
                            Payroll
                        </TabsTrigger>
                        <TabsTrigger value="marketing" className="rounded-lg font-bold text-xs uppercase tracking-wide h-10 px-8 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 border-0 transition-all outline-none">
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
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-xl font-bold text-xs uppercase tracking-wide shadow-lg shadow-slate-200 active:scale-95 transition-all" onClick={() => setBillDialogOpen(true)}>
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
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] tracking-wide py-4 pl-10">Payee / Merchant Identity</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] tracking-wide py-4">Timeline</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] tracking-wide py-4">Due Expiry</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] tracking-wide py-4 text-right">Invoice Sum</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] tracking-wide py-4 text-center">Settlement</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] tracking-wide py-4 text-right pr-10">Control</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredBills.map(bill => (
                                    <TableRow key={bill.id} className="hover:bg-indigo-50/30 transition-all group border-slate-50 last:border-0 border-b">
                                        <TableCell className="py-4 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs uppercase shadow-sm group-hover:rotate-6 transition-transform">
                                                    {bill.vendor_name?.substring(0, 2)}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h4 className="font-bold text-slate-900 text-sm tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{bill.vendor_name}</h4>
                                                    <p className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase font-mono">No: {bill.bill_number || 'TRX-99'}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 font-medium text-slate-600 text-xs">{bill.date ? format(new Date(bill.date), 'MMM dd, yyyy') : '-'}</TableCell>
                                        <TableCell className="py-4">
                                            <div className="flex items-center gap-2 font-bold text-rose-500 text-[10px] uppercase tracking-wide bg-rose-50/50 px-2 py-1 rounded-lg w-fit border border-rose-100">
                                                Exp: {bill.due_date ? format(new Date(bill.due_date), 'MMM d, yy') : '-'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            <div className="font-bold text-slate-900 text-base tracking-tight">₹{(bill.total || 0).toLocaleString()}</div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="flex justify-center">
                                                <Badge className={`rounded-lg px-3 py-1 font-bold text-[9px] uppercase tracking-wide border-0 shadow-sm transition-all ${bill.status === 'paid' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                                                    bill.status === 'overdue' ? 'bg-rose-500 text-white shadow-rose-200 animate-pulse' :
                                                        'bg-amber-400 text-white shadow-amber-100'
                                                    }`}>
                                                    {bill.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-4 pr-10">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg shadow-sm hover:shadow-emerald-100" onClick={() => statusMutation.mutate({ id: bill.id, status: 'paid' })}>
                                                    <CheckCircle className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-rose-50 hover:text-rose-500 rounded-lg shadow-sm hover:shadow-rose-100" onClick={() => {
                                                    if (confirm('Purge this record?')) deleteBillMutation.mutate(bill.id);
                                                }}>
                                                    <Trash2 className="w-4 h-4" />
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
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 pl-10 tracking-wide">Personnel Identity</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 tracking-wide">Pay Period</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 text-right tracking-wide">Disbursement Sum</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 text-center tracking-wide">State</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 text-right pr-10 tracking-wide">Navigation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {salaries.map(sal => (
                                    <TableRow key={sal.id} className="hover:bg-white transition-all group border-slate-50 last:border-0 border-b">
                                        <TableCell className="py-4 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-xs border border-emerald-100">
                                                    {sal.employee_name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-sm uppercase tracking-tight underline underline-offset-4 decoration-emerald-100 decoration-2 group-hover:decoration-emerald-400 transition-all">{sal.employee_name}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide mt-1 font-mono">{sal.employee_email}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 font-semibold text-slate-600 uppercase tracking-wide text-xs">{sal.month}</TableCell>
                                        <TableCell className="py-4 text-right">
                                            <div className="font-bold text-slate-900 text-base tracking-tight">₹{sal.net_salary?.toLocaleString()}</div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <div className="flex justify-center">
                                                <Badge className={`rounded-lg px-3 py-1 font-bold text-[9px] uppercase tracking-wide border-0 ${sal.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {sal.status}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 text-right pr-10">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wide text-indigo-600 hover:bg-slate-900 hover:text-white shadow-sm transition-all active:scale-95 group-hover:shadow-md"
                                                onClick={() => navigate('/Salary')}
                                            >
                                                Deep Dive <ChevronRight className="w-3 h-3 ml-2" />
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
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 pl-10 tracking-wide">Campaign Assets</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 tracking-wide">Record Timestamp</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 text-right tracking-wide">Direct Capital Burn</TableHead>
                                    <TableHead className="font-bold text-slate-500 uppercase text-[9px] py-4 text-right pr-10 tracking-wide">Cap Allocation</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {marketing.map(mt => (
                                    <TableRow key={mt.id} className="hover:bg-white transition-all border-slate-50 border-b last:border-0 group transition-all">
                                        <TableCell className="py-4 pl-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold text-xs border border-amber-100 group-hover:scale-105 transition-all">
                                                    MT
                                                </div>
                                                <div className="font-bold text-slate-900 uppercase tracking-tight text-sm">
                                                    {mt.campaign_name || 'Generic Growth Ops'}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4 text-slate-500 font-medium text-xs">
                                            {mt.date ? format(new Date(mt.date), 'MMM dd, yyyy') : '-'}
                                        </TableCell>
                                        <TableCell className="py-4 text-right">
                                            <div className="font-bold text-rose-500 text-base tracking-tight">₹{mt.spent_amount?.toLocaleString()}</div>
                                        </TableCell>
                                        <TableCell className="py-4 text-right pr-10 font-medium text-slate-400 text-xs tracking-tight">
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
                        <DialogTitle className="text-xl font-bold text-slate-900 uppercase tracking-tight flex items-center gap-4">
                            <div className="p-2 bg-red-50 rounded-xl shadow-sm">
                                <ShoppingBag className="w-5 h-5 text-red-600" />
                            </div>
                            Register Expense Bill
                        </DialogTitle>
                        <button onClick={() => setBillDialogOpen(false)} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleAddBill} className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-5 bg-white p-6 rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100">
                            <div className="space-y-2 col-span-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wide pl-2">Merchant / Vendor Identity</Label>
                                <Input
                                    required
                                    className="h-12 border-0 bg-slate-50 rounded-xl px-4 text-base font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-red-500 transition-all"
                                    placeholder="e.g. AWS, Local Stationery, Maintenance Corp"
                                    value={billFormData.vendor_name}
                                    onChange={(e) => setBillFormData({ ...billFormData, vendor_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wide pl-2">Vendor Ref #</Label>
                                <Input
                                    className="h-11 border-0 bg-slate-50 rounded-xl px-4 font-mono text-sm font-semibold text-slate-600 focus:ring-2 focus:ring-red-500 transition-all"
                                    placeholder="INV-XX-001"
                                    value={billFormData.bill_number}
                                    onChange={(e) => setBillFormData({ ...billFormData, bill_number: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wide pl-2">Bill Total Sum</Label>
                                <Input
                                    type="number"
                                    required
                                    className="h-11 border-0 bg-slate-100 rounded-xl px-4 font-bold text-red-600 text-lg shadow-inner outline-none"
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
                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wide pl-2">Issue Date</Label>
                                <Input
                                    type="date"
                                    required
                                    className="h-11 border-0 bg-slate-50 rounded-xl px-4 font-semibold text-slate-600 focus:ring-2 focus:ring-red-500 transition-all"
                                    value={billFormData.date}
                                    onChange={(e) => setBillFormData({ ...billFormData, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-wide pl-2">Due Expiry</Label>
                                <Input
                                    type="date"
                                    required
                                    className="h-11 border-0 bg-slate-50 rounded-xl px-4 font-semibold text-slate-600 focus:ring-2 focus:ring-red-500 transition-all"
                                    value={billFormData.due_date}
                                    onChange={(e) => setBillFormData({ ...billFormData, due_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 flex gap-4 text-amber-700 shadow-sm shadow-amber-50">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-[11px] font-medium leading-relaxed tracking-tight py-0.5">
                                Security Warning: This bill will be logged as an untracked liability in your P&L statement until the settlement flow is finalized.
                            </p>
                        </div>

                        <div className="flex gap-4 pt-2">
                            <Button type="button" variant="ghost" className="flex-1 rounded-xl h-12 font-bold uppercase tracking-wide text-slate-400 hover:bg-slate-100 transition-all" onClick={() => setBillDialogOpen(false)}>Abort Transition</Button>
                            <Button type="submit" className="flex-1 rounded-xl h-12 bg-slate-900 hover:bg-red-600 text-white font-bold uppercase tracking-wide shadow-xl shadow-slate-200 transition-all active:scale-95 disabled:opacity-50" disabled={createBillMutation.isPending}>
                                Commit Record <ArrowUpRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
