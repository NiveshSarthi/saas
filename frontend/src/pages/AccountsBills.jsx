
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AccountsBills() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newBill, setNewBill] = useState({
        bill_number: '',
        vendor_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        due_date: format(new Date(Date.now() + 86400000 * 30), 'yyyy-MM-dd'),
        total: 0
    });

    const queryClient = useQueryClient();

    const { data: bills = [], isLoading } = useQuery({
        queryKey: ['bills'],
        queryFn: async () => {
            const res = await fetch('http://localhost:3001/api/accounts/bills');
            const json = await res.json();
            return json.data || [];
        }
    });

    const { data: vendors = [] } = useQuery({
        queryKey: ['vendors'],
        queryFn: async () => {
            try {
                const res = await fetch('http://localhost:3001/api/accounts/vendors');
                const json = await res.json();
                return json.data || [];
            } catch (e) { return []; }
        }
    });

    const createBill = useMutation({
        mutationFn: async (data) => {
            const vendor = vendors.find(v => v._id === data.vendor_id);
            const payload = { ...data, vendor_name: vendor?.name };

            const res = await fetch('http://localhost:3001/api/accounts/bills', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['bills']);
            setIsAddOpen(false);
            setNewBill({
                bill_number: '',
                vendor_id: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                due_date: format(new Date(Date.now() + 86400000 * 30), 'yyyy-MM-dd'),
                total: 0
            });
            toast.success('Bill recorded successfully');
        },
        onError: () => toast.error('Failed to record bill')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        createBill.mutate(newBill);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expenses & Bills</h1>
                    <p className="text-muted-foreground">Track vendor bills and operational expenses.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" /> Record Bill
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Record New Bill</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Bill Number</label>
                                    <Input
                                        value={newBill.bill_number}
                                        onChange={e => setNewBill({ ...newBill, bill_number: e.target.value })}
                                        placeholder="Optional (Vendor Inv#)"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Vendor</label>
                                    <Select
                                        value={newBill.vendor_id}
                                        onValueChange={val => setNewBill({ ...newBill, vendor_id: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Vendor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {vendors.map(v => (
                                                <SelectItem key={v._id} value={v._id}>{v.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={newBill.date}
                                        onChange={e => setNewBill({ ...newBill, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Due Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={newBill.due_date}
                                        onChange={e => setNewBill({ ...newBill, due_date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Total Amount</label>
                                <Input
                                    type="number"
                                    required
                                    value={newBill.total}
                                    onChange={e => setNewBill({ ...newBill, total: Number(e.target.value) })}
                                />
                            </div>

                            <Button type="submit" className="w-full" disabled={createBill.isPending}>
                                {createBill.isPending ? 'Saving...' : 'Record Bill'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Bill #</TableHead>
                                <TableHead>Vendor</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24">Loading bills...</TableCell>
                                </TableRow>
                            ) : bills.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                        No bills recorded.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                bills.map((bill) => (
                                    <TableRow key={bill._id}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            {bill.bill_number || '-'}
                                        </TableCell>
                                        <TableCell>{bill.vendor_name || 'Unknown Vendor'}</TableCell>
                                        <TableCell>{format(new Date(bill.date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>{format(new Date(bill.due_date), 'dd MMM yyyy')}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${bill.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    bill.status === 'overdue' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-700'}`}>
                                                {bill.status?.toUpperCase()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {bill.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
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
