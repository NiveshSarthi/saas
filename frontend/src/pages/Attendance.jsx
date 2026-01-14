import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  BarChart3,
  FileText,
  Settings,
  DollarSign,
  Upload
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import AttendanceCalendar from '@/components/attendance/AttendanceCalendar';
import MarkAttendanceDialog from '@/components/attendance/MarkAttendanceDialog';
import AttendanceStats from '@/components/attendance/AttendanceStats';
import AttendanceTable from '@/components/attendance/AttendanceTable';
import CheckInOutWidget from '@/components/attendance/CheckInOutWidget';
import AttendanceDashboard from '@/components/attendance/AttendanceDashboard';
import AttendanceTrendChart from '@/components/attendance/AttendanceTrendChart';

import MemberAttendanceSummary from '@/components/attendance/MemberAttendanceSummary';
import WorkHoursBreakdown from '@/components/attendance/WorkHoursBreakdown';
import AttendanceInsights from '@/components/attendance/AttendanceInsights';
import RecentAttendanceHistory from '@/components/attendance/RecentAttendanceHistory';
import TeamAttendanceView from '@/components/attendance/TeamAttendanceView';
import AIAttendanceInsights from '@/components/attendance/AIAttendanceInsights';
import SalaryCalculationReport from '@/components/attendance/SalaryCalculationReport';
import EnhancedSalaryReport from '@/components/attendance/EnhancedSalaryReport';
import BulkUploadDialog from '@/components/attendance/BulkUploadDialog';
import DailyAttendanceReport from '@/components/attendance/DailyAttendanceReport';
import MonthlyAttendanceReport from '@/components/attendance/MonthlyAttendanceReport';
import CustomDateRangeReport from '@/components/attendance/CustomDateRangeReport';
import BulkMarkWeekoffDialog from '@/components/attendance/BulkMarkWeekoffDialog';
import ClearMonthDataDialog from '@/components/attendance/ClearMonthDataDialog';

