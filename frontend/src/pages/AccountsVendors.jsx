
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountsVendors() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newVendor, setNewVendor] = useState({ name: '', email: '', phone: '', address: '', tax_id: '' });
    const queryClient = useQueryClient();

    const { data: vendors = [], isLoading } = useQuery({
        queryKey: ['vendors'],
        queryFn: async () => {
            const res = await fetch('http://localhost:3001/api/accounts/vendors');
            const json = await res.json();
            return json.data || [];
        }
    });

    const createVendor = useMutation({
        mutationFn: async (data) => {
            const res = await fetch('http://localhost:3001/api/accounts/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['vendors']);
            setIsAddOpen(false);
            setNewVendor({ name: '', email: '', phone: '', address: '', tax_id: '' });
            toast.success('Vendor created successfully');
        },
        onError: () => toast.error('Failed to create vendor')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        createVendor.mutate(newVendor);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
                    <p className="text-muted-foreground">Manage your suppliers and service providers.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Vendor
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Vendor</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Vendor Name</label>
                                <Input
                                    required
                                    value={newVendor.name}
                                    onChange={e => setNewVendor({ ...newVendor, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <Input
                                        type="email"
                                        value={newVendor.email}
                                        onChange={e => setNewVendor({ ...newVendor, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone</label>
                                    <Input
                                        value={newVendor.phone}
                                        onChange={e => setNewVendor({ ...newVendor, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Address</label>
                                <Input
                                    value={newVendor.address}
                                    onChange={e => setNewVendor({ ...newVendor, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tax ID (GST/VAT)</label>
                                <Input
                                    value={newVendor.tax_id}
                                    onChange={e => setNewVendor({ ...newVendor, tax_id: e.target.value })}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={createVendor.isPending}>
                                {createVendor.isPending ? 'Creating...' : 'Create Vendor'}
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
                                <TableHead>Vendor</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Tax ID</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">Loading vendors...</TableCell>
                                </TableRow>
                            ) : vendors.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No vendors found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                vendors.map((v) => (
                                    <TableRow key={v._id}>
                                        <TableCell>
                                            <div className="font-medium">{v.name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {v.address || 'No address'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {v.email || '-'}</div>
                                            <div className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {v.phone || '-'}</div>
                                        </TableCell>
                                        <TableCell>{v.tax_id || '-'}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {v.balance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '₹0'}
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
