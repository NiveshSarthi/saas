import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { DollarSign, Download, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

export default function SalaryCalculationReport({
  selectedMonth = new Date(),
  attendanceRecords = [],
  allUsers = [],
  approvedLeaves = []
}) {
  const [perDaySalary, setPerDaySalary] = useState({});
  const safeMonth = selectedMonth instanceof Date && !isNaN(selectedMonth) ? selectedMonth : new Date();

  const { data: existingSalaries = [] } = useQuery({
    queryKey: ['salary-records', format(safeMonth, 'yyyy-MM')],
    queryFn: () => base44.entities.SalaryRecord.filter({
      month: format(safeMonth, 'yyyy-MM')
    }),
    enabled: true,
  });

  const monthStart = startOfMonth(safeMonth);
  const monthEnd = endOfMonth(safeMonth);
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const totalWorkingDays = allDaysInMonth.length;

  const calculateSalaryForUser = (userEmail) => {
    const userRecords = attendanceRecords.filter(r => r.user_email === userEmail);

    // Count present days (present, checked_out, work_from_home)
    const presentDays = userRecords.filter(r =>
      r.status === 'present' ||
      r.status === 'checked_out' ||
      r.status === 'work_from_home'
    ).length;

    // Count absent days
    const absentDays = userRecords.filter(r => r.status === 'absent').length;

    // Count approved leave days for this user
    let leaveDays = 0;
    approvedLeaves
      .filter(leave => leave.user_email === userEmail)
      .forEach(leave => {
        const leaveStart = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);

        allDaysInMonth.forEach(day => {
          if (day >= leaveStart && day <= leaveEnd) {
            leaveDays++;
          }
        });
      });

    const dailyRate = parseFloat(perDaySalary[userEmail] || 0);

    // Calculate salary: (present days + leave days) * daily rate
    // Deduction: absent days * daily rate (automatic)
    const earnedSalary = (presentDays + leaveDays) * dailyRate;
    const deductions = absentDays * dailyRate;
    const netSalary = earnedSalary - deductions;

    return {
      presentDays,
      absentDays,
      leaveDays,
      totalWorkingDays,
      earnedSalary,
      deductions,
      netSalary,
      attendanceRate: totalWorkingDays > 0 ? ((presentDays + leaveDays) / totalWorkingDays * 100).toFixed(1) : 0
    };
  };

  const handleGenerateReport = async () => {
    const salaryData = allUsers.map(user => {
      const calc = calculateSalaryForUser(user.email);
      const existingSalary = existingSalaries.find(s => s.employee_email === user.email);

      return {
        employee: user,
        calculation: calc,
        existingSalary,
        perDay: parseFloat(perDaySalary[user.email] || 0)
      };
    }).filter(data => data.perDay > 0);

    if (salaryData.length === 0) {
      toast.error('Please enter per day salary for at least one employee');
      return;
    }

    // Generate PDF Report
    const doc = new jsPDF('landscape');

    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 297, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('SALARY CALCULATION REPORT', 148.5, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(format(selectedMonth, 'MMMM yyyy'), 148.5, 30, { align: 'center' });

    // Summary stats
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    let y = 50;

    const totalPayable = salaryData.reduce((sum, d) => sum + d.calculation.netSalary, 0);
    const totalDeductions = salaryData.reduce((sum, d) => sum + d.calculation.deductions, 0);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Employees: ${salaryData.length}`, 14, y);
    doc.text(`Total Working Days: ${totalWorkingDays}`, 80, y);
    doc.text(`Total Payable: ₹${totalPayable.toLocaleString()}`, 150, y);
    doc.text(`Total Deductions: ₹${totalDeductions.toLocaleString()}`, 220, y);
    y += 15;

    // Table header
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y - 5, 270, 8, 'F');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);

    doc.text('Employee', 16, y);
    doc.text('Present', 70, y);
    doc.text('Absent', 90, y);
    doc.text('Leave', 110, y);
    doc.text('Rate/Day', 130, y);
    doc.text('Earned', 160, y);
    doc.text('Deduction', 190, y);
    doc.text('Net Salary', 225, y);
    doc.text('Attn %', 265, y);

    y += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    // Employee rows
    salaryData.forEach((data, index) => {
      if (y > 185) {
        doc.addPage('landscape');
        y = 20;

        // Redraw header
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y - 5, 270, 8, 'F');
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);

        doc.text('Employee', 16, y);
        doc.text('Present', 70, y);
        doc.text('Absent', 90, y);
        doc.text('Leave', 110, y);
        doc.text('Rate/Day', 130, y);
        doc.text('Earned', 160, y);
        doc.text('Deduction', 190, y);
        doc.text('Net Salary', 225, y);
        doc.text('Attn %', 265, y);

        y += 8;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
      }

      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 5, 270, 7, 'F');
      }

      doc.setTextColor(30, 41, 59);
      doc.text(data.employee.full_name.substring(0, 25), 16, y);
      doc.text(String(data.calculation.presentDays), 70, y);
      doc.text(String(data.calculation.absentDays), 90, y);
      doc.text(String(data.calculation.leaveDays), 110, y);
      doc.text(`₹${data.perDay}`, 130, y);
      doc.text(`₹${data.calculation.earnedSalary.toLocaleString()}`, 160, y);
      doc.text(`₹${data.calculation.deductions.toLocaleString()}`, 190, y);

      // Color code net salary
      if (data.calculation.netSalary >= 0) {
        doc.setTextColor(34, 197, 94); // Green
      } else {
        doc.setTextColor(239, 68, 68); // Red
      }
      doc.text(`₹${data.calculation.netSalary.toLocaleString()}`, 225, y);

      // Color code attendance
      const rate = parseFloat(data.calculation.attendanceRate);
      if (rate >= 90) {
        doc.setTextColor(34, 197, 94);
      } else if (rate >= 75) {
        doc.setTextColor(234, 179, 8);
      } else {
        doc.setTextColor(239, 68, 68);
      }
      doc.text(`${data.calculation.attendanceRate}%`, 265, y);

      doc.setTextColor(0, 0, 0);
      y += 7;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, y + 10);
    doc.text('Salary Calculation System', 297 - 14, y + 10, { align: 'right' });

    doc.save(`salary-report-${format(selectedMonth, 'yyyy-MM')}.pdf`);
    toast.success('Salary report generated successfully!');
  };

  const salaryPreview = allUsers.map(user => ({
    user,
    calc: calculateSalaryForUser(user.email),
    perDay: parseFloat(perDaySalary[user.email] || 0),
    existing: existingSalaries.find(s => s.employee_email === user.email)
  })).filter(d => d.perDay > 0);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-none">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            <h2 className="text-2xl font-bold text-slate-800">
              Salary Calculation Report - {format(selectedMonth, 'MMMM yyyy')}
            </h2>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateReport}
              disabled={salaryPreview.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Generate PDF Report
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">How it works:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Enter per day salary for each employee</li>
                    <li>Earned = (Present Days + Leave Days) × Per Day Rate</li>
                    <li>Deduction = Absent Days × Per Day Rate (automatic)</li>
                    <li>Net Salary = Earned - Deductions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Salary Input Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Set Daily Rates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto p-1 border rounded-lg bg-slate-50/50">
              {allUsers.map(user => (
                <Card key={user.email} className="bg-white">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold">{user.full_name}</Label>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>

                      <div>
                        <Label className="text-xs">Per Day Salary (₹)</Label>
                        <Input
                          type="number"
                          placeholder="Enter daily rate"
                          value={perDaySalary[user.email] || ''}
                          onChange={(e) => setPerDaySalary({
                            ...perDaySalary,
                            [user.email]: e.target.value
                          })}
                          className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          Deduction per absent: ₹{perDaySalary[user.email] || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Preview Table */}
          {salaryPreview.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Salary Preview</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Leave</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Deduction</TableHead>
                      <TableHead className="text-right">Net Salary</TableHead>
                      <TableHead className="text-center">Attn%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryPreview.map(({ user, calc, perDay }) => (
                      <TableRow key={user.email}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{calc.presentDays}</TableCell>
                        <TableCell className="text-center">{calc.absentDays}</TableCell>
                        <TableCell className="text-center">{calc.leaveDays}</TableCell>
                        <TableCell className="text-right text-green-600 font-semibold">
                          ₹{calc.earnedSalary.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          ₹{calc.deductions.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg">
                          ₹{calc.netSalary.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              calc.attendanceRate >= 90 ? 'bg-green-100 text-green-700' :
                                calc.attendanceRate >= 75 ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                            }
                          >
                            {calc.attendanceRate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-slate-600">Total Employees</p>
                    <p className="text-2xl font-bold text-slate-900">{salaryPreview.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Deductions</p>
                    <p className="text-2xl font-bold text-red-600">
                      ₹{salaryPreview.reduce((sum, d) => sum + d.calc.deductions, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Payable</p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{salaryPreview.reduce((sum, d) => sum + d.calc.netSalary, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}