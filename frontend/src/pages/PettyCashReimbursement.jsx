import React, { useState, useMemo } from 'react';
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
  Image as ImageIcon,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  MoreVertical,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  DialogFooter,
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
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import PettyCashAnalytics from '@/components/pettycash/PettyCashAnalytics';
import BudgetTracker from '@/components/pettycash/BudgetTracker';
import CashDrawerManager from '@/components/pettycash/CashDrawerManager';

const TRAN_TYPES = [
  { value: 'reimbursement', label: 'Reimbursement', icon: ArrowDownLeft, color: 'text-blue-500' },
  { value: 'advance', label: 'Advance Payment', icon: Clock, color: 'text-amber-500' },
  { value: 'credit', label: 'Credit (In)', icon: ArrowUpRight, color: 'text-emerald-500' },
  { value: 'debit', label: 'Debit (Out)', icon: ArrowDownLeft, color: 'text-rose-500' }
];

const CATEGORIES = [
  { value: 'travel', label: 'Travel', color: 'bg-sky-100 text-sky-700' },
  { value: 'food', label: 'Food & Dining', color: 'bg-pink-100 text-pink-700' },
  { value: 'supplies', label: 'Office Supplies', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'transport', label: 'Transport', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'courier', label: 'Courier/Logistics', color: 'bg-amber-100 text-amber-700' },
  { value: 'emergency', label: 'Emergency', color: 'bg-rose-100 text-rose-700' },
  { value: 'other', label: 'Other', color: 'bg-slate-100 text-slate-700' }
];

