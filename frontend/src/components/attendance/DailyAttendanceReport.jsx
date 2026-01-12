import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, UserCheck, UserX, Clock, Coffee, AlertTriangle, 
  Home, Calendar, TrendingUp, Timer, Award, Target, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function DailyAttendanceReport({ 
  records, 
  allUsers, 
  selectedDate,
  departments = []
}) {
  const metrics = useMemo(() => {
    const total = allUsers.length;
    const present = records.filter(r => 
      ['present', 'checked_out', 'work_from_home'].includes(r.status)
    ).length;
    const absent = records.filter(r => r.status === 'absent').length;
    const onLeave = records.filter(r => 
      ['leave', 'sick_leave', 'casual_leave'].includes(r.status)
    ).length;
    const late = records.filter(r => r.is_late).length;
    const earlyCheckout = records.filter(r => r.is_early_checkout).length;
    const wfh = records.filter(r => r.status === 'work_from_home').length;
    const halfDay = records.filter(r => r.status === 'half_day').length;
    const overtime = records.filter(r => (r.total_hours || 0) > 9).reduce((sum, r) => 
      sum + Math.max(0, (r.total_hours || 0) - 9), 0
    ).toFixed(1);
    const missingPunches = records.filter(r => 
      r.status === 'checked_in' || !r.check_out_time
    ).length;
    
    const avgHours = records.length > 0 
      ? (records.reduce((sum, r) => sum + (r.total_hours || 0), 0) / records.length).toFixed(1)
      : 0;
    
    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
    const punctualityRate = present > 0 ? (((present - late) / present) * 100).toFixed(1) : 0;

    // Department-wise
    const deptStats = {};
    departments.forEach(dept => {
      const deptUsers = allUsers.filter(u => u.department_id === dept.id);
      const deptRecords = records.filter(r => 
        deptUsers.some(u => u.email === r.user_email)
      );
      const deptPresent = deptRecords.filter(r => 
        ['present', 'checked_out', 'work_from_home'].includes(r.status)
      ).length;
      
      deptStats[dept.name] = {
        total: deptUsers.length,
        present: deptPresent,
        percentage: deptUsers.length > 0 
          ? ((deptPresent / deptUsers.length) * 100).toFixed(1)
          : 0
      };
    });

    // Late arrivals list
    const lateArrivals = records
      .filter(r => r.is_late)
      .map(r => {
        const user = allUsers.find(u => u.email === r.user_email);
        return {
          name: user?.full_name || r.user_email,
          checkIn: r.check_in_time,
          delay: r.late_minutes || 0
        };
      })
      .sort((a, b) => b.delay - a.delay)
      .slice(0, 10);

    return {
      total, present, absent, onLeave, late, earlyCheckout, wfh, 
      halfDay, overtime, missingPunches, avgHours, attendanceRate, 
      punctualityRate, deptStats, lateArrivals
    };
  }, [records, allUsers, departments]);

  const handleExportPDF = async () => {
    try {
      toast.info('Generating PDF...');
      const response = await base44.functions.invoke('exportDailyAttendanceReport', {
        date: format(selectedDate, 'yyyy-MM-dd')
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

  const statusCards = [
    { 
      label: 'Total Employees', 
      value: metrics.total, 
      icon: Users, 
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    { 
      label: 'Present', 
      value: metrics.present, 
      icon: UserCheck, 
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    { 
      label: 'Absent', 
      value: metrics.absent, 
      icon: UserX, 
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    },
    { 
      label: 'On Leave', 
      value: metrics.onLeave, 
      icon: Calendar, 
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    { 
      label: 'Late Arrivals', 
      value: metrics.late, 
      icon: AlertTriangle, 
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700'
    },
    { 
      label: 'Early Checkouts', 
      value: metrics.earlyCheckout, 
      icon: Clock, 
      color: 'from-yellow-500 to-amber-600',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700'
    },
    { 
      label: 'Work From Home', 
      value: metrics.wfh, 
      icon: Home, 
      color: 'from-cyan-500 to-blue-600',
      bgColor: 'bg-cyan-50',
      textColor: 'text-cyan-700'
    },
    { 
      label: 'Half Day', 
      value: metrics.halfDay, 
      icon: Coffee, 
      color: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Daily Attendance Report</h2>
          <p className="text-slate-600 mt-1">
            {format(selectedDate, 'EEEE, MMMM dd, yyyy')} - Operational Focus
          </p>
        </div>
        <div className="flex gap-4">
          <Button onClick={handleExportPDF} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <div className={`${statusCards[0].bgColor} rounded-xl px-4 py-2 border-2 border-blue-200`}>
            <p className="text-xs font-bold text-slate-600 uppercase">Attendance Rate</p>
            <p className={`text-2xl font-black ${statusCards[0].textColor}`}>{metrics.attendanceRate}%</p>
          </div>
          <div className={`${statusCards[5].bgColor} rounded-xl px-4 py-2 border-2 border-yellow-200`}>
            <p className="text-xs font-bold text-slate-600 uppercase">Punctuality</p>
            <p className={`text-2xl font-black ${statusCards[5].textColor}`}>{metrics.punctualityRate}%</p>
          </div>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statusCards.map((card, index) => (
          <Card key={index} className="relative overflow-hidden border-2 hover:shadow-lg transition-all">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-5`} />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-bold text-slate-600 uppercase mb-2">{card.label}</p>
                  <p className="text-4xl font-black text-slate-900">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.bgColor}`}>
                  <card.icon className={`w-6 h-6 ${card.textColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <Timer className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Avg Work Hours</p>
                <p className="text-3xl font-black text-slate-900">{metrics.avgHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 rounded-xl">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Overtime Hours</p>
                <p className="text-3xl font-black text-slate-900">{metrics.overtime}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-50 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Missing Punches</p>
                <p className="text-3xl font-black text-slate-900">{metrics.missingPunches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department-wise Breakdown */}
      {departments.length > 0 && (
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b-2">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" />
              Department-wise Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {Object.entries(metrics.deptStats).map(([deptName, stats]) => (
                <div key={deptName} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{deptName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600">
                        {stats.present} / {stats.total}
                      </span>
                      <Badge className={`${
                        stats.percentage >= 90 ? 'bg-green-500' :
                        stats.percentage >= 75 ? 'bg-yellow-500' :
                        'bg-red-500'
                      } text-white font-bold`}>
                        {stats.percentage}%
                      </Badge>
                    </div>
                  </div>
                  <Progress 
                    value={parseFloat(stats.percentage)} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Late Arrivals List */}
      {metrics.lateArrivals.length > 0 && (
        <Card className="border-2">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Late Arrivals (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              {metrics.lateArrivals.map((late, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg border border-orange-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{late.name}</p>
                      <p className="text-xs text-slate-600">Check-in: {late.checkIn}</p>
                    </div>
                  </div>
                  <Badge className="bg-red-500 text-white font-bold">
                    +{late.delay} min
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}