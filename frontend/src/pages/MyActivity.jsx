import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfToday, startOfWeek, startOfMonth, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Activity,
  TrendingUp,
  Clock,
  AlertCircle,
  Calendar,
  Building,
  Filter,
  Eye,
  Phone,
  Mail
} from 'lucide-react';
import LogActivityDialog from '@/components/sales/LogActivityDialog';
import { toast } from 'sonner';

const statusConfig = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Contacted', color: 'bg-purple-100 text-purple-700' },
  follow_up: { label: 'Follow-Up', color: 'bg-amber-100 text-amber-700' },
  meeting_done: { label: 'Meeting Done', color: 'bg-indigo-100 text-indigo-700' },
  proposal: { label: 'Proposal', color: 'bg-cyan-100 text-cyan-700' },
  negotiation: { label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  closed_won: { label: 'Closed Won', color: 'bg-emerald-100 text-emerald-700' },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-100 text-red-700' }
};

export default function MyActivity() {
  const [user, setUser] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [builderFilter, setBuilderFilter] = useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: myActivities = [] } = useQuery({
    queryKey: ['my-sales-activities', user?.email],
    queryFn: () => base44.entities.SalesActivity.filter({ user_email: user?.email }, '-date', 500),
    enabled: !!user?.email,
  });

  const { data: myLeads = [] } = useQuery({
    queryKey: ['my-assigned-leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ assigned_to: user?.email }, '-created_date', 500),
    enabled: !!user?.email,
  });

  const { data: builders = [] } = useQuery({
    queryKey: ['builders'],
    queryFn: () => base44.entities.Builder.list('builder_name', 1000),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { start: startOfToday(), end: now };
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: now };
      case 'month':
        return { start: startOfMonth(now), end: now };
      case 'custom':
        return {
          start: customStartDate ? parseISO(customStartDate) : new Date(0),
          end: customEndDate ? parseISO(customEndDate) : now
        };
      default:
        return { start: new Date(0), end: now };
    }
  };

  const filteredActivities = useMemo(() => {
    const { start, end } = getDateRange();
    return myActivities.filter(activity => {
      const activityDate = parseISO(activity.date);
      const dateMatch = activityDate >= start && activityDate <= end;
      const builderMatch = builderFilter === 'all' || activity.builder_email === builderFilter;
      const statusMatch = leadStatusFilter === 'all' || activity.status === leadStatusFilter;
      const typeMatch = activityTypeFilter === 'all' || activity.type === activityTypeFilter;
      return dateMatch && builderMatch && statusMatch && typeMatch;
    });
  }, [myActivities, dateFilter, customStartDate, customEndDate, builderFilter, leadStatusFilter, activityTypeFilter]);

  const filteredLeads = useMemo(() => {
    return myLeads.filter(lead => {
      const statusMatch = leadStatusFilter === 'all' || lead.status === leadStatusFilter;
      return statusMatch;
    });
  }, [myLeads, leadStatusFilter]);

  const stats = useMemo(() => {
    const todayActivities = myActivities.filter(a => {
      const activityDate = parseISO(a.date);
      return activityDate >= startOfToday();
    });

    return {
      totalActivities: filteredActivities.length,
      todayActivities: todayActivities.length,
      pendingApprovals: myActivities.filter(a => 
        a.ro_verification_status === 'pending' ||
        a.builder_verification_status === 'pending' ||
        a.approval_status === 'pending_builder' || 
        a.approval_status === 'pending' ||
        a.approval_status === 'changes_requested' ||
        a.approval_status === 'pending_assignment'
      ).length,
      leadsFollowUp: myLeads.filter(l => 
        l.follow_up_date && 
        parseISO(l.follow_up_date) <= new Date()
      ).length,
      totalLeads: filteredLeads.length
    };
  }, [myActivities, myLeads, filteredActivities, filteredLeads]);

  const getBuilderName = (email) => {
    const builder = builders.find(b => b.email === email);
    return builder?.builder_name || email;
  };

  const getUserName = (email) => allUsers.find(u => u.email === email)?.full_name || email;

  if (!user) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Sales Activity</h1>
          <p className="text-slate-500 mt-1">View your activities, leads, and approvals</p>
        </div>
        <LogActivityDialog 
          user={user} 
          builders={builders}
          allUsers={allUsers}
          departments={departments}
          projects={projects}
          invitations={invitations}
          className="bg-indigo-600 hover:bg-indigo-700" 
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Total Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalActivities}</p>
            <p className="text-xs text-slate-500 mt-1">In selected period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Today's Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-600">{stats.todayActivities}</p>
            <p className="text-xs text-slate-500 mt-1">Logged today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{stats.pendingApprovals}</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Follow-up Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.leadsFollowUp}</p>
            <p className="text-xs text-slate-500 mt-1">Leads requiring action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Assigned Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{stats.totalLeads}</p>
            <p className="text-xs text-slate-500 mt-1">Active leads</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Date Range</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateFilter === 'custom' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Builder</label>
              <Select value={builderFilter} onValueChange={setBuilderFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Builders</SelectItem>
                  {builders.map(b => (
                    <SelectItem key={b.id} value={b.email}>{b.builder_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Lead Status</label>
              <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">Activity Type</label>
              <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="walk_in">Walk-Ins</SelectItem>
                  <SelectItem value="closure">Closures</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Sales Activities ({filteredActivities.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Builder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approval Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivities.length > 0 ? (
                filteredActivities.map(activity => (
                  <TableRow key={activity.id}>
                    <TableCell>{format(parseISO(activity.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {activity.type === 'walk_in' ? 'Walk-In' : 'Closure'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{activity.customer_name}</span>
                        {activity.customer_phone && (
                          <span className="text-xs text-slate-500">{activity.customer_phone}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {activity.builder_email ? (
                        <div className="flex items-center gap-2">
                          <Building className="w-3 h-3 text-slate-400" />
                          <span className="text-sm">{getBuilderName(activity.builder_email)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig[activity.status]?.color}>
                        {statusConfig[activity.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        // Calculate final status based on verification states
                        const builderComplete = !activity.builder_email || 
                          (activity.builder_verification_status === 'verified' || activity.builder_verification_status === 'not_verified');
                        const roComplete = activity.ro_verification_status === 'verified' || activity.ro_verification_status === 'not_verified';
                        
                        const builderVerified = !activity.builder_email || activity.builder_verification_status === 'verified';
                        const roVerified = activity.ro_verification_status === 'verified';
                        
                        const isFullyApproved = builderVerified && roVerified;
                        const hasRejection = activity.builder_verification_status === 'not_verified' || 
                                           activity.ro_verification_status === 'not_verified';
                        
                        let statusText, statusClass;
                        
                        if (isFullyApproved) {
                          statusText = 'Approved ✓';
                          statusClass = 'bg-emerald-50 text-emerald-600 border-emerald-200';
                        } else if (hasRejection) {
                          statusText = 'Changes Requested';
                          statusClass = 'bg-red-50 text-red-600 border-red-200';
                        } else if (activity.approval_status === 'pending_assignment') {
                          statusText = 'Pending Assignment';
                          statusClass = 'bg-purple-50 text-purple-600 border-purple-200';
                        } else if (activity.builder_verification_status === 'pending') {
                          statusText = 'Builder Review';
                          statusClass = 'bg-orange-50 text-orange-600 border-orange-200';
                        } else if (activity.ro_verification_status === 'pending') {
                          statusText = 'Manager Review';
                          statusClass = 'bg-amber-50 text-amber-600 border-amber-200';
                        } else {
                          statusText = 'Pending Verification';
                          statusClass = 'bg-slate-50 text-slate-600 border-slate-200';
                        }
                        
                        return (
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={statusClass}>
                              {statusText}
                            </Badge>
                            <div className="flex gap-2 text-xs">
                              {activity.builder_email && (
                                <span className={
                                  activity.builder_verification_status === 'verified' ? 'text-emerald-600' :
                                  activity.builder_verification_status === 'not_verified' ? 'text-red-600' :
                                  'text-amber-600'
                                }>
                                  Builder: {activity.builder_verification_status === 'verified' ? '✓' : 
                                           activity.builder_verification_status === 'not_verified' ? '✗' : '⏳'}
                                </span>
                              )}
                              <span className={
                                activity.ro_verification_status === 'verified' ? 'text-emerald-600' :
                                activity.ro_verification_status === 'not_verified' ? 'text-red-600' :
                                'text-amber-600'
                              }>
                                RO: {activity.ro_verification_status === 'verified' ? '✓' : 
                                     activity.ro_verification_status === 'not_verified' ? '✗' : '⏳'}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No activities found for the selected filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}