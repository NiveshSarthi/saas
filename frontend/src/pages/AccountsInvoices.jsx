
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, FileText, Calendar as CalendarIcon, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AccountsInvoices() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newInvoice, setNewInvoice] = useState({
        invoice_number: `INV-${Date.now()}`,
        client_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 86400000 * 30), 'yyyy-MM-dd'),
        total: 0
    });

    const queryClient = useQueryClient();

    const { data: invoices = [], isLoading } = useQuery({
        queryKey: ['invoices'],
        queryFn: async () => {
            const res = await fetch('http://localhost:3001/api/accounts/invoices');
            const json = await res.json();
            return json.data || [];
        }
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            // Allow gracefully handling empty clients initially
            try {
                const res = await fetch('http://localhost:3001/api/accounts/clients');
                const json = await res.json();
                return json.data || [];
            } catch (e) { return []; }
        }
    });

    const createInvoice = useMutation({
        mutationFn: async (data) => {
            const client = clients.find(c => c._id === data.client_id);
            const payload = { ...data, client_name: client?.name };

            const res = await fetch('http://localhost:3001/api/accounts/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['invoices']);
            setIsAddOpen(false);
            setNewInvoice({
                invoice_number: `INV-${Date.now()}`,
                client_id: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                due_date: format(new Date(Date.now() + 86400000 * 30), 'yyyy-MM-dd'),
                total: 0
            });
            toast.success('Invoice created successfully');
        },
        onError: (e) => toast.error('Failed to create invoice')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        createInvoice.mutate(newInvoice);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
                    <p className="text-muted-foreground">Manage client invoices and billing.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" /> Create Invoice
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Create New Invoice</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Invoice Number</label>
                                    <Input
                                        required
                                        value={newInvoice.invoice_number}
                                        onChange={e => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Client</label>
                                    <Select
                                        value={newInvoice.client_id}
                                        onValueChange={val => setNewInvoice({ ...newInvoice, client_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Client" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map(c => (
                                                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Issue Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={newInvoice.date}
                                        onChange={e => setNewInvoice({ ...newInvoice, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Due Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={newInvoice.due_date}
                                        onChange={e => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Total Amount</label>
                                <Input
                                    type="number"
                                    required
                                    value={newInvoice.total}
                                    onChange={e => setNewInvoice({ ...newInvoice, total: Number(e.target.value) })}
                                />
                                <p className="text-xs text-muted-foreground">Simple entry for now. Items support coming soon.</p>
                            </div>

                            <Button type="submit" className="w-full" disabled={createInvoice.isPending}>
                                {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Invoice History</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Number</TableHead>
                                <TableHead>Client</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24">Loading invoices...</TableCell>
                                </TableRow>
                            ) : invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No invoices found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <TableRow key={inv._id}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {inv.invoice_number}
                                        </TableCell>
                                        <TableCell>{inv.client_name || 'Unknown Client'}</TableCell>
                                        <TableCell>{format(new Date(inv.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{format(new Date(inv.due_date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                                        inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-700'}`}>
                                                {inv.status?.toUpperCase()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {inv.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(`http://localhost:3001/api/accounts/invoices/${inv._id}/pdf`, '_blank')}
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
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
