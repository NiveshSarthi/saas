import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { format } from 'date-fns';
import {
  Plus,
  TrendingDown,
  Calendar,
  CreditCard,
  Edit,
  Trash2,
  Repeat,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
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

export default function Payables() {
  const { can } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [formData, setFormData] = useState({
    category: 'operational',
    amount: '',
    due_date: '',
    status: 'pending',
    vendor_name: '',
    notes: '',
    is_recurring: false,
    recurring_frequency: 'monthly',
    recurring_start_date: '',
    recurring_end_date: '',
    recurring_enabled: true
  });

  const queryClient = useQueryClient();

  if (!can('payables', 'read')) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to view Payables.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  const { data: payables = [] } = useQuery({
    queryKey: ['payables'],
    queryFn: () => base44.entities.PaymentPayable.list('-due_date', 1000),
  });

  const recurringTemplates = payables.filter(p => p.is_recurring && !p.is_recurring_instance);
  const regularPayables = payables.filter(p => !p.is_recurring || p.is_recurring_instance);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PaymentPayable.create({
      ...data,
      pending_amount: data.amount - (data.paid_amount || 0)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PaymentPayable.update(id, {
      ...data,
      pending_amount: data.amount - (data.paid_amount || 0)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PaymentPayable.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payables'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setDialogOpen(true);
  };

  const handleAISuggest = async () => {
    if (!formData.vendor_name && !formData.notes) return;
    
    setAiSuggesting(true);
    try {
      const { data } = await base44.functions.invoke('autoCategorizeTran', {
        transaction_type: 'payable',
        vendor_name: formData.vendor_name,
        description: formData.notes,
        amount: formData.amount
      });

      if (data.success && data.suggestions) {
        const suggestions = data.suggestions;
        setFormData(prev => ({
          ...prev,
          category: suggestions.category || prev.category,
          subcategory: suggestions.subcategory || prev.subcategory,
          department: suggestions.department || prev.department,
          is_recurring: suggestions.is_recurring ?? prev.is_recurring,
          recurring_frequency: suggestions.recurring_frequency || prev.recurring_frequency
        }));
      }
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiSuggesting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      category: 'operational',
      amount: '',
      due_date: '',
      status: 'pending',
      vendor_name: '',
      notes: '',
      is_recurring: false,
      recurring_frequency: 'monthly',
      recurring_start_date: '',
      recurring_end_date: '',
      recurring_enabled: true
    });
    setEditingItem(null);
  };

  const totalAmount = payables.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPaid = payables.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
  const totalPending = payables.reduce((sum, p) => sum + (p.pending_amount || 0), 0);

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      case 'partial': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-rose-900 p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl">
              <TrendingDown className="w-8 h-8 text-white" />
            </div>
            Payables
          </h1>
          <p className="text-red-200 mt-2">Manage outgoing payments and expenses</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Payable
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add'} Payable</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-end mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAISuggest}
                  disabled={aiSuggesting || (!formData.vendor_name && !formData.notes)}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiSuggesting ? 'AI Analyzing...' : 'AI Suggest Categories'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salary">Salary</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="operational">Operational</SelectItem>
                      <SelectItem value="it_tech">IT & Tech</SelectItem>
                      <SelectItem value="statutory">Statutory</SelectItem>
                      <SelectItem value="commission">Commission</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vendor/Payee Name</Label>
                  <Input
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({...formData, vendor_name: e.target.value})}
                    placeholder="Enter vendor name for AI suggestions"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Subcategory</Label>
                  <Input
                    value={formData.subcategory || ''}
                    onChange={(e) => setFormData({...formData, subcategory: e.target.value})}
                    placeholder="Specific expense type"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    value={formData.department || ''}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    placeholder="Department/team"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Recurring Transaction</Label>
                    <p className="text-sm text-slate-500">Automatically create future instances</p>
                  </div>
                  <Switch
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({...formData, is_recurring: checked})}
                  />
                </div>

                {formData.is_recurring && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select 
                        value={formData.recurring_frequency} 
                        onValueChange={(val) => setFormData({...formData, recurring_frequency: val})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={formData.recurring_start_date}
                        onChange={(e) => setFormData({...formData, recurring_start_date: e.target.value})}
                        required={formData.is_recurring}
                      />
                    </div>

                    <div className="space-y-2 col-span-2">
                      <Label>End Date (Optional)</Label>
                      <Input
                        type="date"
                        value={formData.recurring_end_date}
                        onChange={(e) => setFormData({...formData, recurring_end_date: e.target.value})}
                      />
                      <p className="text-xs text-slate-500">Leave empty for ongoing recurrence</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-red-600 hover:bg-red-700">
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-indigo-100 font-medium">Total Amount</p>
                <p className="text-4xl font-black">₹{(totalAmount / 100000).toFixed(2)}L</p>
              </div>
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <CreditCard className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-100 font-medium">Total Paid</p>
                <p className="text-4xl font-black">₹{(totalPaid / 100000).toFixed(2)}L</p>
              </div>
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <TrendingDown className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 via-rose-600 to-pink-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-100 font-medium">Pending</p>
                <p className="text-4xl font-black">₹{(totalPending / 100000).toFixed(2)}L</p>
              </div>
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Calendar className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Payables Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="regular" className="space-y-4">
            <TabsList>
              <TabsTrigger value="regular">Regular Transactions</TabsTrigger>
              <TabsTrigger value="recurring">
                <Repeat className="w-4 h-4 mr-2" />
                Recurring Templates ({recurringTemplates.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="regular">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regularPayables.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.due_date ? format(new Date(item.due_date), 'MMM dd, yyyy') : '-'}</TableCell>
                  <TableCell className="capitalize">{item.category?.replace('_', ' ')}</TableCell>
                  <TableCell>{item.vendor_name || '-'}</TableCell>
                  <TableCell>₹{(item.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>₹{(item.paid_amount || 0).toLocaleString()}</TableCell>
                  <TableCell>₹{(item.pending_amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
              </Table>
              </TabsContent>

              <TabsContent value="recurring">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringTemplates.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="capitalize">{item.category?.replace('_', ' ')}</TableCell>
                      <TableCell>{item.vendor_name || '-'}</TableCell>
                      <TableCell>₹{(item.amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{item.recurring_frequency}</TableCell>
                      <TableCell>{item.recurring_start_date ? format(new Date(item.recurring_start_date), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell>{item.recurring_end_date ? format(new Date(item.recurring_end_date), 'MMM dd, yyyy') : 'Ongoing'}</TableCell>
                      <TableCell>
                        <Badge className={item.recurring_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                          {item.recurring_enabled ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(item.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {recurringTemplates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-500">
                        No recurring templates yet. Create one to automate future payables.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              </TabsContent>
              </Tabs>
              </CardContent>
              </Card>
    </div>
  );
}