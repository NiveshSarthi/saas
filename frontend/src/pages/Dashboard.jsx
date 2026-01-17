import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import FollowUpReminderWidget from '@/components/sales/FollowUpReminderWidget';
import { format, isToday, isTomorrow, isYesterday, isThisWeek, startOfDay, endOfDay, addDays, isPast, isFuture } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Target,
  Users,
  FolderKanban,
  Plus,
  ArrowRight,
  Zap,
  Eye,
  Video,
  Bell,
  AtSign,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StatsCard from '@/components/dashboard/StatsCard';
import TasksByStatus from '@/components/dashboard/TasksByStatus';
import RecentTasks from '@/components/dashboard/RecentTasks';
import PriorityChart from '@/components/dashboard/PriorityChart';
import GroupStats from '@/components/dashboard/GroupStats';
import RecentActivities from '@/components/dashboard/RecentActivities';
import UpcomingMeetings from '@/components/dashboard/UpcomingMeetings';
import QuickActions from '@/components/dashboard/QuickActions';
import WorkloadView from '@/components/dashboard/WorkloadView';
import TeamActivityFeed from '@/components/dashboard/TeamActivityFeed';
import VelocityChart from '@/components/dashboard/VelocityChart';
import TeamWorkload from '@/components/dashboard/TeamWorkload';
import AdminTeamOverview from '@/components/dashboard/AdminTeamOverview';
// import SalesKPIDashboard from '@/components/sales/SalesKPIDashboard'; // Moved to SalesPerformance
import LogActivityDialog from '@/components/sales/LogActivityDialog';
import { isSalesExecutive } from '@/components/utils/salesPermissions';
import AIStandupSummary from '@/components/dashboard/AIStandupSummary';
import TodayAttendanceWidget from '@/components/attendance/TodayAttendanceWidget';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [viewAllTasks, setViewAllTasks] = useState(false);
  const [dueFilter, setDueFilter] = useState('today');
  const [activeTaskFilters, setActiveTaskFilters] = useState({
    status: 'active',
    date: 'all',
    priority: 'all'
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        if (userData?.role === 'admin') {
          setViewAllTasks(true);
        }
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  const { data: rawTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-updated_date', 1000),
    enabled: !!user,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 20),
    enabled: !!user,
  });

  const tasks = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return rawTasks;

    // Get Syndicate project ID
    const syndicateProject = projects.find(p => p.name === 'Syndicate');

    return rawTasks.filter(t => {
      const userEmail = (user.email || '').toLowerCase();
      const reporterEmail = (t.reporter_email || '').toLowerCase();
      const assigneeEmail = (t.assignee_email || '').toLowerCase();
      // Safe check for assignees array with lowercasing
      const isAssigned = t.assignees && Array.isArray(t.assignees) && t.assignees.some(e => (e || '').toLowerCase() === userEmail);

      return t.project_id === (syndicateProject?.id || syndicateProject?._id) || // Show all Syndicate project tasks
        reporterEmail === userEmail ||
        assigneeEmail === userEmail ||
        isAssigned;
    });
  }, [rawTasks, user, projects]);

  const { data: taskGroups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['task-groups'],
    queryFn: () => base44.entities.TaskGroup.list('order'),
    enabled: !!user,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: () => base44.entities.Activity.list('-created_date', 50),
    enabled: !!user,
  });

  const { data: teamData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'dashboard'],
    queryFn: async () => {
      // Use backend function to bypass RLS so Managers can see all users and invitations
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
    enabled: !!user,
  });

  const users = teamData?.users || [];
  const invitations = (teamData?.invitations || []).filter(i => i.status === 'pending');

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => base44.entities.Meeting.list('-start_date', 20),
    enabled: !!user,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: ['user-groups'],
    queryFn: () => base44.entities.Group.list('name'),
    enabled: !!user,
  });

  const { data: myLeads = [] } = useQuery({
    queryKey: ['my-leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ assigned_to: user?.email }),
    enabled: !!user?.email,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['user-notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['user-mentions', user?.email],
    queryFn: () => base44.entities.Comment.list('-created_date', 100),
    enabled: !!user?.email,
  });

  // Calculate stats - filter by group if selected
  const isAdmin = user?.role === 'admin';

  // Check for any department containing "sales" (case insensitive)
  const salesDepts = departments.filter(d => d.name?.toLowerCase().includes('sales'));
  const salesDeptIds = salesDepts.map(d => d.id);
  const isSalesUser = salesDeptIds.includes(user?.department_id);
  const isSalesExec = isSalesExecutive(user);

  const showSalesKPI = isAdmin;

  // Combine users and pending invitations for team view
  const allTeamMembers = [
    ...users,
    ...invitations.map(inv => ({
      ...inv,
      id: `inv-${inv.id}`, // Ensure unique ID
      role: 'user', // Default pending invites to user role for display purposes (unless they are admin role_id, but we don't check that deep here)
      is_invitation: true
    }))
  ];

  const baseTasks = viewAllTasks && isAdmin ? tasks : tasks.filter(t => t.assignee_email === user?.email);
  const allMyTasks = baseTasks;
  const myTasks = selectedGroup === 'all'
    ? allMyTasks
    : selectedGroup === 'ungrouped'
      ? allMyTasks.filter(t => !t.group_id)
      : allMyTasks.filter(t => t.group_id === selectedGroup);
  const dueTasks = myTasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    const date = new Date(t.due_date);
    if (dueFilter === 'today') return isToday(date);
    if (dueFilter === 'tomorrow') return isTomorrow(date);
    if (dueFilter === 'yesterday') return isYesterday(date);
    if (dueFilter === 'week') {
      const today = new Date();
      const nextWeek = addDays(today, 7);
      return date >= today && date <= nextWeek;
    }
    return false;
  });

  const overdueTasks = myTasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    return isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
  });
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
  const completedTasks = myTasks.filter(t => t.status === 'done');
  const blockedTasks = myTasks.filter(t => t.status === 'blocked');

  const filteredActiveTasks = myTasks.filter(t => {
    // Status
    if (activeTaskFilters.status === 'active' && t.status === 'done') return false;
    if (activeTaskFilters.status === 'inactive' && t.status !== 'done') return false;

    // Priority
    if (activeTaskFilters.priority !== 'all' && t.priority !== activeTaskFilters.priority) return false;

    // Date
    if (activeTaskFilters.date !== 'all') {
      if (!t.due_date) return false;
      const date = new Date(t.due_date);
      if (activeTaskFilters.date === 'today' && !isToday(date)) return false;
      if (activeTaskFilters.date === 'tomorrow' && !isTomorrow(date)) return false;
      if (activeTaskFilters.date === 'week' && !isThisWeek(date)) return false;
    }

    return true;
  });

  // Upcoming tasks (next 7 days)
  const upcomingTasks = myTasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    const dueDate = new Date(t.due_date);
    const nextWeek = addDays(new Date(), 7);
    return isFuture(dueDate) && dueDate <= nextWeek;
  });

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const myMentions = comments.filter(c => c.mentions?.includes(user?.email)).length;
  const activeLeads = myLeads.filter(l => l.stage !== 'closed' && l.stage !== 'lost').length;

  const isLoading = tasksLoading || projectsLoading || groupsLoading || activitiesLoading || usersLoading || meetingsLoading;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Welcome Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl sm:rounded-3xl opacity-10 blur-3xl" />
          <div className="relative bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border-2 border-white/50 shadow-xl p-4 sm:p-5 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                  Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-slate-600 mt-1 sm:mt-2 font-medium">
                  {viewAllTasks && isAdmin
                    ? "Viewing all team members' tasks"
                    : "Here's what's happening with your tasks today"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
                {/* Sales Dashboard - For Admin, Sales Manager, and Sales Executive */}
                {(isAdmin || user?.job_title === 'Sales Manager' || isSalesExec) && (
                  <Link to={createPageUrl('SalesPerformance')}>
                    <Button variant="outline" className="text-sm sm:text-base border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm">
                      <TrendingUp className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Sales Dashboard</span>
                    </Button>
                  </Link>
                )}
                {isAdmin && (
                  <Select
                    value={viewAllTasks ? "team" : "my_tasks"}
                    onValueChange={(val) => setViewAllTasks(val === "team")}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="my_tasks">My Tasks</SelectItem>
                      <SelectItem value="team">All Team</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {taskGroups.length > 0 && (
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger className="w-32 sm:w-40">
                      <SelectValue placeholder="Filter by group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      <SelectItem value="ungrouped">Ungrouped</SelectItem>
                      {taskGroups.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
                            {g.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {/* New Project - Only for Admin */}
                {isAdmin && (
                  <Link to={createPageUrl('NewProject')}>
                    <Button variant="outline" className="text-sm sm:text-base shadow-sm">
                      <FolderKanban className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">New Project</span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions isSalesExec={isSalesExec} isSalesManager={user?.job_title === 'Sales Manager'} />

        {/* Sales KPI Dashboard - Moved to SalesPerformance page */}

        {/* Stats Cards with Attendance Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left side - Stats Cards */}
          <div className="lg:col-span-2">
            <div className="space-y-3 sm:space-y-4">
              {/* First Row - 3 Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                <StatsCard
                  title={viewAllTasks && isAdmin ? "Team Tasks" : "My Tasks"}
                  value={myTasks.length}
                  subtitle={`${inProgressTasks.length} in progress`}
                  icon={viewAllTasks && isAdmin ? Users : CheckSquare}
                  color="indigo"
                />
                <StatsCard
                  title={dueFilter === 'week' ? "Due This Week" : `Due ${dueFilter.charAt(0).toUpperCase() + dueFilter.slice(1)}`}
                  value={dueTasks.length}
                  subtitle={dueTasks.length > 0 ? "Focus on these" : "All clear!"}
                  icon={Calendar}
                  color="blue"
                />
                <StatsCard
                  title="Overdue"
                  value={overdueTasks.length}
                  subtitle={overdueTasks.length > 0 ? "Needs attention" : "Great job!"}
                  icon={AlertTriangle}
                  color={overdueTasks.length > 0 ? "red" : "green"}
                />
              </div>

              {/* Second Row - 5 Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
                <StatsCard
                  title="Completed"
                  value={completedTasks.length}
                  subtitle="Total completed"
                  icon={Target}
                  color="green"
                  trend={completedTasks.length > 0 ? "up" : undefined}
                  trendValue={completedTasks.length > 0 ? "+12%" : undefined}
                />

                {/* Meeting Status Card */}
                <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm dark:bg-slate-800 rounded-2xl p-4 border-2 border-white/50 dark:border-slate-700 shadow-lg flex flex-col justify-between group hover:shadow-xl transition-all h-full">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
                  <div className="relative">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Meeting Status</p>
                    {(() => {
                      const now = new Date();
                      const currentMeeting = meetings.find(m => {
                        const start = new Date(m.start_date);
                        const end = new Date(m.end_date);
                        return (m.participants?.includes(user?.email) || m.created_by === user?.email) &&
                          now >= start && now <= end && m.status !== 'cancelled';
                      });

                      if (currentMeeting) {
                        return (
                          <>
                            <h3 className="text-xl font-bold text-red-600 mt-1 truncate" title={currentMeeting.title}>Busy</h3>
                            <p className="text-xs text-slate-500 mt-1 truncate">In: {currentMeeting.title}</p>
                          </>
                        );
                      }

                      const nextMeeting = meetings
                        .filter(m => (m.participants?.includes(user?.email) || m.created_by === user?.email) && new Date(m.start_date) > now && m.status !== 'cancelled')
                        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];

                      if (nextMeeting) {
                        return (
                          <>
                            <h3 className="text-xl font-bold text-emerald-600 mt-1">Available</h3>
                            <p className="text-xs text-slate-500 mt-1 truncate">Next: {format(new Date(nextMeeting.start_date), 'h:mm a')}</p>
                          </>
                        );
                      }

                      return (
                        <>
                          <h3 className="text-xl font-bold text-emerald-600 mt-1">Available</h3>
                          <p className="text-xs text-slate-500 mt-1">No meetings today</p>
                        </>
                      );
                    })()}
                  </div>
                  <div className="mt-3 flex justify-end relative">
                    <div className={cn("p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600")}>
                      <Video className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <StatsCard
                  title="My Leads"
                  value={activeLeads}
                  subtitle={activeLeads > 0 ? "Active leads" : "No active leads"}
                  icon={UserCheck}
                  color="cyan"
                />

                <StatsCard
                  title="Notifications"
                  value={unreadNotifications}
                  subtitle={unreadNotifications > 0 ? "Unread" : "All caught up!"}
                  icon={Bell}
                  color={unreadNotifications > 0 ? "yellow" : "gray"}
                />

                <StatsCard
                  title="Mentions"
                  value={myMentions}
                  subtitle="In comments"
                  icon={AtSign}
                  color="pink"
                />
              </div>
            </div>
          </div>

          {/* Right side - Today's Attendance */}
          <div className="lg:col-span-1">
            <TodayAttendanceWidget user={user} />
          </div>
        </div>

        {/* Blocked Tasks Alert */}
        {blockedTasks.length > 0 && (
          <div className="relative overflow-hidden bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200/50 rounded-2xl p-4 flex items-start gap-4 shadow-lg backdrop-blur-sm">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-rose-100 flex items-center justify-center flex-shrink-0 shadow-md">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1 relative">
              <h4 className="font-semibold text-red-900">
                {blockedTasks.length} blocked task{blockedTasks.length > 1 ? 's' : ''} require attention
              </h4>
              <p className="text-red-700 text-sm mt-1">
                {blockedTasks.map(t => t.title).slice(0, 2).join(', ')}
                {blockedTasks.length > 2 && ` and ${blockedTasks.length - 2} more`}
              </p>
            </div>
            <Link to={createPageUrl('MyTasks?filter=blocked')}>
              <Button size="sm" variant="outline" className="relative border-red-300 text-red-700 hover:bg-red-100 shadow-sm">
                View
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}

        {/* Follow-up Reminders Widget - Sales Team Only */}
        {(isSalesUser || isSalesExec) && (
          <FollowUpReminderWidget user={user} />
        )}

        {/* AI Standup Summary - Admin Only */}
        {isAdmin && <AIStandupSummary user={user} />}

        {/* Main Content Grid - Prioritized Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 items-start">
          <div className="md:col-span-1 space-y-6">
            <RecentTasks
              users={allTeamMembers}
              tasks={dueTasks}
              title={
                <div className="flex items-center gap-2">
                  <Select value={dueFilter} onValueChange={setDueFilter}>
                    <SelectTrigger className="h-auto border-none shadow-none p-0 text-sm sm:text-base font-semibold bg-transparent focus:ring-0 hover:bg-transparent text-slate-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Due Today</SelectItem>
                      <SelectItem value="tomorrow">Due Tomorrow</SelectItem>
                      <SelectItem value="week">Due Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
              viewAllLink={viewAllTasks && isAdmin ? 'TeamTasks' : 'MyTasks'}
            />
            <TasksByStatus
              tasks={myTasks}
              projects={projects}
              taskGroups={taskGroups}
              departments={departments}
              users={allTeamMembers}
              viewAllLink={viewAllTasks && isAdmin ? 'TeamTasks' : 'MyTasks'}
            />
          </div>
          <div className="md:col-span-2 space-y-6">
            {!isSalesExec && user?.job_title !== 'Sales Manager' && (
              <TeamWorkload
                tasks={tasks}
                users={allTeamMembers}
                taskGroups={taskGroups}
                departments={departments}
                userGroups={userGroups}
              />
            )}
            <RecentTasks
              users={allTeamMembers}
              tasks={filteredActiveTasks.slice(0, 5)}
              title="Active Tasks"
              viewAllLink={viewAllTasks && isAdmin ? 'TeamTasks' : 'MyTasks'}
              extraControls={
                <div className="flex items-center gap-2">
                  <Select
                    value={activeTaskFilters.status}
                    onValueChange={(v) => setActiveTaskFilters(prev => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-[90px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="all">All</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={activeTaskFilters.date}
                    onValueChange={(v) => setActiveTaskFilters(prev => ({ ...prev, date: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-[90px]">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Date</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="tomorrow">Tomorrow</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={activeTaskFilters.priority}
                    onValueChange={(v) => setActiveTaskFilters(prev => ({ ...prev, priority: v }))}
                  >
                    <SelectTrigger className="h-7 text-xs w-[90px]">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
            />
          </div>
        </div>

        {/* Workload & Priority */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 items-stretch">
          <div className="md:col-span-2">
            <WorkloadView tasks={myTasks} />
          </div>
          <div className="md:col-span-1">
            <PriorityChart tasks={myTasks.filter(t => t.status !== 'done')} />
          </div>
        </div>

        {/* Velocity & Upcoming */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          <VelocityChart tasks={tasks} />
          <RecentTasks
            users={allTeamMembers}
            tasks={upcomingTasks.slice(0, 5)}
            title="Upcoming This Week"
          />
        </div>

        {/* Activity, Feed and Meetings */}
        {!isSalesExec && user?.job_title !== 'Sales Manager' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            <div className="sm:col-span-1">
              <TeamActivityFeed activities={activities} users={users} tasks={tasks} />
            </div>
            <div className="sm:col-span-1">
              <RecentActivities activities={activities} users={users} />
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <UpcomingMeetings
                meetings={meetings.filter(m =>
                  (m.participants?.includes(user?.email) || m.created_by === user?.email) &&
                  new Date(m.end_date) > new Date() &&
                  m.status !== 'cancelled'
                )}
                users={users}
                currentUserEmail={user?.email}
              />
            </div>
          </div>
        )}

        {/* Admin Team Overview */}
        {isAdmin && (
          <AdminTeamOverview
            users={users}
            tasks={tasks}
            activities={activities}
          />
        )}

        {/* Group Stats */}
        {taskGroups.length > 0 && (
          <GroupStats
            groups={taskGroups}
            tasks={allMyTasks}
            onSelectGroup={(groupId) => setSelectedGroup(groupId || 'ungrouped')}
          />
        )}

        {/* Projects Overview */}
        {!isSalesExec && user?.job_title !== 'Sales Manager' && (
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm dark:bg-slate-800 rounded-2xl p-6 shadow-lg border-2 border-white/50 dark:border-slate-700">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl" />
            <div className="relative flex items-center justify-between mb-6">
              <h3 className="font-semibold text-slate-900 dark:text-white text-lg">Active Projects</h3>
              <Link to={createPageUrl('Projects')}>
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50">
                  View all
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
              {projects.filter(p => p.status === 'active').slice(0, 3).map((project) => {
                const projectId = project.id || project._id;
                if (!projectId) return null;

                const projectTasks = tasks.filter(t => t.project_id === projectId);
                const completed = projectTasks.filter(t => t.status === 'done').length;
                const total = projectTasks.length;
                const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

                return (
                  <Link
                    key={project.id || project._id}
                    to={createPageUrl(`ProjectBoard?id=${project.id || project._id}`)}
                    className="block"
                  >
                    <div className="relative overflow-hidden p-4 rounded-xl border-2 border-slate-200/50 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1 transition-all group bg-white/60 backdrop-blur-sm">
                      <div className="absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md"
                          style={{ backgroundColor: `${project.color}20` }}
                        >
                          <FolderKanban className="w-5 h-5" style={{ color: project.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 dark:text-white truncate group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-purple-600 group-hover:bg-clip-text transition-all">
                            {project.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {total} tasks · {progress}% complete
                          </p>
                          <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: project.color || '#6366F1'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              {projects.filter(p => p.status === 'active').length === 0 && (
                <div className="col-span-full text-center py-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <FolderKanban className="w-8 h-8 text-indigo-600" />
                  </div>
                  <p className="text-slate-600 text-sm mb-4 font-medium">No projects yet</p>
                  <Link to={createPageUrl('NewProject')}>
                    <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}