export default function PettyCashReimbursement() {
  const { can, isAdmin } = usePermissions();
  const [user, setUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [ocrExtracting, setOcrExtracting] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeTab, setActiveTab] = useState('transactions');
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    transaction_type: 'reimbursement',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'other',
    subcategory: '',
    purpose: '',
    receipt_urls: [],
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

  const { data: reimbursements = [], isLoading } = useQuery({
    queryKey: ['petty-cash-reimbursements'],
    queryFn: () => base44.entities.PettyCashReimbursement.list('-created_at', 1000),
  });

  const myReimbursements = reimbursements.filter(r => r.employee_email === user?.email);
  const pendingApprovals = reimbursements.filter(r => r.status === 'submitted');
  const approvedItems = reimbursements.filter(r => r.status === 'approved');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PettyCashReimbursement.create({
      ...data,
      employee_email: user.email,
      employee_name: user.full_name,
      status: 'submitted'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Transaction submitted for approval');
    },
    onError: (err) => toast.error('Failed: ' + err.message)
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }) => base44.entities.PettyCashReimbursement.update(id, {
      status,
      approved_by: user.email,
      approved_date: new Date().toISOString(),
      rejection_reason: reason
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      toast.success(`Transaction ${variables.status}`);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PettyCashReimbursement.update(id, {
      ...data,
      status: 'paid',
      payment_date: new Date().toISOString().split('T')[0]
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-reimbursements'] });
      toast.success('Marked as Paid');
    }
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const res = await base44.integrations.Core.UploadFile({ file });
        setFormData(prev => ({
          ...prev,
          receipt_urls: [...(prev.receipt_urls || []), res.file_url]
        }));

        // Try OCR on the first file
        if (files.indexOf(file) === 0) await handleOCR(res.file_url);
      }
      toast.success('Files uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleOCR = async (url) => {
    setOcrExtracting(true);
    try {
      const { data } = await base44.functions.invoke('extractReceiptOCR', { receipt_url: url });
      if (data.success && data.extracted_data) {
        setFormData(prev => ({
          ...prev,
          amount: data.extracted_data.amount || prev.amount,
          expense_date: data.extracted_data.date || prev.expense_date,
          purpose: data.extracted_data.description || prev.purpose,
          gst_amount: data.extracted_data.gst_amount || prev.gst_amount
        }));
        toast.success('Data extracted from receipt!');
      }
    } catch (e) { } finally { setOcrExtracting(false); }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: 'reimbursement',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      category: 'other',
      subcategory: '',
      purpose: '',
      receipt_urls: [],
      gst_amount: 0,
      notes: ''
    });
  };

  const getStatusBadge = (status) => {
    const config = {
      submitted: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-blue-100 text-blue-700 border-blue-200',
      rejected: 'bg-rose-100 text-rose-700 border-rose-200',
      paid: 'bg-emerald-100 text-emerald-700 border-emerald-200'
    };
    return <Badge className={cn("capitalize px-2.5 py-0.5", config[status] || 'bg-slate-100')}>
      {status}
    </Badge>;
  };

  const stats = useMemo(() => {
    const myPending = myReimbursements.filter(r => r.status === 'submitted').reduce((s, r) => s + (r.amount || 0), 0);
    const myPaid = myReimbursements.filter(r => r.status === 'paid').reduce((s, r) => s + (r.amount || 0), 0);
    const systemApprovalCount = pendingApprovals.length;

    return { myPending, myPaid, systemApprovalCount };
  }, [myReimbursements, pendingApprovals]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 rounded-2xl shadow-indigo-200 shadow-xl">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Petty Cash</h1>
              <p className="text-slate-500 font-medium">Manage and track organization-wide micro-expenses</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-11 px-5 border-slate-200 hover:bg-white shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100 transition-all active:scale-95">
                <Plus className="w-5 h-5 mr-2" />
                New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">New Petty Cash Record</DialogTitle>
                <DialogDescription>Submit a new expense or reimbursement request. OCR will auto-process receipts.</DialogDescription>
              </DialogHeader>

              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Transaction Type</Label>
                    <Select value={formData.transaction_type} onValueChange={v => setFormData({ ...formData, transaction_type: v })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRAN_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>
                            <div className="flex items-center gap-2">
                              <t.icon className={cn("w-4 h-4", t.color)} />
                              {t.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <Input
                      required
                      type="number"
                      className="h-11 text-lg font-semibold"
                      value={formData.amount}
                      onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Expense Date</Label>
                    <Input
                      type="date"
                      className="h-11"
                      value={formData.expense_date}
                      onChange={e => setFormData({ ...formData, expense_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>GST (Optional)</Label>
                    <Input
                      type="number"
                      className="h-11"
                      placeholder="0.00"
                      value={formData.gst_amount}
                      onChange={e => setFormData({ ...formData, gst_amount: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Purpose / Description *</Label>
                  <Textarea
                    required
                    rows={3}
                    placeholder="Detail the expense..."
                    value={formData.purpose}
                    onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                  />
                </div>

                <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-slate-400" />
                      Receipts & Vouchers
                    </Label>
                    {ocrExtracting && <Badge className="animate-pulse bg-indigo-50 text-indigo-600 border-indigo-100">AI Extracting...</Badge>}
                  </div>
                  <Input type="file" multiple onChange={handleFileUpload} disabled={uploading || ocrExtracting} className="bg-white" />
                  {formData.receipt_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.receipt_urls.map((url, i) => (
                        <div key={i} className="group relative w-12 h-12 rounded-lg overflow-hidden border">
                          <img src={url} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <XCircle className="w-4 h-4 text-white cursor-pointer" onClick={() => setFormData({ ...formData, receipt_urls: formData.receipt_urls.filter((_, idx) => idx !== i) })} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-indigo-600 px-8" disabled={createMutation.isPending || uploading}>
                    {createMutation.isPending ? 'Submitting...' : 'Submit Request'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-none shadow-md overflow-hidden bg-white group border-l-4 border-l-indigo-600">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">My Out-of-Pocket</p>
                  <h3 className="text-3xl font-black text-slate-900">₹{stats.myPending.toLocaleString()}</h3>
                  <p className="text-xs text-amber-600 font-medium mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Awaiting Reimbursement
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-none shadow-md overflow-hidden bg-white group border-l-4 border-l-emerald-600">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Received</p>
                  <h3 className="text-3xl font-black text-slate-900">₹{stats.myPaid.toLocaleString()}</h3>
                  <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Fully Settled
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-none shadow-md overflow-hidden bg-indigo-600 text-white group cursor-pointer hover:bg-indigo-700 transition-colors" onClick={() => setActiveTab('approvals')}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-indigo-100 uppercase tracking-wider mb-1">Pending Review</p>
                    <h3 className="text-3xl font-black">{stats.systemApprovalCount}</h3>
                    <p className="text-xs text-indigo-100 font-medium mt-1">Requires your action</p>
                  </div>
                  <div className="p-3 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-none shadow-md overflow-hidden bg-slate-900 text-white group">
            <CardContent className="p-6 text-center flex flex-col items-center justify-center h-full gap-2">
              <div className="p-2 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-full mb-1">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <p className="text-xs font-bold uppercase text-slate-400">Drawer Health</p>
              <h4 className="text-lg font-bold">Stable Ops</h4>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Tabs UI */}
      <Tabs defaultValue="transactions" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border shadow-sm sticky top-0 z-20">
          <TabsList className="bg-transparent h-auto p-0 gap-1">
            <TabsTrigger value="transactions" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 px-6 py-2.5 font-bold transition-all">
              <History className="w-4 h-4 mr-2" /> My Logs
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="approvals" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 px-6 py-2.5 font-bold transition-all">
                  Pending {stats.systemApprovalCount > 0 && <Badge className="ml-2 h-5 min-w-[20px] px-1 bg-rose-500">{stats.systemApprovalCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 px-6 py-2.5 font-bold transition-all">All History</TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 px-6 py-2.5 font-bold transition-all">Analytics</TabsTrigger>
                <TabsTrigger value="drawers" className="rounded-xl data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-600 px-6 py-2.5 font-bold transition-all">Drawers</TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="flex items-center gap-3 w-full md:w-auto px-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search purpose..."
                className="pl-9 h-10 border-slate-200 bg-slate-50/50 focus:bg-white"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" className="text-slate-500 border rounded-xl"><Filter className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="pt-8">
          <TabsContent value="transactions" className="m-0">
            <TransactionTable
              data={myReimbursements.filter(r => r.purpose?.toLowerCase().includes(searchQuery.toLowerCase()))}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="approvals" className="m-0">
            <TransactionTable
              data={pendingApprovals}
              isAdminView
              onStatusUpdate={(id, status) => {
                if (status === 'rejected') {
                  const reason = prompt('Reason for rejection:');
                  if (!reason) return;
                  updateStatusMutation.mutate({ id, status, reason });
                } else {
                  updateStatusMutation.mutate({ id, status });
                }
              }}
            />
          </TabsContent>

          <TabsContent value="all" className="m-0">
            <TransactionTable data={reimbursements} />
          </TabsContent>

          <TabsContent value="analytics" className="m-0">
            <PettyCashAnalytics transactions={reimbursements} />
          </TabsContent>

          <TabsContent value="drawers" className="m-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <CashDrawerManager />
              <BudgetTracker />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function TransactionTable({ data = [], isAdminView = false, onStatusUpdate, isLoading }) {
  if (isLoading) return <div className="flex flex-col gap-3">{[1, 2, 3].map(i => <div key={i} className="h-16 w-full animate-pulse bg-slate-200 rounded-xl" />)}</div>;

  if (data.length === 0) return (
    <div className="py-20 text-center bg-white rounded-3xl border border-dashed flex flex-col items-center gap-4">
      <div className="p-4 bg-slate-50 rounded-full text-slate-300">
        <Receipt className="w-12 h-12" />
      </div>
      <div>
        <p className="text-lg font-bold text-slate-900">No records found</p>
        <p className="text-slate-500">Transaction history will appear here.</p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50/50">
          <TableRow className="hover:bg-transparent border-slate-100">
            <TableHead className="w-[120px] font-bold text-slate-700">Date</TableHead>
            <TableHead className="font-bold text-slate-700">Particulars</TableHead>
            <TableHead className="font-bold text-slate-700">Type</TableHead>
            <TableHead className="font-bold text-slate-700 text-right">Amount (₹)</TableHead>
            <TableHead className="font-bold text-slate-700">Status</TableHead>
            <TableHead className="w-[100px] text-right font-bold text-slate-700">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
              <TableCell className="font-medium text-slate-600">
                {item.expense_date ? format(new Date(item.expense_date), 'MMM dd, yyyy') : '-'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 line-clamp-1">{item.purpose}</span>
                  {isAdminView && <span className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider flex items-center gap-1 mt-0.5">
                    <UserCheck className="w-3 h-3" /> {item.employee_name}
                  </span>}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-400 border-slate-200">
                      {item.category || 'misc'}
                    </Badge>
                    {item.receipt_urls?.length > 0 && <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600"><CheckCircle className="w-3 h-3" /> Receipt Attached</div>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {(() => {
                    const type = TRAN_TYPES.find(t => t.value === item.transaction_type) || TRAN_TYPES[0];
                    return <type.icon className={cn("w-4 h-4", type.color)} />;
                  })()}
                  <span className="text-xs font-semibold capitalize text-slate-600">{item.transaction_type}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <span className="text-lg font-black text-slate-900">₹{(item.amount || 0).toLocaleString()}</span>
              </TableCell>
              <TableCell>
                {(() => {
                  const config = {
                    submitted: 'bg-amber-50 text-amber-600 border-amber-100',
                    approved: 'bg-indigo-50 text-indigo-600 border-indigo-100',
                    rejected: 'bg-rose-50 text-rose-600 border-rose-100',
                    paid: 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  };
                  return <Badge className={cn("capitalize px-3 py-1 font-bold rounded-full", config[item.status] || 'bg-slate-100')}>
                    {item.status}
                  </Badge>;
                })()}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl border border-transparent hover:border-slate-200 hover:bg-white group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[180px] rounded-xl p-1 shadow-2xl border-slate-100">
                    <DropdownMenuItem className="rounded-lg flex items-center gap-2 cursor-pointer py-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      View Logs
                    </DropdownMenuItem>

                    {isAdminView && item.status === 'submitted' && (
                      <>
                        <DropdownMenuItem className="rounded-lg flex items-center gap-2 cursor-pointer font-bold text-emerald-600 py-2" onClick={() => onStatusUpdate(item.id, 'approved')}>
                          <CheckCircle className="w-4 h-4" /> Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-lg flex items-center gap-2 cursor-pointer font-bold text-rose-600 py-2" onClick={() => onStatusUpdate(item.id, 'rejected')}>
                          <XCircle className="w-4 h-4" /> Reject
                        </DropdownMenuItem>
                      </>
                    )}

                    {isAdminView && item.status === 'approved' && (
                      <DropdownMenuItem className="rounded-lg flex items-center gap-2 cursor-pointer font-bold text-indigo-600 py-2" onClick={() => {
                        const mode = prompt('Payment mode (e.g. Cash, UPI):');
                        const ref = prompt('Reference:');
                        if (mode) markPaidMutation.mutate({ id: item.id, data: { payment_mode: mode, payment_reference: ref } });
                      }}>
                        <DollarSign className="w-4 h-4" /> Mark Paid
                      </DropdownMenuItem>
                    )}

                    {item.receipt_urls?.length > 0 && (
                      <DropdownMenuItem className="rounded-lg flex items-center gap-2 cursor-pointer py-2" onClick={() => window.open(item.receipt_urls[0], '_blank')}>
                        <Receipt className="w-4 h-4 text-slate-500" /> View Receipt
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const UserCheck = ({ className }) => <CheckCircle className={className} />;