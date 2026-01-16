import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from 'jspdf';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DollarSign, Download, RefreshCw, Lock, Unlock, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EnhancedSalaryReport({ isOpen, onClose, selectedMonth = new Date(), allUsers = [] }) {
  const [syncing, setSyncing] = useState(false);

  // Safety check for date
  const safeMonth = selectedMonth instanceof Date && !isNaN(selectedMonth) ? selectedMonth : new Date();
  const monthStr = format(safeMonth, 'yyyy-MM');

  // Auto-sync on mount
  React.useEffect(() => {
    if (isOpen) {
      const autoSync = async () => {
        try {
          await base44.functions.invoke('syncWorkDayLedger', { month: monthStr });
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      };
      autoSync();
    }
  }, [isOpen, monthStr]);

  // Fetch WorkDay records for the month
  const { data: workDays = [], isLoading, refetch } = useQuery({
    queryKey: ['workdays', monthStr],
    queryFn: async () => {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      return await base44.entities.WorkDay.filter({
        date: { $gte: start, $lte: end }
      });
    },
    enabled: isOpen
  });

  // Calculate summary per employee
  const employeeSummary = React.useMemo(() => {
    const summary = {};

    workDays.forEach(wd => {
      if (!summary[wd.user_email]) {
        // Find user from allUsers to get proper name
        const user = allUsers.find(u => u.email === wd.user_email);
        const userName = user?.full_name || wd.user_name || wd.user_email;

        summary[wd.user_email] = {
          user_email: wd.user_email,
          user_name: userName,
          total_days: 0,
          present_days: 0,
          absent_days: 0,
          leave_days: 0,
          half_days: 0,
          total_hours: 0,
          late_count: 0,
          total_earned: 0,
          total_deducted: 0,
          net_payable: 0,
          per_day_rate: wd.salary_unit_value || 0
        };
      }

      const emp = summary[wd.user_email];
      emp.total_days++;
      emp.total_hours += wd.work_hours || 0;
      emp.total_earned += wd.salary_earned || 0;
      emp.total_deducted += wd.salary_deducted || 0;
      emp.net_payable += wd.final_payable || 0;

      if (wd.late_minutes > 0) emp.late_count++;

      if (wd.leave_status === 'approved') {
        emp.leave_days++;
      } else if (wd.attendance_status === 'present' || wd.attendance_status === 'holiday' || wd.attendance_status === 'weekoff') {
        emp.present_days += 1;
      } else if (wd.attendance_status === 'absent') {
        emp.absent_days++;
      } else if (wd.attendance_status === 'half_day') {
        emp.half_days++;
        emp.present_days += 0.5; // Half days count as 0.5 present
      }
    });

    return Object.values(summary);
  }, [workDays, allUsers]);



  const handleGeneratePDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('SALARY REPORT', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text(format(selectedMonth, 'MMMM yyyy'), 105, 30, { align: 'center' });

    // Summary
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', 14, 50);

    const totalPayable = employeeSummary.reduce((sum, e) => sum + e.net_payable, 0);
    const totalDeducted = employeeSummary.reduce((sum, e) => sum + e.total_deducted, 0);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Total Employees: ${employeeSummary.length}`, 14, 58);
    doc.text(`Total Payable: ₹${totalPayable.toFixed(2)}`, 14, 64);
    doc.text(`Total Deductions: ₹${totalDeducted.toFixed(2)}`, 14, 70);

    // Table
    let y = 85;
    doc.setFont(undefined, 'bold');
    doc.text('Employee', 14, y);
    doc.text('Present', 80, y);
    doc.text('Absent', 105, y);
    doc.text('Leave', 130, y);
    doc.text('Earned', 155, y);
    doc.text('Net', 180, y);

    y += 7;
    doc.setFont(undefined, 'normal');

    employeeSummary.forEach(emp => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }

      doc.text(emp.user_name.substring(0, 20), 14, y);
      doc.text(String(emp.present_days), 80, y);
      doc.text(String(emp.absent_days), 105, y);
      doc.text(String(emp.leave_days), 130, y);
      doc.text(`₹${emp.total_earned.toFixed(0)}`, 155, y);
      doc.text(`₹${emp.net_payable.toFixed(0)}`, 180, y);

      y += 7;
    });

    doc.save(`salary-report-${monthStr}.pdf`);
    toast.success('PDF generated');
  };

  const totalSummary = React.useMemo(() => {
    return {
      totalEmployees: employeeSummary.length,
      totalPayable: employeeSummary.reduce((sum, e) => sum + e.net_payable, 0),
      totalDeducted: employeeSummary.reduce((sum, e) => sum + e.total_deducted, 0),
      totalEarned: employeeSummary.reduce((sum, e) => sum + e.total_earned, 0)
    };
  }, [employeeSummary]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl md:max-w-6xl max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Enhanced Salary Report - {format(selectedMonth, 'MMMM yyyy')}
          </DialogTitle>
        </DialogHeader>

        {/* Actions */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <Button onClick={handleGeneratePDF} disabled={employeeSummary.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Generate PDF
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          <Card>
            <CardHeader className="pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm text-slate-600">Total Employees</CardTitle>
            </CardHeader>
            <CardContent className="pt-1 sm:pt-2">
              <div className="text-xl sm:text-2xl font-bold">{totalSummary.totalEmployees}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Total Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">₹{totalSummary.totalEarned.toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Total Deductions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">₹{totalSummary.totalDeducted.toFixed(0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Net Payable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">₹{totalSummary.totalPayable.toFixed(0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">WorkDay Ledger System</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Single source of truth for attendance, leave, and salary</li>
                <li>Approved leaves are auto-counted as paid days</li>
                <li>Absent days auto-deduct salary (per day rate)</li>
                <li>Late penalties applied if configured in Salary Policy</li>
                <li>Data automatically syncs from attendance & leave records</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin -webkit-overflow-scrolling-touch">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold whitespace-nowrap">Employee</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold whitespace-nowrap">Present</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold whitespace-nowrap">Absent</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold whitespace-nowrap">Leave</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold whitespace-nowrap">Half</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold whitespace-nowrap">Hours</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold whitespace-nowrap">Late</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold whitespace-nowrap">Earned</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold whitespace-nowrap">Deducted</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold whitespace-nowrap">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employeeSummary.map((emp, index) => (
                  <tr key={emp.user_email} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{emp.user_name}</div>
                      <div className="text-xs text-slate-500">{emp.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-green-100 text-green-700">
                        {emp.present_days % 1 === 0 ? emp.present_days : emp.present_days.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-red-100 text-red-700">{emp.absent_days}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-purple-100 text-purple-700">{emp.leave_days}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className="bg-yellow-100 text-yellow-700">{emp.half_days}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">{emp.total_hours.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-center">
                      {emp.late_count > 0 && (
                        <Badge className="bg-orange-100 text-orange-700">{emp.late_count}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-green-600">
                      ₹{emp.total_earned.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-red-600">
                      ₹{emp.total_deducted.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-indigo-600">
                      ₹{emp.net_payable.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {employeeSummary.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No salary data available</p>
            <p className="text-sm mt-2">Salary data will sync automatically</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}