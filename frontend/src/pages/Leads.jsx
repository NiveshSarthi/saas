import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  Upload,
  Download,
  Plus,
  Users,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Mail,
  Phone as PhoneIcon,
  User,
  MoreHorizontal,
  Eye,
  Trash2,
  Calendar,
  Building,
  UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import ImportLeadsDialog from '@/components/leads/ImportLeadsDialog';
import AssignLeadsDialog from '@/components/leads/AssignLeadsDialog';
import LeadDetailDialog from '@/components/leads/LeadDetailDialog';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { getVisibleLeads, getVisibleSalesUsers } from '@/components/utils/salesPermissions';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { LEAD_FILTERS } from '@/components/filters/filterConfigs';
import FollowUpDialog from '@/components/leads/FollowUpDialog';

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700', icon: AlertCircle },
  contacted: { label: 'Contacted', color: 'bg-purple-100 text-purple-700', icon: PhoneIcon },
  follow_up: { label: 'Follow-Up', color: 'bg-amber-100 text-amber-700', icon: Clock },
  meeting_done: { label: 'Meeting Done', color: 'bg-indigo-100 text-indigo-700', icon: Users },
  proposal: { label: 'Proposal', color: 'bg-cyan-100 text-cyan-700', icon: FileText },
  negotiation: { label: 'Negotiation', color: 'bg-orange-100 text-orange-700', icon: TrendingUp },
  closed_won: { label: 'Closed Won', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export default function Leads() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [contactStatusFilter, setContactStatusFilter] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [viewingLead, setViewingLead] = useState(null);
  const [statusUpdateLead, setStatusUpdateLead] = useState(null);
  const [deletingLead, setDeletingLead] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allLeadsRaw = [], isLoading } = useQuery({
    queryKey: ['leads-management'],
    queryFn: () => base44.entities.Lead.list('-created_date', 5000),
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-leads'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data?.users || [];
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
  });

  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);

  // Apply sales hierarchy permissions - show only assigned leads for non-admins
  const leads = React.useMemo(() => {
    if (!user) return [];

    // Admin sees all leads
    if (user.role === 'admin') return allLeadsRaw;

    // Non-admins only see leads assigned to them
    return allLeadsRaw.filter(lead => {
      if (!lead.assigned_to) return false;
      return lead.assigned_to?.toLowerCase()?.trim() === user.email?.toLowerCase()?.trim();
    });
  }, [allLeadsRaw, user]);

  // Filter visible sales users based on hierarchy
  const visibleSalesUsers = React.useMemo(() => {
    if (!user) return [];
    return getVisibleSalesUsers(user, users, departments).filter(u =>
      u.department_id && salesDeptIds.includes(u.department_id)
    );
  }, [user, users, departments, salesDeptIds]);

  const salesUsers = users.filter(u => u.department_id && salesDeptIds.includes(u.department_id));

  const visibleLeads = leads;

  // Check if user is sales member (non-admin)
  const isSalesMember = user?.department_id && salesDeptIds.includes(user.department_id) && user?.role !== 'admin';

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'leads'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'leads' }),
    enabled: !!user,
  });

  const applyAdvancedFilters = (lead) => {
    // Stage filter
    if (advancedFilters.stage?.length > 0 && !advancedFilters.stage.includes(lead.status)) {
      return false;
    }
    // Source filter
    if (advancedFilters.source?.length > 0 && !advancedFilters.source.includes(lead.source)) {
      return false;
    }
    // Assigned to filter
    if (advancedFilters.assigned_to?.length > 0 && !advancedFilters.assigned_to.includes(lead.assigned_to)) {
      return false;
    }
    // Builder filter
    if (advancedFilters.builder_id && lead.builder_id !== advancedFilters.builder_id) {
      return false;
    }
    // City filter
    if (advancedFilters.city && !lead.location?.toLowerCase().includes(advancedFilters.city.toLowerCase())) {
      return false;
    }
    // Batch name filter
    if (advancedFilters.batch_name && !lead.import_batch_name?.toLowerCase().includes(advancedFilters.batch_name.toLowerCase())) {
      return false;
    }
    return true;
  };

  const filteredLeads = visibleLeads.filter(lead => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(lead)) return false;
    if (contactStatusFilter !== 'all' && lead.contact_status !== contactStatusFilter) return false;

    // Member filter
    if (filterMember !== 'all' && lead.assigned_to !== filterMember) return false;

    // Date filter
    if (dateFilter !== 'all' && lead.created_date) {
      const leadDate = new Date(lead.created_date);
      leadDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        if (leadDate.getTime() !== today.getTime()) return false;
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (leadDate.getTime() !== yesterday.getTime()) return false;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (leadDate < weekAgo) return false;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        if (leadDate < monthAgo) return false;
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        lead.lead_name?.toLowerCase().includes(query) ||
        lead.phone?.includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.company?.toLowerCase().includes(query) ||
        lead.location?.toLowerCase().includes(query) ||
        lead.import_batch_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: user?.email,
      is_global: user?.role === 'admin'
    });
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
  };

  const handleLoadFilter = (savedFilter) => {
    setAdvancedFilters(savedFilter.filters);
  };

  const handleDeleteFilter = async (filterId) => {
    await base44.entities.SavedFilter.delete(filterId);
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
  };

  const handleRemoveFilter = (field) => {
    setAdvancedFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
  };

  const handleClearAllFilters = () => {
    setAdvancedFilters({});
  };

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, contactStatusFilter, dateFilter]);

  const stats = {
    total: visibleLeads.length,
    notContacted: visibleLeads.filter(l => !l.contact_status || l.contact_status === 'not_contacted').length,
    contacted: visibleLeads.filter(l => l.contact_status === 'contacted').length,
    connected: visibleLeads.filter(l => l.contact_status === 'connected').length,
    others: visibleLeads.filter(l =>
      l.contact_status &&
      l.contact_status !== 'not_contacted' &&
      l.contact_status !== 'contacted' &&
      l.contact_status !== 'connected'
    ).length,
    assigned: visibleLeads.filter(l => l.assigned_to).length
  };

  const exportToCSV = () => {
    const leadsToExport = selectedLeads.length > 0
      ? filteredLeads.filter(l => selectedLeads.includes(l.id))
      : filteredLeads;

    const csv = [
      ['Lead Name', 'Phone', 'Email', 'Status', 'Priority', 'Source', 'Assigned To', 'Created Date'].join(','),
      ...leadsToExport.map(l => [
        l.lead_name,
        l.phone,
        l.email || '',
        l.status,
        l.priority,
        l.source,
        l.assigned_to || 'Unassigned',
        format(new Date(l.created_date), 'yyyy-MM-dd')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();

    if (selectedLeads.length > 0) {
      toast.success(`${selectedLeads.length} selected lead(s) exported to CSV`);
    } else {
      toast.success('All leads exported to CSV');
    }
  };

  const getUserName = (email) => getUserDisplayByEmail(email, users);
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const handleSelectLead = (leadId, index, event) => {
    if (event?.shiftKey && lastClickedIndex !== null) {
      // Shift+Click: Select range
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = filteredLeads.slice(start, end + 1).map(l => l.id);

      setSelectedLeads(prev => {
        const newSelection = [...prev];
        rangeIds.forEach(id => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    } else if (event?.ctrlKey || event?.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual selection
      setSelectedLeads(prev =>
        prev.includes(leadId)
          ? prev.filter(id => id !== leadId)
          : [...prev, leadId]
      );
    } else {
      // Regular click: Toggle single selection
      setSelectedLeads(prev =>
        prev.includes(leadId)
          ? prev.filter(id => id !== leadId)
          : [...prev, leadId]
      );
    }
    setLastClickedIndex(index);
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedLeads.map(l => l.id));
    }
  };

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ leadId, contact_status, feedback }) => {
      const lead = leads.find(l => l.id === leadId);
      const activityLog = [...(lead.activity_log || [])];

      activityLog.push({
        action: 'contact_status_changed',
        actor_email: user?.email,
        timestamp: new Date().toISOString(),
        note: `Contact status changed to ${contact_status}`
      });

      await base44.entities.Lead.update(leadId, {
        contact_status,
        feedback,
        activity_log: activityLog,
        last_activity_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success('Status updated successfully');
      setStatusUpdateLead(null);
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId) => {
      await base44.entities.Lead.delete(leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success('Lead deleted successfully');
      setDeletingLead(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (leadIds) => {
      await Promise.all(leadIds.map(id => base44.entities.Lead.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success(`${selectedLeads.length} lead(s) deleted successfully`);
      setSelectedLeads([]);
      setDeletingLead(null);
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Leads Management
            </h1>
            {!isSalesMember && (
              <p className="text-slate-600 mt-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                Import, assign, track, and convert leads
              </p>
            )}
          </div>
          {!isSalesMember && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAdvancedFilter(true)}>
                <Filter className="w-4 h-4 mr-2" />
                Advanced Filters
              </Button>
              <Button variant="outline" onClick={exportToCSV} className="border-indigo-200 hover:bg-indigo-50">
                <Download className="w-4 h-4 mr-2" />
                Export {selectedLeads.length > 0 ? `(${selectedLeads.length})` : ''}
              </Button>
              <Button onClick={() => setShowImportDialog(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg shadow-indigo-500/30">
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            </div>
          )}
        </div>

        {/* Filter Chips */}
        {Object.keys(advancedFilters).length > 0 && (
          <FilterChips
            filters={advancedFilters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
            moduleConfig={LEAD_FILTERS}
          />
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg">
                  <Users className="w-5 h-5 text-slate-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
                  <div className="text-xs text-slate-500 font-medium">Total Leads</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-red-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-red-100 to-red-200 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{stats.notContacted}</div>
                  <div className="text-xs text-slate-500 font-medium">Not Contacted</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-blue-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg">
                  <PhoneIcon className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.contacted}</div>
                  <div className="text-xs text-slate-500 font-medium">Contacted</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-green-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-green-100 to-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.connected}</div>
                  <div className="text-xs text-slate-500 font-medium">Connected</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-amber-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{stats.others}</div>
                  <div className="text-xs text-slate-500 font-medium">Others</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur-sm border-purple-200 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg">
                  <User className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-purple-600">{stats.assigned}</div>
                  <div className="text-xs text-slate-500 font-medium">Assigned</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-md border-slate-200">
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search by name, phone, email, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-11 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                <SelectTrigger className="w-[180px] h-11 bg-white border-slate-300">
                  <SelectValue placeholder="Contact Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="not_contacted">Not Contacted</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="not_picked">Not Picked</SelectItem>
                  <SelectItem value="switched_off">Switched Off</SelectItem>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                  <SelectItem value="out_of_network">Out of Network</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="w-[180px] h-11 bg-white border-slate-300">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {visibleSalesUsers
                    .filter(u => u.active !== false && u.status !== 'inactive')
                    .map(u => (
                      <SelectItem key={u.email} value={u.email}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[160px] h-11 bg-white border-slate-300">
                  <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(Number(v))}>
                <SelectTrigger className="w-[140px] h-11 bg-white border-slate-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 per page</SelectItem>
                  <SelectItem value="100">100 per page</SelectItem>
                  <SelectItem value="200">200 per page</SelectItem>
                  <SelectItem value="500">500 per page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filteredLeads.length > 0 && (
              <div className="text-sm text-slate-600 font-medium">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length} leads
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Actions - Admin Only */}
        {!isSalesMember && selectedLeads.length > 0 && (
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-lg">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base font-semibold text-indigo-900">
                    {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex gap-3">
                  <Button
                    size="sm"
                    onClick={() => setShowAssignDialog(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Assign
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeletingLead({ isBulk: true })}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedLeads([])}
                    className="border-indigo-300 hover:bg-indigo-100"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leads Display - Table for Admin, Cards for Others */}
        {user?.role === 'admin' ? (
          <Card className="bg-white/90 backdrop-blur-sm shadow-md border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                    </TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeads.map((lead, index) => {
                    const StatusIcon = statusConfig[lead.status]?.icon || AlertCircle;
                    return (
                      <TableRow key={lead.id} className="hover:bg-slate-50">
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={(e) => handleSelectLead(lead.id, index, e)}
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                          />
                        </TableCell>
                        <TableCell>
                          <div
                            onClick={() => {
                              navigate(createPageUrl('LeadDetail') + `?id=${lead.id}`);
                            }}
                            className="flex items-center gap-3 hover:opacity-70 transition-opacity cursor-pointer"
                          >
                            <Avatar className="w-10 h-10 border-2 border-slate-100">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-sm">
                                {getInitials(lead.lead_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-semibold text-slate-900 hover:text-indigo-600">{lead.lead_name}</div>
                              {lead.company && (
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <Building className="w-3 h-3" />
                                  {lead.company}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <PhoneIcon className="w-3 h-3 text-slate-400" />
                              <span className="font-medium">{lead.phone}</span>
                            </div>
                            {lead.email && (
                              <div className="flex items-center gap-2 text-xs text-slate-600">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[200px]">{lead.email}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            {lead.status && (
                              <Badge className={`${statusConfig[lead.status]?.color || 'bg-slate-100 text-slate-700'} flex items-center gap-1 w-fit text-xs`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {statusConfig[lead.status]?.label || lead.status}
                              </Badge>
                            )}
                            <Badge className={`flex items-center gap-1 w-fit text-xs ${!lead.contact_status || lead.contact_status === 'not_contacted' ? 'bg-slate-100 text-slate-700' :
                                lead.contact_status === 'connected' ? 'bg-green-100 text-green-700' :
                                  lead.contact_status === 'follow_up' ? 'bg-blue-100 text-blue-700' :
                                    lead.contact_status === 'not_interested' ? 'bg-red-100 text-red-700' :
                                      lead.contact_status === 'not_picked' ? 'bg-amber-100 text-amber-700' :
                                        lead.contact_status === 'switched_off' ? 'bg-orange-100 text-orange-700' :
                                          lead.contact_status === 'wrong_number' ? 'bg-rose-100 text-rose-700' :
                                            'bg-slate-100 text-slate-700'
                              }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {!lead.contact_status || lead.contact_status === 'not_contacted' ? 'Not Contacted' :
                                lead.contact_status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.assigned_to ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-8 h-8 border border-slate-200">
                                <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                  {getInitials(getUserName(lead.assigned_to))}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">
                                {getUserName(lead.assigned_to).split('—')[0].trim()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.import_batch_name && (
                            <div className="text-xs">
                              <div className="font-medium text-indigo-700">{lead.import_batch_name}</div>
                              {lead.import_date && (
                                <div className="text-slate-500">{format(new Date(lead.import_date), 'dd MMM yyyy')}</div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                navigate(createPageUrl('LeadDetail') + `?id=${lead.id}`);
                              }}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setStatusUpdateLead(lead)}>
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Update Status
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.location.href = `tel:${lead.phone}`}>
                                <PhoneIcon className="w-4 h-4 mr-2 text-green-600" />
                                Call Lead
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedLeads([lead.id]);
                                  setShowAssignDialog(true);
                                }}
                              >
                                <UserPlus className="w-4 h-4 mr-2 text-indigo-600" />
                                Assign Lead
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletingLead(lead)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    {[...Array(Math.min(5, totalPages))].map((_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className={currentPage === pageNum ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedLeads.length > 0 ? (
              paginatedLeads.map((lead, index) => {
                const StatusIcon = statusConfig[lead.status]?.icon || AlertCircle;
                return (
                  <Card key={lead.id} className="bg-white/90 backdrop-blur-sm border-slate-200 hover:shadow-2xl hover:border-indigo-300 hover:-translate-y-1 transition-all duration-300 relative group">
                    {!isSalesMember && (
                      <div className="absolute top-3 left-3 z-10">
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={(e) => handleSelectLead(lead.id, index, e)}
                          className="w-4 h-4 rounded border-slate-300 bg-white cursor-pointer"
                        />
                      </div>
                    )}

                    <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-100">
                      <div
                        onClick={() => {
                          navigate(createPageUrl('LeadDetail') + `?id=${lead.id}`);
                        }}
                        className={`flex items-center gap-4 ${!isSalesMember ? 'ml-8' : ''} hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        <Avatar className="w-14 h-14 border-3 border-white shadow-lg ring-2 ring-indigo-100">
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-bold text-lg">
                            {getInitials(lead.lead_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          {lead.title && (
                            <div className="text-xs font-semibold text-indigo-600 mb-1 truncate">{lead.title}</div>
                          )}
                          <CardTitle className="text-lg font-bold text-slate-900 truncate hover:text-indigo-600">{lead.lead_name}</CardTitle>
                          {lead.company && (
                            <p className="text-sm text-slate-600 truncate flex items-center gap-1 mt-0.5">
                              <Building className="w-3 h-3" />
                              {lead.company}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 p-5">
                      {/* Contact Info */}
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-sm bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <div className="p-2 bg-blue-500 rounded-lg shadow-sm">
                            <PhoneIcon className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-semibold text-slate-800">{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-3 text-sm bg-purple-50 p-3 rounded-lg border border-purple-100">
                            <div className="p-2 bg-purple-500 rounded-lg shadow-sm">
                              <Mail className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-slate-700 truncate font-medium">{lead.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        {lead.status && (
                          <Badge className={`${statusConfig[lead.status]?.color || 'bg-slate-100 text-slate-700'} flex items-center gap-1.5`}>
                            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                            {statusConfig[lead.status]?.label || lead.status}
                          </Badge>
                        )}
                        <Badge className={`flex items-center gap-1.5 ${!lead.contact_status || lead.contact_status === 'not_contacted' ? 'bg-slate-100 text-slate-700' :
                            lead.contact_status === 'connected' ? 'bg-green-100 text-green-700' :
                              lead.contact_status === 'follow_up' ? 'bg-blue-100 text-blue-700' :
                                lead.contact_status === 'not_interested' ? 'bg-red-100 text-red-700' :
                                  lead.contact_status === 'not_picked' ? 'bg-amber-100 text-amber-700' :
                                    lead.contact_status === 'switched_off' ? 'bg-orange-100 text-orange-700' :
                                      lead.contact_status === 'wrong_number' ? 'bg-rose-100 text-rose-700' :
                                        lead.contact_status === 'out_of_network' ? 'bg-purple-100 text-purple-700' :
                                          'bg-slate-100 text-slate-700'
                          }`}>
                          <span className="w-2 h-2 rounded-full bg-current" />
                          {!lead.contact_status || lead.contact_status === 'not_contacted' ? 'Not Contacted' :
                            lead.contact_status?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </Badge>
                        {lead.priority && (
                          <Badge className={`flex items-center gap-1.5 ${lead.priority === 'urgent' ? 'border-red-500 text-red-700 bg-red-50 border' :
                              lead.priority === 'high' ? 'border-orange-500 text-orange-700 bg-orange-50 border' :
                                lead.priority === 'medium' ? 'border-blue-500 text-blue-700 bg-blue-50 border' :
                                  'border-slate-300 text-slate-600 border'
                            }`}>
                            {lead.priority}
                          </Badge>
                        )}
                      </div>

                      {/* Import Batch Name */}
                      {lead.import_batch_name && (
                        <div className="flex items-center gap-2 text-xs p-2 bg-indigo-50 border border-indigo-200 rounded">
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="font-medium text-indigo-700">{lead.import_batch_name}</span>
                          {lead.import_date && (
                            <span className="text-indigo-500">• {format(new Date(lead.import_date), 'dd MMM yyyy')}</span>
                          )}
                        </div>
                      )}

                      {/* Location/Address */}
                      {lead.location && (
                        <div className="flex items-start gap-3 text-sm p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="p-1.5 bg-slate-200 rounded">
                            <Building className="w-4 h-4 text-slate-600" />
                          </div>
                          <span className="text-slate-700 line-clamp-2 font-medium">{lead.location}</span>
                        </div>
                      )}

                      {/* Follow-up Date */}
                      {lead.follow_up_date && (
                        <div className="flex items-center gap-3 text-sm bg-amber-50 p-3 rounded-lg border-2 border-amber-300">
                          <div className="p-1.5 bg-amber-500 rounded-lg shadow-sm">
                            <Calendar className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="text-xs text-amber-700 font-medium">Follow-up</div>
                            <div className="font-bold text-amber-900">{format(new Date(lead.follow_up_date), 'MMM d, yyyy')}</div>
                          </div>
                        </div>
                      )}

                      {/* Assigned User */}
                      <div className="pt-4 border-t-2 border-slate-100">
                        {lead.assigned_to ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                              <Avatar className="w-9 h-9 border-2 border-white shadow-sm">
                                <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                  {getInitials(getUserName(lead.assigned_to))}
                                </AvatarFallback>
                              </Avatar>
                              <div className="overflow-hidden flex-1">
                                <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Assigned to</p>
                                <p className="text-sm font-bold text-slate-900 truncate">
                                  {getUserName(lead.assigned_to).split('—')[0].trim()}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  navigate(createPageUrl('LeadDetail') + `?id=${lead.id}`);
                                }}
                                className="h-9 w-9 hover:bg-indigo-100"
                              >
                                <Eye className="w-4 h-4 text-indigo-600" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setStatusUpdateLead(lead)}
                                className="border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700 font-medium h-10"
                              >
                                <AlertCircle className="w-4 h-4 mr-1.5" />
                                Update
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.location.href = `tel:${lead.phone}`}
                                className="border-green-300 hover:bg-green-50 hover:border-green-400 text-green-700 font-medium h-10"
                              >
                                <PhoneIcon className="w-4 h-4 mr-1.5" />
                                Call
                              </Button>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full h-9 mt-2">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  navigate(createPageUrl('LeadDetail') + `?id=${lead.id}`);
                                }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedLeads([lead.id]);
                                    setShowAssignDialog(true);
                                  }}
                                >
                                  <UserPlus className="w-4 h-4 mr-2 text-indigo-600" />
                                  Reassign Lead
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeletingLead(lead)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : (
                          <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                              <span className="text-sm font-medium text-slate-500">Unassigned</span>
                            </div>
                            {!isSalesMember && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedLeads([lead.id]);
                                  setShowAssignDialog(true);
                                }}
                                className="w-full border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-medium"
                              >
                                <User className="w-4 h-4 mr-2" />
                                Assign Lead
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full text-center py-20">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-6 shadow-inner">
                  <User className="w-12 h-12 text-slate-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No leads found</h3>
                <p className="text-slate-600 mb-6">Try adjusting your filters or import new leads</p>
                {!isSalesMember && (
                  <Button onClick={() => setShowImportDialog(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg">
                    <Upload className="w-4 h-4 mr-2" />
                    Import Leads
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {user?.role === 'admin' && filteredLeads.length === 0 && (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-6 shadow-inner">
              <User className="w-12 h-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No leads found</h3>
            <p className="text-slate-600 mb-6">Try adjusting your filters or import new leads</p>
            <Button onClick={() => setShowImportDialog(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg">
              <Upload className="w-4 h-4 mr-2" />
              Import Leads
            </Button>
          </div>
        )}

        {/* Dialogs */}
        <ImportLeadsDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          salesUsers={visibleSalesUsers}
        />

        <AssignLeadsDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          selectedLeads={selectedLeads}
          leads={leads}
          salesUsers={salesUsers}
          departments={departments}
          onSuccess={() => {
            setSelectedLeads([]);
            setShowAssignDialog(false);
          }}
        />

        <LeadDetailDialog
          lead={viewingLead}
          open={!!viewingLead}
          onOpenChange={(open) => !open && setViewingLead(null)}
          salesUsers={visibleSalesUsers}
        />

        {/* Quick Status Update Dialog */}
        <Dialog open={!!statusUpdateLead} onOpenChange={(open) => !open && setStatusUpdateLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Update Lead Status</DialogTitle>
              <DialogDescription>{statusUpdateLead?.lead_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Contact Status *</Label>
                <Select
                  defaultValue={statusUpdateLead?.contact_status || 'not_contacted'}
                  onValueChange={(v) => {
                    if (statusUpdateLead) {
                      setStatusUpdateLead({ ...statusUpdateLead, contact_status: v });
                    }
                  }}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_contacted">Not Contacted</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                    <SelectItem value="not_picked">Not Picked</SelectItem>
                    <SelectItem value="switched_off">Switched Off</SelectItem>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="wrong_number">Wrong Number</SelectItem>
                    <SelectItem value="out_of_network">Out of Network</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Feedback (Optional)</Label>
                <Textarea
                  placeholder="Add feedback..."
                  defaultValue={statusUpdateLead?.feedback || ''}
                  onChange={(e) => {
                    if (statusUpdateLead) {
                      setStatusUpdateLead({ ...statusUpdateLead, feedback: e.target.value });
                    }
                  }}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStatusUpdateLead(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (statusUpdateLead) {
                    updateLeadStatusMutation.mutate({
                      leadId: statusUpdateLead.id,
                      contact_status: statusUpdateLead.contact_status,
                      feedback: statusUpdateLead.feedback
                    });
                  }
                }}
                disabled={updateLeadStatusMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {updateLeadStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deletingLead} onOpenChange={(open) => !open && setDeletingLead(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Lead{deletingLead?.isBulk ? 's' : ''}</DialogTitle>
              <DialogDescription>
                {deletingLead?.isBulk
                  ? `Are you sure you want to delete ${selectedLeads.length} lead(s)? This action cannot be undone.`
                  : `Are you sure you want to delete ${deletingLead?.lead_name}? This action cannot be undone.`
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingLead(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (deletingLead?.isBulk) {
                    bulkDeleteMutation.mutate(selectedLeads);
                  } else if (deletingLead) {
                    deleteLeadMutation.mutate(deletingLead.id);
                  }
                }}
                disabled={deleteLeadMutation.isPending || bulkDeleteMutation.isPending}
              >
                {(deleteLeadMutation.isPending || bulkDeleteMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Advanced Filter Panel */}
        <AdvancedFilterPanel
          isOpen={showAdvancedFilter}
          onClose={() => setShowAdvancedFilter(false)}
          filters={advancedFilters}
          onApplyFilters={setAdvancedFilters}
          moduleConfig={LEAD_FILTERS}
          savedFilters={savedFilters}
          onSaveFilter={handleSaveFilter}
          onLoadFilter={handleLoadFilter}
          onDeleteFilter={handleDeleteFilter}
        />

        {/* Follow-up Dialog */}
        <FollowUpDialog user={user} />
      </div>
    </div>
  );
}