// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  ChevronDown,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Snowflake,
  XCircle,
  Building,
  Check,
  Sparkles,
  Plus,
  Upload,
  Download,
  Trash2,
  Users,
  Facebook,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
// import confetti from 'canvas-confetti'; // Temporarily disabled
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import LeadPipelineStages from '@/components/leads/LeadPipelineStages';
import StageChangeDialog from '@/components/leads/StageChangeDialog';
import AssignLeadDialog from '@/components/leads/AssignLeadDialog';
import LeadTimeline from '@/components/leads/LeadTimeline';
import LostLeadDialog from '@/components/leads/LostLeadDialog';
import ColdLeadDialog from '@/components/leads/ColdLeadDialog';
import LeadMetricsDashboard from '@/components/leads/LeadMetricsDashboard';
import LeadQuickActions from '@/components/leads/LeadQuickActions';
import LeadScoreBadge from '@/components/leads/LeadScoreBadge';
import NextActionSuggestion from '@/components/leads/NextActionSuggestion';
import LeadSourceBadge from '@/components/leads/LeadSourceBadge';
import LeadProgressBar from '@/components/leads/LeadProgressBar';
import CreateLeadDialog from '@/components/leads/CreateLeadDialog';
import FacebookWebhookInfo from '@/components/leads/FacebookWebhookInfo';
import FacebookConnectionManager from '@/components/leads/FacebookConnectionManager';
import FollowUpReminderDialog from '@/components/leads/FollowUpReminderDialog';
import FacebookSetupGuide from '@/components/leads/FacebookSetupGuide';
import ImportLeadsDialog from '@/components/leads/ImportLeadsDialog';
import AssignLeadsDialog from '@/components/leads/AssignLeadsDialog';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import WhatsAppImportDialog from '@/components/leads/WhatsAppImportDialog';
import { LEAD_FILTERS } from '@/components/filters/filterConfigs';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-slate-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { key: 'screening', label: 'Screening', color: 'bg-indigo-500' },
  { key: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { key: 'proposal', label: 'Proposal', color: 'bg-violet-500' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { key: 'site_visit', label: 'Site Visit', color: 'bg-orange-500' },
  { key: 'agreement', label: 'Agreement', color: 'bg-emerald-500' },
  { key: 'payment', label: 'Payment', color: 'bg-green-600' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-green-700' }
];

export default function LeadManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterAssignment, setFilterAssignment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterContactStatus, setFilterContactStatus] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
  const [filterFormName, setFilterFormName] = useState('all');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    stage: [],
    source: [],
    assigned_to: []
  });
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState('all');
  const [selectedForm, setSelectedForm] = useState('all');
  const [autoAssignPaused, setAutoAssignPaused] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [whatsappImportOpen, setWhatsappImportOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: organization } = useQuery({
    queryKey: ['organization', user?.organization_id],
    queryFn: () => base44.entities.Organization.get(user.organization_id),
    enabled: !!user?.organization_id
  });

  const { data: fbPages = [] } = useQuery({
    queryKey: ['facebook-pages'],
    queryFn: () => base44.entities.FacebookPageConnection.list('-created_date'),
    staleTime: 30 * 60 * 1000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters'],
    queryFn: () => base44.entities.SavedFilter.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { can, canAny, isAdmin: isAdminFunc } = usePermissions();
  const isAdmin = isAdminFunc();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-management'],
    queryFn: () => base44.entities.Lead.list('-created_date', 5000),
    enabled: !!user,
    staleTime: 5000,
    gcTime: 60 * 60 * 1000,
    refetchInterval: 10000, // Poll every 10 seconds for real-time updates
    refetchOnWindowFocus: true,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (organization?.settings?.autoAssignPaused !== undefined) {
      setAutoAssignPaused(organization.settings.autoAssignPaused);
    }
  }, [organization]);

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: (data) => base44.entities.RELeadActivity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId) => {
      await base44.entities.Lead.delete(leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted successfully');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (leadIds) => {
      await Promise.all(leadIds.map(id => base44.entities.Lead.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`${selectedLeads.length} lead(s) deleted successfully`);
      setSelectedLeads([]);
    },
  });

  const toggleAutoAssignMutation = useMutation({
    mutationFn: async (paused) => {
      if (!organization) return;
      await base44.entities.Organization.update(organization.id, {
        settings: {
          ...organization.settings,
          autoAssignPaused: paused
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
      toast.success(autoAssignPaused ? 'Auto-assign resumed' : 'Auto-assign paused');
    },
  });

  const syncLeadsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('fetchFacebookLeads');
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(data.message || 'Leads synced successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to sync leads');
    },
  });

  const bulkUnassignMutation = useMutation({
    mutationFn: async (leadIds) => {
      await Promise.all(leadIds.map(id =>
        base44.entities.Lead.update(id, { assigned_to: null })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success(`${selectedLeads.length} lead(s) unassigned successfully`);
      setSelectedLeads([]);
    },
  });

  const applyAdvancedFilters = (lead) => {
    // Stage filter
    if (advancedFilters.stage?.length > 0 && !advancedFilters.stage.includes(lead.status)) {
      return false;
    }
    // Source filter
    if (advancedFilters.source?.length > 0 && !advancedFilters.source.includes(lead.lead_source)) {
      return false;
    }
    // Assigned to filter
    if (advancedFilters.assigned_to?.length > 0 && !advancedFilters.assigned_to.includes(lead.assigned_to)) {
      return false;
    }
    return true;
  };

  // Extract form name from notes
  const extractFormName = (notes) => {
    if (!notes) return '-';
    // Match "Form Name:" (legacy) or "Form:" (new)
    const match = notes.match(/(?:Form Name|Form): ([^\n]+)/);
    return match ? match[1].trim() : '-';
  };

  // Get unique form names for filter
  const uniqueFormNames = [...new Set(leads.map(lead => extractFormName(lead.notes)))].filter(name => name !== '-');

  const getDateFilterRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateFilter) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 86400000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 86400000);
        return { start: yesterday, end: today };
      case 'last_7_days':
        return { start: new Date(today.getTime() - 7 * 86400000), end: new Date() };
      case 'last_30_days':
        return { start: new Date(today.getTime() - 30 * 86400000), end: new Date() };
      case 'this_month':
        return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date() };
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          return { start: new Date(customDateRange.start), end: new Date(customDateRange.end) };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredLeads = leads.filter(lead => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(lead)) {
      return false;
    }

    // Role-based visibility: Non-admins only see their assigned leads (case-insensitive comparison)
    if (!isAdmin) {
      const userEmail = user?.email?.toLowerCase()?.trim();
      const assignedEmail = lead.assigned_to?.toLowerCase()?.trim();
      if (!assignedEmail || assignedEmail !== userEmail) {
        return false;
      }
    }

    const matchesSearch =
      lead.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.includes(searchQuery) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSource = filterSource === 'all' || lead.lead_source === filterSource;

    const matchesAssignment =
      filterAssignment === 'all' ||
      (filterAssignment === 'my_leads' && lead.assigned_to === user?.email) ||
      (filterAssignment === 'assigned' && lead.assigned_to) ||
      (filterAssignment === 'unassigned' && !lead.assigned_to);

    const matchesMember = filterMember === 'all' || lead.assigned_to === filterMember;

    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;

    const matchesContactStatus = filterContactStatus === 'all' || lead.contact_status === filterContactStatus;

    // Date filter - Use Facebook created_time if available, otherwise created_date
    const dateRange = getDateFilterRange();
    let matchesDate = true;
    if (dateRange) {
      const leadDateStr = lead.fb_created_time || lead.created_date;
      if (leadDateStr) {
        const leadDate = new Date(leadDateStr);
        matchesDate = leadDate >= dateRange.start && leadDate <= dateRange.end;
      }
    }

    // Filter by Facebook page/form
    const matchesPageFilter = selectedPage === 'all' ||
      (lead.lead_source === 'facebook' && (lead.fb_page_id === selectedPage || lead.notes?.includes(`Page ID: ${selectedPage}`)));

    const matchesFormFilter = selectedForm === 'all' ||
      (lead.lead_source === 'facebook' && lead.fb_form_id === selectedForm);

    const matchesFormNameFilter = filterFormName === 'all' || extractFormName(lead.notes) === filterFormName;

    return matchesSearch && matchesSource && matchesAssignment && matchesMember && matchesStatus && matchesContactStatus && matchesDate && matchesPageFilter && matchesFormFilter && matchesFormNameFilter;
  });

  // Sort filtered leads
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle special cases
    if (sortField === 'name') {
      aValue = a.lead_name || a.name || '';
      bValue = b.lead_name || b.name || '';
    } else if (sortField === 'form_name') {
      aValue = extractFormName(a.notes);
      bValue = extractFormName(b.notes);
    }

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';

    // Compare values
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
      return sortDirection === 'asc' ? comparison : -comparison;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedLeads.length / pageSize);
  const paginatedLeads = sortedLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll table to top on page change
    const tableContainer = document.querySelector('.table-container');
    if (tableContainer) tableContainer.scrollTop = 0;
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-400" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-indigo-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-indigo-600" />;
  };

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: user?.email,
      is_global: isAdmin
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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleExportCSV = () => {
    if (sortedLeads.length === 0) {
      toast.error('No leads to export');
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Status', 'Source', 'Location', 'Budget', 'Requirements', 'Timeline', 'Assigned To', 'Created Date'];
    const csvData = sortedLeads.map(lead => [
      lead.lead_name || lead.name || '',
      lead.phone || '',
      lead.email || '',
      lead.status || 'new',
      lead.lead_source || '',
      lead.location || '',
      lead.budget || '',
      lead.requirements || '',
      lead.timeline || '',
      lead.assigned_to || '',
      lead.created_date ? new Date(lead.created_date).toLocaleString() : ''
    ]);

    const csv = [headers, ...csvData].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${sortedLeads.length} leads`);
  };

  const handleBulkAction = async (action) => {
    if (selectedLeads.length === 0) return;

    if (action === 'mark_contacted') {
      let successCount = 0;
      for (const id of selectedLeads) {
        const lead = leads.find(l => l.id === id);
        if (lead) {
          // Check if user is assigned to this lead or is admin
          const isAssigned = lead.assigned_to === user?.email;

          if (!isAssigned && !isAdmin) {
            continue; // Skip leads not assigned to current user
          }

          const willChangeStage = lead.status === 'new';

          await updateLeadMutation.mutateAsync({
            id: lead.id,
            data: {
              last_contact_date: new Date().toISOString(),
              status: 'contacted'
            }
          });

          await createActivityMutation.mutateAsync({
            lead_id: lead.id,
            activity_type: willChangeStage ? 'stage_change' : 'status_change',
            notes: willChangeStage ? 'Contacted & Stage Updated: New → Contacted' : 'Status: Marked as contacted',
            created_by: user?.email,
          });

          successCount++;
        }
      }
      setSelectedLeads([]);
      toast.success(`${successCount} lead(s) marked as contacted`);
    }
  };

  // Check for overdue leads
  const overdueLeads = leads.filter(lead => {
    if (!lead.next_follow_up) return false;
    return new Date(lead.next_follow_up) < new Date();
  });

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <FollowUpReminderDialog />
      {/* Top Metrics Bar */}
      <div className="p-4 bg-white border-b">
        <LeadMetricsDashboard leads={leads} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-white border-b flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-slate-900">Lead Management</h1>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <>
                  <FacebookSetupGuide />
                  <FacebookConnectionManager />
                  <FacebookWebhookInfo />
                  <Button
                    size="sm"
                    variant={autoAssignPaused ? "destructive" : "default"}
                    onClick={() => {
                      const newPausedState = !autoAssignPaused;
                      setAutoAssignPaused(newPausedState);
                      toggleAutoAssignMutation.mutate(newPausedState);
                    }}
                    disabled={toggleAutoAssignMutation.isPending}
                  >
                    {autoAssignPaused ? (
                      <>
                        <XCircle className="w-4 h-4 mr-1" />
                        Auto-Assign Paused
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Auto-Assign Active
                      </>
                    )}
                  </Button>
                </>
              )}
              <Badge variant="outline" className="text-xs">
                {sortedLeads.length} leads
              </Badge>
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setWhatsappImportOpen(true)}
                    className="border-green-300 hover:bg-green-50 text-green-700 font-medium h-9"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    WhatsApp Import
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => syncLeadsMutation.mutate()}
                    disabled={syncLeadsMutation.isPending}
                    className="border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-medium h-9"
                  >
                    <Facebook className="w-4 h-4 mr-2" />
                    {syncLeadsMutation.isPending ? 'Syncing...' : 'Facebook Sync'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAdvancedFilter(true)}
                    className="h-9"
                  >
                    <Filter className="w-4 h-4 mr-1" />
                    Advanced Filters
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setImportDialogOpen(true)}
                    className="h-9"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    Import CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setCreateDialogOpen(true)}
                    className="h-9"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Lead
                  </Button>
                </div>
              )}
            </div>
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

          <div className="space-y-3">
            {/* Facebook Page/Form Filters */}
            {fbPages.length > 0 && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <Facebook className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Facebook Leads:</span>
                <Select value={selectedPage} onValueChange={(val) => {
                  setSelectedPage(val);
                  setSelectedForm('all');
                }}>
                  <SelectTrigger className="w-48 bg-white">
                    <SelectValue placeholder="All Pages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pages ({leads.filter(l => l.lead_source === 'facebook').length})</SelectItem>
                    {fbPages.map(page => (
                      <SelectItem key={page.id} value={page.page_id}>
                        {page.page_name} ({leads.filter(l => l.notes?.includes(`Page ID: ${page.page_id}`)).length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPage !== 'all' && (
                  <Select value={selectedForm} onValueChange={setSelectedForm}>
                    <SelectTrigger className="w-64 bg-white">
                      <SelectValue placeholder="All Forms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Forms</SelectItem>
                      {fbPages
                        .find(p => p.page_id === selectedPage)
                        ?.lead_forms?.map((form, idx) => (
                          <SelectItem key={idx} value={form.form_id}>
                            {form.form_name} ({leads.filter(l => l.notes?.includes(`Form: ${form.form_id}`)).length})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterAssignment} onValueChange={setFilterAssignment}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Leads</SelectItem>
                    <SelectItem value="my_leads">My Leads</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="screening">Screening</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="site_visit">Site Visit</SelectItem>
                    <SelectItem value="agreement">Agreement</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="closed_won">Closed Won</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterContactStatus} onValueChange={setFilterContactStatus}>
                  <SelectTrigger className="w-40">
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
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {users
                      .filter(u => u.active !== false && u.status !== 'inactive')
                      .map(u => (
                        <SelectItem key={u.email} value={u.email}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Date Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterFormName} onValueChange={setFilterFormName}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Form Name" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    {uniqueFormNames.map(formName => (
                      <SelectItem key={formName} value={formName}>
                        {formName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {dateFilter === 'custom' && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="date"
                  value={customDateRange.start || ''}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-40"
                  placeholder="Start date"
                />
                <span className="text-slate-500">to</span>
                <Input
                  type="date"
                  value={customDateRange.end || ''}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-40"
                  placeholder="End date"
                />
              </div>
            )}
          </div>

          {/* Bulk Actions Bar */}
          {selectedLeads.length > 0 && (
            <div className="flex items-center justify-between bg-indigo-50 px-4 py-2 rounded-lg">
              <span className="text-sm font-medium text-indigo-900">
                {selectedLeads.length} selected
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('mark_contacted')}>
                  Mark Contacted
                </Button>
                {(user?.role === 'admin' || can('leads', 'assign')) && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => setShowAssignDialog(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => bulkUnassignMutation.mutate(selectedLeads)}
                      disabled={bulkUnassignMutation.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Unassign
                    </Button>
                  </>
                )}
                {(user?.role === 'admin' || can('leads', 'delete')) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setSelectedLeads([])}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 bg-white border-t flex flex-col min-h-0">
          {filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No Leads Found</h3>
              <p className="text-sm text-slate-500">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Start by importing or creating leads"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-x-auto overflow-y-auto relative table-container">
                <Table className="min-w-max">
                  <TableHeader className="sticky top-0 bg-white z-20 shadow-sm border-b">
                    <TableRow>
                      {(isAdmin || canAny('leads', ['assign', 'delete', 'update'])) && (
                        <TableHead className="w-12 min-w-[3rem]">
                          <Checkbox
                            checked={selectedLeads.length === sortedLeads.length && sortedLeads.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedLeads(sortedLeads.map(l => l.id));
                              } else {
                                setSelectedLeads([]);
                              }
                            }}
                          />
                        </TableHead>
                      )}
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('id')}>
                        <div className="flex items-center">
                          Lead ID
                          <SortIcon field="id" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[150px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>
                        <div className="flex items-center">
                          Name
                          <SortIcon field="name" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('phone')}>
                        <div className="flex items-center">
                          Phone
                          <SortIcon field="phone" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[180px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('email')}>
                        <div className="flex items-center">
                          Email
                          <SortIcon field="email" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('status')}>
                        <div className="flex items-center">
                          Stage
                          <SortIcon field="status" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('contact_status')}>
                        <div className="flex items-center">
                          Contact Status
                          <SortIcon field="contact_status" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('lead_source')}>
                        <div className="flex items-center">
                          Source
                          <SortIcon field="lead_source" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[150px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('form_name')}>
                        <div className="flex items-center">
                          Form Name
                          <SortIcon field="form_name" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[80px]">Score</TableHead>
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('location')}>
                        <div className="flex items-center">
                          Location
                          <SortIcon field="location" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('assigned_to')}>
                        <div className="flex items-center">
                          Assigned To
                          <SortIcon field="assigned_to" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('fb_created_time')}>
                        <div className="flex items-center">
                          FB Created
                          <SortIcon field="fb_created_time" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('created_date')}>
                        <div className="flex items-center">
                          Imported Date
                          <SortIcon field="created_date" />
                        </div>
                      </TableHead>
                      <TableHead className="min-w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('last_activity')}>
                        <div className="flex items-center">
                          Last Activity
                          <SortIcon field="last_activity" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLeads.map(lead => {
                      // Uses context isAdmin
                      const canViewLead = isAdmin || lead.assigned_to === user?.email;

                      return (
                        <TableRow
                          key={lead.id}
                          className={cn(
                            canViewLead ? "cursor-pointer hover:bg-slate-50" : "cursor-default",
                            lead.is_cold && "bg-blue-50/30",
                            lead.status === 'lost' && "bg-red-50/30 opacity-60",
                            overdueLeads.some(l => l.id === lead.id) && "bg-red-50"
                          )}
                        >
                          {(isAdmin || canAny('leads', ['assign', 'delete', 'update'])) && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedLeads.includes(lead.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedLeads([...selectedLeads, lead.id]);
                                  } else {
                                    setSelectedLeads(selectedLeads.filter(id => id !== lead.id));
                                  }
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono text-[10px] text-slate-500">
                            {lead.id?.slice(-8).toUpperCase() || '-'}
                          </TableCell>
                          <TableCell
                            className="font-medium"
                            onClick={(e) => {
                              if (canViewLead) {
                                e.stopPropagation();
                                window.location.href = createPageUrl('LeadDetail') + '?id=' + lead.id;
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {lead.lead_name || lead.name}
                              {lead.is_cold && <Snowflake className="w-3 h-3 text-blue-400" />}
                              {lead.status === 'lost' && (
                                <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                  LOST
                                </Badge>
                              )}
                              {!lead.assigned_to && (
                                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                  UNASSIGNED
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{lead.phone}</TableCell>
                          <TableCell className="text-sm text-slate-600">{lead.email || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {lead.status?.replace('_', ' ') || 'new'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn(
                              "text-xs",
                              lead.contact_status === 'connected' && "bg-green-50 text-green-700 border-green-200",
                              lead.contact_status === 'not_contacted' && "bg-amber-50 text-amber-700 border-amber-200",
                              lead.contact_status === 'not_interested' && "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {lead.contact_status?.replace('_', ' ') || 'not contacted'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {lead.lead_source && <LeadSourceBadge source={lead.lead_source} />}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {extractFormName(lead.notes)}
                          </TableCell>
                          <TableCell>
                            <LeadScoreBadge lead={lead} />
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{lead.location || '-'}</TableCell>
                          <TableCell>
                            {lead.assigned_to ? (
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px]">
                                  {getInitials(lead.assigned_to)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {lead.fb_created_time
                              ? new Date(lead.fb_created_time).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {lead.created_date
                              ? new Date(lead.created_date).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {lead.last_activity
                              ? new Date(lead.last_activity).toLocaleDateString()
                              : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Footer */}
              <div className="p-4 border-t bg-slate-50 flex items-center justify-between sticky bottom-0 z-20">
                <div className="text-sm text-slate-500">
                  Showing <span className="font-medium text-slate-900">{Math.min(sortedLeads.length, (currentPage - 1) * pageSize + 1)}</span> to <span className="font-medium text-slate-900">{Math.min(sortedLeads.length, currentPage * pageSize)}</span> of <span className="font-medium text-slate-900">{sortedLeads.length}</span> leads
                </div>
                <div className="flex items-center gap-4">
                  <Select value={String(pageSize)} onValueChange={(val) => {
                    setPageSize(Number(val));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className="w-[110px] h-8 bg-white">
                      <SelectValue placeholder="Page size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 / page</SelectItem>
                      <SelectItem value="50">50 / page</SelectItem>
                      <SelectItem value="100">100 / page</SelectItem>
                      <SelectItem value="250">250 / page</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronDown className="w-4 h-4 rotate-90" />
                    </Button>
                    <div className="flex items-center gap-1.5 px-2">
                      <span className="text-sm text-slate-500">Page</span>
                      <Input
                        className="w-12 h-8 text-center p-0"
                        value={currentPage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val) && val > 0 && val <= totalPages) {
                            handlePageChange(val);
                          }
                        }}
                      />
                      <span className="text-sm text-slate-500">of {totalPages || 1}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronDown className="w-4 h-4 -rotate-90" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Dialogs */}
        <CreateLeadDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          currentUser={user}
        />
        <ImportLeadsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          salesUsers={users}
        />

        <WhatsAppImportDialog
          open={whatsappImportOpen}
          onOpenChange={setWhatsappImportOpen}
        />

        <AssignLeadsDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          selectedLeads={selectedLeads}
          leads={leads}
          salesUsers={users}
          departments={departments}
          onSuccess={() => {
            setSelectedLeads([]);
            setShowAssignDialog(false);
          }}
        />

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedLeads.length} Lead{selectedLeads.length > 1 ? 's' : ''}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedLeads.length} lead{selectedLeads.length > 1 ? 's' : ''}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  bulkDeleteMutation.mutate(selectedLeads);
                  setDeleteDialogOpen(false);
                }}
                disabled={bulkDeleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
      </div>
    </div >
  );
}