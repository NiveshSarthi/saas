import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Users,
  Clock,
  Calendar,
  CheckCircle,
  FileText,
  MapPin,
  Coffee,
  BarChart3,
  Eye,
  UserPlus,
  LayoutDashboard,
  Receipt,
  DollarSign,
  UserCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Import HR Sub-pages
import Recruitment from './Recruitment';
import Attendance from './Attendance';
import LeaveManagement from './LeaveManagement';
import Salary from './Salary';
import PettyCashReimbursement from './PettyCashReimbursement';
import HRTargetsManagement from '@/components/hr/HRTargetsManagement';

export default function HRDashboard() {
  const [user, setUser] = useState(null);
  const [timeRange, setTimeRange] = useState('month'); // week, month

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
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
    }
  };

  const dateRange = getDateRange();

  // Get all users for attendance tracking
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-hr'],
    queryFn: () => base44.entities.User.list(),
    enabled: user?.role_id === 'hr' || user?.role === 'admin',
  });

  // Get attendance records for the selected period
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-hr', dateRange.start, dateRange.end],
    queryFn: () => base44.entities.Attendance.filter({
      created_at: { $gte: dateRange.start.toISOString(), $lte: dateRange.end.toISOString() }
    }),
    enabled: user?.role_id === 'hr' || user?.role === 'admin',
  });

  // Get pending timesheets
  const { data: pendingTimesheets = [] } = useQuery({
    queryKey: ['pending-timesheets'],
    queryFn: () => base44.entities.Timesheet.filter({ status: 'submitted' }),
    enabled: user?.role_id === 'hr' || user?.role === 'admin',
  });

  // Get freelancers for timesheet tracking
  const { data: freelancers = [] } = useQuery({
    queryKey: ['freelancers-for-hr'],
    queryFn: () => base44.entities.User.filter({ role: 'freelancer' }),
    enabled: user?.role_id === 'hr' || user?.role === 'admin',
  });

  // Calculate attendance statistics
  const calculateAttendanceStats = () => {
    const userStats = {};

    users.forEach(user => {
      const userAttendance = attendanceRecords.filter(att => att.user_email === user.email);

      // Group by date
      const attendanceByDate = {};
      userAttendance.forEach(att => {
        attendanceByDate[att.date] = att;
      });

      const totalDays = timeRange === 'week' ? 7 : new Date(dateRange.end).getDate();
      const presentDays = Object.values(attendanceByDate).filter(att =>
        att.status === 'present' && att.check_out
      ).length;
      const absentDays = totalDays - presentDays;
      const averageWorkingHours = userAttendance.length > 0 ?
        userAttendance.reduce((sum, att) => sum + (att.actual_working_hours || 0), 0) / userAttendance.length : 0;

      userStats[user.email] = {
        user,
        totalDays,
        presentDays,
        absentDays,
        attendanceRate: totalDays > 0 ? (presentDays / totalDays) * 100 : 0,
        averageWorkingHours,
        totalBreakTime: userAttendance.reduce((sum, att) => sum + (att.total_break_duration || 0), 0),
        records: userAttendance
      };
    });

    return userStats;
  };

  const attendanceStats = calculateAttendanceStats();

  // Calculate overall statistics
  const overallStats = {
    totalUsers: users.length,
    totalPresentToday: attendanceRecords.filter(att =>
      att.date === format(new Date(), 'yyyy-MM-dd') &&
      att.status === 'present' &&
      att.check_in &&
      !att.check_out
    ).length,
    totalOnBreak: attendanceRecords.filter(att =>
      att.date === format(new Date(), 'yyyy-MM-dd') &&
      att.current_status === 'on_break'
    ).length,
    averageAttendanceRate: Object.values(attendanceStats).reduce((sum, stat) => sum + stat.attendanceRate, 0) / users.length || 0,
    totalPendingTimesheets: pendingTimesheets.length,
    freelancersWithTimesheets: freelancers.filter(freelancer =>
      pendingTimesheets.some(ts => ts.freelancer_email === freelancer.email)
    ).length
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Please log in to access HR dashboard.</p>
      </div>
    );
  }

  if (user.role_id !== 'hr' && user.role !== 'admin') {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only HR managers and administrators can access this dashboard.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">HR Hub</h1>
            <p className="text-slate-600 mt-1">Centralized Human Resource Management</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm pb-4 pt-2">
          <TabsList className="grid grid-cols-7 h-auto p-1 bg-slate-100 rounded-xl">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-xs font-semibold">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="targets" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <BarChart3 className="w-5 h-5" />
              <span className="text-xs font-semibold">Targets</span>
            </TabsTrigger>
            <TabsTrigger value="recruitment" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <UserPlus className="w-5 h-5" />
              <span className="text-xs font-semibold">Recruitment</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <Clock className="w-5 h-5" />
              <span className="text-xs font-semibold">Attendance</span>
            </TabsTrigger>
            <TabsTrigger value="leave" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <Calendar className="w-5 h-5" />
              <span className="text-xs font-semibold">Leave</span>
            </TabsTrigger>
            <TabsTrigger value="payroll" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <DollarSign className="w-5 h-5" />
              <span className="text-xs font-semibold">Payroll</span>
            </TabsTrigger>
            <TabsTrigger value="petty_cash" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm py-3 rounded-lg flex flex-col items-center gap-1.5 transition-all">
              <Receipt className="w-5 h-5" />
              <span className="text-xs font-semibold">Petty Cash</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab (Original Dashboard Content) */}
        <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Operational Overview</h2>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallStats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">Active team members</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{overallStats.totalPresentToday}</div>
                <p className="text-xs text-muted-foreground">Checked in today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">On Break</CardTitle>
                <Coffee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{overallStats.totalOnBreak}</div>
                <p className="text-xs text-muted-foreground">Currently on break</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Timesheets</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{overallStats.totalPendingTimesheets}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>
          </div>

          {/* Sub-Tabs for Overview */}
          <Tabs defaultValue="attendance_summary" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="attendance_summary">Attendance Activity</TabsTrigger>
              <TabsTrigger value="timesheets_summary">Pending Timesheets</TabsTrigger>
              <TabsTrigger value="reports_summary">HR Intelligence</TabsTrigger>
            </TabsList>

            <TabsContent value="attendance_summary" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Team Activity - {timeRange === 'week' ? 'This Week' : 'This Month'}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
                  </p>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Attendance Rate</TableHead>
                        <TableHead>Present Days</TableHead>
                        <TableHead>Avg Working Hours</TableHead>
                        <TableHead>Total Break Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.values(attendanceStats).map((stat) => {
                        const todayAttendance = stat.records.find(att =>
                          att.date === format(new Date(), 'yyyy-MM-dd')
                        );

                        return (
                          <TableRow key={stat.user.email}>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold">{stat.user.full_name || stat.user.email}</div>
                                <div className="text-sm text-slate-500">{stat.user.email}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={stat.attendanceRate} className="w-16 h-2" />
                                <span className={cn("text-sm font-medium",
                                  stat.attendanceRate >= 90 ? "text-green-600" :
                                    stat.attendanceRate >= 75 ? "text-yellow-600" : "text-red-600"
                                )}>
                                  {stat.attendanceRate.toFixed(1)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{stat.presentDays}/{stat.totalDays}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{stat.averageWorkingHours.toFixed(1)}h</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{(stat.totalBreakTime / 60).toFixed(1)}h</span>
                            </TableCell>
                            <TableCell>
                              {todayAttendance ? (
                                <Badge className={cn(
                                  todayAttendance.current_status === 'checked_in' ? "bg-green-100 text-green-700" :
                                    todayAttendance.current_status === 'on_break' ? "bg-orange-100 text-orange-700" :
                                      todayAttendance.current_status === 'checked_out' ? "bg-blue-100 text-blue-700" :
                                        "bg-gray-100 text-gray-700"
                                )}>
                                  {todayAttendance.current_status === 'checked_in' ? 'Present' :
                                    todayAttendance.current_status === 'on_break' ? 'On Break' :
                                      todayAttendance.current_status === 'checked_out' ? 'Checked Out' : 'Not Checked In'}
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700">Absent Today</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timesheets_summary" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Pending Timesheets</CardTitle>
                  <p className="text-sm text-muted-foreground">Freelancer timesheets requiring approval</p>
                </CardHeader>
                <CardContent>
                  {pendingTimesheets.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Freelancer</TableHead>
                          <TableHead>Week</TableHead>
                          <TableHead>Total Hours</TableHead>
                          <TableHead>Submitted</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingTimesheets.map((timesheet) => (
                          <TableRow key={timesheet.id}>
                            <TableCell className="font-medium">
                              {timesheet.freelancer_name}
                              <div className="text-sm text-slate-500">{timesheet.freelancer_email}</div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(timesheet.period_start), 'MMM d')} - {format(new Date(timesheet.period_end), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="font-medium">{timesheet.total_hours}h</TableCell>
                            <TableCell>
                              {timesheet.submitted_at ? format(new Date(timesheet.submitted_at), 'MMM d, HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">
                                <Eye className="w-4 h-4 mr-1" />
                                Review
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-slate-900 mb-2">All caught up!</h3>
                      <p className="text-slate-500">No pending timesheets to review</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports_summary" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Attendance Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Average Attendance Rate</span>
                      <span className={cn("font-bold",
                        overallStats.averageAttendanceRate >= 90 ? "text-green-600" :
                          overallStats.averageAttendanceRate >= 75 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {overallStats.averageAttendanceRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={overallStats.averageAttendanceRate} className="h-2" />

                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {Object.values(attendanceStats).filter(s => s.attendanceRate >= 90).length}
                        </div>
                        <div className="text-xs text-muted-foreground">High Performers</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {Object.values(attendanceStats).filter(s => s.attendanceRate < 75).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Need Attention</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Working Hours Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>8+ hours/day</span>
                        <span className="font-medium">
                          {Object.values(attendanceStats).filter(s => s.averageWorkingHours >= 8).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>6-8 hours/day</span>
                        <span className="font-medium">
                          {Object.values(attendanceStats).filter(s => s.averageWorkingHours >= 6 && s.averageWorkingHours < 8).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>&lt; 6 hours/day</span>
                        <span className="font-medium">
                          {Object.values(attendanceStats).filter(s => s.averageWorkingHours < 6).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Break Time Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {(Object.values(attendanceStats).reduce((sum, s) => sum + s.totalBreakTime, 0) / 60 / users.length).toFixed(1)}h
                      </div>
                      <div className="text-sm text-muted-foreground">Average daily break time</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Under 1 hour</span>
                        <span className="font-medium">
                          {Object.values(attendanceStats).filter(s => (s.totalBreakTime / 60) < 1).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>1-2 hours</span>
                        <span className="font-medium">
                          {Object.values(attendanceStats).filter(s => (s.totalBreakTime / 60) >= 1 && (s.totalBreakTime / 60) <= 2).length}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Over 2 hours</span>
                        <span className="font-medium">
                          {Object.values(attendanceStats).filter(s => (s.totalBreakTime / 60) > 2).length}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Targets Tab */}
        <TabsContent value="targets" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <HRTargetsManagement user={user} />
        </TabsContent>

        {/* Recruitment Tab */}
        <TabsContent value="recruitment" className="space-y-6">
          <Recruitment />
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <Attendance />
        </TabsContent>

        {/* Leave Tab */}
        <TabsContent value="leave" className="space-y-6">
          <LeaveManagement />
        </TabsContent>

        {/* Payroll Tab */}
        <TabsContent value="payroll" className="space-y-6">
          <Salary />
        </TabsContent>

        {/* Petty Cash Tab */}
        <TabsContent value="petty_cash" className="space-y-6">
          <PettyCashReimbursement />
        </TabsContent>
      </Tabs>
    </div>
  );
}