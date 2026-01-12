import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, TrendingDown, Clock, Award, AlertCircle, 
  DollarSign, Target, Activity, Zap, CheckCircle, Download
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function MonthlyAttendanceReport({ 
  records, 
  allUsers,
  selectedMonth,
  departments = [],
  approvedLeaves = [],
  leaveBalances = [],
  leaveTypes = [],
  workDays = []
}) {
  const metrics = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const workingDays = allDays.filter(day => day.getDay() !== 1).length; // Exclude Mondays
    
    // Count holidays and comp offs
    const monthStr = format(selectedMonth, 'yyyy-MM');
    const monthWorkDays = workDays.filter(wd => wd.date?.startsWith(monthStr));
    const holidays = monthWorkDays.filter(wd => wd.is_holiday).length;
    const compOffs = records.filter(r => r.status === 'comp_off').length;
    
    // Group records by user
    const userStats = {};
    allUsers.forEach(user => {
      const userRecords = records.filter(r => r.user_email === user.email);
      const present = userRecords.filter(r => 
        ['present', 'checked_out', 'work_from_home'].includes(r.status)
      ).length;
      const absent = userRecords.filter(r => r.status === 'absent').length;
      const halfDay = userRecords.filter(r => r.status === 'half_day').length;
      const userLeaves = approvedLeaves.filter(l => 
        (l.employee_email === user.email || l.user_email === user.email)
      );
      
      // Categorize leaves as paid/unpaid
      const paidLeave = userLeaves.filter(l => {
        const leaveType = leaveTypes.find(lt => lt.name === l.leave_type);
        return leaveType?.is_paid !== false;
      }).length;
      const unpaidLeave = userLeaves.filter(l => {
        const leaveType = leaveTypes.find(lt => lt.name === l.leave_type);
        return leaveType?.is_paid === false;
      }).length;
      
      const totalHours = userRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
      const avgHours = userRecords.length > 0 ? totalHours / userRecords.length : 0;
      const lateMarks = userRecords.filter(r => r.is_late).length;
      const overtime = userRecords.reduce((sum, r) => 
        sum + Math.max(0, (r.total_hours || 0) - 9), 0
      );
      
      const attendanceRate = workingDays > 0 
        ? ((present / workingDays) * 100).toFixed(1)
        : 0;
      
      const regularityScore = Math.max(0, 100 - (absent * 5) - (lateMarks * 2) - (halfDay * 3));
      
      // Salary deduction days (unpaid leaves + absent beyond first + half days as 0.5)
      const salaryDeductionDays = unpaidLeave + Math.max(0, absent - 1) + (halfDay * 0.5);
      
      // Leave balance
      const userBalance = leaveBalances.find(lb => lb.user_email === user.email);
      
      userStats[user.email] = {
        name: user.full_name || user.email,
        present,
        absent,
        halfDay,
        paidLeave,
        unpaidLeave,
        totalHours,
        avgHours,
        lateMarks,
        overtime,
        attendanceRate: parseFloat(attendanceRate),
        regularityScore,
        salaryDeductionDays,
        leaveBalance: userBalance
      };
    });

    // Aggregate metrics
    const totalUsers = allUsers.length;
    const totalPresent = Object.values(userStats).reduce((sum, u) => sum + u.present, 0);
    const totalAbsent = Object.values(userStats).reduce((sum, u) => sum + u.absent, 0);
    const totalHalfDays = Object.values(userStats).reduce((sum, u) => sum + u.halfDay, 0);
    const totalPaidLeave = Object.values(userStats).reduce((sum, u) => sum + u.paidLeave, 0);
    const totalUnpaidLeave = Object.values(userStats).reduce((sum, u) => sum + u.unpaidLeave, 0);
    const totalLeave = totalPaidLeave + totalUnpaidLeave;
    const totalHours = Object.values(userStats).reduce((sum, u) => sum + u.totalHours, 0);
    const totalLateMarks = Object.values(userStats).reduce((sum, u) => sum + u.lateMarks, 0);
    const totalOvertime = Object.values(userStats).reduce((sum, u) => sum + u.overtime, 0);
    const totalSalaryDeductionDays = Object.values(userStats).reduce((sum, u) => sum + (u.salaryDeductionDays || 0), 0);
    
    const avgAttendanceRate = totalUsers > 0
      ? (Object.values(userStats).reduce((sum, u) => sum + u.attendanceRate, 0) / totalUsers).toFixed(1)
      : 0;
    
    const absenteeismRate = (workingDays * totalUsers) > 0
      ? ((totalAbsent / (workingDays * totalUsers)) * 100).toFixed(1)
      : 0;
    
    const avgWorkingHours = records.length > 0
      ? (totalHours / records.length).toFixed(1)
      : 0;

    // Department-wise absenteeism
    const deptAbsenteeism = {};
    departments.forEach(dept => {
      const deptUsers = allUsers.filter(u => u.department_id === dept.id);
      const deptAbsent = deptUsers.reduce((sum, u) => 
        sum + (userStats[u.email]?.absent || 0), 0
      );
      const deptWorkingDays = workingDays * deptUsers.length;
      deptAbsenteeism[dept.name] = {
        rate: deptWorkingDays > 0 
          ? ((deptAbsent / deptWorkingDays) * 100).toFixed(1)
          : 0,
        count: deptAbsent
      };
    });

    // Leave balance summary (simplified)
    const leaveUtilization = totalLeave > 0
      ? ((totalLeave / (totalUsers * 2)) * 100).toFixed(1) // Assuming 2 leaves per month avg
      : 0;

    return {
      workingDays,
      userStats,
      totalPresent,
      totalAbsent,
      totalHalfDays,
      totalPaidLeave,
      totalUnpaidLeave,
      totalLeave,
      totalHours,
      totalLateMarks,
      totalOvertime,
      avgAttendanceRate,
      absenteeismRate,
      avgWorkingHours,
      deptAbsenteeism,
      leaveUtilization,
      holidays,
      compOffs,
      totalSalaryDeductionDays
    };
  }, [records, allUsers, selectedMonth, departments, approvedLeaves, leaveBalances, leaveTypes, workDays]);

  const handleExportPDF = async () => {
    try {
      toast.info('Generating PDF...');
      const response = await base44.functions.invoke('exportMonthlyAttendanceReport', {
        month: format(selectedMonth, 'yyyy-MM')
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

  const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#3B82F6'];

  const pieData = [
    { name: 'Present', value: metrics.totalPresent, color: COLORS[0] },
    { name: 'Absent', value: metrics.totalAbsent, color: COLORS[1] },
    { name: 'Leave', value: metrics.totalLeave, color: COLORS[3] }
  ];

  const topPerformers = Object.entries(metrics.userStats)
    .sort((a, b) => b[1].regularityScore - a[1].regularityScore)
    .slice(0, 5);

  const bottomPerformers = Object.entries(metrics.userStats)
    .sort((a, b) => a[1].attendanceRate - b[1].attendanceRate)
    .filter(([_, stats]) => stats.attendanceRate < 90)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Monthly Attendance Report</h2>
          <p className="text-slate-600 mt-1">
            {format(selectedMonth, 'MMMM yyyy')} - HR & Payroll Focus
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge className="bg-indigo-600 text-white px-4 py-2 text-lg font-bold">
            {metrics.workingDays} Working Days
          </Badge>
          <Button onClick={handleExportPDF} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Attendance Rate</p>
                <p className="text-3xl font-black text-green-700">{metrics.avgAttendanceRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 bg-gradient-to-br from-red-50 to-rose-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Absenteeism</p>
                <p className="text-3xl font-black text-red-700">{metrics.absenteeismRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Avg Hours</p>
                <p className="text-3xl font-black text-blue-700">{metrics.avgWorkingHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 bg-gradient-to-br from-amber-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Total Overtime</p>
                <p className="text-3xl font-black text-amber-700">{metrics.totalOvertime.toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* HR & Payroll Detailed Metrics */}
      <Card className="border-2 bg-gradient-to-br from-indigo-50 to-purple-50">
        <CardHeader className="bg-gradient-to-r from-indigo-100 to-purple-100 border-b-2">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-600" />
            HR & Payroll Metrics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Total Working Days</p>
              <p className="text-2xl font-black text-indigo-900">{metrics.workingDays}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-green-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Days Present</p>
              <p className="text-2xl font-black text-green-900">{metrics.totalPresent}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-emerald-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Leave (Paid)</p>
              <p className="text-2xl font-black text-emerald-900">{metrics.totalPaidLeave}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-rose-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Leave (Unpaid)</p>
              <p className="text-2xl font-black text-rose-900">{metrics.totalUnpaidLeave}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-amber-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Half Days</p>
              <p className="text-2xl font-black text-amber-900">{metrics.totalHalfDays}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-orange-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Total Late Marks</p>
              <p className="text-2xl font-black text-orange-900">{metrics.totalLateMarks}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-purple-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Compensatory Offs</p>
              <p className="text-2xl font-black text-purple-900">{metrics.compOffs}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-blue-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Holiday Count</p>
              <p className="text-2xl font-black text-blue-900">{metrics.holidays}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-red-200 shadow-sm">
              <p className="text-xs font-bold text-slate-600 uppercase mb-1">Salary Deduction Days</p>
              <p className="text-2xl font-black text-red-900">{metrics.totalSalaryDeductionDays.toFixed(1)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b-2">
            <CardTitle>Attendance Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Comparison */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50 border-b-2">
            <CardTitle>Department Absenteeism</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Object.entries(metrics.deptAbsenteeism)
                .sort((a, b) => parseFloat(b[1].rate) - parseFloat(a[1].rate))
                .map(([dept, data]) => (
                <div key={dept} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{dept}</span>
                    <Badge className={`${
                      parseFloat(data.rate) < 5 ? 'bg-green-500' :
                      parseFloat(data.rate) < 10 ? 'bg-yellow-500' :
                      'bg-red-500'
                    } text-white font-bold`}>
                      {data.rate}%
                    </Badge>
                  </div>
                  <Progress value={parseFloat(data.rate)} className="h-2" max={20} />
                  <p className="text-xs text-slate-600">{data.count} absences</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-green-600" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {topPerformers.map(([email, stats], index) => (
                <div key={email} className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{stats.name}</p>
                      <p className="text-xs text-slate-600">
                        {stats.present} days | {stats.lateMarks} late | {stats.overtime.toFixed(1)}h OT
                      </p>
                      <p className="text-xs text-slate-500">
                        Deduction: {stats.salaryDeductionDays?.toFixed(1) || 0} days
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-600 text-white font-bold mb-1">
                      {stats.attendanceRate}%
                    </Badge>
                    <p className="text-xs text-green-700 font-semibold">
                      Score: {stats.regularityScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Need Attention */}
        {bottomPerformers.length > 0 && (
          <Card className="border-2">
            <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50 border-b-2">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Need Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {bottomPerformers.map(([email, stats]) => (
                  <div key={email} className="flex items-center justify-between p-3 bg-red-50/50 rounded-lg border border-red-100">
                    <div>
                      <p className="font-semibold text-slate-900">{stats.name}</p>
                      <p className="text-xs text-slate-600">
                        {stats.absent} absent | {stats.lateMarks} late | {stats.halfDay} half
                      </p>
                      <p className="text-xs text-rose-600 font-semibold">
                        Deduction: {stats.salaryDeductionDays?.toFixed(1) || 0} days
                      </p>
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

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Total Late Marks</p>
                <p className="text-2xl font-black text-slate-900">{metrics.totalLateMarks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-purple-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Leave Utilization</p>
                <p className="text-2xl font-black text-slate-900">{metrics.leaveUtilization}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Total Hours</p>
                <p className="text-2xl font-black text-slate-900">{metrics.totalHours.toFixed(0)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}