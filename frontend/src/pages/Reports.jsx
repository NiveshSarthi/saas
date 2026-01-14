import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isTomorrow, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Filter,
  FileText,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import MarketingReports from '@/components/marketing/MarketingReports';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

const STATUS_COLORS = {
  backlog: '#94A3B8',
  todo: '#3B82F6',
  in_progress: '#F59E0B',
  review: '#8B5CF6',
  done: '#10B981',
  blocked: '#EF4444',
};

export default function Reports() {
  const [timeRange, setTimeRange] = useState('week');
  const [customDateRange, setCustomDateRange] = useState({ from: null, to: null });
  const [reportType, setReportType] = useState('tasks');
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedUserGroup, setSelectedUserGroup] = useState('all');
  const [user, setUser] = useState(null);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['report-tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 1000),
  });

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['report-groups'],
    queryFn: () => base44.entities.TaskGroup.list('order'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['report-projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['report-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['report-departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: ['report-user-groups'],
    queryFn: () => base44.entities.Group.list('name'),
  });

  const { data: marketingTasks = [] } = useQuery({
    queryKey: ['marketing-tasks-reports'],
    queryFn: () => base44.entities.MarketingTask.list('-updated_date', 1000),
  });

  // Filter tasks based on selections
  const filteredTasks = tasks.filter(t => {
    if (selectedProject !== 'all' && t.project_id !== selectedProject) return false;
    if (selectedUser !== 'all' && t.assignee_email !== selectedUser) return false;
    if (selectedGroup !== 'all') {
      if (selectedGroup === 'ungrouped') {
        if (t.group_id) return false;
      } else if (t.group_id !== selectedGroup) {
        return false;
      }
    }
    
    if (selectedDepartment !== 'all') {
      const assignee = users.find(u => u.email === t.assignee_email);
      if (!assignee || assignee.department_id !== selectedDepartment) return false;
    }

    if (selectedUserGroup !== 'all') {
      const group = userGroups.find(g => g.id === selectedUserGroup);
      if (!group || !group.members.includes(t.assignee_email)) return false;
    }

    if (timeRange === 'today') {
      if (!t.due_date) return false;
      if (!isToday(new Date(t.due_date))) return false;
    } else if (timeRange === 'tomorrow') {
      if (!t.due_date) return false;
      if (!isTomorrow(new Date(t.due_date))) return false;
    } else if (timeRange === 'yesterday') {
      if (!t.due_date) return false;
      if (!isYesterday(new Date(t.due_date))) return false;
    } else {
      const dateToCompare = new Date(t.created_date);
      const now = new Date();
      
      if (timeRange === 'week' && dateToCompare < subDays(now, 7)) return false;
      if (timeRange === 'month' && dateToCompare < subDays(now, 30)) return false;
      if (timeRange === 'quarter' && dateToCompare < subDays(now, 90)) return false;
      
      if (timeRange === 'custom' && customDateRange.from) {
        if (dateToCompare < startOfDay(customDateRange.from)) return false;
        if (customDateRange.to && dateToCompare > endOfDay(customDateRange.to)) return false;
      }
    }

    return true;
  });

  const filteredUsers = users.filter(u => {
    if (selectedDepartment !== 'all' && u.department_id !== selectedDepartment) return false;
    if (selectedUserGroup !== 'all') {
      const group = userGroups.find(g => g.id === selectedUserGroup);
      if (!group || !group.members.includes(u.email)) return false;
    }
    return true;
  });

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress').length;
  const overdueTasks = filteredTasks.filter(t => 
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  ).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const totalEstimatedHours = filteredTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
  const totalActualHours = filteredTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);
  const avgCycleTime = completedTasks > 0 
    ? filteredTasks
        .filter(t => t.status === 'done' && t.created_date)
        .reduce((sum, t) => {
          const created = new Date(t.created_date);
          const updated = new Date(t.updated_date);
          return sum + (updated - created) / (1000 * 60 * 60 * 24);
        }, 0) / completedTasks
    : 0;

  const tasksByStatus = Object.entries(
    filteredTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ 
    name: name.replace('_', ' ').charAt(0).toUpperCase() + name.replace('_', ' ').slice(1),
    value,
    color: STATUS_COLORS[name]
  }));

  const tasksByPriority = [
    { name: 'Critical', value: filteredTasks.filter(t => t.priority === 'critical').length, color: '#EF4444' },
    { name: 'High', value: filteredTasks.filter(t => t.priority === 'high').length, color: '#F97316' },
    { name: 'Medium', value: filteredTasks.filter(t => t.priority === 'medium').length, color: '#3B82F6' },
    { name: 'Low', value: filteredTasks.filter(t => t.priority === 'low').length, color: '#94A3B8' },
  ];

  const getChartInterval = () => {
    const end = new Date();
    let start = subDays(end, 6);

    if (timeRange === 'month') start = subDays(end, 29);
    if (timeRange === 'quarter') start = subDays(end, 89);
    if (timeRange === 'custom' && customDateRange.from) {
      start = customDateRange.from;
      if (customDateRange.to) end.setTime(customDateRange.to.getTime());
    }
    if (timeRange === 'today') start = startOfDay(end);
    if (timeRange === 'yesterday') {
      start = startOfDay(subDays(end, 1));
      end.setTime(endOfDay(start).getTime());
    }
    if (timeRange === 'tomorrow') {
      start = startOfDay(addDays(end, 1));
      end.setTime(endOfDay(start).getTime());
    }

    if (start > end) start = end;
    
    return { start, end };
  };

  const chartInterval = getChartInterval();
  const chartDays = eachDayOfInterval(chartInterval);

  const tasksPerDay = chartDays.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const created = filteredTasks.filter(t => t.created_date?.startsWith(dayStr)).length;
    const completed = filteredTasks.filter(t => 
      t.status === 'done' && t.updated_date?.startsWith(dayStr)
    ).length;
    return {
      date: chartDays.length > 30 ? format(day, 'MMM d') : format(day, 'EEE'),
      created,
      completed
    };
  });

  const teamPerformance = users.slice(0, 6).map(u => {
    const userTasks = tasks.filter(t => t.assignee_email === u.email);
    const completed = userTasks.filter(t => t.status === 'done').length;
    return {
      name: u.full_name?.split(' ')[0] || u.email.split('@')[0],
      completed,
      total: userTasks.length
    };
  });

  const projectProgress = projects.slice(0, 5).map(p => {
    const projectTasks = tasks.filter(t => t.project_id === p.id);
    const completed = projectTasks.filter(t => t.status === 'done').length;
    const total = projectTasks.length;
    return {
      name: p.name.length > 15 ? p.name.slice(0, 15) + '...' : p.name,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      total
    };
  });

  const handleExport = async (exportFormat) => {
    const cleanData = filteredTasks.map(task => {
      const project = projects.find(p => p.id === task.project_id);
      const assignee = users.find(u => u.email === task.assignee_email);
      return {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee_email: task.assignee_email,
        assignee_name: assignee ? (assignee.full_name || assignee.email.split('@')[0]) : (task.assignee_email || 'Unassigned'),
        project_name: project?.name || '',
        due_date: task.due_date,
        created_date: task.created_date,
        estimated_hours: task.estimated_hours || 0,
        actual_hours: task.actual_hours || 0
      };
    });

    if (exportFormat === 'csv') {
      const headers = ['Task Title', 'Status', 'Priority', 'Assignee', 'Project', 'Due Date', 'Created Date', 'Estimated Hours', 'Actual Hours'];
      const rows = cleanData.map(item => [
        `"${item.title?.replace(/"/g, '""') || ''}"`,
        item.status || '',
        item.priority || '',
        item.assignee_name || '',
        `"${item.project_name?.replace(/"/g, '""') || ''}"`,
        item.due_date || '',
        item.created_date || '',
        item.estimated_hours,
        item.actual_hours
      ].join(','));
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      try {
        const response = await base44.functions.invoke('generateReport', { 
          data: cleanData, 
          format: exportFormat 
        });
        
        const type = exportFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const extension = exportFormat === 'pdf' ? 'pdf' : 'xlsx';
        
        const blob = new Blob([response.data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${format(new Date(), 'yyyy-MM-dd')}.${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } catch (error) {
        console.error('Export failed:', error);
        alert('Export failed. Please try again.');
      }
    }
  };

  const completionData = [
    { name: 'Completion', value: completionRate, fill: '#10B981' }
  ];

  if (tasksLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 mt-1">Analytics and insights</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
              <ChevronDown className="w-4 h-4 ml-2 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              Export as Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Filters:</span>
          </div>
          
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2"
          >
            <option value="tasks">Task Reports</option>
            <option value="marketing">Marketing Reports</option>
            <option value="time">Time Tracking</option>
            <option value="team">Team Performance</option>
            <option value="projects">Projects</option>
          </select>

          {reportType === 'tasks' && (
            <>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="all">All Projects</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="all">All Task Groups</option>
                <option value="ungrouped">Ungrouped Tasks</option>
                {taskGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <select
                value={selectedUserGroup}
                onChange={(e) => setSelectedUserGroup(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="all">All User Groups</option>
                {userGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="all">All Members</option>
                {filteredUsers.map(u => (
                  <option key={u.email} value={u.email}>{u.full_name || u.email}</option>
                ))}
              </select>

              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-2"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
                <option value="yesterday">Due Yesterday</option>
                <option value="today">Due Today</option>
                <option value="tomorrow">Due Tomorrow</option>
                <option value="custom">Custom Range</option>
              </select>

              {timeRange === 'custom' && (
                <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal h-9 px-3",
                        !customDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "LLL dd, y")} -{" "}
                            {format(customDateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(customDateRange.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.from}
                      selected={customDateRange}
                      onSelect={setCustomDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </>
          )}
        </div>
      </div>

      {reportType === 'marketing' && (
        <MarketingReports
          tasks={marketingTasks}
          users={users}
          departments={departments}
        />
      )}

      {reportType === 'tasks' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-100">Total Tasks</p>
                    <p className="text-3xl font-bold mt-1">{totalTasks}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-indigo-200">
                      <Target className="w-3 h-3" />
                      <span>{completedTasks} completed</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-100">Completion Rate</p>
                    <p className="text-3xl font-bold mt-1">{completionRate}%</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-emerald-200">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>On track</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-100">In Progress</p>
                    <p className="text-3xl font-bold mt-1">{inProgressTasks}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-amber-200">
                      <Zap className="w-3 h-3" />
                      <span>Active work</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-100">Overdue</p>
                    <p className="text-3xl font-bold mt-1">{overdueTasks}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-red-200">
                      <ArrowDownRight className="w-3 h-3" />
                      <span>Needs attention</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-slate-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-indigo-600" />
                  Completion Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart 
                      cx="50%" 
                      cy="50%" 
                      innerRadius="60%" 
                      outerRadius="90%" 
                      barSize={20} 
                      data={completionData}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        background={{ fill: '#E2E8F0' }}
                        dataKey="value"
                        cornerRadius={10}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-slate-900">{completionRate}%</span>
                    <span className="text-sm text-slate-500">Complete</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-600">{completedTasks}</p>
                    <p className="text-xs text-slate-500">Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-600">{totalTasks - completedTasks}</p>
                    <p className="text-xs text-slate-500">Remaining</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  Tasks by Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={tasksByStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {tasksByStatus.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                                  <p className="font-medium">{payload[0].payload.name}</p>
                                  <p>{payload[0].value} tasks</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 flex flex-col justify-center gap-3">
                    {tasksByStatus.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-slate-600 flex-1">{item.name}</span>
                        <Badge variant="secondary" className="font-medium">
                          {item.value}
                        </Badge>
                        <span className="text-xs text-slate-400 w-10 text-right">
                          {totalTasks > 0 ? Math.round((item.value / totalTasks) * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Task Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tasksPerDay}>
                    <defs>
                      <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="date" stroke="#94A3B8" axisLine={false} tickLine={false} />
                    <YAxis stroke="#94A3B8" axisLine={false} tickLine={false} />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-lg">
                              <p className="font-medium text-slate-900 mb-2">{label}</p>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-indigo-500" />
                                <span className="text-slate-600">Created:</span>
                                <span className="font-medium">{payload[0]?.value || 0}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                <span className="text-slate-600">Completed:</span>
                                <span className="font-medium">{payload[1]?.value || 0}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="created" 
                      stroke="#6366F1" 
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCreated)"
                      name="Created"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      stroke="#10B981" 
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCompleted)"
                      name="Completed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Team Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamPerformance} layout="vertical" barGap={0}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={true} vertical={false} />
                      <XAxis type="number" stroke="#94A3B8" axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" stroke="#64748B" width={80} axisLine={false} tickLine={false} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const rate = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p>Completed: {data.completed} / {data.total}</p>
                                <p>Rate: {rate}%</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="total" fill="#E2E8F0" name="Total" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="completed" fill="#10B981" name="Completed" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Project Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={projectProgress}>
                      <defs>
                        <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366F1" />
                          <stop offset="100%" stopColor="#8B5CF6" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="name" stroke="#94A3B8" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94A3B8" axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg">
                                <p className="font-medium">{data.name}</p>
                                <p>{data.progress}% complete</p>
                                <p>{data.total} total tasks</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="progress" fill="url(#progressGradient)" name="Progress %" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-indigo-600" />
                Tasks by Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {tasksByPriority.map((item) => {
                  const percentage = totalTasks > 0 ? Math.round((item.value / totalTasks) * 100) : 0;
                  return (
                    <div 
                      key={item.name}
                      className="p-5 rounded-2xl border-2 text-center relative overflow-hidden transition-all hover:shadow-md"
                      style={{ borderColor: item.color }}
                    >
                      <div 
                        className="absolute bottom-0 left-0 right-0 opacity-10"
                        style={{ 
                          backgroundColor: item.color,
                          height: `${percentage}%`,
                          transition: 'height 0.5s ease'
                        }}
                      />
                      <div className="relative">
                        <div 
                          className="w-4 h-4 rounded-full mx-auto mb-3"
                          style={{ backgroundColor: item.color }}
                        />
                        <p className="text-3xl font-bold" style={{ color: item.color }}>{item.value}</p>
                        <p className="text-sm font-medium text-slate-700 mt-1">{item.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{percentage}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {reportType === 'time' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <p className="text-3xl font-bold">{totalEstimatedHours.toFixed(1)}h</p>
              <p className="text-sm text-slate-500">Estimated Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-3xl font-bold">{totalActualHours.toFixed(1)}h</p>
              <p className="text-sm text-slate-500">Logged Hours</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <p className="text-3xl font-bold">{avgCycleTime.toFixed(1)} days</p>
              <p className="text-sm text-slate-500">Avg. Cycle Time</p>
            </CardContent>
          </Card>
        </div>
      )}

      {reportType === 'team' && (
        <Card>
          <CardHeader>
            <CardTitle>Workload Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.slice(0, 10).map(u => {
                const userTasks = filteredTasks.filter(t => t.assignee_email === u.email);
                const completed = userTasks.filter(t => t.status === 'done').length;
                const inProgress = userTasks.filter(t => t.status === 'in_progress').length;
                const total = userTasks.length;
                
                return (
                  <div key={u.email} className="flex items-center gap-4">
                    <div className="w-32 truncate text-sm font-medium">
                      {u.full_name || u.email.split('@')[0]}
                    </div>
                    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-emerald-500"
                        style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                      />
                      <div 
                        className="h-full bg-amber-500"
                        style={{ width: `${total > 0 ? (inProgress / total) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm text-slate-500">
                      {completed}/{total} done
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}