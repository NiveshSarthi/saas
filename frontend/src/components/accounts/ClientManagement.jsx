import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    Search,
    User,
    Mail,
    Phone,
    FileText,
    Edit,
    Trash2,
    Building,
    CreditCard
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
import { toast } from 'sonner';

export default function ClientManagement() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        tax_id: '',
        payment_terms: 'Net 30',
        status: 'active'
    });

    const queryClient = useQueryClient();

    // Note: Using entity Client defined in backend/models/index.js
    const { data: clients = [], isLoading } = useQuery({
        queryKey: ['clients'],
        queryFn: () => base44.entities.Client.list('name'),
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.Client.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setDialogOpen(false);
            resetForm();
            toast.success('Client created successfully');
        },
        onError: (err) => {
            toast.error('Failed to create client: ' + err.message);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            setDialogOpen(false);
            resetForm();
            toast.success('Client updated successfully');
        },
        onError: (err) => {
            toast.error('Failed to update client: ' + err.message);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => base44.entities.Client.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            toast.success('Client deleted successfully');
        },
        onError: (err) => {
            toast.error('Failed to delete client: ' + err.message);
        }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingClient) {
            updateMutation.mutate({ id: editingClient.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const handleEdit = (client) => {
        setEditingClient(client);
        setFormData({
            name: client.name || '',
            email: client.email || '',
            phone: client.phone || '',
            address: client.address || '',
            tax_id: client.tax_id || '',
            payment_terms: client.payment_terms || 'Net 30',
            status: client.status || 'active'
        });
        setDialogOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            address: '',
            tax_id: '',
            payment_terms: 'Net 30',
            status: 'active'
        });
        setEditingClient(null);
    };

    const filteredClients = Array.isArray(clients) ? clients.filter(client =>
        client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.tax_id?.toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search clients by name, email or GSTIN..."
                        className="pl-10 h-10 border-slate-200 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) resetForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto shadow-md transition-all active:scale-95">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Client
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-white border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                {editingClient ? 'Edit Client Profile' : 'Register New Client'}
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Client/Company Name</Label>
                                    <Input
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter full name or company"
                                        className="border-slate-200 focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">GSTIN / Tax ID</Label>
                                    <Input
                                        value={formData.tax_id}
                                        onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                                        placeholder="e.g. 22AAAAA0000A1Z5"
                                        className="border-slate-200 font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email Address</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="contact@client.com"
                                        className="border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phone Number</Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+91 00000 00000"
                                        className="border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment Terms</Label>
                                    <Input
                                        value={formData.payment_terms}
                                        onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                                        placeholder="e.g. Net 30, Due on Receipt"
                                        className="border-slate-200"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</Label>
                                    <select
                                        className="w-full h-10 px-3 py-2 bg-white border border-slate-200 rounded-md text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-all cursor-pointer"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Billing Address</Label>
                                <Textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Full street address, city, state, zip"
                                    rows={3}
                                    className="border-slate-200"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="hover:bg-slate-100">
                                    Cancel
                                </Button>
                                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 px-8 disabled:opacity-50" disabled={createMutation.isPending || updateMutation.isPending}>
                                    {editingClient ? 'Update Profile' : 'Save Client'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-slate-200 shadow-xl overflow-hidden rounded-xl bg-white/50 backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow className="hover:bg-transparent border-slate-200">
                                <TableHead className="font-bold text-slate-700 py-4">Client Details</TableHead>
                                <TableHead className="font-bold text-slate-700 py-4">Tax ID / GSTIN</TableHead>
                                <TableHead className="font-bold text-slate-700 py-4">Contact Info</TableHead>
                                <TableHead className="font-bold text-slate-700 py-4 text-right">Outstanding Balance</TableHead>
                                <TableHead className="font-bold text-slate-700 py-4">Status</TableHead>
                                <TableHead className="font-bold text-slate-700 py-4 text-right pr-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredClients.map((client) => (
                                <TableRow key={client.id} className="hover:bg-indigo-50/30 transition-all border-slate-100">
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-100 uppercase">
                                                {client.name?.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 text-base">{client.name}</div>
                                                <div className="text-xs text-slate-400 mt-0.5 max-w-[240px] truncate">{client.address || 'No address specified'}</div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-2 font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded w-fit border border-slate-200">
                                            <FileText className="w-3 h-3 text-slate-500" />
                                            {client.tax_id || 'NOT_PROVIDED'}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                                                {client.email || '-'}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-600">
                                                <Phone className="w-3.5 h-3.5 text-indigo-400" />
                                                {client.phone || '-'}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-4">
                                        <div className="font-black text-slate-900 text-lg">₹{(client.balance || 0).toLocaleString()}</div>
                                        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Due: {client.payment_terms || 'Net 30'}</div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize border ${client.status === 'active'
                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                : 'bg-slate-50 text-slate-600 border-slate-200'
                                            }`}>
                                            <div className={`w-1.5 h-1.5 rounded-full mr-2 ${client.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
                                            {client.status}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-4 pr-6">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                onClick={() => handleEdit(client)}
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                onClick={() => {
                                                    if (confirm('Delete client profile? This cannot be undone.')) {
                                                        deleteMutation.mutate(client.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && filteredClients.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center justify-center p-8 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 mx-4 my-8">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                                <Building className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">No Client Database Found</h3>
                                            <p className="text-slate-500 max-w-xs text-sm">
                                                Start building your accounts by registering your first client or company profile.
                                            </p>
                                            <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all" onClick={() => setDialogOpen(true)}>
                                                <Plus className="w-4 h-4 mr-2" />
                                                Register Your First Client
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
