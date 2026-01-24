import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    ShoppingBag,
    ShoppingCart,
    CheckCircle,
    XCircle,
    Clock,
    Filter,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    DollarSign,
    Package,
    ArrowRight,
    Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
    { value: 'Stationery', label: 'Stationery', icon: Edit, color: 'bg-blue-100 text-blue-600' },
    { value: 'Confectionery', label: 'Confectionery', icon: ShoppingBag, color: 'bg-pink-100 text-pink-600' },
    { value: 'Maintenance', label: 'Maintenance', icon: Package, color: 'bg-amber-100 text-amber-600' },
    { value: 'Other', label: 'Other', icon: ShoppingCart, color: 'bg-slate-100 text-slate-600' }
];

export default function OfficeNeedsManager({ user }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRequest, setEditingRequest] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const [formData, setFormData] = useState({
        item_name: '',
        category: 'Stationery',
        quantity: 1,
        estimated_unit_price: '',
        notes: ''
    });

    const queryClient = useQueryClient();
    const isHRorAdmin = user?.role === 'admin' || user?.role_id === 'hr';

    // Fetch purchase requests
    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['office-purchase-requests'],
        queryFn: () => base44.entities.OfficePurchaseRequest.list('-created_at', 1000),
        enabled: isHRorAdmin
    });

    const createMutation = useMutation({
        mutationFn: (data) => base44.entities.OfficePurchaseRequest.create({
            ...data,
            total_amount: data.quantity * (parseFloat(data.estimated_unit_price) || 0),
            requester_email: user?.email,
            status: 'pending'
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['office-purchase-requests'] });
            setDialogOpen(false);
            resetForm();
            toast.success('Purchase request submitted');
        },
        onError: (error) => toast.error('Failed to submit: ' + error.message)
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }) => base44.entities.OfficePurchaseRequest.update(id, {
            status,
            approved_by: status === 'approved' ? user.email : undefined,
            updated_at: new Date().toISOString()
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['office-purchase-requests'] });
            toast.success('Status updated');
        }
    });

    const pushToPettyCashMutation = useMutation({
        mutationFn: async (request) => {
            // 1. Create Petty Cash entry
            await base44.entities.PettyCashReimbursement.create({
                amount: request.total_amount,
                transaction_type: 'debit',
                category: request.category.toLowerCase() === 'stationery' ? 'supplies' : 'food',
                purpose: `Purchase: ${request.item_name} (Qty: ${request.quantity})`,
                employee_email: user.email,
                employee_name: user.full_name,
                expense_date: new Date().toISOString().split('T')[0],
                status: 'approved',
                notes: `Linked from Office Purchase Request ID: ${request.id}`
            });

            // 2. Update status
            return await base44.entities.OfficePurchaseRequest.update(request.id, { status: 'linked_to_petty_cash' });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['office-purchase-requests'] });
            queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
            toast.success('Pushed to Petty Cash successfully');
        }
    });

    const resetForm = () => {
        setFormData({
            item_name: '',
            category: 'Stationery',
            quantity: 1,
            estimated_unit_price: '',
            notes: ''
        });
        setEditingRequest(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        createMutation.mutate(formData);
    };

    const filteredRequests = useMemo(() => {
        return (requests || []).filter(req => {
            const matchesSearch = (req.item_name || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || req.category === categoryFilter;
            const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [requests, searchQuery, categoryFilter, statusFilter]);

    const stats = useMemo(() => {
        const pending = requests.filter(r => r.status === 'pending');
        const approved = requests.filter(r => r.status === 'approved');
        const totalSpend = requests
            .filter(r => ['approved', 'linked_to_petty_cash', 'received'].includes(r.status))
            .reduce((sum, r) => sum + (r.total_amount || 0), 0);

        return {
            pendingCount: pending.length,
            approvedCount: approved.length,
            totalSpend
        };
    }, [requests]);

    if (!isHRorAdmin) return null;

    return (
        <div className="space-y-6">
            {/* KPI Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white border-none shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-indigo-100 text-sm">Pending Approval</p>
                                <h3 className="text-2xl font-bold">{stats.pendingCount}</h3>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-xl">
                            <CheckCircle className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm">Approved Needs</p>
                            <h3 className="text-2xl font-bold text-slate-900">{stats.approvedCount}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-rose-100 rounded-xl">
                            <DollarSign className="w-6 h-6 text-rose-600" />
                        </div>
                        <div>
                            <p className="text-slate-500 text-sm">Total Value</p>
                            <h3 className="text-2xl font-bold text-slate-900">₹{stats.totalSpend.toLocaleString()}</h3>
                        </div>
                    </CardContent>
                </Card>

                <Card
                    className="bg-white border-slate-200 border-dashed cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => { resetForm(); setDialogOpen(true); }}
                >
                    <CardContent className="p-6 flex items-center justify-center gap-3 h-full">
                        <Plus className="w-5 h-5 text-indigo-600" />
                        <span className="font-semibold text-indigo-600">New Requirement</span>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="Search items..."
                        className="pl-9 bg-slate-50 border-slate-200"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[160px] bg-slate-50">
                            <Filter className="w-3.5 h-3.5 mr-2 text-slate-400" />
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px] bg-slate-50">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="linked_to_petty_cash">In Petty Cash</SelectItem>
                            <SelectItem value="received">Received</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredRequests.map((req, idx) => (
                        <motion.div
                            key={req.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card className="hover:shadow-md transition-shadow group relative overflow-hidden">
                                <div className={cn("h-1.5 w-full", CATEGORIES.find(c => c.value === req.category)?.color.split(' ')[0])} />
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <Badge variant="outline" className="mb-2 text-[10px] uppercase">
                                                {req.category}
                                            </Badge>
                                            <CardTitle className="text-lg">{req.item_name}</CardTitle>
                                        </div>
                                        <Badge className={cn(
                                            req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                req.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                                    req.status === 'linked_to_petty_cash' ? 'bg-indigo-100 text-indigo-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                        )}>
                                            {req.status?.replace(/_/g, ' ')}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Qty: {req.quantity}</span>
                                        <span className="font-bold text-slate-900">₹{req.total_amount?.toLocaleString()}</span>
                                    </div>

                                    {req.notes && <p className="text-xs text-slate-500 italic line-clamp-2">"{req.notes}"</p>}

                                    <div className="pt-4 border-t border-slate-100 flex gap-2">
                                        {req.status === 'pending' && user.role === 'admin' && (
                                            <>
                                                <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'approved' })}>
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'rejected' })}>
                                                    Reject
                                                </Button>
                                            </>
                                        )}

                                        {req.status === 'approved' && (
                                            <Button size="sm" className="w-full bg-indigo-600" onClick={() => pushToPettyCashMutation.mutate(req)}>
                                                <ArrowRight className="w-3.5 h-3.5 mr-2" />
                                                Push to Petty Cash
                                            </Button>
                                        )}

                                        {req.status === 'linked_to_petty_cash' && (
                                            <Button size="sm" variant="outline" className="w-full border-emerald-500 text-emerald-600" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'received' })}>
                                                <Package className="w-3.5 h-3.5 mr-2" />
                                                Mark Received
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Form Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Office Requirement</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Item Name</Label>
                            <Input
                                required
                                placeholder="e.g. Blue Ball Pens (Box)"
                                value={formData.item_name}
                                onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Quantity</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Est. Unit Price (₹)</Label>
                            <Input
                                type="number"
                                required
                                value={formData.estimated_unit_price}
                                onChange={e => setFormData({ ...formData, estimated_unit_price: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Internal Notes</Label>
                            <Textarea
                                placeholder="Where to buy or priority details..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" className="bg-indigo-600 text-white" disabled={createMutation.isPending}>
                                {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