const statusConfig = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700 border-green-200' },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200' },
  half_day: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  leave: { label: 'Leave', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  work_from_home: { label: 'WFH', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  sick_leave: { label: 'Sick Leave', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  casual_leave: { label: 'Casual Leave', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  holiday: { label: 'Holiday', color: 'bg-pink-100 text-pink-700 border-pink-200' }
};

export default function AttendancePage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [markDialogOpen, setMarkDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewMode, setViewMode] = useState('calendar');
  const [salaryReportOpen, setSalaryReportOpen] = useState(false);
  const [enhancedSalaryOpen, setEnhancedSalaryOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState('all');
  const [reportType, setReportType] = useState('daily');
  const [weekoffDialogOpen, setWeekoffDialogOpen] = useState(false);
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };
    fetchUser();
  }, []);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  const [isHR, setIsHR] = useState(false);

  useEffect(() => {
    if (user && departments.length > 0) {
      const hrDept = departments.find(d => d.name?.toLowerCase().includes('hr'));
      const itDept = departments.find(d => d.name?.toLowerCase().includes('it'));
      const userIsHR = user.department_id && hrDept && user.department_id === hrDept.id;
      const isIT = user.department_id && itDept && user.department_id === itDept.id;
      setIsHR(userIsHR);
      setIsAdmin(user.role === 'admin' || userIsHR || isIT);
    }
  }, [user, departments]);

  const { data: teamData } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
    enabled: isAdmin,
  });

  const usersFromEntity = teamData?.users || [];
  const invitations = teamData?.invitations || [];

  const excludedUsers = ['Nivesh Sarthi', 'Rahul Kushwaha', 'Satpal', 'Tech NS', 'Sachin'];
  
  const allUsers = [
    ...usersFromEntity.filter(u => u.active !== false && u.status !== 'inactive'),
    ...invitations
      .filter(inv => inv.status === 'accepted')
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ].filter(user => !excludedUsers.includes(user.full_name));

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance', format(selectedMonth, 'yyyy-MM'), selectedMemberFilter],
    queryFn: async () => {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

      if (isAdmin) {
        const filter = { date: { $gte: start, $lte: end } };
        if (selectedMemberFilter !== 'all') {
          filter.user_email = selectedMemberFilter;
        }
        return await base44.entities.Attendance.filter(filter);
      } else {
        return await base44.entities.Attendance.filter({
          user_email: user?.email,
          date: { $gte: start, $lte: end }
        });
      }
    },
    enabled: !!user,
  });

  const { data: todayRecord } = useQuery({
    queryKey: ['today-attendance', user?.email],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const records = await base44.entities.Attendance.filter({
        user_email: user?.email,
        date: today
      }, '-updated_date', 1);
      return records[0] || null;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: allAttendanceRecords = [] } = useQuery({
    queryKey: ['all-attendance-records', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      return await base44.entities.Attendance.filter({
        date: { $gte: start, $lte: end }
      });
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const { data: approvedLeaves = [] } = useQuery({
    queryKey: ['approved-leaves', format(selectedMonth, 'yyyy-MM'), isAdmin, user?.email],
    queryFn: async () => {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      
      if (isAdmin) {
        return await base44.entities.LeaveRequest.filter({
          status: 'approved',
          start_date: { $lte: end },
          end_date: { $gte: start }
        });
      } else {
        return await base44.entities.LeaveRequest.filter({
          user_email: user?.email,
          status: 'approved',
          start_date: { $lte: end },
          end_date: { $gte: start }
        });
      }
    },
    enabled: !!user,
  });

  const { data: leaveBalances = [] } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: () => base44.entities.LeaveBalance.list(),
    enabled: isAdmin,
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.list(),
    enabled: isAdmin,
  });

  const { data: workDays = [] } = useQuery({
    queryKey: ['work-days', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
      return await base44.entities.WorkDay.filter({
        date: { $gte: start, $lte: end }
      });
    },
    enabled: isAdmin,
  });

  const { data: todayAllRecords = [] } = useQuery({
    queryKey: ['today-all-attendance', format(new Date(), 'yyyy-MM-dd')],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      return await base44.entities.Attendance.filter({ date: today });
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  const { data: customRangeRecords = [], refetch: refetchCustomRange } = useQuery({
    queryKey: ['custom-range-attendance', customStartDate, customEndDate],
    queryFn: async () => {
      return await base44.entities.Attendance.filter({
        date: { $gte: customStartDate, $lte: customEndDate }
      });
    },
    enabled: isAdmin && reportType === 'custom',
    refetchOnMount: true,
  });

  // Refetch when dates change
  useEffect(() => {
    if (reportType === 'custom' && isAdmin) {
      refetchCustomRange();
    }
  }, [customStartDate, customEndDate, reportType, isAdmin, refetchCustomRange]);

  const handleMonthChange = (direction) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const handleMarkAttendance = (date) => {
    if (!isAdmin) {
      toast.error('Only admins can mark attendance');
      return;
    }
    setSelectedDate(date);
    setMarkDialogOpen(true);
  };



  const handleExportCSV = async () => {
    // Get all days in the selected month
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Fetch all attendance records for the month
    const allMonthRecords = await base44.entities.Attendance.filter({
      date: { 
        $gte: format(monthStart, 'yyyy-MM-dd'), 
        $lte: format(monthEnd, 'yyyy-MM-dd') 
      }
    });
    
    // Get only users who have at least one attendance record
    const usersWithAttendance = allUsers.filter(user => 
      allMonthRecords.some(r => r.user_email === user.email)
    );
    
    // Build header row with date columns
    const dateHeaders = allDaysInMonth.flatMap(day => [
      `${format(day, 'dd-MMM')} Status`,
      `${format(day, 'dd-MMM')} In`,
      `${format(day, 'dd-MMM')} Out`
    ]);
    const headers = ['Employee Name', 'Email', ...dateHeaders];

    // Build data rows - one row per employee with attendance
    const dataRows = usersWithAttendance.map(user => {
      // Get attendance for each day
      const dailyAttendance = allDaysInMonth.flatMap(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay();
        const isWeekOff = dayOfWeek === 1; // Monday only
        const record = allMonthRecords.find(r => r.user_email === user.email && r.date === dayStr);
        
        if (!record) {
          if (isWeekOff) {
            return ['WO', '-', '-'];
          }
          return ['-', '-', '-'];
        }
        
        // Status code
        const statusCode = {
          present: 'P',
          checked_out: 'P',
          absent: 'A',
          half_day: 'HD',
          leave: 'L',
          work_from_home: 'WFH',
          sick_leave: 'SL',
          casual_leave: 'CL',
          checked_in: 'CI',
          weekoff: 'WO',
          holiday: 'H'
        };
        const status = statusCode[record.status] || record.status;
        const checkIn = record.check_in_time || '-';
        const checkOut = record.check_out_time || '-';
        
        return [status, checkIn, checkOut];
      });
      
      return [user.full_name || user.email, user.email, ...dailyAttendance];
    });

    // CSV escape function
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Combine headers and data
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...dataRows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv; charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${format(selectedMonth, 'yyyy-MM')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Attendance exported to CSV');
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF('landscape');
      
      // Fetch all attendance records for the month
      const pdfMonthStart = startOfMonth(selectedMonth);
      const pdfMonthEnd = endOfMonth(selectedMonth);
      const allDaysInMonth = eachDayOfInterval({ start: pdfMonthStart, end: pdfMonthEnd });
      
      const allMonthRecords = await base44.entities.Attendance.filter({
        date: { 
          $gte: format(pdfMonthStart, 'yyyy-MM-dd'), 
          $lte: format(pdfMonthEnd, 'yyyy-MM-dd') 
        }
      });
      
      // Filter users with at least one attendance record
      const usersWithAttendance = allUsers.filter(user => 
        allMonthRecords.some(r => r.user_email === user.email)
      );
      
      // Calculate summary statistics
      const totalEmployees = usersWithAttendance.length;
      const totalWorkingDays = allDaysInMonth.length;
      const totalAttendanceRecords = allMonthRecords.filter(r => 
        r.status === 'checked_out' || 
        r.status === 'present' || 
        r.status === 'checked_in' ||
        r.status === 'work_from_home'
      ).length;
      const averageAttendanceRate = ((totalAttendanceRecords / (totalEmployees * totalWorkingDays)) * 100).toFixed(1);
      const totalHoursWorked = allMonthRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0).toFixed(1);
      const lateCheckIns = allMonthRecords.filter(r => r.is_late).length;
      const earlyCheckouts = allMonthRecords.filter(r => r.is_early_checkout).length;
      
      // ===== COVER PAGE =====
      // Gradient header background
      doc.setFillColor(79, 70, 229); // Indigo
      doc.rect(0, 0, 297, 50, 'F');
      
      doc.setFillColor(147, 51, 234); // Purple gradient
      doc.rect(0, 0, 297, 45, 'F');
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(32);
      doc.setFont(undefined, 'bold');
      doc.text('ATTENDANCE REPORT', 148.5, 25, { align: 'center' });
      
      doc.setFontSize(14);
      doc.setFont(undefined, 'normal');
      doc.text(format(selectedMonth, 'MMMM yyyy'), 148.5, 35, { align: 'center' });
      
      // Summary Cards Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('SUMMARY OVERVIEW', 14, 65);
      
      // Card 1 - Total Employees
      doc.setFillColor(239, 246, 255); // Blue background
      doc.roundedRect(14, 72, 60, 35, 3, 3, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.roundedRect(14, 72, 60, 35, 3, 3, 'S');
      doc.setFontSize(10);
      doc.setTextColor(59, 130, 246);
      doc.text('Total Employees', 44, 80, { align: 'center' });
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text(String(totalEmployees), 44, 95, { align: 'center' });
      
      // Card 2 - Attendance Rate
      doc.setFillColor(240, 253, 244); // Green background
      doc.roundedRect(80, 72, 60, 35, 3, 3, 'F');
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(80, 72, 60, 35, 3, 3, 'S');
      doc.setFontSize(10);
      doc.setTextColor(34, 197, 94);
      doc.text('Attendance Rate', 110, 80, { align: 'center' });
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text(`${averageAttendanceRate}%`, 110, 95, { align: 'center' });
      
      // Card 3 - Total Hours
      doc.setFillColor(254, 243, 199); // Amber background
      doc.roundedRect(146, 72, 60, 35, 3, 3, 'F');
      doc.setDrawColor(245, 158, 11);
      doc.roundedRect(146, 72, 60, 35, 3, 3, 'S');
      doc.setFontSize(10);
      doc.setTextColor(245, 158, 11);
      doc.text('Total Hours', 176, 80, { align: 'center' });
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text(`${totalHoursWorked}h`, 176, 95, { align: 'center' });
      
      // Card 4 - Late Check-ins
      doc.setFillColor(254, 242, 242); // Red background
      doc.roundedRect(212, 72, 60, 35, 3, 3, 'F');
      doc.setDrawColor(239, 68, 68);
      doc.roundedRect(212, 72, 60, 35, 3, 3, 'S');
      doc.setFontSize(10);
      doc.setTextColor(239, 68, 68);
      doc.text('Late Check-ins', 242, 80, { align: 'center' });
      doc.setFontSize(24);
      doc.setFont(undefined, 'bold');
      doc.text(String(lateCheckIns), 242, 95, { align: 'center' });
      
      // Legend Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('LEGEND', 14, 120);
      
      const legendY = 128;
      const legendItems = [
        { label: 'Present (P)', color: [34, 197, 94] },
        { label: 'Absent (A)', color: [239, 68, 68] },
        { label: 'Half Day (HD)', color: [234, 179, 8] },
        { label: 'Leave (L)', color: [168, 85, 247] },
        { label: 'WFH', color: [59, 130, 246] },
        { label: 'Holiday (H)', color: [236, 72, 153] },
        { label: 'Weekoff (WO)', color: [249, 115, 22] },
        { label: 'Late ⚠️', color: [239, 68, 68] }
      ];
      
      legendItems.forEach((item, index) => {
        const x = 14 + (index * 45);
        doc.setFillColor(...item.color);
        doc.circle(x + 2, legendY - 1, 2, 'F');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.setFont(undefined, 'normal');
        doc.text(item.label, x + 6, legendY);
      });
      
      // Footer
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, 14, 195);
      doc.text('Attendance Management System', 297 - 14, 195, { align: 'right' });
      
      // ===== DETAILED ATTENDANCE PAGES =====
      doc.addPage('landscape');
      
      const uniqueUsers = allUsers.map(u => u.email);
      let y = 20;
      let pageNum = 2;
      
      // Page header with gradient
      const drawPageHeader = () => {
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 297, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`${format(selectedMonth, 'MMMM yyyy')} - Detailed Attendance`, 14, 10);
        doc.setFontSize(8);
        doc.text(`Page ${pageNum}`, 297 - 14, 10, { align: 'right' });
      };
      
      drawPageHeader();
      y = 25;
      
      // Table headers
      doc.setFillColor(241, 245, 249); // Light gray background
      doc.rect(14, y - 5, 270, 12, 'F');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      
      let x = 16;
      doc.text('Employee', x, y);
      x += 55;
      
      // Date headers with status/time rows
      allDaysInMonth.forEach(day => {
        const dateText = format(day, 'dd');
        doc.text(dateText, x - 1, y - 1);
        doc.setFontSize(5);
        doc.text('S|In|Out', x - 1.5, y + 2);
        doc.setFontSize(7);
        x += 6.5;
      });
      
      y += 12;
      doc.setFont(undefined, 'normal');
      
      // Employee rows (only users with attendance)
      usersWithAttendance.forEach((userObj, userIndex) => {
        const userEmail = userObj.email;
        if (y > 185) {
          doc.addPage('landscape');
          pageNum++;
          drawPageHeader();
          y = 25;
          
          // Redraw headers
          doc.setFillColor(241, 245, 249);
          doc.rect(14, y - 5, 270, 12, 'F');
          doc.setFont(undefined, 'bold');
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);
          
          x = 16;
          doc.text('Employee', x, y);
          x += 55;
          
          allDaysInMonth.forEach(day => {
            doc.text(format(day, 'dd'), x - 1, y - 1);
            doc.setFontSize(5);
            doc.text('S|In|Out', x - 1.5, y + 2);
            doc.setFontSize(7);
            x += 6.5;
          });
          
          y += 12;
          doc.setFont(undefined, 'normal');
        }
        
        // Alternate row colors
        if (userIndex % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, y - 6, 270, 10, 'F');
        }
        
        const userName = userObj.full_name || userEmail;
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        x = 16;
        doc.text(userName.substring(0, 28), x, y);
        x += 55;
        
        // Daily attendance with status, check-in, and check-out
        allDaysInMonth.forEach(day => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayOfWeek = day.getDay();
          const isWeekOff = dayOfWeek === 1; // Monday only
          const record = allMonthRecords.find(r => r.user_email === userEmail && r.date === dayStr);
          
          if (record) {
            // Color code based on status
            if (record.status === 'present' || record.status === 'checked_out') {
              doc.setTextColor(34, 197, 94); // Green
            } else if (record.status === 'absent') {
              doc.setTextColor(239, 68, 68); // Red
            } else if (record.status === 'leave') {
              doc.setTextColor(168, 85, 247); // Purple
            } else if (record.status === 'work_from_home') {
              doc.setTextColor(59, 130, 246); // Blue
            } else if (record.status === 'half_day') {
              doc.setTextColor(234, 179, 8); // Yellow
            } else if (record.status === 'weekoff') {
              doc.setTextColor(249, 115, 22); // Orange
            }
            
            if (record.is_late) {
              doc.setTextColor(239, 68, 68); // Red for late
            }
            
            const statusCode = {
              present: 'P',
              checked_out: 'P',
              absent: 'A',
              half_day: 'HD',
              leave: 'L',
              work_from_home: 'W',
              sick_leave: 'SL',
              casual_leave: 'CL',
              checked_in: 'CI',
              weekoff: 'WO',
              holiday: 'H'
            };
            
            const statusText = statusCode[record.status] || '-';
            const checkIn = record.check_in_time ? record.check_in_time.substring(0, 5) : '-';
            const checkOut = record.check_out_time ? record.check_out_time.substring(0, 5) : '-';
            
            // Display status, check-in, check-out in compact format
            doc.setFontSize(4.5);
            doc.text(statusText, x - 1.5, y - 2);
            doc.text(checkIn, x - 1.5, y + 0.5);
            doc.text(checkOut, x - 1.5, y + 3);
          } else if (isWeekOff) {
            // Show weekoff even if no record exists
            doc.setTextColor(249, 115, 22); // Orange
            doc.setFontSize(4.5);
            doc.text('WO', x - 1, y);
            doc.text('-', x - 1, y + 2.5);
          } else {
            doc.setTextColor(203, 213, 225); // Light gray for no data
            doc.setFontSize(4.5);
            doc.text('-', x - 1, y);
          }
          x += 6.5;
        });
        
        y += 10;
        doc.setTextColor(0, 0, 0);
      });
      
      // Final footer
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('End of Report', 148.5, y + 10, { align: 'center' });
      
      doc.save(`attendance-report-${format(selectedMonth, 'yyyy-MM')}.pdf`);
      toast.success('Attendance exported to PDF');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF: ' + error.message);
    }
  };



  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAdmin && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
        <p className="text-slate-500">You need to be logged in to view attendance.</p>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Hero Section with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
        
        <div className="relative max-w-[1800px] mx-auto px-6 lg:px-8 py-8 lg:py-12">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl">
                  <UserCheck className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold">Attendance Hub</h1>
                  <p className="text-white/80 mt-1">Track, manage, and analyze team presence</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isAdmin && (
                <>
                  <Button variant="outline" onClick={() => setBulkUploadOpen(true)} className="bg-amber-500/20 backdrop-blur-lg border-amber-300/50 text-white hover:bg-amber-500/30">
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </Button>
                  <Button variant="outline" onClick={() => setWeekoffDialogOpen(true)} className="bg-orange-500/20 backdrop-blur-lg border-orange-300/50 text-white hover:bg-orange-500/30">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Mark Weekoffs
                  </Button>
                  <Button variant="outline" onClick={() => setClearDataDialogOpen(true)} className="bg-red-500/20 backdrop-blur-lg border-red-300/50 text-white hover:bg-red-500/30">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Clear Data
                  </Button>
                  <Button variant="outline" onClick={handleExportCSV} className="bg-white/20 backdrop-blur-lg border-white/30 text-white hover:bg-white/30">
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button variant="outline" onClick={handleExportPDF} className="bg-white/20 backdrop-blur-lg border-white/30 text-white hover:bg-white/30">
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" onClick={() => setEnhancedSalaryOpen(true)} className="bg-green-500/20 backdrop-blur-lg border-green-300/50 text-white hover:bg-green-500/30">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Salary Report
                  </Button>
                  <Link to={createPageUrl('AttendanceRules')}>
                    <Button variant="outline" className="bg-white/20 backdrop-blur-lg border-white/30 text-white hover:bg-white/30">
                      <Settings className="w-4 h-4 mr-2" />
                      Rules
                    </Button>
                  </Link>
                  <Button onClick={() => handleMarkAttendance(new Date())} className="bg-white text-indigo-600 hover:bg-white/90 shadow-lg">
                    <Clock className="w-4 h-4 mr-2" />
                    Mark Attendance
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Month Navigation - Glassmorphism Style */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/20 backdrop-blur-lg rounded-2xl border border-white/30 p-4 shadow-xl">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Button variant="ghost" onClick={() => handleMonthChange(-1)} className="text-white hover:bg-white/20">
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <div className="flex-1 sm:flex-none sm:w-48">
                <Input
                  type="month"
                  value={format(selectedMonth, 'yyyy-MM')}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-');
                    setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                  }}
                  className="bg-white/30 border-white/40 text-white placeholder:text-white/60 text-center font-bold text-lg"
                />
              </div>

              <Button variant="ghost" onClick={() => handleMonthChange(1)} className="text-white hover:bg-white/20">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {isAdmin && (
              <div className="w-full sm:w-64">
                <Select value={selectedMemberFilter} onValueChange={setSelectedMemberFilter}>
                  <SelectTrigger className="bg-white/30 border-white/40 text-white">
                    <SelectValue placeholder="Filter by member" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {allUsers.map(u => (
                      <SelectItem key={u.email} value={u.email}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 lg:px-8 py-8 -mt-8 relative z-10">

        {/* Check-In/Out Widget - Featured with Shadow */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden transform transition-all hover:shadow-3xl hover:scale-[1.01]">
            <CheckInOutWidget 
              user={user}
              todayRecord={todayRecord}
              onUpdate={() => queryClient.invalidateQueries(['today-attendance'])}
            />
          </div>
        </div>

        {/* Admin Dashboard */}
        {isAdmin && (
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
              <AttendanceDashboard 
                todayRecords={todayAllRecords}
                allUsers={allUsers}
              />
            </div>
          </div>
        )}

        {/* AI Insights */}
        {isAdmin && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-3xl shadow-xl border border-purple-100 overflow-hidden">
              <AIAttendanceInsights
                records={attendanceRecords}
                selectedMonth={selectedMonth}
                allUsers={allUsers}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        )}

        {/* Member-specific Summary */}
        {!isAdmin && (
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
              <MemberAttendanceSummary 
                records={attendanceRecords}
                selectedMonth={selectedMonth}
              />
            </div>
          </div>
        )}

        {/* Stats with Card Grid */}
        {isAdmin && (
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden p-6">
              <AttendanceStats 
                records={attendanceRecords}
                selectedMonth={selectedMonth}
                isAdmin={isAdmin}
                allUsers={allUsers}
                approvedLeaves={approvedLeaves}
              />
            </div>
          </div>
        )}

        {/* Member Analytics - Glass Cards */}
        {!isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
              <WorkHoursBreakdown 
                records={attendanceRecords}
                selectedMonth={selectedMonth}
              />
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl shadow-xl border border-indigo-100 overflow-hidden">
              <AttendanceInsights 
                records={attendanceRecords}
                selectedMonth={selectedMonth}
                todayRecord={todayRecord}
              />
            </div>
          </div>
        )}

        {/* Recent History for Members */}
        {!isAdmin && (
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
              <RecentAttendanceHistory records={attendanceRecords} />
            </div>
          </div>
        )}

        {/* Trend Charts (Admin Only) */}
        {isAdmin && (
          <div className="mb-8">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden p-6">
              <AttendanceTrendChart 
                records={attendanceRecords}
                selectedMonth={selectedMonth}
              />
            </div>
          </div>
        )}

        {/* Report Type Selection - For Admins Only */}
        {isAdmin && (
          <div className="mb-8">
            <Card className="bg-white/80 backdrop-blur-xl border-2 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Select Report Type</h3>
                    <p className="text-sm text-slate-600">Choose the type of attendance analysis you want to view</p>
                  </div>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="w-64 border-2 h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily Report (Today)</SelectItem>
                      <SelectItem value="monthly">Monthly Report</SelectItem>
                      <SelectItem value="custom">Custom Date Range</SelectItem>
                      <SelectItem value="attendance">Attendance View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Custom Date Range Inputs */}
                {reportType === 'custom' && (
                  <div className="mt-4 flex gap-4">
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">Start Date</label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="border-2"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-sm font-semibold text-slate-700 mb-2 block">End Date</label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="border-2"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reports Content */}
        {isAdmin && reportType === 'daily' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden p-6">
            <DailyAttendanceReport
              records={todayAllRecords}
              allUsers={allUsers}
              selectedDate={new Date()}
              departments={departments}
            />
          </div>
        )}

        {isAdmin && reportType === 'monthly' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden p-6">
            <MonthlyAttendanceReport
              records={attendanceRecords}
              allUsers={allUsers}
              selectedMonth={selectedMonth}
              departments={departments}
              approvedLeaves={approvedLeaves}
              leaveBalances={leaveBalances}
              leaveTypes={leaveTypes}
              workDays={workDays}
            />
          </div>
        )}

        {isAdmin && reportType === 'custom' && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden p-6">
            <CustomDateRangeReport
              records={customRangeRecords}
              allUsers={allUsers}
              startDate={new Date(customStartDate)}
              endDate={new Date(customEndDate)}
              departments={departments}
              approvedLeaves={approvedLeaves}
              leaveBalances={leaveBalances}
              leaveTypes={leaveTypes}
              workDays={workDays}
            />
          </div>
        )}

        {/* View Tabs - Modern Design - Show only for attendance view or non-admin */}
        {(reportType === 'attendance' || !isAdmin) && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
            <Tabs value={viewMode} onValueChange={setViewMode} className="p-6">
              <TabsList className="bg-gradient-to-r from-indigo-100 to-purple-100 p-1 rounded-2xl">
                <TabsTrigger value="calendar" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="table" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Table
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="realtime" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg">
                    <Users className="w-4 h-4 mr-2" />
                    Live Team
                  </TabsTrigger>
                )}
              </TabsList>

            <TabsContent value="calendar" className="mt-6">
              <div className="mb-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-200 shadow-sm">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMonthChange(-1)}
                  className="gap-2 bg-white hover:bg-indigo-50 border-indigo-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="text-lg font-bold text-indigo-900">
                  {format(selectedMonth, 'MMMM yyyy')}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMonthChange(1)}
                  className="gap-2 bg-white hover:bg-indigo-50 border-indigo-200"
                  disabled={format(selectedMonth, 'yyyy-MM') >= format(new Date(), 'yyyy-MM')}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <AttendanceCalendar
                selectedMonth={selectedMonth}
                records={attendanceRecords}
                onMarkAttendance={handleMarkAttendance}
                isAdmin={isAdmin}
                currentUserEmail={user?.email}
                approvedLeaves={approvedLeaves}
              />
            </TabsContent>

            <TabsContent value="table" className="mt-6">
              <AttendanceTable
                records={attendanceRecords}
                users={allUsers}
                isAdmin={isAdmin}
                currentUserEmail={user?.email}
                isHR={isHR}
              />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="realtime" className="mt-6">
                <TeamAttendanceView
                  allUsers={allUsers}
                  todayRecords={allAttendanceRecords}
                />
              </TabsContent>
              )}
            </Tabs>
          </div>
        )}
      </div>
      
      {/* Mark Attendance Dialog */}
      <MarkAttendanceDialog
        isOpen={markDialogOpen}
        onClose={() => {
          setMarkDialogOpen(false);
          setSelectedDate(null);
        }}
        selectedDate={selectedDate}
        currentUser={user}
        isAdmin={isAdmin}
        allUsers={allUsers}
      />

      {/* Enhanced Salary Report Dialog */}
      <EnhancedSalaryReport
        isOpen={enhancedSalaryOpen}
        onClose={() => setEnhancedSalaryOpen(false)}
        selectedMonth={selectedMonth}
        allUsers={allUsers}
      />

      {/* Bulk Upload Dialog */}
      <BulkUploadDialog
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        selectedMonth={format(selectedMonth, 'yyyy-MM')}
      />

      {/* Bulk Mark Weekoff Dialog */}
      <BulkMarkWeekoffDialog
        isOpen={weekoffDialogOpen}
        onClose={() => setWeekoffDialogOpen(false)}
        allUsers={allUsers}
        selectedMonth={selectedMonth}
      />

      {/* Clear Month Data Dialog */}
      <ClearMonthDataDialog
        isOpen={clearDataDialogOpen}
        onClose={() => setClearDataDialogOpen(false)}
        allUsers={allUsers}
        selectedMonth={selectedMonth}
      />
      </div>
      );
      }