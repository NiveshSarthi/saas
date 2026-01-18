
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function AccountsCharts() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newAccount, setNewAccount] = useState({ code: '', name: '', type: 'Asset', description: '' });
    const queryClient = useQueryClient();

    // Fetch Accounts
    const { data: accounts = [], isLoading } = useQuery({
        queryKey: ['chart-of-accounts'],
        queryFn: async () => {
            const res = await fetch('http://localhost:3001/api/accounts/chart-of-accounts');
            const json = await res.json();
            return json.data || [];
        }
    });

    // Create Account Mutation
    const createAccount = useMutation({
        mutationFn: async (data) => {
            const res = await fetch('http://localhost:3001/api/accounts/chart-of-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['chart-of-accounts']);
            setIsAddOpen(false);
            setNewAccount({ code: '', name: '', type: 'Asset', description: '' });
            toast.success('Account created successfully');
        },
        onError: () => toast.error('Failed to create account')
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        createAccount.mutate(newAccount);
    };

    const filteredAccounts = accounts; // Add client-side filtering logic if needed

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
                    <p className="text-muted-foreground">Manage your ledger accounts and classifications.</p>
                </div>
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                            <Plus className="mr-2 h-4 w-4" /> Add Account
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Account</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Account Code</label>
                                    <Input
                                        required
                                        value={newAccount.code}
                                        onChange={e => setNewAccount({ ...newAccount, code: e.target.value })}
                                        placeholder="e.g. 1001"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Type</label>
                                    <Select
                                        value={newAccount.type}
                                        onValueChange={val => setNewAccount({ ...newAccount, type: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Asset">Asset</SelectItem>
                                            <SelectItem value="Liability">Liability</SelectItem>
                                            <SelectItem value="Equity">Equity</SelectItem>
                                            <SelectItem value="Income">Income</SelectItem>
                                            <SelectItem value="Expense">Expense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Account Name</label>
                                <Input
                                    required
                                    value={newAccount.name}
                                    onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                                    placeholder="e.g. Cash in Hand"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Description</label>
                                <Input
                                    value={newAccount.description}
                                    onChange={e => setNewAccount({ ...newAccount, description: e.target.value })}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={createAccount.isPending}>
                                {createAccount.isPending ? 'Creating...' : 'Create Account'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>All Accounts</CardTitle>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input className="pl-8 w-[200px]" placeholder="Search accounts..." />
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Code</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">Loading accounts...</TableCell>
                                </TableRow>
                            ) : filteredAccounts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No accounts found. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAccounts.map((acc) => (
                                    <TableRow key={acc._id}>
                                        <TableCell className="font-medium">{acc.code}</TableCell>
                                        <TableCell>{acc.name}</TableCell>
                                        <TableCell>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium 
                            ${acc.type === 'Asset' ? 'bg-green-100 text-green-700' :
                                                    acc.type === 'Liability' ? 'bg-red-100 text-red-700' :
                                                        acc.type === 'Income' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-700'}`}>
                                                {acc.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{acc.description}</TableCell>
                                        <TableCell className="text-right font-mono">
                                            {acc.balance.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
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
