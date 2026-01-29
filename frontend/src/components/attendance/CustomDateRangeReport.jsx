import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import DailyAttendanceReport from './DailyAttendanceReport';
import MonthlyAttendanceReport from './MonthlyAttendanceReport';
import {
  TrendingUp, AlertTriangle, Award, DollarSign,
  Target, Activity, Users, Clock, Zap, Download,
  TrendingDown, Calendar, Info
} from 'lucide-react';
import { format, eachDayOfInterval, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function CustomDateRangeReport({
  records = [],
  allUsers = [],
  startDate = new Date(),
  endDate = new Date(),
  departments = [],
  approvedLeaves = [],
  leaveBalances = [],
  leaveTypes = [],
  workDays = []
}) {
  // Ensure valid dates at the component level
  const safeStart = startDate instanceof Date && !isNaN(startDate) ? startDate : new Date();
  const safeEnd = endDate instanceof Date && !isNaN(endDate) ? endDate : new Date();

  // Safety check: if end is before start, swap or equal them
  const finalStart = safeStart > safeEnd ? safeEnd : safeStart;
  const finalEnd = safeEnd;

  const metrics = useMemo(() => {
    const days = eachDayOfInterval({ start: finalStart, end: finalEnd });
    const totalDays = days.length;

    // Attendance trend over time
    const dailyTrend = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayRecords = records.filter(r => r.date === dayStr);
      const present = dayRecords.filter(r =>
        ['present', 'checked_out', 'work_from_home'].includes(r.status)
      ).length;
      const absent = dayRecords.filter(r => r.status === 'absent').length;
      const rate = allUsers.length > 0
        ? ((present / allUsers.length) * 100).toFixed(1)
        : 0;

      return {
        date: format(day, 'MMM dd'),
        attendance: parseFloat(rate),
        present,
        absent
      };
    });

    // User performance stats
    const userPerformance = {};
    allUsers.forEach(user => {
      const userRecords = records.filter(r => r.user_email === user.email);
      const present = userRecords.filter(r =>
        ['present', 'checked_out', 'work_from_home'].includes(r.status)
      ).length;
      const absent = userRecords.filter(r => r.status === 'absent').length;
      const late = userRecords.filter(r => r.is_late).length;
      const overtime = userRecords.reduce((sum, r) =>
        sum + Math.max(0, (r.total_hours || 0) - 9), 0
      );
      const totalHours = userRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
      const avgHours = userRecords.length > 0 ? totalHours / userRecords.length : 0;

      const attendanceRate = totalDays > 0
        ? ((present / totalDays) * 100).toFixed(1)
        : 0;

      userPerformance[user.email] = {
        name: user.full_name || user.email,
        department: departments.find(d => d.id === user.department_id)?.name || 'N/A',
        present,
        absent,
        late,
        overtime,
        totalHours,
        avgHours,
        attendanceRate: parseFloat(attendanceRate)
      };
    });

    // Frequent late comers
    const lateComersList = Object.entries(userPerformance)
      .sort((a, b) => b[1].late - a[1].late)
      .filter(([_, stats]) => stats.late > 0)
      .slice(0, 10);

    // High overtime employees
    const overtimeList = Object.entries(userPerformance)
      .sort((a, b) => b[1].overtime - a[1].overtime)
      .filter(([_, stats]) => stats.overtime > 0)
      .slice(0, 10);

    // Leave patterns
    const leaveTypes = {
      sick: records.filter(r => r.status === 'sick_leave').length,
      casual: records.filter(r => r.status === 'casual_leave').length,
      paid: records.filter(r => r.status === 'leave').length
    };

    // Shift utilization (assuming standard 9-hour shifts)
    const shiftUtilization = records.length > 0
      ? ((records.reduce((sum, r) => sum + (r.total_hours || 0), 0) / (records.length * 9)) * 100).toFixed(1)
      : 0;

    // Cost of absenteeism (estimated at ₹500 per day)
    const absenteeismCost = records.filter(r => r.status === 'absent').length * 500;

    // Compliance exceptions
    const complianceIssues = {
      missingPunches: records.filter(r => !r.check_out && r.status === 'checked_in').length,
      lateExcessive: lateComersList.filter(([_, stats]) => stats.late > 5).length,
      lowAttendance: Object.values(userPerformance).filter(u => u.attendanceRate < 75).length
    };

    // Department productivity index
    const deptProductivity = {};
    departments.forEach(dept => {
      const deptUsers = allUsers.filter(u => u.department_id === dept.id);
      const deptRecords = records.filter(r =>
        deptUsers.some(u => u.email === r.user_email)
      );
      const avgHours = deptRecords.length > 0
        ? deptRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0) / deptRecords.length
        : 0;
      const attendanceRate = (totalDays * deptUsers.length) > 0
        ? ((deptRecords.filter(r => ['present', 'checked_out'].includes(r.status)).length /
          (totalDays * deptUsers.length)) * 100).toFixed(1)
        : 0;

      const productivityScore = (parseFloat(attendanceRate) * 0.6) + (avgHours / 9 * 100 * 0.4);

      deptProductivity[dept.name] = {
        avgHours: avgHours.toFixed(1),
        attendanceRate,
        productivityScore: productivityScore.toFixed(1)
      };
    });

    // Absenteeism pattern (by day of week)
    const absenteeismPattern = {
      Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0
    };
    records.filter(r => r.status === 'absent').forEach(r => {
      const day = format(new Date(r.date), 'EEEE');
      absenteeismPattern[day] = (absenteeismPattern[day] || 0) + 1;
    });

    // Top performers
    const topPerformers = Object.entries(userPerformance)
      .sort((a, b) => b[1].attendanceRate - a[1].attendanceRate)
      .slice(0, 10);

    // Bottom performers
    const bottomPerformers = Object.entries(userPerformance)
      .sort((a, b) => a[1].attendanceRate - b[1].attendanceRate)
      .filter(([_, stats]) => stats.attendanceRate < 90)
      .slice(0, 10);

    // Attendance heatmap data (by user and week)
    const heatmapData = allUsers.map(user => {
      const weeklyData = [];
      let currentWeekStart = finalStart;
      while (currentWeekStart <= finalEnd) {
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekRecords = records.filter(r => {
          const rDate = new Date(r.date);
          return r.user_email === user.email &&
            rDate >= currentWeekStart &&
            rDate <= weekEnd;
        });
        const weeklyRate = weekRecords.length > 0
          ? (weekRecords.filter(r => ['present', 'checked_out', 'work_from_home'].includes(r.status)).length / 7) * 100
          : 0;
        weeklyData.push(weeklyRate);
        currentWeekStart = new Date(weekEnd);
        currentWeekStart.setDate(currentWeekStart.getDate() + 1);
      }
      return {
        name: user.full_name || user.email,
        weeks: weeklyData
      };
    });

    // Leave breakdown by type
    const leaveBreakdown = [
      { name: 'Sick Leave', value: leaveTypes.sick, color: '#F59E0B' },
      { name: 'Casual Leave', value: leaveTypes.casual, color: '#6366F1' },
      { name: 'Paid Leave', value: leaveTypes.paid, color: '#8B5CF6' }
    ];

    // Absenteeism chart data
    const absenteeismChartData = Object.entries(absenteeismPattern).map(([day, count]) => ({
      day: day.substring(0, 3),
      count
    }));

    return {
      totalDays,
      dailyTrend,
      userPerformance,
      lateComersList,
      overtimeList,
      leaveTypes,
      shiftUtilization,
      absenteeismCost,
      complianceIssues,
      deptProductivity,
      absenteeismPattern,
      topPerformers,
      bottomPerformers,
      heatmapData,
      leaveBreakdown,
      absenteeismChartData
    };
  }, [records, allUsers, finalStart, finalEnd, departments]);

  const handleExportPDF = async () => {
    try {
      toast.info('Generating PDF...');
      const response = await base44.functions.invoke('exportCustomRangeReport', {
        startDate: format(safeStart, 'yyyy-MM-dd'),
        endDate: format(safeEnd, 'yyyy-MM-dd')
      });

      const { pdf_base64, filename } = response.data;
      const byteCharacters = atob(pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF: ' + error.message);
    }
  };

  // Check if date range is for today
  const isToday = format(safeStart, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') &&
    format(safeEnd, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  // Check if date range is a full month
  const isFullMonth = format(safeStart, 'yyyy-MM-dd') === format(startOfMonth(safeStart), 'yyyy-MM-dd') &&
    format(safeEnd, 'yyyy-MM-dd') === format(endOfMonth(safeStart), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Comprehensive Attendance Reports</h2>
          <p className="text-slate-600 mt-1">
            {format(safeStart, 'MMM dd, yyyy')} - {format(safeEnd, 'MMM dd, yyyy')} ({metrics.totalDays} days)
          </p>
        </div>
        <Button onClick={handleExportPDF} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Download className="w-4 h-4" />
          Export PDF
        </Button>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="custom" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-indigo-100 to-purple-100 p-1 rounded-2xl">
          <TabsTrigger value="daily" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg">
            Daily Report
          </TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg">
            Monthly Report
          </TabsTrigger>
          <TabsTrigger value="custom" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg">
            Custom Range Analysis
          </TabsTrigger>
        </TabsList>

        {/* Daily Report Tab */}
        <TabsContent value="daily" className="space-y-6 mt-6">
          <DailyAttendanceReport
            records={isToday ? records : records.filter(r => r.date === format(new Date(), 'yyyy-MM-dd'))}
            allUsers={allUsers}
            selectedDate={new Date()}
            departments={departments}
          />
        </TabsContent>

        {/* Monthly Report Tab */}
        <TabsContent value="monthly" className="space-y-6 mt-6">
          <MonthlyAttendanceReport
            records={isFullMonth ? records : records.filter(r => {
              const rDate = new Date(r.date);
              return rDate.getMonth() === safeStart.getMonth() &&
                rDate.getFullYear() === safeStart.getFullYear();
            })}
            allUsers={allUsers}
            selectedMonth={safeStart}
            departments={departments}
            approvedLeaves={approvedLeaves}
            leaveBalances={leaveBalances}
            leaveTypes={leaveTypes}
            workDays={workDays}
          />
        </TabsContent>

        {/* Custom Range Analysis Tab */}
        <TabsContent value="custom" className="space-y-6 mt-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-2 bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase">Shift Utilization</p>
                    <p className="text-3xl font-black text-blue-700">{metrics.shiftUtilization}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-gradient-to-br from-red-50 to-rose-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-8 h-8 text-red-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase">Cost of Absenteeism</p>
                    <p className="text-3xl font-black text-red-700">₹{(metrics.absenteeismCost / 1000).toFixed(1)}K</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-gradient-to-br from-orange-50 to-amber-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-orange-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase">Compliance Issues</p>
                    <p className="text-3xl font-black text-orange-700">
                      {Object.values(metrics.complianceIssues).reduce((a, b) => a + b, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 bg-gradient-to-br from-purple-50 to-violet-50">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Zap className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase">Total Leaves</p>
                    <p className="text-3xl font-black text-purple-700">
                      {Object.values(metrics.leaveTypes).reduce((a, b) => a + b, 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Trend Chart */}
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b-2">
              <CardTitle>Attendance Trend Over Time</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="attendance" stroke="#4F46E5" strokeWidth={3} name="Attendance %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Department Productivity Index */}
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                Department Productivity Index
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Object.entries(metrics.deptProductivity)
                  .sort((a, b) => parseFloat(b[1].productivityScore) - parseFloat(a[1].productivityScore))
                  .map(([dept, data]) => (
                    <div key={dept} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
                      <div className="flex-1">
                        <p className="font-bold text-slate-900">{dept}</p>
                        <p className="text-sm text-slate-600">
                          Avg Hours: {data.avgHours}h | Attendance: {data.attendanceRate}%
                        </p>
                      </div>
                      <Badge className={`${parseFloat(data.productivityScore) >= 85 ? 'bg-green-500' :
                        parseFloat(data.productivityScore) >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        } text-white font-bold text-lg px-4 py-2`}>
                        {data.productivityScore}
                      </Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Frequent Late Comers */}
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b-2">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  Frequent Late Comers (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {metrics.lateComersList.length > 0 ? (
                    metrics.lateComersList.map(([email, stats], index) => (
                      <div key={email} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg border border-orange-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{stats.name}</p>
                            <p className="text-xs text-slate-600">{stats.department}</p>
                          </div>
                        </div>
                        <Badge className="bg-red-600 text-white font-bold">
                          {stats.late} times
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-4">No late arrivals</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* High Overtime Employees */}
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  High Overtime Employees (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {metrics.overtimeList.length > 0 ? (
                    metrics.overtimeList.map(([email, stats], index) => (
                      <div key={email} className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{stats.name}</p>
                            <p className="text-xs text-slate-600">{stats.department}</p>
                          </div>
                        </div>
                        <Badge className="bg-blue-600 text-white font-bold">
                          {stats.overtime.toFixed(1)}h
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-4">No overtime recorded</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Exceptions */}
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b-2">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Compliance Exceptions & Policy Violations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-red-50 rounded-xl border-2 border-red-200">
                  <p className="text-sm font-bold text-red-700 uppercase mb-2">Missing Punches</p>
                  <p className="text-4xl font-black text-red-900">{metrics.complianceIssues.missingPunches}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200">
                  <p className="text-sm font-bold text-orange-700 uppercase mb-2">Excessive Late (&gt;5)</p>
                  <p className="text-4xl font-black text-orange-900">{metrics.complianceIssues.lateExcessive}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                  <p className="text-sm font-bold text-yellow-700 uppercase mb-2">Low Attendance (&lt;75%)</p>
                  <p className="text-4xl font-black text-yellow-900">{metrics.complianceIssues.lowAttendance}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Pattern Analysis with Pie Chart */}
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b-2">
              <CardTitle>Leave Pattern Analysis</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-purple-50 rounded-xl border-2 border-purple-200">
                    <p className="text-sm font-bold text-purple-700 uppercase mb-2">Sick Leave</p>
                    <p className="text-4xl font-black text-purple-900">{metrics.leaveTypes.sick}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <p className="text-sm font-bold text-blue-700 uppercase mb-2">Casual Leave</p>
                    <p className="text-4xl font-black text-blue-900">{metrics.leaveTypes.casual}</p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl border-2 border-indigo-200">
                    <p className="text-sm font-bold text-indigo-700 uppercase mb-2">Paid Leave</p>
                    <p className="text-4xl font-black text-indigo-900">{metrics.leaveTypes.paid}</p>
                  </div>
                </div>
                <div>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={metrics.leaveBreakdown.filter(l => l.value > 0)}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {metrics.leaveBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Absenteeism Pattern by Day of Week */}
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                Absenteeism Pattern by Day of Week
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.absenteeismChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#F59E0B" name="Absent Count" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm text-amber-900">
                  <Info className="w-4 h-4 inline mr-2" />
                  <strong>Insights:</strong> {
                    metrics.absenteeismChartData.length > 0
                      ? `Highest absenteeism on ${metrics.absenteeismChartData.reduce((max, day) => day.count > max.count ? day : max).day}`
                      : 'No absenteeism data'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Top & Bottom Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2">
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600" />
                  Top Performers (Best Attendance)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {metrics.topPerformers.length > 0 ? (
                    metrics.topPerformers.map(([email, stats], index) => (
                      <div key={email} className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{stats.name}</p>
                            <p className="text-xs text-slate-600">{stats.department} | {stats.present} days present</p>
                          </div>
                        </div>
                        <Badge className="bg-green-600 text-white font-bold">
                          {stats.attendanceRate}%
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-4">No data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bottom Performers */}
            {metrics.bottomPerformers.length > 0 && (
              <Card className="border-2">
                <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b-2">
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    Need Attention (Low Attendance)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    {metrics.bottomPerformers.map(([email, stats], index) => (
                      <div key={email} className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg border border-red-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{stats.name}</p>
                            <p className="text-xs text-slate-600">
                              {stats.department} | {stats.absent} absent | {stats.late} late
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-red-600 text-white font-bold">
                          {stats.attendanceRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Attendance Heatmap */}
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b-2">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Attendance Density Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-2 text-xs font-bold text-slate-700">Employee</th>
                      {metrics.heatmapData.length > 0 && metrics.heatmapData[0].weeks.map((_, idx) => (
                        <th key={idx} className="text-center p-2 text-xs font-bold text-slate-700">W{idx + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.heatmapData.slice(0, 15).map((user, userIdx) => (
                      <tr key={userIdx} className={userIdx % 2 === 0 ? 'bg-slate-50' : ''}>
                        <td className="p-2 text-xs font-semibold text-slate-900 truncate max-w-[120px]">
                          {user.name}
                        </td>
                        {user.weeks.map((rate, weekIdx) => (
                          <td key={weekIdx} className="p-1 text-center">
                            <div
                              className="w-8 h-8 rounded-md mx-auto flex items-center justify-center text-xs font-bold"
                              style={{
                                backgroundColor: rate >= 90 ? '#10B981' :
                                  rate >= 75 ? '#F59E0B' :
                                    rate >= 50 ? '#EF4444' : '#94A3B8',
                                color: 'white'
                              }}
                              title={`${rate.toFixed(0)}%`}
                            >
                              {rate > 0 ? rate.toFixed(0) : '-'}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span>90-100%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-500"></div>
                  <span>75-89%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500"></div>
                  <span>50-74%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-400"></div>
                  <span>&lt;50%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}