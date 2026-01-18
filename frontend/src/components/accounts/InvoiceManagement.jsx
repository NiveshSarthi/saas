import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    Plus,
    Search,
    FileText,
    Download,
    MoreVertical,
    CheckCircle,
    Clock,
    AlertCircle,
    Trash2,
    Edit,
    Send,
    Printer,
    ChevronDown,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export default function InvoiceManagement() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const initialFormData = {
        client_id: '',
        client_name: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        invoice_number: `INV-${Date.now().toString().slice(-6)}`,
        items: [{ description: '', quantity: 1, unit_price: 0, tax_rate: 18, amount: 0 }],
        notes: '',
        status: 'draft'
    };

    const [formData, setFormData] = useState(initialFormData);

    const queryClient = useQueryClient();

    const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => base44.entities.Invoice.list('-date'),
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list('name'),
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Invoice.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setDialogOpen(false);
            resetForm();
            toast.success('Invoice generated successfully');
        },
        onError: (err) => {
            toast.error('Failed to generate invoice: ' + err.message);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            setDialogOpen(false);
            resetForm();
            toast.success('Invoice updated');
        },
        onError: (err) => {
            toast.error('Failed to update invoice: ' + err.message);
        }
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }) => base44.entities.Invoice.update(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            toast.success('Status updated');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Invoice.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            toast.success('Invoice deleted');
        },
    });

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', quantity: 1, unit_price: 0, tax_rate: 18, amount: 0 }]
        });
    };

    const handleRemoveItem = (index) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        // Recalculate item amount
        if (field === 'quantity' || field === 'unit_price') {
            newItems[index].amount = newItems[index].quantity * newItems[index].unit_price;
        }

        setFormData({ ...formData, items: newItems });
    };

    const totals = useMemo(() => {
        const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const tax_total = formData.items.reduce((sum, item) => {
            const itemTotal = item.quantity * item.unit_price;
            return sum + (itemTotal * (item.tax_rate / 100));
        }, 0);
        return { subtotal, tax_total, total: subtotal + tax_total };
    }, [formData.items]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const finalData = {
            ...formData,
            ...totals
        };

        if (editingInvoice) {
            updateMutation.mutate({ id: editingInvoice.id, data: finalData });
        } else {
            createMutation.mutate(finalData);
        }
    };

    const handleEdit = (invoice) => {
        setEditingInvoice(invoice);
        setFormData({
            ...invoice,
            date: invoice.date ? format(new Date(invoice.date), 'yyyy-MM-dd') : '',
            due_date: invoice.due_date ? format(new Date(invoice.due_date), 'yyyy-MM-dd') : '',
        });
        setDialogOpen(true);
    };

    const resetForm = () => {
        setFormData(initialFormData);
        setEditingInvoice(null);
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'paid': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200 shadow-none">Paid</Badge>;
            case 'partial': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200 shadow-none">Partial</Badge>;
            case 'sent': return <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border-indigo-200 shadow-none">Sent</Badge>;
            case 'overdue': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 shadow-none">Overdue</Badge>;
            case 'cancelled': return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200 shadow-none">Cancelled</Badge>;
            default: return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200 shadow-none">Draft</Badge>;
        }
    };

    const filteredInvoices = Array.isArray(invoices) ? invoices.filter(inv =>
        inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search by invoice # or client name..."
                        className="pl-10 h-10 border-slate-200 rounded-xl bg-white shadow-sm focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto rounded-xl shadow-lg ring-offset-2 ring-indigo-500 transition-all hover:scale-[1.02] active:scale-95 font-bold">
                            <Plus className="w-4 h-4 mr-2" />
                            Generate Invoice
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-slate-50 border-0 shadow-2xl p-0">
                        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-sm">
                            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-lg">
                                    <FileText className="w-6 h-6 text-indigo-600" />
                                </div>
                                {editingInvoice ? 'Revise Invoice' : 'New Client Invoice'}
                            </DialogTitle>
                            <button onClick={() => setDialogOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-8 pb-12">
                            {/* Header Info */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="space-y-2 col-span-1 md:col-span-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Select Client Profile</Label>
                                    <select
                                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-transparent rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                        required
                                        value={formData.client_id}
                                        onChange={(e) => {
                                            const client = clients.find(c => c.id === e.target.value);
                                            setFormData({ ...formData, client_id: e.target.value, client_name: client?.name || '' });
                                        }}
                                    >
                                        <option value="">-- Choose Client Profile --</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Invoice Number</Label>
                                    <Input
                                        required
                                        className="h-11 border-0 bg-slate-50 font-mono font-bold text-slate-700"
                                        value={formData.invoice_number}
                                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Issue Date</Label>
                                    <Input
                                        type="date"
                                        required
                                        className="h-11 border-0 bg-slate-50 font-semibold text-slate-700"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Due Date</Label>
                                    <Input
                                        type="date"
                                        required
                                        className="h-11 border-0 bg-slate-50 font-semibold text-slate-700"
                                        value={formData.due_date}
                                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Workflow Status</Label>
                                    <select
                                        className="w-full h-11 px-4 py-2 bg-slate-50 border border-transparent rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="draft">Draft - Saving for later</option>
                                        <option value="sent">Sent - Awaiting payment</option>
                                        <option value="paid">Paid - Close invoice</option>
                                        <option value="cancelled">Cancelled/Void</option>
                                    </select>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-2">
                                    <h3 className="font-black text-slate-900 uppercase tracking-tighter text-sm flex items-center gap-3">
                                        <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                                        Itemized Breakdown
                                    </h3>
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddItem} className="rounded-xl font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all">
                                        <Plus className="w-4 h-4 mr-1" /> Add Line Item
                                    </Button>
                                </div>

                                <div className="space-y-3">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="grid grid-cols-12 gap-3 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm items-end group transition-all hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50">
                                            <div className="col-span-12 md:col-span-5 space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Description</Label>
                                                <Input
                                                    placeholder="What are you billing for?"
                                                    className="bg-slate-50 border-0 h-10 font-medium text-slate-700 placeholder:text-slate-300"
                                                    value={item.description}
                                                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                />
                                            </div>
                                            <div className="col-span-4 md:col-span-2 space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Quantity</Label>
                                                <Input
                                                    type="number"
                                                    className="bg-slate-50 border-0 h-10 font-bold text-slate-700"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="col-span-4 md:col-span-2 space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Unit Price</Label>
                                                <Input
                                                    type="number"
                                                    className="bg-slate-50 border-0 h-10 font-bold text-slate-700"
                                                    value={item.unit_price}
                                                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="col-span-3 md:col-span-2 space-y-1.5">
                                                <Label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">GST/Tax (%)</Label>
                                                <select
                                                    className="w-full h-10 px-3 py-2 bg-slate-50 border-0 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                                    value={item.tax_rate}
                                                    onChange={(e) => handleItemChange(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                                                >
                                                    <option value="0">0% Non-Taxable</option>
                                                    <option value="5">GST 5%</option>
                                                    <option value="12">GST 12%</option>
                                                    <option value="18">GST 18% (Standard)</option>
                                                    <option value="28">GST 28%</option>
                                                </select>
                                            </div>
                                            <div className="col-span-1 flex justify-center pb-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-slate-200 hover:text-red-500 transition-colors hover:bg-red-50"
                                                    disabled={formData.items.length === 1}
                                                    onClick={() => handleRemoveItem(index)}
                                                >
                                                    <X className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Payment Instructions & Notes</Label>
                                    <Textarea
                                        placeholder="Include bank details, UPI ID, or project milestones..."
                                        rows={5}
                                        className="rounded-2xl border-slate-200 focus:border-indigo-500 p-4 font-medium"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 flex gap-4 text-indigo-700 shadow-sm shadow-indigo-50">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <AlertCircle className="w-5 h-5" />
                                        </div>
                                        <p className="text-xs font-semibold leading-relaxed py-1">
                                            Tax amounts are aggregated at the bottom. Ensure client GSTIN is correct in their profile for valid tax invoicing.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white p-8 rounded-3xl shadow-2xl shadow-indigo-100/20 border border-slate-100 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center text-slate-400">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Subtotal (Untaxed)</span>
                                            <span className="font-mono font-bold text-slate-600 text-lg">₹{totals.subtotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-400">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Aggregate GST/Tax</span>
                                            <span className="font-mono font-bold text-slate-600 text-lg">₹{totals.tax_total.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100" />

                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-sm font-black uppercase tracking-widest text-slate-900 border-b-4 border-indigo-200">Total Invoice Amount</span>
                                        <span className="text-3xl font-black text-indigo-600 font-mono italic tracking-tighter">₹{totals.total.toLocaleString()}</span>
                                    </div>

                                    <Button type="submit" className="w-full h-14 bg-indigo-600 hover:bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:-translate-y-1 active:scale-95 disabled:opacity-50" disabled={createMutation.isPending || updateMutation.isPending}>
                                        {editingInvoice ? 'Commit Revision' : 'Confirm & Finalize Invoice'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-slate-200 shadow-2xl overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                            <TableRow className="hover:bg-transparent border-0">
                                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest py-6 pl-8">Invoice Identity</TableHead>
                                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest py-6">Timeline</TableHead>
                                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest py-6">Recipient Client</TableHead>
                                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest py-6 text-right">Valuation</TableHead>
                                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest py-6">State</TableHead>
                                <TableHead className="font-black text-slate-400 uppercase text-[10px] tracking-widest py-6 text-right pr-8">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInvoices.map((inv) => (
                                <TableRow key={inv.id} className="hover:bg-indigo-50/40 group border-b border-slate-50 last:border-0 transition-all">
                                    <TableCell className="py-6 pl-8">
                                        <div className="flex items-center gap-4">
                                            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-indigo-600 font-black text-xs transition-all shadow-sm group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-indigo-100 group-hover:border-indigo-100">
                                                {inv.invoice_number?.slice(-3) || '00'}
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase font-mono tracking-tighter text-base">{inv.invoice_number}</div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Auto-Generated ID</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-6">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 font-bold text-slate-600 text-[11px] uppercase tracking-tighter">
                                                <Clock className="w-3.5 h-3.5 text-indigo-300" />
                                                Issued: {inv.date ? format(new Date(inv.date), 'MMM d, yyyy') : '-'}
                                            </div>
                                            <div className="flex items-center gap-2 font-black text-rose-500 text-[11px] uppercase tracking-tighter">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                Due: {inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '-'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-6 font-black text-slate-800 uppercase tracking-tighter max-w-[180px] truncate text-sm">
                                        {inv.client_name || 'UNSPECIFIED'}
                                    </TableCell>
                                    <TableCell className="text-right py-6">
                                        <div className="font-black text-slate-900 text-lg tracking-tighter italic">₹{(inv.total || 0).toLocaleString()}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                            Tax: <span className="text-indigo-500">₹{(inv.tax_total || 0).toLocaleString()}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-6">
                                        <div className="scale-110 origin-left">
                                            {getStatusBadge(inv.status)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-6 pr-8">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-10 w-10 p-0 hover:bg-white hover:shadow-xl hover:shadow-indigo-100 rounded-2xl outline-none transition-all group-active:scale-90">
                                                    <MoreVertical className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-2xl border-indigo-100 shadow-2xl rounded-3xl p-2 ring-offset-2 ring-indigo-50 animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-300">
                                                <DropdownMenuItem className="rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-700 py-3.5 focus:bg-indigo-50 transition-all cursor-pointer" onClick={() => handleEdit(inv)}>
                                                    <Edit className="mr-3 h-4 w-4 text-indigo-500" /> Revision
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-700 py-3.5 focus:bg-blue-50 transition-all cursor-pointer" onClick={() => toast.info('Initiating print flow...')}>
                                                    <Printer className="mr-3 h-4 w-4 text-blue-500" /> Print / PDF
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-700 py-3.5 focus:bg-indigo-50 transition-all cursor-pointer" onClick={() => toast.info('Emailing to client...')}>
                                                    <Send className="mr-3 h-4 w-4 text-indigo-400" /> Send via Email
                                                </DropdownMenuItem>
                                                <div className="h-px bg-slate-100 my-1 mx-2" />
                                                <DropdownMenuItem className="rounded-2xl font-black text-[11px] uppercase tracking-widest text-emerald-600 py-3.5 focus:bg-emerald-50 transition-all cursor-pointer" onClick={() => statusMutation.mutate({ id: inv.id, status: 'paid' })}>
                                                    <CheckCircle className="mr-3 h-4 w-4" /> Finalize as Paid
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="rounded-2xl font-black text-[11px] uppercase tracking-widest text-rose-500 py-3.5 focus:bg-rose-50 transition-all cursor-pointer" onClick={() => {
                                                    if (confirm('Void this invoice permanently?')) deleteMutation.mutate(inv.id);
                                                }}>
                                                    <Trash2 className="mr-3 h-4 w-4" /> Void Transition
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!invoicesLoading && filteredInvoices.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center border-0 hover:bg-transparent">
                                        <div className="flex flex-col items-center justify-center p-12 bg-indigo-50/20 rounded-[40px] border-4 border-dashed border-indigo-100/50 mx-8 my-12 group hover:bg-indigo-50/40 transition-all">
                                            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-indigo-100 group-hover:scale-110 transition-all rotate-3 group-hover:rotate-0">
                                                <FileText className="w-10 h-10 text-indigo-200 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Vault Empty</h3>
                                            <p className="text-slate-500 max-w-[280px] text-sm font-bold leading-relaxed mb-8">
                                                No invoices found on record. Elevate your business by issuing your first itemized digital bill.
                                            </p>
                                            <Button
                                                className="bg-slate-900 hover:bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl h-12 px-10 shadow-2xl shadow-indigo-200 transition-all active:scale-95"
                                                onClick={() => setDialogOpen(true)}
                                            >
                                                <Plus className="w-4 h-4 mr-2" />
                                                Create Invoice #001
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>
    );
}
