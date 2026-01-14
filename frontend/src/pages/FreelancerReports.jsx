import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function FreelancerReports() {
  const [user, setUser] = useState(null);
  const [timeRange, setTimeRange] = useState('month'); // week, month, quarter
  const [selectedFreelancer, setSelectedFreelancer] = useState('all');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (timeRange) {
      case 'week':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 })
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        return { start: quarterStart, end: quarterEnd };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  };

  const dateRange = getDateRange();

  // Get all freelancers
  const { data: freelancers = [] } = useQuery({
    queryKey: ['freelancers-for-reports'],
    queryFn: () => base44.entities.User.filter({ role: 'freelancer' }),
    enabled: !!user?.role === 'admin',
  });

  // Get timesheets for the selected period
  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets-reports', dateRange.start, dateRange.end, selectedFreelancer],
    queryFn: async () => {
      let filter = {
        submitted_at: { $gte: dateRange.start.toISOString(), $lte: dateRange.end.toISOString() }
      };

      if (selectedFreelancer !== 'all') {
        filter.freelancer_email = selectedFreelancer;
      }

      return await base44.entities.Timesheet.filter(filter);
    },
    enabled: !!user?.role === 'admin',
  });

  // Get freelancer assignments/tasks
  const { data: freelancerTasks = [] } = useQuery({
    queryKey: ['freelancer-tasks-reports'],
    queryFn: () => base44.entities.Task.filter({
      assignmentType: 'FREELANCER',
      status: { $in: ['in_progress', 'done'] }
    }),
    enabled: !!user?.role === 'admin',
  });

  // Calculate metrics
  const calculateMetrics = () => {
    const freelancerMetrics = {};

    freelancers.forEach(freelancer => {
      const freelancerTimesheets = timesheets.filter(ts => ts.freelancer_email === freelancer.email);
      const freelancerTaskAssignments = freelancerTasks.filter(task => task.assignedFreelancerId === freelancer.email);

      // Calculate total hours worked
      const totalHours = freelancerTimesheets
        .filter(ts => ts.status === 'approved')
        .reduce((sum, ts) => sum + ts.total_hours, 0);

      // Calculate approved timesheets
      const approvedTimesheets = freelancerTimesheets.filter(ts => ts.status === 'approved').length;
      const totalSubmitted = freelancerTimesheets.filter(ts => ['approved', 'rejected'].includes(ts.status)).length;
      const approvalRate = totalSubmitted > 0 ? (approvedTimesheets / totalSubmitted) * 100 : 0;

      // Calculate active tasks
      const activeTasks = freelancerTaskAssignments.filter(task => task.status === 'in_progress').length;
      const completedTasks = freelancerTaskAssignments.filter(task => task.status === 'done').length;

      // Calculate efficiency (hours per task)
      const totalAssignedTasks = freelancerTaskAssignments.length;
      const efficiency = totalAssignedTasks > 0 ? totalHours / totalAssignedTasks : 0;

      // Calculate weekly average
      const weeksInPeriod = timeRange === 'week' ? 1 :
                           timeRange === 'month' ? 4.33 :
                           timeRange === 'quarter' ? 13 : 4.33;
      const weeklyAverage = totalHours / weeksInPeriod;

      freelancerMetrics[freelancer.email] = {
        freelancer,
        totalHours,
        approvedTimesheets,
        totalSubmitted,
        approvalRate,
        activeTasks,
        completedTasks,
        totalAssignedTasks,
        efficiency,
        weeklyAverage,
        timesheets: freelancerTimesheets
      };
    });

    return freelancerMetrics;
  };

  const metrics = calculateMetrics();

  // Overall statistics
  const overallStats = {
    totalFreelancers: freelancers.length,
    totalHoursLogged: Object.values(metrics).reduce((sum, m) => sum + m.totalHours, 0),
    averageApprovalRate: Object.values(metrics).reduce((sum, m) => sum + m.approvalRate, 0) / freelancers.length || 0,
    averageWeeklyHours: Object.values(metrics).reduce((sum, m) => sum + m.weeklyAverage, 0) / freelancers.length || 0,
    totalActiveTasks: Object.values(metrics).reduce((sum, m) => sum + m.activeTasks, 0),
    totalCompletedTasks: Object.values(metrics).reduce((sum, m) => sum + m.completedTasks, 0),
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 15) return 'text-green-600';
    if (efficiency >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getApprovalRateColor = (rate) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Please log in to access freelancer reports.</p>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only administrators can access freelancer reports.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Freelancer Efficiency Reports</h1>
            <p className="text-slate-600 mt-1">Monitor freelancer productivity and performance metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedFreelancer} onValueChange={setSelectedFreelancer}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Freelancers</SelectItem>
                {freelancers.map(freelancer => (
                  <SelectItem key={freelancer.email} value={freelancer.email}>
                    {freelancer.full_name || freelancer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Freelancers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalFreelancers}</div>
            <p className="text-xs text-muted-foreground">Active freelancers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.totalHoursLogged.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">Approved timesheets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.averageApprovalRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Timesheet approvals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Weekly Hours</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallStats.averageWeeklyHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">Per freelancer</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Tasks</span>
                <span className="text-2xl font-bold text-blue-600">{overallStats.totalActiveTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Completed Tasks</span>
                <span className="text-2xl font-bold text-green-600">{overallStats.totalCompletedTasks}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Assigned</span>
                <span className="text-2xl font-bold">{overallStats.totalActiveTasks + overallStats.totalCompletedTasks}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">High Performers</span>
                <span className="text-2xl font-bold text-green-600">
                  {Object.values(metrics).filter(m => m.approvalRate >= 90 && m.weeklyAverage >= 20).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Needs Attention</span>
                <span className="text-2xl font-bold text-red-600">
                  {Object.values(metrics).filter(m => m.approvalRate < 75 || m.weeklyAverage < 10).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">On Track</span>
                <span className="text-2xl font-bold text-yellow-600">
                  {freelancers.length - Object.values(metrics).filter(m => m.approvalRate >= 90 && m.weeklyAverage >= 20).length - Object.values(metrics).filter(m => m.approvalRate < 75 || m.weeklyAverage < 10).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Freelancer Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Freelancer Performance Details</CardTitle>
          <p className="text-sm text-muted-foreground">
            Detailed metrics for {timeRange === 'week' ? 'this week' : timeRange === 'month' ? 'this month' : 'this quarter'}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Freelancer</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Weekly Avg</TableHead>
                <TableHead>Approval Rate</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Active Tasks</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(metrics).map((metric) => (
                <TableRow key={metric.freelancer.email}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{metric.freelancer.full_name || metric.freelancer.email}</div>
                      <div className="text-sm text-slate-500">{metric.freelancer.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{metric.totalHours.toFixed(1)}h</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{metric.weeklyAverage.toFixed(1)}h</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {metric.totalSubmitted > 0 ? (
                        <>
                          {metric.approvalRate >= 90 ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : metric.approvalRate >= 75 ? (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className={cn("font-medium", getApprovalRateColor(metric.approvalRate))}>
                            {metric.approvalRate.toFixed(1)}%
                          </span>
                          <span className="text-sm text-slate-500">
                            ({metric.approvedTimesheets}/{metric.totalSubmitted})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">No submissions</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-slate-400" />
                      <span className={cn("font-medium", getEfficiencyColor(metric.efficiency))}>
                        {metric.efficiency.toFixed(1)}h/task
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-slate-400" />
                      <span className="font-medium">{metric.activeTasks} active</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {metric.approvalRate >= 90 && metric.weeklyAverage >= 20 ? (
                      <Badge className="bg-green-100 text-green-700">High Performer</Badge>
                    ) : metric.approvalRate < 75 || metric.weeklyAverage < 10 ? (
                      <Badge className="bg-red-100 text-red-700">Needs Attention</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700">On Track</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}