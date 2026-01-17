
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountsClients() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '', tax_id: '' });
    const queryClient = useQueryClient();

    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const res = await fetch('http://localhost:3001/api/accounts/clients');
            const json = await res.json();
            return json.data || [];
        }
    });

    const createClient = useMutation({
        mutationFn: async (data) => {
            const res = await fetch('http://localhost:3001/api/accounts/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['clients']);
            setIsAddOpen(false);
            setNewClient({ name: '', email: '', phone: '', address: '', tax_id: '' });
            toast.success('Client created successfully');
        },
        onError: () => toast.error('Failed to create client')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        createClient.mutate(newClient);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
                    <p className="text-muted-foreground">Manage your customers and clients.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Client
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Client</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Client Name</label>
                                <Input
                                    required
                                    value={newClient.name}
                                    onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Email</label>
                                    <Input
                                        type="email"
                                        value={newClient.email}
                                        onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Phone</label>
                                    <Input
                                        value={newClient.phone}
                                        onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Address</label>
                                <Input
                                    value={newClient.address}
                                    onChange={e => setNewClient({ ...newClient, address: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Tax ID</label>
                                <Input
                                    value={newClient.tax_id}
                                    onChange={e => setNewClient({ ...newClient, tax_id: e.target.value })}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={createClient.isPending}>
                                {createClient.isPending ? 'Creating...' : 'Create Client'}
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
                                <TableHead>Client</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Tax ID</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">Loading clients...</TableCell>
                                </TableRow>
                            ) : clients.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                        No clients found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                clients.map((c) => (
                                    <TableRow key={c._id}>
                                        <TableCell>
                                            <div className="font-medium">{c.name}</div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {c.address || 'No address'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email || '-'}</div>
                                            <div className="text-sm flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone || '-'}</div>
                                        </TableCell>
                                        <TableCell>{c.tax_id || '-'}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {c.balance?.toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) || '₹0'}
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
