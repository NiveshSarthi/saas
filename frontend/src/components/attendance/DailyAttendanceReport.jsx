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
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function DailyAttendanceReport({
  records = [],
  allUsers = [],
  selectedDate = new Date(),
  departments = []
}) {
  const metrics = useMemo(() => {
    // Safety check just in case arrays are null/undefined despite defaults
    const safeRecords = records || [];
    const safeUsers = allUsers || [];
    const safeDepts = departments || [];

    const total = safeUsers.length;
    const present = safeRecords.filter(r =>
      ['present', 'checked_out', 'work_from_home'].includes(r.status)
    ).length;
    const absent = safeRecords.filter(r => r.status === 'absent').length;
    const onLeave = safeRecords.filter(r =>
      ['leave', 'sick_leave', 'casual_leave'].includes(r.status)
    ).length;
    const late = safeRecords.filter(r => r.is_late).length;
    const earlyCheckout = safeRecords.filter(r => r.is_early_checkout).length;
    const wfh = safeRecords.filter(r => r.status === 'work_from_home').length;
    const halfDay = safeRecords.filter(r => r.status === 'half_day').length;
    const overtime = safeRecords.filter(r => (r.total_hours || 0) > 9).reduce((sum, r) =>
      sum + Math.max(0, (r.total_hours || 0) - 9), 0
    ).toFixed(1);
    const missingPunches = safeRecords.filter(r =>
      r.status === 'checked_in' || !r.check_out
    ).length;

    const avgHours = safeRecords.length > 0
      ? (safeRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0) / safeRecords.length).toFixed(1)
      : 0;

    const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : 0;
    const punctualityRate = present > 0 ? (((present - late) / present) * 100).toFixed(1) : 0;

    // Department-wise
    const deptStats = {};
    safeDepts.forEach(dept => {
      const deptUsers = safeUsers.filter(u => u.department_id === dept.id);
      const deptRecords = safeRecords.filter(r =>
        deptUsers.some(u => u.email === r.user_email)
      );
      const deptPresent = deptRecords.filter(r =>
        ['present', 'checked_out'].includes(r.status)
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
    const lateArrivals = safeRecords
      .filter(r => r.is_late)
      .map(r => {
        const user = safeUsers.find(u => u.email === r.user_email);
        return {
          name: user?.full_name || r.user_email,
          checkIn: r.check_in ? (
            (r.check_in.includes('T') || r.check_in.includes('Z'))
              ? format(new Date(r.check_in), 'hh:mm a')
              : r.check_in
          ) : '-',
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

  const handleExportPDF = () => {
    try {
      toast.info('Generating PDF...');
      const doc = new jsPDF();

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Attendance Report', 105, 15, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const dateToUse = selectedDate && !isNaN(new Date(selectedDate).getTime())
        ? new Date(selectedDate)
        : new Date();
      doc.text(format(dateToUse, 'EEEE, MMMM dd, yyyy'), 105, 22, { align: 'center' });

      // Summary Metrics
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary Metrics', 14, 32);

      const summaryData = [
        ['Total Employees', metrics.total],
        ['Present', metrics.present],
        ['Absent', metrics.absent],
        ['On Leave', metrics.onLeave],
        ['Late Arrivals', metrics.late],
        ['Early Checkouts', metrics.earlyCheckout],
        ['Work From Home', metrics.wfh],
        ['Half Day', metrics.halfDay],
      ];

      autoTable(doc, {
        startY: 36,
        head: [['Metric', 'Count']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30, halign: 'center' }
        }
      });

      let yPos = doc.lastAutoTable.finalY + 10;

      // Additional Metrics
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Performance Metrics', 14, yPos);
      yPos += 4;

      const perfData = [
        ['Attendance Rate', `${metrics.attendanceRate}%`],
        ['Punctuality Rate', `${metrics.punctualityRate}%`],
        ['Avg Work Hours', `${metrics.avgHours}h`],
        ['Overtime Hours', `${metrics.overtime}h`],
        ['Missing Punches', metrics.missingPunches],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [['Metric', 'Value']],
        body: perfData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
        styles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30, halign: 'center' }
        }
      });

      yPos = doc.lastAutoTable.finalY + 10;

      // Department-wise Breakdown
      if (Object.keys(metrics.deptStats).length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Department-wise Attendance', 14, yPos);
        yPos += 4;

        const deptData = Object.entries(metrics.deptStats).map(([name, stats]) => [
          name,
          stats.present,
          stats.total,
          `${stats.percentage}%`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Department', 'Present', 'Total', 'Percentage']],
          body: deptData,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229], fontSize: 9 },
          styles: { fontSize: 9 }
        });

        yPos = doc.lastAutoTable.finalY + 10;
      }

      // Late Arrivals
      if (metrics.lateArrivals.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 15;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Late Arrivals (Top 10)', 14, yPos);
        yPos += 4;

        const lateData = metrics.lateArrivals.map((late, idx) => [
          idx + 1,
          late.name,
          late.checkIn,
          `+${late.delay} min`
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Employee', 'Check-in', 'Delay']],
          body: lateData,
          theme: 'grid',
          headStyles: { fillColor: [249, 115, 22], fontSize: 9 },
          styles: { fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            3: { halign: 'center' }
          }
        });
      }

      // Save
      const filename = `Daily_Attendance_${format(dateToUse, 'yyyy-MM-dd')}.pdf`;
      doc.save(filename);
      toast.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export error:', error);
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
            {selectedDate && !isNaN(new Date(selectedDate).getTime())
              ? format(new Date(selectedDate), 'EEEE, MMMM dd, yyyy')
              : format(new Date(), 'EEEE, MMMM dd, yyyy')} - Operational Focus
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
                      <Badge className={`${stats.percentage >= 90 ? 'bg-green-500' :
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