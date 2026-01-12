import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { format } from 'date-fns';
import {
  Plus,
  Wallet,
  CheckCircle,
  XCircle,
  Clock,
  Receipt,
  FileText,
  AlertCircle,
  Calendar,
  Sparkles,
  Download,
  MessageSquare,
  BarChart3,
  DollarSign,
  CreditCard,
  TrendingUp,
  CheckSquare,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'react-hot-toast';
import PettyCashAnalytics from '@/components/pettycash/PettyCashAnalytics';
import BudgetTracker from '@/components/pettycash/BudgetTracker';
import CashDrawerManager from '@/components/pettycash/CashDrawerManager';

export default function PettyCashReimbursement() {
  const { can, isAdmin } = usePermissions();
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [ocrExtracting, setOcrExtracting] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentingItem, setCommentingItem] = useState(null);
  const [comment, setComment] = useState('');
  const [formData, setFormData] = useState({
    transaction_type: 'reimbursement',
    amount: '',
    expense_date: '',
    category: 'other',
    subcategory: '',
    purpose: '',
    project_id: '',
    department: '',
    receipt_urls: [],
    receipt_url: '',
    gst_amount: 0,
    notes: ''
  });

  const queryClient = useQueryClient();

  React.useEffect(() => {
    const fetchUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    fetchUser();
  }, []);

  const { data: reimbursements = [] } = useQuery({
    queryKey: ['petty-cash-reimbursements'],
    queryFn: () => base44.entities.PettyCashReimbursement.list('-created_date', 1000),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('name', 100),
  });

  const myReimbursements = reimbursements.filter(r => r.employee_email === user?.email);
  const pendingApprovals = reimbursements.filter(r => r.status === 'submitted');
  const approvedPending = reimbursements.filter(r => r.status === 'approved');

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Duplicate detection
      try {
        const dupResponse = await base44.functions.invoke('detectDuplicatePettyCash', {
          employee_email: user.email,
          amount: data.amount,
          expense_date: data.expense_date,
          purpose: data.purpose
        });

        if (dupResponse.data.is_duplicate) {
          const proceed = window.confirm(dupResponse.data.warning + '\n\nDo you want to proceed?');
          if (!proceed) return null;
          data.is_duplicate_flag = true;
          data.duplicate_warning = dupResponse.data.warning;
        }
      } catch (e) {
        console.log('Duplicate detection failed');
      }

      return await base44.entities.PettyCashReimbursement.create({
        ...data,
        employee_email: user.email,
        employee_name: user.full_name,
        status: 'submitted'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Reimbursement submitted');
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.PettyCashReimbursement.update(id, {
      status: 'approved',
      approved_by: user.email,
      approved_date: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      toast.success('Approved');
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => approveMutation.mutateAsync({ id })));
    },
    onSuccess: () => {
      setSelectedItems([]);
      toast.success(`Approved ${selectedItems.length} items`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.entities.PettyCashReimbursement.update(id, {
      status: 'rejected',
      approved_by: user.email,
      approved_date: new Date().toISOString(),
      rejection_reason: reason
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      toast.success('Rejected');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, payment_mode, payment_reference }) => 
      base44.entities.PettyCashReimbursement.update(id, {
        status: 'paid',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode,
        payment_reference
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      toast.success('Marked as paid');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ id, comment }) => {
      const item = reimbursements.find(r => r.id === id);
      const existingComments = item.comments || [];
      return base44.entities.PettyCashReimbursement.update(id, {
        comments: [...existingComments, {
          author: user.email,
          text: comment,
          timestamp: new Date().toISOString()
        }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      setCommentDialogOpen(false);
      setComment('');
      toast.success('Comment added');
    },
  });

  const handleAISuggest = async () => {
    if (!formData.purpose) return;
    
    setAiSuggesting(true);
    try {
      const { data } = await base44.functions.invoke('autoCategorizeTran', {
        transaction_type: 'petty_cash',
        purpose: formData.purpose,
        description: formData.purpose,
        amount: formData.amount
      });

      if (data.success && data.suggestions) {
        const suggestions = data.suggestions;
        setFormData(prev => ({
          ...prev,
          category: suggestions.category || prev.category,
          subcategory: suggestions.subcategory || prev.subcategory,
          department: suggestions.department || prev.department
        }));
        toast.success('AI suggestions applied');
      }
    } catch (error) {
      toast.error('AI suggestion failed');
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleReceiptOCR = async (receiptUrl) => {
    setOcrExtracting(true);
    try {
      const { data } = await base44.functions.invoke('extractReceiptOCR', {
        receipt_url: receiptUrl
      });

      if (data.success && data.extracted_data) {
        const extracted = data.extracted_data;
        setFormData(prev => ({
          ...prev,
          amount: extracted.amount || prev.amount,
          expense_date: extracted.date || prev.expense_date,
          gst_amount: extracted.gst_amount || prev.gst_amount,
          subcategory: extracted.vendor || prev.subcategory,
          purpose: extracted.description || prev.purpose
        }));
        toast.success('Receipt data extracted!');
      }
    } catch (error) {
      toast.error('OCR extraction failed');
    } finally {
      setOcrExtracting(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      const newUrl = uploadResponse.file_url;
      setFormData({ 
        ...formData, 
        receipt_url: newUrl,
        receipt_urls: [...(formData.receipt_urls || []), newUrl]
      });
      toast.success('Receipt uploaded');
      
      // Trigger OCR
      await handleReceiptOCR(newUrl);
    } catch (error) {
      toast.error('Upload failed: ' + error.message);
    }
    setUploading(false);
  };

  const handleExport = async () => {
    try {
      const response = await base44.functions.invoke('exportPettyCash', { filters: {} });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `petty_cash_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Export complete');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      transaction_type: 'reimbursement',
      amount: '',
      expense_date: '',
      category: 'other',
      subcategory: '',
      purpose: '',
      project_id: '',
      department: '',
      receipt_urls: [],
      receipt_url: '',
      gst_amount: 0,
      notes: ''
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'paid': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const totalPending = myReimbursements.filter(r => r.status === 'submitted' || r.status === 'approved').reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalPaid = myReimbursements.filter(r => r.status === 'paid').reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-cyan-900 p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            Petty Cash Management
          </h1>
          <p className="text-teal-200 mt-2">Track reimbursements, advances, credits & debits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAISuggest}
                    disabled={aiSuggesting || !formData.purpose}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {aiSuggesting ? 'AI Analyzing...' : 'AI Suggest'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Transaction Type</Label>
                    <Select value={formData.transaction_type} onValueChange={(val) => setFormData({...formData, transaction_type: val})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reimbursement">Reimbursement</SelectItem>
                        <SelectItem value="advance">Advance Payment</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                        <SelectItem value="debit">Debit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount *</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.expense_date}
                      onChange={(e) => setFormData({...formData, expense_date: e.target.value})}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="supplies">Supplies</SelectItem>
                        <SelectItem value="transport">Transport</SelectItem>
                        <SelectItem value="courier">Courier</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Subcategory</Label>
                    <Input
                      value={formData.subcategory}
                      onChange={(e) => setFormData({...formData, subcategory: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>GST Amount</Label>
                    <Input
                      type="number"
                      value={formData.gst_amount}
                      onChange={(e) => setFormData({...formData, gst_amount: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Purpose/Description *</Label>
                  <Textarea
                    value={formData.purpose}
                    onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                    placeholder="Describe the expense for AI suggestions..."
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Receipt Upload (Optional) {ocrExtracting && <span className="text-sm text-indigo-600">(Extracting data...)</span>}</Label>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    accept="image/*,.pdf"
                    disabled={uploading || ocrExtracting}
                    multiple
                  />
                  {formData.receipt_urls && formData.receipt_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.receipt_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                          <ImageIcon className="w-4 h-4" />
                          Receipt {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createMutation.isPending}>
                    Submit
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-500 via-amber-600 to-orange-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-100 font-medium">My Pending</p>
                <p className="text-4xl font-black">₹{(totalPending / 1000).toFixed(2)}K</p>
              </div>
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <Clock className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 via-emerald-600 to-teal-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-100 font-medium">My Paid</p>
                <p className="text-4xl font-black">₹{(totalPaid / 1000).toFixed(2)}K</p>
              </div>
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="bg-gradient-to-br from-orange-500 via-red-600 to-pink-600 text-white border-0 shadow-2xl hover:scale-105 transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-100 font-medium">Pending Approvals</p>
                  <p className="text-4xl font-black">{pendingApprovals.length}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                  <AlertCircle className="w-8 h-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardContent className="p-6">
          <Tabs defaultValue="requests">
            <TabsList>
              <TabsTrigger value="requests">Transactions</TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="analytics">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </TabsTrigger>
                  <TabsTrigger value="budget">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Budgets
                  </TabsTrigger>
                  <TabsTrigger value="drawer">
                    <CreditCard className="w-4 h-4 mr-2" />
                    Cash Drawers
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="requests">
              <Tabs defaultValue={isAdmin ? "approvals" : "my"}>
                <div className="flex justify-between items-center mb-4">
                  <TabsList>
                    <TabsTrigger value="my">My Transactions</TabsTrigger>
                    {isAdmin && (
                      <>
                        <TabsTrigger value="approvals">Pending ({pendingApprovals.length})</TabsTrigger>
                        <TabsTrigger value="approved">Approved ({approvedPending.length})</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                      </>
                    )}
                  </TabsList>
                  {selectedItems.length > 0 && isAdmin && (
                    <Button size="sm" onClick={() => bulkApproveMutation.mutate(selectedItems)}>
                      <CheckSquare className="w-4 h-4 mr-2" />
                      Approve Selected ({selectedItems.length})
                    </Button>
                  )}
                </div>

                <TabsContent value="my">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myReimbursements.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.expense_date ? format(new Date(item.expense_date), 'MMM dd') : '-'}</TableCell>
                          <TableCell className="capitalize">{item.transaction_type || 'reimbursement'}</TableCell>
                          <TableCell className="capitalize">{item.category?.replace('_', ' ')}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.purpose}</TableCell>
                          <TableCell>₹{(item.amount || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.receipt_url && (
                              <a href={item.receipt_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="icon">
                                  <Receipt className="w-4 h-4" />
                                </Button>
                              </a>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                {isAdmin && (
                  <>
                    <TabsContent value="approvals">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              <Checkbox
                                checked={selectedItems.length === pendingApprovals.length}
                                onCheckedChange={(checked) => {
                                  setSelectedItems(checked ? pendingApprovals.map(i => i.id) : []);
                                }}
                              />
                            </TableHead>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Receipt</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingApprovals.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedItems.includes(item.id)}
                                  onCheckedChange={(checked) => {
                                    setSelectedItems(checked 
                                      ? [...selectedItems, item.id]
                                      : selectedItems.filter(id => id !== item.id)
                                    );
                                  }}
                                />
                              </TableCell>
                              <TableCell>{item.employee_name}</TableCell>
                              <TableCell>{item.expense_date ? format(new Date(item.expense_date), 'MMM dd') : '-'}</TableCell>
                              <TableCell className="capitalize">{item.category}</TableCell>
                              <TableCell>₹{(item.amount || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <a href={item.receipt_url} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="icon">
                                    <Receipt className="w-4 h-4" />
                                  </Button>
                                </a>
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button size="sm" className="bg-green-600" onClick={() => approveMutation.mutate({ id: item.id })}>
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => {
                                    const reason = prompt('Rejection reason:');
                                    if (reason) rejectMutation.mutate({ id: item.id, reason });
                                  }}>
                                    Reject
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    setCommentingItem(item);
                                    setCommentDialogOpen(true);
                                  }}>
                                    <MessageSquare className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="approved">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {approvedPending.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.employee_name}</TableCell>
                              <TableCell>{item.expense_date ? format(new Date(item.expense_date), 'MMM dd') : '-'}</TableCell>
                              <TableCell>₹{(item.amount || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Button size="sm" onClick={() => {
                                  const mode = prompt('Payment mode:');
                                  const ref = prompt('Reference:');
                                  if (mode) markPaidMutation.mutate({ id: item.id, payment_mode: mode, payment_reference: ref });
                                }}>
                                  Mark Paid
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>

                    <TabsContent value="all">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reimbursements.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.employee_name}</TableCell>
                              <TableCell>{item.expense_date ? format(new Date(item.expense_date), 'MMM dd, yyyy') : '-'}</TableCell>
                              <TableCell className="capitalize">{item.transaction_type || 'reimbursement'}</TableCell>
                              <TableCell>₹{(item.amount || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(item.status)}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </TabsContent>

            {isAdmin && (
              <>
                <TabsContent value="analytics">
                  <PettyCashAnalytics transactions={reimbursements} />
                </TabsContent>

                <TabsContent value="budget">
                  <BudgetTracker />
                </TabsContent>

                <TabsContent value="drawer">
                  <CashDrawerManager />
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your comment..."
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCommentDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                if (commentingItem) {
                  addCommentMutation.mutate({ id: commentingItem.id, comment });
                }
              }}>
                Add Comment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}