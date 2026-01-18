import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO } from 'date-fns';
import {
  Search,
  Filter,
  Footprints,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  Download,
  Plus,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  User,
  DollarSign,
  Building,
  TrendingUp,
  Loader2,
  Target,
  Zap,
  BarChart3,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';
import { getVisibleSalesActivities, getVisibleSalesUsers, isSalesManager } from '@/components/utils/salesPermissions';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import SalesKPIDashboard from '@/components/sales/SalesKPIDashboard';
import SalesHierarchyView from '@/components/sales/SalesHierarchyView';
import SalesTargetsManager from '@/components/sales/SalesTargetsManager';
import DailyPerformanceUpdate from '@/components/sales/DailyPerformanceUpdate';
import TargetVsActual from '@/components/sales/TargetVsActual';
import SalesMemberComparison from '@/components/sales/SalesMemberComparison';
import UnifiedAssignedLeadsReport from '@/components/sales/UnifiedAssignedLeadsReport';
import BuilderLeadVerificationQueue from '@/components/leads/BuilderLeadVerificationQueue';
import DownloadActivityReportDialog from '@/components/sales/DownloadActivityReportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { SALES_ACTIVITY_FILTERS } from '@/components/filters/filterConfigs';

const sourceLabels = {
  walk_in: 'Walk-In',
  referral: 'Referral',
  online: 'Online',
  phone: 'Phone',
  social_media: 'Social Media',
  other: 'Other'
};

const statusLabels = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  follow_up: { label: 'Follow Up', color: 'bg-amber-100 text-amber-700' },
  negotiation: { label: 'Negotiation', color: 'bg-purple-100 text-purple-700' },
  closed_won: { label: 'Closed Won', color: 'bg-emerald-100 text-emerald-700' },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-100 text-red-700' }
};

export default function SalesPerformance() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [formData, setFormData] = useState({});
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: allActivitiesRaw = [], isLoading } = useQuery({
    queryKey: ['all-sales-activities'],
    queryFn: () => base44.entities.SalesActivity.filter({}, '-date', 1000),
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: usersFromEntity = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  // Get sales department users
  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);

  const allUsers = React.useMemo(() => [
    ...usersFromEntity,
    ...invitations
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
        job_title: inv.job_title,
        reports_to: inv.reports_to,
      }))
  ], [usersFromEntity, invitations]);

  // Filter activities based on sales role hierarchy
  const activities = React.useMemo(() => {
    if (!user) return [];
    return getVisibleSalesActivities(allActivitiesRaw, user, allUsers, departments);
  }, [allActivitiesRaw, user, allUsers, departments]);

  // Filter visible sales users based on hierarchy
  const visibleSalesUsers = React.useMemo(() => {
    if (!user) return [];
    return getVisibleSalesUsers(user, allUsers, departments).filter(u =>
      u.department_id && salesDeptIds.includes(u.department_id)
    );
  }, [user, allUsers, departments, salesDeptIds]);

  const salesUsers = allUsers.filter(u => u.department_id && salesDeptIds.includes(u.department_id));

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'sales_activity'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'sales_activity' }),
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesActivity.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      setEditDialogOpen(false);
      setSelectedActivity(null);
    },
  });

  const builderVerifyMutation = useMutation({
    mutationFn: async ({ id, status, note, activity }) => {
      const newLog = {
        action: `builder_${status}`,
        actor_email: user.email,
        timestamp: new Date().toISOString(),
        note: note || ''
      };

      const updatedLogs = [...(activity.workflow_logs || []), newLog];

      // Determine final approval_status based on both verifications
      let finalApprovalStatus = activity.approval_status;

      const builderVerified = status === 'verified';
      const roVerified = activity.ro_verification_status === 'verified';

      // If both are verified, mark as approved
      if (builderVerified && roVerified) {
        finalApprovalStatus = 'approved';
      } else if (status === 'not_verified') {
        finalApprovalStatus = 'changes_requested';
      }

      await base44.entities.SalesActivity.update(id, {
        builder_verification_status: status,
        builder_verified_by: user.email,
        builder_verified_at: new Date().toISOString(),
        builder_note: note,
        approval_status: finalApprovalStatus,
        workflow_logs: updatedLogs
      });

      // Notify sales member
      await base44.entities.Notification.create({
        user_email: activity.user_email,
        type: 'status_changed',
        title: `Builder ${status === 'verified' ? 'Verified' : 'Did Not Verify'} Your Activity`,
        message: note || `Activity verification ${status} by builder. Status: ${finalApprovalStatus}`,
        read: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['my-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities-dashboard'] });
      toast.success('Builder verification recorded');
    }
  });

  const roVerifyMutation = useMutation({
    mutationFn: async ({ id, status, note, activity }) => {
      const newLog = {
        action: `ro_${status}`,
        actor_email: user.email,
        timestamp: new Date().toISOString(),
        note: note || ''
      };

      const updatedLogs = [...(activity.workflow_logs || []), newLog];

      // Determine final approval_status based on both verifications
      let finalApprovalStatus = activity.approval_status;

      // Check if builder verification exists and what its status is
      const builderVerified = !activity.builder_email || activity.builder_verification_status === 'verified';
      const roVerified = status === 'verified';

      // If both are verified (or builder not required), mark as approved
      if (builderVerified && roVerified) {
        finalApprovalStatus = 'approved';
      } else if (status === 'not_verified') {
        finalApprovalStatus = 'changes_requested';
      }

      await base44.entities.SalesActivity.update(id, {
        ro_verification_status: status,
        ro_verified_by: user.email,
        ro_verified_at: new Date().toISOString(),
        ro_note: note,
        approval_status: finalApprovalStatus,
        workflow_logs: updatedLogs
      });

      // Notify sales member
      await base44.entities.Notification.create({
        user_email: activity.user_email,
        type: 'status_changed',
        title: `Manager ${status === 'verified' ? 'Verified' : 'Did Not Verify'} Your Activity`,
        message: note || `Activity verification ${status} by reporting officer. Status: ${finalApprovalStatus}`,
        read: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['my-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities-dashboard'] });
      toast.success('RO verification recorded');
    }
  });

  const assignManagerMutation = useMutation({
    mutationFn: async ({ activity, managerEmail }) => {
      // 1. Update the User's or UserInvitation's reporting officer
      const targetUserFromEntity = usersFromEntity.find(u => u.email?.toLowerCase() === activity.user_email?.toLowerCase());
      const targetInvitation = invitations.find(inv => inv.email?.toLowerCase() === activity.user_email?.toLowerCase());

      if (targetUserFromEntity) {
        await base44.entities.User.update(targetUserFromEntity.id, { reports_to: managerEmail });
      } else if (targetInvitation) {
        await base44.entities.UserInvitation.update(targetInvitation.id, { reports_to: managerEmail });
      }

      // 2. Forward activity to new manager (set to pending)
      const newLog = {
        action: 'manager_assigned',
        actor_email: user.email,
        timestamp: new Date().toISOString(),
        note: `Assigned to ${managerEmail}`
      };

      await base44.entities.SalesActivity.update(activity.id, {
        approval_status: 'pending',
        workflow_logs: [...(activity.workflow_logs || []), newLog]
      });

      // 3. Notify the assigned manager
      await base44.entities.Notification.create({
        user_email: managerEmail,
        type: 'review_requested',
        title: 'New Activity Assigned for Approval',
        message: `Activity from ${activity.user_email} has been assigned to you for review.`,
        read: false
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user-invitations'] });
      toast.success('Manager assigned successfully! Activity forwarded for approval.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesActivity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      setDeleteDialogOpen(false);
      setSelectedActivity(null);
    },
  });

  const applyAdvancedFilters = (activity) => {
    // Activity type filter
    if (advancedFilters.activity_type?.length > 0 && !advancedFilters.activity_type.includes(activity.type)) {
      return false;
    }
    // Sales member filter
    if (advancedFilters.sales_member?.length > 0 && !advancedFilters.sales_member.includes(activity.user_email)) {
      return false;
    }
    // Builder verification filter
    if (advancedFilters.builder_verification_status && activity.builder_verification_status !== advancedFilters.builder_verification_status) {
      return false;
    }
    // Approval status filter
    if (advancedFilters.approval_status && activity.approval_status !== advancedFilters.approval_status) {
      return false;
    }
    // Project filter
    if (advancedFilters.project_id && activity.project_id !== advancedFilters.project_id) {
      return false;
    }
    return true;
  };

  const filteredActivities = activities.filter(activity => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(activity)) return false;

    if (typeFilter !== 'all' && activity.type !== typeFilter) return false;
    if (memberFilter !== 'all' && activity.user_email !== memberFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        activity.customer_name?.toLowerCase().includes(query) ||
        activity.customer_phone?.includes(query) ||
        activity.customer_email?.toLowerCase().includes(query) ||
        activity.user_email?.toLowerCase().includes(query)
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

  const handleEdit = (activity) => {
    setSelectedActivity(activity);
    setFormData({
      customer_name: activity.customer_name || '',
      customer_phone: activity.customer_phone || '',
      customer_email: activity.customer_email || '',
      source: activity.source || 'walk_in',
      property_interest: activity.property_interest || '',
      follow_up_date: activity.follow_up_date || '',
      status: activity.status || 'new',
      notes: activity.notes || ''
    });
    setEditDialogOpen(true);
  };

  const handleView = (activity) => {
    setSelectedActivity(activity);
    setViewDialogOpen(true);
  };

  const handleSave = () => {
    const shouldResetApproval = selectedActivity.approval_status === 'changes_requested';

    let updatedLogs = selectedActivity.workflow_logs || [];
    if (shouldResetApproval) {
      updatedLogs = [
        ...updatedLogs,
        {
          action: 'resubmitted',
          actor_email: user.email,
          timestamp: new Date().toISOString(),
          note: 'Changes made and resubmitted'
        }
      ];
    }

    updateMutation.mutate({
      id: selectedActivity.id,
      data: {
        ...formData,
        // Resubmit for approval if changes were requested
        approval_status: shouldResetApproval ? 'pending' : selectedActivity.approval_status,
        workflow_logs: shouldResetApproval ? updatedLogs : selectedActivity.workflow_logs
      }
    });

    if (shouldResetApproval) {
      // Log the resubmission to generic activity stream too
      base44.entities.Activity.create({
        action: 'status_changed',
        task_id: selectedActivity.id,
        actor_email: user.email,
        new_value: 'pending',
        old_value: 'changes_requested',
        metadata: { type: 'sales_activity_resubmitted' }
      });
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const getUserName = (email) => getUserDisplayByEmail(email, allUsers);

  // Allow access to Admins OR Sales Team OR Sales Executives
  const isSalesUser = user?.department_id && salesDeptIds.includes(user.department_id);
  const isAdmin = user?.role === 'admin';
  const isSalesMgr = isSalesManager(user);
  const isSalesExec = user?.job_title === 'Sales Executive';

  if (user && !isSalesUser && !isAdmin && !isSalesExec) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only sales team members and administrators can access this page.</p>
      </div>
    );
  }

  if (!user) return null; // Loading state

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-3">
            <Zap className="w-10 h-10 text-indigo-600" />
            Sales Performance
          </h1>
          <p className="text-slate-600 mt-2 flex items-center gap-2 ml-1">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            Track targets, daily efforts, and achievements
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 flex-wrap h-auto gap-2 p-2 bg-gradient-to-r from-slate-50 to-slate-100 border-2 border-slate-200">
          <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          {!isSalesMgr && !isSalesExec && (
            <TabsTrigger value="leads" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
              <User className="w-4 h-4 mr-2" />
              Assigned Leads
            </TabsTrigger>
          )}
          {!isSalesExec && (
            <TabsTrigger value="comparison" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4 mr-2" />
              Member Comparison
            </TabsTrigger>
          )}
          {!isSalesMgr && !isSalesExec && (
            <TabsTrigger value="targets" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">
              <Target className="w-4 h-4 mr-2" />
              Targets & KPIs
            </TabsTrigger>
          )}
          {!isSalesMgr && !isSalesExec && (
            <TabsTrigger value="hierarchy" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white">
              Hierarchy View
            </TabsTrigger>
          )}
          {!isSalesExec && (
            <TabsTrigger value="approvals" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-500 data-[state=active]:text-white">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approvals
            </TabsTrigger>
          )}
          {!isSalesMgr && !isSalesExec && (
            <TabsTrigger value="activities" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-slate-600 data-[state=active]:to-slate-700 data-[state=active]:text-white">
              Activity Logs
            </TabsTrigger>
          )}
          {user.role === 'admin' && (
            <TabsTrigger value="monitor" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white">
              <AlertCircle className="w-4 h-4 mr-2" />
              Workflow Monitor
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Deep Dive Analytics</h2>
                <p className="text-sm text-slate-500">Comprehensive performance insights and metrics</p>
              </div>
            </div>
            <SalesKPIDashboard
              currentUser={user}
              users={allUsers}
              departments={departments}
            />
          </div>
        </TabsContent>

        {!isSalesMgr && !isSalesExec && (
          <TabsContent value="leads">
            <UnifiedAssignedLeadsReport user={user} allUsers={allUsers} departments={departments} />
          </TabsContent>
        )}

        {!isSalesExec && (
          <TabsContent value="comparison">
            <SalesMemberComparison
              users={allUsers}
              departments={departments}
              projects={projects}
            />
          </TabsContent>
        )}

        {!isSalesMgr && !isSalesExec && (
          <TabsContent value="targets">
            <div className="space-y-8">
              <div className="w-full">
                <TargetVsActual user={user} allUsers={salesUsers} />
              </div>

              {user.role === 'admin' && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-4">Assign Targets</h2>
                  <SalesTargetsManager users={salesUsers} projects={projects} />
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {!isSalesMgr && !isSalesExec && (
          <TabsContent value="hierarchy">
            <SalesHierarchyView />
          </TabsContent>
        )}

        {!isSalesExec && (
          <TabsContent value="approvals">
            {/* Builder Verification Section */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200">
                <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-lg">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-orange-900">Builder Verification</h2>
                  <p className="text-sm text-orange-700">
                    Independent builder verification for sales activities
                  </p>
                </div>
              </div>
              <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50/50 to-white shadow-lg">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sales Member</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Builder</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities
                        .filter(a => {
                          if (!a.builder_email) return false;
                          // Show to assigned builder or admin
                          if (user.role === 'admin') return a.builder_verification_status === 'pending';
                          return a.builder_verification_status === 'pending' && a.builder_email?.toLowerCase() === user.email?.toLowerCase();
                        })
                        .map(activity => (
                          <TableRow key={activity.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="text-xs">{getInitials(getUserName(activity.user_email))}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium">{getUserName(activity.user_email)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{activity.type === 'walk_in' ? 'Walk-In' : 'Closure'}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{activity.customer_name}</span>
                                <span className="text-xs text-slate-500">{activity.customer_email}</span>
                              </div>
                            </TableCell>
                            <TableCell>{activity.date ? format(parseISO(activity.date), 'MMM d, p') : '-'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="bg-orange-100 text-orange-600 text-xs">
                                    {getInitials(getUserName(activity.builder_email))}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{getUserName(activity.builder_email)}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => handleView(activity)}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 h-8"
                                  onClick={() => {
                                    builderVerifyMutation.mutate({ id: activity.id, status: 'verified', activity });
                                  }}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Verified
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-red-300 text-red-600 hover:bg-red-50"
                                  onClick={() => {
                                    const note = prompt("Optional note (why not verified):");
                                    builderVerifyMutation.mutate({ id: activity.id, status: 'not_verified', note: note || '', activity });
                                  }}
                                >
                                  Not Verified
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      {activities.filter(a => {
                        if (!a.builder_email) return false;
                        if (user.role === 'admin') return a.builder_verification_status === 'pending';
                        return a.builder_verification_status === 'pending' && a.builder_email?.toLowerCase() === user.email?.toLowerCase();
                      }).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-4 text-slate-500">
                              No activities pending builder verification
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Reporting Officer Verification Section */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg shadow-lg">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-blue-900">Reporting Officer Verification</h2>
                  <p className="text-sm text-blue-700">
                    Independent manager verification for sales activities
                  </p>
                </div>
              </div>
              <Card className="border-2 border-blue-200 shadow-lg">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sales Member</TableHead>
                        <TableHead>Activity</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        {user.role === 'admin' && <TableHead>Pending With (RO)</TableHead>}
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities
                        .filter(a => {
                          if (user.role === 'admin') {
                            return a.ro_verification_status === 'pending';
                          } else {
                            const creator = allUsers.find(u => u.email?.toLowerCase() === a.user_email?.toLowerCase());
                            const reportsTo = creator?.reports_to?.toLowerCase();
                            const currentUserEmail = user?.email?.toLowerCase();

                            return reportsTo && reportsTo === currentUserEmail && a.ro_verification_status === 'pending';
                          }
                        })
                        .map(activity => {
                          const creator = allUsers.find(u => u.email?.toLowerCase() === activity.user_email?.toLowerCase());
                          const reportingOfficer = allUsers.find(u => u.email?.toLowerCase() === creator?.reports_to?.toLowerCase());

                          return (
                            <TableRow key={activity.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-6 h-6">
                                    <AvatarFallback className="text-xs">{getInitials(getUserName(activity.user_email))}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{getUserName(activity.user_email)}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{activity.type === 'walk_in' ? 'Walk-In' : 'Closure'}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{activity.customer_name}</span>
                                  <span className="text-xs text-slate-500">{activity.customer_email}</span>
                                </div>
                              </TableCell>
                              <TableCell>{activity.date ? format(parseISO(activity.date), 'MMM d, p') : '-'}</TableCell>
                              {user.role === 'admin' && (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-7 h-7">
                                      <AvatarFallback className="bg-amber-100 text-amber-600 text-xs">
                                        {reportingOfficer?.full_name?.[0] || 'RO'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-sm">{reportingOfficer?.full_name || 'Reporting Officer'}</p>
                                      <p className="text-xs text-slate-500">{reportingOfficer?.email || creator?.reports_to || 'Unknown'}</p>
                                    </div>
                                  </div>
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8"
                                    onClick={() => handleView(activity)}
                                  >
                                    <Eye className="w-3 h-3 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 h-8"
                                    onClick={() => roVerifyMutation.mutate({ id: activity.id, status: 'verified', activity })}
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Verified
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 border-red-300 text-red-600 hover:bg-red-50"
                                    onClick={() => {
                                      const note = prompt("Optional note (why not verified):");
                                      roVerifyMutation.mutate({ id: activity.id, status: 'not_verified', note: note || '', activity });
                                    }}
                                  >
                                    Not Verified
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {activities.filter(a => {
                        if (user.role === 'admin') {
                          return a.ro_verification_status === 'pending';
                        }
                        const creator = allUsers.find(u => u.email?.toLowerCase() === a.user_email?.toLowerCase());
                        return creator?.reports_to?.toLowerCase() === user?.email?.toLowerCase() && a.ro_verification_status === 'pending';
                      }).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={user.role === 'admin' ? 6 : 5} className="text-center py-8 text-slate-500">
                              No pending verifications found
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Admin Section: Unassigned Activities */}
            {user.role === 'admin' && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 rounded-xl border-2 border-red-300">
                  <div className="p-2 bg-gradient-to-br from-red-500 to-rose-500 rounded-lg shadow-lg animate-pulse">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-red-900 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Action Required: Missing Reporting Officer
                    </h2>
                    <p className="text-sm text-red-700">
                      These activities need a reporting officer assignment
                    </p>
                  </div>
                </div>
                <Card className="border-2 border-red-300 bg-gradient-to-br from-red-50/50 to-white shadow-lg">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sales Member</TableHead>
                          <TableHead>Activity</TableHead>
                          <TableHead>Activity Date</TableHead>
                          <TableHead>Action Required</TableHead>
                          <TableHead>Assign Manager</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activities.filter(a => a.approval_status === 'pending_assignment').map(activity => (
                          <TableRow key={activity.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6">
                                  <AvatarFallback className="text-xs">{getInitials(getUserName(activity.user_email))}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{getUserName(activity.user_email)}</div>
                                  <div className="text-xs text-slate-500">Has no reporting officer</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{activity.type === 'walk_in' ? 'Walk-In' : 'Closure'}</Badge>
                            </TableCell>
                            <TableCell>{activity.date ? format(parseISO(activity.date), 'MMM d, p') : '-'}</TableCell>
                            <TableCell className="text-amber-600 text-sm">
                              Assign manager to forward this activity
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 items-center max-w-xs">
                                <Select
                                  onValueChange={(managerEmail) => assignManagerMutation.mutate({ activity, managerEmail })}
                                  disabled={assignManagerMutation.isPending}
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Select Manager" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {salesUsers.filter(u => u.email !== activity.user_email).map(u => (
                                      <SelectItem key={u.email} value={u.email}>
                                        {u.full_name || u.email}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {assignManagerMutation.isPending && (
                                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {activities.filter(a => a.approval_status === 'pending_assignment').length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-slate-500">
                              No unassigned activities
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        )}

        {user.role === 'admin' && (
          <TabsContent value="monitor">
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border-2 border-purple-200">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg shadow-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-purple-900">Verification Status Monitor</h2>
                  <p className="text-sm text-purple-700">Track dual verification progress</p>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Activity</TableHead>
                        <TableHead>Builder Status</TableHead>
                        <TableHead>RO Status</TableHead>
                        <TableHead>Final Status</TableHead>
                        <TableHead>Time Since Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities
                        .filter(a =>
                          a.builder_verification_status !== 'verified' ||
                          a.ro_verification_status !== 'verified'
                        )
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map(activity => {
                          const createdDate = activity.date ? new Date(activity.date) : new Date();
                          const hoursPending = Math.floor((new Date() - createdDate) / (1000 * 60 * 60));

                          const builderStatus = activity.builder_email ? activity.builder_verification_status || 'pending' : 'N/A';
                          const roStatus = activity.ro_verification_status || 'pending';

                          const bothVerified = builderStatus === 'verified' && roStatus === 'verified';
                          const anyNotVerified = builderStatus === 'not_verified' || roStatus === 'not_verified';

                          let finalStatus = 'Pending';
                          let statusColor = 'bg-amber-100 text-amber-700';

                          if (bothVerified) {
                            finalStatus = 'Approved (Valid for KPI)';
                            statusColor = 'bg-emerald-100 text-emerald-700';
                          } else if (anyNotVerified) {
                            finalStatus = 'Flagged – Needs Review';
                            statusColor = 'bg-red-100 text-red-700';
                          }

                          return (
                            <TableRow key={activity.id}>
                              <TableCell>
                                <div className="font-medium">
                                  {activity.type === 'walk_in' ? 'Walk-In' : 'Closure'}
                                </div>
                                <div className="text-xs text-slate-500">by {getUserName(activity.user_email)}</div>
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  builderStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                    builderStatus === 'not_verified' ? 'bg-red-100 text-red-700' :
                                      builderStatus === 'N/A' ? 'bg-slate-100 text-slate-500' :
                                        'bg-amber-100 text-amber-700'
                                }>
                                  {builderStatus === 'verified' ? '✔ Verified' :
                                    builderStatus === 'not_verified' ? '❌ Not Verified' :
                                      builderStatus === 'N/A' ? 'N/A' :
                                        'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  roStatus === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                    roStatus === 'not_verified' ? 'bg-red-100 text-red-700' :
                                      'bg-amber-100 text-amber-700'
                                }>
                                  {roStatus === 'verified' ? '✔ Verified' :
                                    roStatus === 'not_verified' ? '❌ Not Verified' :
                                      'Pending'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusColor}>
                                  {finalStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="font-mono text-sm text-slate-600">
                                  {hoursPending}h
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      {activities.filter(a =>
                        a.builder_verification_status !== 'verified' ||
                        a.ro_verification_status !== 'verified'
                      ).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-emerald-600 font-medium">
                              <CheckCircle2 className="w-6 h-6 mx-auto mb-2" />
                              All activities fully verified!
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {!isSalesMgr && (
          <TabsContent value="activities">
            {/* Detailed Activity Log Section */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border-2 border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg shadow-lg">
                    <Footprints className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Activity Logs</h2>
                    <p className="text-sm text-slate-600">Complete history of all sales activities</p>
                  </div>
                </div>
                {user.role === 'admin' && (
                  <DownloadActivityReportDialog activities={activities} users={allUsers} />
                )}
              </div>

              {/* Filter Chips */}
              {Object.keys(advancedFilters).length > 0 && (
                <div className="mb-6">
                  <FilterChips
                    filters={advancedFilters}
                    onRemoveFilter={handleRemoveFilter}
                    onClearAll={handleClearAllFilters}
                    moduleConfig={SALES_ACTIVITY_FILTERS}
                  />
                </div>
              )}

              {/* Filters */}
              <Card className="mb-6">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Search by customer name, phone, email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowAdvancedFilter(true)}>
                      <Filter className="w-4 h-4 mr-2" />
                      Advanced Filters
                    </Button>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Activity Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="walk_in">Walk-Ins</SelectItem>
                        <SelectItem value="closure">Closures</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={memberFilter} onValueChange={setMemberFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Team Member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Members</SelectItem>
                        {visibleSalesUsers.map(u => (
                          <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Activities Table - Redesigned */}
              <Card className="border-2 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50 border-b-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg">
                        <Footprints className="w-5 h-5 text-white" />
                      </div>
                      All Activities ({filteredActivities.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 hover:bg-slate-50">
                          <TableHead className="font-bold">Type</TableHead>
                          <TableHead className="font-bold">Sales Member</TableHead>
                          <TableHead className="font-bold">Customer</TableHead>
                          <TableHead className="font-bold">Source</TableHead>
                          <TableHead className="font-bold">Builder Approval</TableHead>
                          <TableHead className="font-bold">RO Approval</TableHead>
                          <TableHead className="font-bold">Lead Status</TableHead>
                          <TableHead className="font-bold">Date</TableHead>
                          <TableHead className="text-right font-bold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredActivities.map((activity) => (
                          <TableRow key={activity.id} className="hover:bg-indigo-50/30 transition-colors">
                            <TableCell>
                              <Badge className={activity.type === 'walk_in' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm' : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-sm'}>
                                {activity.type === 'walk_in' ? '🚶 Walk-In' : '✅ Closure'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-7 h-7 border-2 border-white shadow-sm">
                                    <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold">
                                      {getInitials(getUserName(activity.user_email))}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-semibold text-slate-900">{getUserName(activity.user_email)}</span>
                                </div>
                                {activity.created_on_behalf_of && (
                                  <span className="text-xs text-amber-600 ml-9 font-medium">📝 On behalf of</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-semibold text-slate-900">{activity.customer_name || '-'}</p>
                                {activity.customer_phone && (
                                  <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {activity.customer_phone}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-medium">
                                {sourceLabels[activity.source] || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {activity.builder_email ? (
                                activity.builder_verification_status === 'verified' ? (
                                  <Badge className="bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-300 shadow-sm">
                                    ✓ Verified
                                  </Badge>
                                ) : activity.builder_verification_status === 'not_verified' ? (
                                  <Badge className="bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-300 shadow-sm">
                                    ✗ Not Verified
                                  </Badge>
                                ) : (
                                  <Badge className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300 shadow-sm animate-pulse">
                                    ⏳ Pending
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                                  N/A
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {activity.ro_verification_status === 'verified' ? (
                                <Badge className="bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-300 shadow-sm">
                                  ✓ Verified
                                </Badge>
                              ) : activity.ro_verification_status === 'not_verified' ? (
                                <Badge className="bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-300 shadow-sm">
                                  ✗ Not Verified
                                </Badge>
                              ) : (
                                <Badge className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300 shadow-sm animate-pulse">
                                  ⏳ Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {activity.status && (
                                <Badge className={statusLabels[activity.status]?.color + ' shadow-sm'}>
                                  {statusLabels[activity.status]?.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm">
                                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium">{activity.date ? format(parseISO(activity.date), 'MMM d, yyyy') : '-'}</span>
                              </div>
                              <span className="text-xs text-slate-500">{activity.date ? format(parseISO(activity.date), 'h:mm a') : '-'}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-indigo-100 hover:text-indigo-600" onClick={() => handleView(activity)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600" onClick={() => handleEdit(activity)}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:bg-red-100 hover:text-red-700"
                                  onClick={() => {
                                    setSelectedActivity(activity);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredActivities.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center py-12">
                              <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-slate-100 rounded-full">
                                  <Footprints className="w-8 h-8 text-slate-400" />
                                </div>
                                <p className="text-slate-500 font-medium">No activities found</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl">Activity Details</DialogTitle>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-6 py-4">
              {/* Header Section */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    {selectedActivity.type === 'walk_in' ? (
                      <Footprints className="w-6 h-6 text-blue-600" />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <Badge className={selectedActivity.type === 'walk_in' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}>
                      {selectedActivity.type === 'walk_in' ? 'Walk-In' : 'Closure'}
                    </Badge>
                    <p className="text-sm text-slate-600 mt-1 font-medium">
                      {selectedActivity.date ? format(parseISO(selectedActivity.date), 'MMMM do, yyyy · h:mm a') : '-'}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`${selectedActivity.approval_status === 'approved' ? 'border-emerald-500 text-emerald-700 bg-emerald-50' :
                  selectedActivity.approval_status === 'pending' ? 'border-amber-500 text-amber-700 bg-amber-50' :
                    'border-slate-300 text-slate-600'
                  }`}>
                  {selectedActivity.approval_status?.replace('_', ' ').toUpperCase() || 'PENDING'}
                </Badge>
              </div>

              {/* Main Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales Member</Label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <User className="w-4 h-4 text-indigo-600" />
                    <p className="font-semibold text-slate-900">{getUserName(selectedActivity.user_email)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Customer Name</Label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <User className="w-4 h-4 text-slate-600" />
                    <p className="font-semibold text-slate-900">{selectedActivity.customer_name || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</Label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <p className="font-medium text-slate-900">{selectedActivity.customer_phone || '—'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</Label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <Mail className="w-4 h-4 text-purple-600" />
                    <p className="font-medium text-slate-900 truncate">{selectedActivity.customer_email || '—'}</p>
                  </div>
                </div>
              </div>

              {/* Activity Metadata */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Source</Label>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="font-semibold text-slate-900">{sourceLabels[selectedActivity.source] || '—'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</Label>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <Badge className={statusLabels[selectedActivity.status]?.color || 'bg-slate-100 text-slate-700'}>
                      {statusLabels[selectedActivity.status]?.label || '—'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Property Interest</Label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <Building className="w-4 h-4 text-amber-600" />
                    <p className="font-medium text-slate-900">{selectedActivity.property_interest || '—'}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Follow-up Date</Label>
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                    <CalendarIcon className="w-4 h-4 text-emerald-600" />
                    <p className="font-medium text-slate-900">
                      {selectedActivity.follow_up_date ? format(parseISO(selectedActivity.follow_up_date), 'MMM d, yyyy') : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Deal Value for Closures */}
              {selectedActivity.type === 'closure' && selectedActivity.deal_value && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Deal Value</Label>
                  <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <p className="text-2xl font-bold text-emerald-700">
                      ${selectedActivity.deal_value?.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Property Type & Walk-in At */}
              {(selectedActivity.property_type || selectedActivity.walk_in_at) && (
                <div className="grid grid-cols-2 gap-6">
                  {selectedActivity.property_type && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Property Type</Label>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="font-semibold text-slate-900 capitalize">{selectedActivity.property_type}</p>
                      </div>
                    </div>
                  )}
                  {selectedActivity.walk_in_at && selectedActivity.walk_in_at.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Walk-in At</Label>
                      <div className="flex flex-wrap gap-1 p-3 bg-slate-50 rounded-lg">
                        {selectedActivity.walk_in_at.map((location, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{location}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lead Quality */}
              {selectedActivity.lead_quality && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead Quality (RM Feedback)</Label>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <Badge className={selectedActivity.lead_quality === 'genuine' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {selectedActivity.lead_quality === 'genuine' ? 'Genuine' : 'Not Genuine'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Notes Section */}
              {selectedActivity.notes && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</Label>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm text-slate-700 leading-relaxed">{selectedActivity.notes}</p>
                  </div>
                </div>
              )}

              {/* Reviewer Feedback */}
              {selectedActivity.reviewer_note && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-xs font-semibold text-red-600 uppercase tracking-wide flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Reviewer Feedback
                  </Label>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 leading-relaxed">{selectedActivity.reviewer_note}</p>
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      Reviewed by {selectedActivity.reviewed_by} on {selectedActivity.reviewed_at ? format(parseISO(selectedActivity.reviewed_at), 'MMM d, yyyy') : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Builder Review */}
              {selectedActivity.builder_note && (
                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Builder Feedback</Label>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800 leading-relaxed">{selectedActivity.builder_note}</p>
                    <p className="text-xs text-orange-600 mt-2 font-medium">
                      Reviewed by {selectedActivity.builder_reviewed_by}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">Walk-In</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="closed_won">Closed Won</SelectItem>
                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Property/Product Interest</Label>
              <Input
                value={formData.property_interest}
                onChange={(e) => setFormData({ ...formData, property_interest: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
              <div></div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(selectedActivity?.id)}
            >
              Delete
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
        moduleConfig={SALES_ACTIVITY_FILTERS}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />
    </div>
  );
}