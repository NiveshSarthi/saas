import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Plus,
  Users,
  DollarSign,
  Calendar,
  Download,
  Lock,
  CheckCircle,
  BarChart3,
  FileText,
  RefreshCw,
  Settings,
  Search,
  Mail,
  History,
  Wallet,
  Trash2,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  Zap,
  Eye,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import SalaryAdjustmentDialog from '@/components/salary/SalaryAdjustmentDialog';
import SalaryLockDialog from '@/components/salary/SalaryLockDialog';
import SalaryPolicyForm from '@/components/salary/SalaryPolicyForm';
import AdvanceManagementDialog from '@/components/salary/AdvanceManagementDialog';

export default function SalaryPage() {
  const [activeTab, setActiveTab] = useState('management');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [user, setUser] = useState(null);
  const [policyFormOpen, setPolicyFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState('cards');
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedPenalty, setSelectedPenalty] = useState(null);
  const [ticketReason, setTicketReason] = useState('');

  const approveRequestMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.SalaryAdjustment.update(id, {
        status: 'approved',
        approved_by: user?.email,
        approved_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Request approved');
      queryClient.invalidateQueries(['salary-adjustments-all']);
    },
    onError: (e) => toast.error(e.message)
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.SalaryAdjustment.update(id, {
        status: 'rejected',
        rejected_by: user?.email,
        rejected_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Request rejected');
      queryClient.invalidateQueries(['salary-adjustments-all']);
    },
    onError: (e) => toast.error(e.message)
  });

  const createTicketMutation = useMutation({
    mutationFn: async ({ date, reason, employee_email }) => {
      return await base44.entities.SalaryAdjustment.create({
        employee_email,
        month: selectedMonth,
        date: date,
        amount: 0,
        adjustment_type: 'penalty_waiver',
        reason: reason,
        status: 'pending'
      });
    },
    onSuccess: () => {
      toast.success('Ticket raised successfully');
      setTicketDialogOpen(false);
      setTicketReason('');
      queryClient.invalidateQueries(['salary-adjustments-all']);
    },
    onError: (e) => toast.error(e.message)
  });

  const queryClient = useQueryClient();

  const [isHRMember, setIsHRMember] = React.useState(false);
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  React.useEffect(() => {
    const fetchUser = async () => {
      const userData = await base44.auth.me();
      setUser(userData);
    };
    fetchUser();
  }, []);

  React.useEffect(() => {
    if (user && departments.length > 0) {
      const hrDept = departments.find(d => d.name?.toLowerCase().includes('hr'));
      setIsHRMember(user.role === 'admin' || (user.department_id && hrDept && user.department_id === hrDept.id));
    }
  }, [user, departments]);

  // Auto-calculate on mount and month change
  React.useEffect(() => {
    if (user && activeTab === 'management') {
      const autoCalc = async () => {
        setIsCalculating(true);
        try {
          await base44.functions.invoke('calculateMonthlySalary', { month: selectedMonth });
          await queryClient.refetchQueries(['salary-records', selectedMonth]);
        } catch (error) {
          console.error('Auto-calc failed:', error);
        } finally {
          setIsCalculating(false);
        }
      };
      autoCalc();
    }
  }, [selectedMonth, user, activeTab, queryClient]);

  // Fetch real-time attendance data
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-records-salary', selectedMonth],
    queryFn: () => base44.entities.Attendance.filter({
      date: { $gte: `${selectedMonth}-01`, $lte: `${selectedMonth}-31` }
    }),
    enabled: !!user,
    refetchInterval: 10000
  });

  const { data: salaries = [], isLoading: salariesLoading } = useQuery({
    queryKey: ['salary-records', selectedMonth],
    queryFn: () => base44.entities.SalaryRecord.filter({ month: selectedMonth }, '-employee_name'),
    enabled: !!user,
    refetchInterval: 30000
  });

  const { data: allAdjustments = [] } = useQuery({
    queryKey: ['salary-adjustments-all', selectedMonth],
    queryFn: () => base44.entities.SalaryAdjustment.filter({ month: selectedMonth }),
    enabled: !!user,
    refetchInterval: 30000
  });

  const { data: allPolicies = [] } = useQuery({
    queryKey: ['all-policies-management'],
    queryFn: () => base44.entities.SalaryPolicy.list(),
    enabled: !!user,
    refetchInterval: 30000
  });

  // Fetch Tasks for Timesheet Penalty Check
  const { data: allTasksForPenalty = [] } = useQuery({
    queryKey: ['tasks-penalty-check', selectedMonth],
    queryFn: () => base44.entities.Task.filter({
      created_date: { $gte: `${selectedMonth}-01`, $lte: `${selectedMonth}-31` }
    }),
    enabled: !!user
  });

  // Fetch Timesheets for Penalty Check
  const { data: allTimesheetsForPenalty = [] } = useQuery({
    queryKey: ['all-timesheets-penalty', selectedMonth],
    queryFn: () => base44.entities.Timesheet.filter({
      period_start: { $lte: `${selectedMonth}-31` },
      period_end: { $gte: `${selectedMonth}-01` }
    }),
    enabled: !!user
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['salary-policies'],
    queryFn: () => base44.entities.SalaryPolicy.list('-updated_date'),
    enabled: activeTab === 'policies'
  });

  const { data: teamData } = useQuery({
    queryKey: ['team-data-salary'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });
  // Fetch users directly for better reliability
  const { data: usersList = [] } = useQuery({
    queryKey: ['all-users-list-salary'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const allUsers = React.useMemo(() => {
    const excludedUsers = ['Nivesh Sarthi', 'Rahul Kushwaha', 'Satpal', 'Tech NS', 'Sachin'];
    return usersList
      .filter(u => u.active !== false && u.status !== 'inactive')
      .filter(user => !excludedUsers.includes(user.full_name))
      .map(u => ({
        ...u,
        id: u.id,
        email: u.email,
        full_name: u.full_name || u.email?.split('@')[0],
      }));
  }, [usersList]);

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.list('name'),
    enabled: activeTab === 'policies'
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async (recordIds) => {
      for (const id of recordIds) {
        await base44.entities.SalaryRecord.update(id, {
          status: 'approved',
          approved_by: user?.email,
          approved_at: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-records']);
      setSelectedRecords([]);
      toast.success('Salaries approved successfully');
    }
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (recordIds) => {
      for (const id of recordIds) {
        await base44.functions.invoke('processAdvanceRecovery', { salary_record_id: id });
        await base44.entities.SalaryRecord.update(id, {
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0]
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-records']);
      setSelectedRecords([]);
      toast.success('Marked as paid successfully');
    }
  });

  const deleteSalaryMutation = useMutation({
    mutationFn: async (recordId) => {
      await base44.entities.SalaryRecord.delete(recordId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-records']);
      toast.success('Salary record deleted');
    }
  });

  const generateSlipMutation = useMutation({
    mutationFn: async (recordId) => {
      const response = await base44.functions.invoke('generateSalarySlip', {
        salary_record_id: recordId
      });
      return response.data;
    },
    onSuccess: (data) => {
      const byteCharacters = atob(data.pdf_base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Salary slip downloaded');
    }
  });

  const emailSlipMutation = useMutation({
    mutationFn: async (recordId) => {
      const salary = salaries.find(s => s.id === recordId);
      await base44.functions.invoke('generateSalarySlip', {
        salary_record_id: recordId
      });

      await base44.integrations.Core.SendEmail({
        to: salary.employee_email,
        subject: `Salary Slip - ${salary.month}`,
        body: `Dear ${salary.employee_name},\n\nPlease find your salary slip for ${salary.month} attached.\n\nNet Salary: ₹${salary.net_salary?.toLocaleString()}\n\nRegards,\nHR Team`
      });
    },
    onSuccess: () => {
      toast.success('Salary slip emailed successfully');
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('calculateMonthlySalary', { month: selectedMonth });
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-records', selectedMonth]);
      toast.success('Salaries recalculated successfully');
    },
    onError: (error) => {
      toast.error('Calculation failed: ' + error.message);
    }
  });

  const deletePolicyMutation = useMutation({
    mutationFn: (id) => base44.entities.SalaryPolicy.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-policies']);
      toast.success('Policy deleted successfully');
    }
  });

  const exportCSVMutation = useMutation({
    mutationFn: async () => {
      const headers = [
        'Employee Name', 'Email', 'Month', 'Total Days', 'Present', 'Absent (Unpaid)',
        'Week Off', 'Paid Leave', 'Half Days', 'Not Marked',
        'Base Salary', 'Adjustments', 'Gross', 'Deductions', 'Net Salary', 'Status'
      ];

      const rows = filteredSalaries.map(s => {
        const calc = calculateEmployeeSalary(s.employee_email);
        return [
          s.employee_name, s.employee_email, s.month,
          calc.totalDays, calc.effectivePresent, calc.unpaidAbsent,
          calc.weekoff, calc.paidLeave, calc.halfDay, calc.notMarked,
          calc.baseSalary, calc.adjustments, calc.gross,
          calc.totalDeductions, calc.net, s.status
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary_${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('CSV exported successfully')
  });

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Payroll Report', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${selectedMonth}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 33);

    const tableData = filteredSalaries.map(s => {
      const calc = calculateEmployeeSalary(s.employee_email);
      return [
        s.employee_name,
        // s.employee_email,
        `${calc.paidDays}/${calc.totalDays}`,
        `Rs. ${calc.baseSalary.toLocaleString()}`,
        `Rs. ${calc.adjustments.toLocaleString()}`,
        `Rs. ${calc.gross.toLocaleString()}`,
        `-Rs. ${calc.totalDeductions.toLocaleString()}`,
        `Rs. ${calc.net.toLocaleString()}`,
        s.status.toUpperCase()
      ];
    });

    // Calculate Totals
    const totalNet = filteredSalaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Net Payroll: Rs. ${totalNet.toLocaleString()}`, 280, 20, { align: 'right' });

    autoTable(doc, {
      head: [['Employee', 'Paid/Total Days', 'Base', 'Adjustments', 'Gross', 'Deductions', 'Net Pay', 'Status']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        6: { fontStyle: 'bold', halign: 'right' }, // Net Pay
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });

    doc.save(`payroll-report-${selectedMonth}.pdf`);
    toast.success('PDF exported successfully');
  };

  const applyRetroactiveIncentivesMutation = useMutation({
    mutationFn: async () => {
      const result = await base44.functions.invoke('applyRetroactiveIncentives');
      return result.data;
    },
    onSuccess: (data) => {
      toast.success(`Applied ${data.bonusesCreated} retroactive incentive bonuses`);
      // Refresh salary data and adjustments
      queryClient.invalidateQueries(['salary-records', selectedMonth]);
      queryClient.invalidateQueries(['salary-adjustments-all', selectedMonth]);
    },
    onError: (error) => {
      toast.error('Failed to apply retroactive incentives: ' + error.message);
    }
  });

  // Helper to get user name from email
  const getUserName = React.useCallback((email) => {
    const user = allUsers.find(u => u.email === email);
    return user?.full_name || email;
  }, [allUsers]);

  // Enhanced salary calculation from attendance
  const calculateEmployeeSalary = React.useCallback((employeeEmail) => {
    const policy = allPolicies.find(p => p.user_email === employeeEmail && p.is_active);
    const salary = salaries.find(s => s.employee_email === employeeEmail);
    const empAttendance = attendanceRecords.filter(a => a.user_email === employeeEmail);

    const [year, month] = selectedMonth.split('-');
    const totalDays = new Date(parseInt(year), parseInt(month), 0).getDate();

    // Sort attendance by date
    const sortedAttendance = empAttendance.sort((a, b) => a.date.localeCompare(b.date));

    // Calculate attendance-based adjustments
    let attendanceAdjustments = 0;
    const dailyDetails = [];
    let consecutiveLateCheckIn = 0;
    let consecutiveEarlyCheckout = 0;

    const expectedCheckIn = 10; // 10:00 AM
    const expectedCheckOutStart = 17; // 5:00 PM
    const expectedCheckOutEnd = 18; // 6:00 PM

    const dailySalary = policy ? ((policy.basic_salary || 0) + (policy.hra || 0) + (policy.travelling_allowance || 0) + (policy.children_education_allowance || 0) + (policy.fixed_incentive || 0) + (policy.employer_incentive || 0)) / totalDays : 0;

    // --- Timesheet Penalty Calculation ---
    const penaltyDates = new Set();
    let timesheetPenaltyDeduction = 0;
    const penaltyDetails = [];

    // Filter tasks for this employee
    const employeeTasks = allTasksForPenalty.filter(t =>
      (t.assignee_email === employeeEmail) ||
      (t.assignees && t.assignees.includes(employeeEmail))
    );

    employeeTasks.forEach(task => {
      const taskDate = new Date(task.created_date); // Assignment date
      const deadline = new Date(taskDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
      const now = new Date();

      // Only check if 24h has passed
      if (now > deadline) {
        // Check for timesheet entry for this task
        const hasEntry = allTimesheetsForPenalty.some(sheet =>
          sheet.freelancer_email === employeeEmail &&
          sheet.entries &&
          sheet.entries.some(entry => entry.task_id === task.id || (entry.task_title === task.title && entry.date === task.created_date))
        );

        if (!hasEntry) {
          // Check for Penalty Waiver (Ticket Approved)
          const hasWaiver = employeeAdjustments.some(adj =>
            adj.adjustment_type === 'penalty_waiver' &&
            adj.date === task.created_date
          );

          if (!hasWaiver) {
            // Penalty Triggered
            const dateStr = task.created_date; // "YYYY-MM-DD"
            if (!penaltyDates.has(dateStr)) {
              penaltyDates.add(dateStr);
              // Deduct 1 day salary
              timesheetPenaltyDeduction += dailySalary;
              penaltyDetails.push({
                date: dateStr,
                reason: `Timesheet not submitted for task: ${task.title}`,
                amount: dailySalary
              });
            }
          }
        }
      }
    });

    // Filter attendance: Remove days marked for penalty
    const effectiveAttendance = sortedAttendance.filter(att => !penaltyDates.has(att.date));

    effectiveAttendance.forEach(att => {
      const checkInTime = att.check_in ? new Date(att.check_in) : null;
      const checkOutTime = att.check_out ? new Date(att.check_out) : null;
      let dailyAdjustment = 0;
      let adjustmentReason = '';

      // Check-in rules (only if present or checked_out)
      if (['present', 'checked_out', 'work_from_home'].includes(att.status) && checkInTime) {
        const checkInHour = checkInTime.getHours();
        const checkInMinute = checkInTime.getMinutes();
        const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
        const expectedCheckInMinutes = expectedCheckIn * 60;

        if (checkInTotalMinutes > expectedCheckInMinutes) {
          // Check-in after 10 AM
          if (checkInHour >= 10 && checkInHour < 11) {
            // 10:01 - 11:00
            consecutiveLateCheckIn++;
            if (consecutiveLateCheckIn >= 3) {
              dailyAdjustment -= dailySalary * 0.25;
              adjustmentReason = 'Late check-in (consecutive)';
            } else {
              dailyAdjustment -= dailySalary * 0.25;
              adjustmentReason = 'Late check-in';
            }
          } else if (checkInHour >= 11 && checkInHour < 12) {
            // 11:00 - 12:00
            dailyAdjustment -= dailySalary * 0.5;
            adjustmentReason = 'Very late check-in';
            consecutiveLateCheckIn = 0; // Reset streak
          } else if (checkInHour >= 12 && checkInHour < 14) {
            // 12:00 - 2:00
            dailyAdjustment -= dailySalary * 0.5;
            adjustmentReason = 'Extremely late check-in';
            consecutiveLateCheckIn = 0;
          } else if (checkInHour >= 14 && checkInHour < 16) {
            // 2:00 - 4:00 (Deduction, not bonus)
            dailyAdjustment -= dailySalary * 0.75;
            adjustmentReason = 'Excessively late check-in';
            consecutiveLateCheckIn = 0;
          } else if (checkInHour >= 16) {
            // 4:00 PM or onwards
            dailyAdjustment -= dailySalary;
            adjustmentReason = 'Full deduction for very late check-in';
            consecutiveLateCheckIn = 0;
          }
        } else {
          // Timely check-in
          consecutiveLateCheckIn = 0;
        }

        // Check-out rules (only if check-in was timely)
        if (checkInTotalMinutes <= expectedCheckInMinutes && checkOutTime) {
          const checkOutHour = checkOutTime.getHours();
          const checkOutMinute = checkOutTime.getMinutes();
          const checkOutTotalMinutes = checkOutHour * 60 + checkOutMinute;

          if (checkOutTotalMinutes < 14 * 60) {
            // Before 2:00 PM
            dailyAdjustment -= dailySalary;
            adjustmentReason += (adjustmentReason ? '; ' : '') + 'Early checkout (full deduction)';
            consecutiveEarlyCheckout = 0;
          } else if (checkOutTotalMinutes >= 14 * 60 && checkOutTotalMinutes < expectedCheckOutStart * 60) {
            // 2:00 - 5:00 PM
            dailyAdjustment -= dailySalary * 0.5;
            adjustmentReason += (adjustmentReason ? '; ' : '') + 'Early checkout';
            consecutiveEarlyCheckout = 0;
          } else if (checkOutTotalMinutes >= expectedCheckOutStart * 60 && checkOutTotalMinutes < expectedCheckOutEnd * 60) {
            // 5:00 - 6:00 PM
            consecutiveEarlyCheckout++;
            if (consecutiveEarlyCheckout >= 3) {
              dailyAdjustment -= dailySalary * 0.25;
              adjustmentReason += (adjustmentReason ? '; ' : '') + 'Early checkout (consecutive)';
            } else {
              dailyAdjustment -= dailySalary * 0.25;
              adjustmentReason += (adjustmentReason ? '; ' : '') + 'Early checkout';
            }
          } else {
            // On time or after 6 PM
            consecutiveEarlyCheckout = 0;
          }
        }
      } else {
        // Not present, reset streaks
        consecutiveLateCheckIn = 0;
        consecutiveEarlyCheckout = 0;
      }

      attendanceAdjustments += dailyAdjustment;

      dailyDetails.push({
        date: att.date,
        checkIn: checkInTime ? checkInTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
        checkOut: checkOutTime ? checkOutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
        status: att.status,
        adjustment: dailyAdjustment,
        reason: adjustmentReason
      });
    });

    // Count attendance types from actual records (excluding dates marked for timesheet penalty)
    // We use effectiveAttendance which already filters out penalty dates, but we need to match the logic of empAttendance

    const present = effectiveAttendance.filter(a => ['present', 'checked_out', 'work_from_home'].includes(a.status)).length;
    // Absent now includes explicitly marked absent days PLUS days we removed due to penalty? 
    // No, if we remove them, they become "Not Marked" or just "Unpaid"?
    // The requirement says "remove that daily attendance". If we assume they were present but now removed, they are no longer paid.
    // If we want to treat them as "Absent" (Unpaid), we should technically increment 'absent' count if they were originally scheduled to work.
    // However, simply NOT counting them as 'present' reduces 'paidDays', which effectively deducts the pay for that day.
    // We also have an EXPLICIT deduction 'timesheetPenaltyDeduction' (1 day salary) on TOP of losing the pay for the day?
    // "deduction the salary of 1 day... then remove that daily attendance" -> This sounds like Double Jeopardy (Lose pay for day + Fine).
    // Let's stick to that interpretation as it matches the text literally.

    const absent = effectiveAttendance.filter(a => a.status === 'absent').length;
    const halfDay = effectiveAttendance.filter(a => a.status === 'half_day').length;
    const paidLeave = effectiveAttendance.filter(a => ['leave', 'sick_leave', 'casual_leave'].includes(a.status)).length;
    const weekoff = effectiveAttendance.filter(a => a.status === 'weekoff').length;
    const holiday = effectiveAttendance.filter(a => a.status === 'holiday').length;
    const late = effectiveAttendance.filter(a => a.is_late).length;

    // First absent is paid, rest are unpaid
    const paidAbsent = Math.min(absent, 1);
    const unpaidAbsent = Math.max(0, absent - 1);
    const effectivePresent = present + paidAbsent;

    // Calculate paid days
    const paidDays = present + weekoff + holiday + paidLeave + paidAbsent + (halfDay * 0.5);

    // Not marked days (Original Total - Effective Records) OR (Total - Original Records)?
    // "remove that daily attendance" implies they essentially become "Not Marked" or just Gone.
    const notMarked = totalDays - effectiveAttendance.length;

    if (!policy) {
      return {
        totalDays, present, absent, unpaidAbsent, effectivePresent, halfDay, paidLeave,
        weekoff, holiday, late, paidDays, notMarked,
        baseSalary: 0, adjustments: 0, gross: 0, totalDeductions: 0, net: 0,
        earnedBasic: 0, earnedHra: 0, earnedTa: 0, earnedCea: 0, earnedFi: 0, empIncentive: 0,
        empPF: 0, empESI: 0, lwf: 0, latePenalty: 0, absentDeduction: 0,
        attendancePercentage: 0, hasPolicy: false, attendanceAdjustments: 0, dailyDetails: [],
        timesheetPenaltyDeduction: 0, penaltyDetails: []
      };
    }

    // Calculate base salary components (pro-rated)
    const basicPerDay = (policy.basic_salary || 0) / totalDays;
    const hraPerDay = (policy.hra || 0) / totalDays;
    const taPerDay = (policy.travelling_allowance || 0) / totalDays;
    const ceaPerDay = (policy.children_education_allowance || 0) / totalDays;
    const fiPerDay = (policy.fixed_incentive || 0) / totalDays;

    const earnedBasic = Math.round(basicPerDay * paidDays);
    const earnedHra = Math.round(hraPerDay * paidDays);
    const earnedTa = Math.round(taPerDay * paidDays);
    const earnedCea = Math.round(ceaPerDay * paidDays);
    const earnedFi = Math.round(fiPerDay * paidDays);
    const empIncentive = policy.employer_incentive || 0;

    const baseSalary = earnedBasic + earnedHra + earnedTa + earnedCea + earnedFi + empIncentive;

    // CTC 1: Based on salary policy only (full month salary, not pro-rated, including employer contributions)
    const fullMonthGross = (policy.basic_salary || 0) + (policy.hra || 0) +
      (policy.travelling_allowance || 0) + (policy.children_education_allowance || 0) +
      (policy.fixed_incentive || 0) + (policy.employer_incentive || 0);

    // Employer contributions for CTC calculation
    const employerPF = (policy.employer_pf_percentage > 0)
      ? Math.round(fullMonthGross * (policy.employer_pf_percentage / 100))
      : (policy.employer_pf_fixed || 0);

    const employerESI = (policy.employer_esi_percentage > 0)
      ? Math.round(fullMonthGross * (policy.employer_esi_percentage / 100))
      : (policy.employer_esi_fixed || 0);

    const employerLWF = policy.labour_welfare_employer || 0;

    const exGratia = (policy.ex_gratia_percentage > 0)
      ? Math.round((policy.basic_salary || 0) * (policy.ex_gratia_percentage / 100))
      : (policy.ex_gratia_fixed || 0);

    const monthlyCTC1 = fullMonthGross + employerPF + employerESI + employerLWF + exGratia;
    const yearlyCTC1 = monthlyCTC1 * 12;

    // Adjustments from SalaryAdjustment entity
    const employeeAdjustments = allAdjustments.filter(adj =>
      adj.employee_email === employeeEmail && adj.status === 'approved'
    );

    const adjustments = employeeAdjustments.reduce((total, adj) => {
      if (adj.adjustment_type === 'penalty_waiver') return total;

      if (['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type)) {
        return total + (adj.amount || 0);
      } else {
        return total - Math.abs(adj.amount || 0);
      }
    }, 0);

    const gross = baseSalary + adjustments + attendanceAdjustments;

    // CTC 2: Including adjustments
    const monthlyCTC2 = monthlyCTC1 + adjustments;
    const yearlyCTC2 = monthlyCTC2 * 12;

    // Statutory deductions
    const empPF = policy.employee_pf_percentage > 0
      ? Math.round(earnedBasic * policy.employee_pf_percentage / 100)
      : (policy.employee_pf_fixed || 0) * (paidDays / totalDays);
    const empESI = policy.employee_esi_percentage > 0
      ? Math.round(baseSalary * policy.employee_esi_percentage / 100)
      : (policy.employee_esi_fixed || 0) * (paidDays / totalDays);
    const lwf = (policy.labour_welfare_employee || 0) * (paidDays / totalDays);

    // Other deductions
    const latePenalty = late * (policy.late_penalty_per_minute || 0) * 10;
    const absentDeduction = unpaidAbsent > 0 ? Math.round((earnedBasic + earnedHra + earnedTa + earnedCea + earnedFi) / paidDays * unpaidAbsent) : 0;

    const totalDeductions = empPF + empESI + lwf + latePenalty + absentDeduction +
      (salary?.advance_recovery || 0) + (salary?.other_deductions || 0) + timesheetPenaltyDeduction;

    const net = gross - totalDeductions;

    // Attendance percentage
    const attendancePercentage = totalDays > 0 ? Math.round((paidDays / totalDays) * 100) : 0;

    return {
      totalDays, present, absent, unpaidAbsent, effectivePresent, halfDay, paidLeave,
      weekoff, holiday, late, paidDays, notMarked,
      baseSalary, earnedBasic, earnedHra, earnedTa, earnedCea, earnedFi, empIncentive,
      adjustments, gross, empPF, empESI, lwf, latePenalty, absentDeduction,
      totalDeductions, net, attendancePercentage, policy, hasPolicy: true,
      employeeAdjustments, monthlyCTC1, yearlyCTC1, monthlyCTC2, yearlyCTC2,
      attendanceAdjustments, dailyDetails, timesheetPenaltyDeduction, penaltyDetails
    };
  }, [allPolicies, salaries, attendanceRecords, selectedMonth, allAdjustments]);

  const handleSelectRecord = (recordId) => {
    setSelectedRecords(prev =>
      prev.includes(recordId) ? prev.filter(id => id !== recordId) : [...prev, recordId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRecords.length === filteredSalaries.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(filteredSalaries.map(s => s.id));
    }
  };

  // Filter salaries first (before using in totals)
  const filteredSalaries = useMemo(() => {
    return salaries.filter(salary => {
      const matchesSearch = searchQuery === '' ||
        salary.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        salary.employee_email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || salary.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [salaries, searchQuery, statusFilter]);

  // Calculate totals
  const totals = useMemo(() => {
    let gross = 0, net = 0, deductions = 0, employees = 0;
    filteredSalaries.forEach(s => {
      const calc = calculateEmployeeSalary(s.employee_email);
      if (calc.hasPolicy) {
        gross += calc.gross;
        net += calc.net;
        deductions += calc.totalDeductions;
        employees++;
      }
    });
    return { gross, net, deductions, employees };
  }, [filteredSalaries, calculateEmployeeSalary]);

  const statusCounts = useMemo(() => {
    const draft = salaries.filter(s => s.status === 'draft').length;
    const locked = salaries.filter(s => s.status === 'locked').length;
    const approved = salaries.filter(s => s.status === 'approved').length;
    const paid = salaries.filter(s => s.status === 'paid').length;
    return { draft, locked, approved, paid };
  }, [salaries]);

  if (!isHRMember) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="p-8 bg-white rounded-3xl shadow-2xl border-2 border-red-100">
          <Lock className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-center mb-2">Access Restricted</h1>
          <p className="text-slate-600 text-center">Only HR and Admin can access salary management</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/30 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[30%] bg-emerald-100/20 rounded-full blur-[100px]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 lg:px-8 py-8">

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20">
                <DollarSign className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-700 via-blue-600 to-indigo-700">
                Payroll Hub
              </h1>
            </div>
            <p className="text-slate-600 text-lg max-w-xl">
              Manage salaries, track attendance, and process payments with real-time insights.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isCalculating && (
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full animate-pulse">
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-sm font-medium text-indigo-300">Syncing...</span>
              </div>
            )}
            <div className="px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-full flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-slate-300">{user ? 'System Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Gross Payroll */}
          <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 hover:bg-white/90 hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <DollarSign className="w-24 h-24 text-indigo-500" />
            </div>
            <div className="relative">
              <p className="text-slate-500 font-medium mb-1">Gross Payroll</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-slate-900">₹{(totals.gross / 100000).toFixed(2)}</span>
                <span className="text-sm font-medium text-slate-500">Lakhs</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <TrendingUp className="w-4 h-4" />
                <span>+2.5% from last month</span>
              </div>
            </div>
          </div>

          {/* Net Payable */}
          <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 hover:bg-white/90 hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wallet className="w-24 h-24 text-emerald-500" />
            </div>
            <div className="relative">
              <p className="text-slate-500 font-medium mb-1">Net Payable</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-slate-900">₹{(totals.net / 100000).toFixed(2)}</span>
                <span className="text-sm font-medium text-slate-500">Lakhs</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '85%' }} />
              </div>
              <p className="text-xs text-slate-500 mt-2">85% Processed</p>
            </div>
          </div>

          {/* Average Attendance */}
          <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 hover:bg-white/90 hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Users className="w-24 h-24 text-purple-500" />
            </div>
            <div className="relative">
              <p className="text-slate-500 font-medium mb-1">Active Employees</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-slate-900">{totals.employees}</span>
                <span className="text-sm font-medium text-slate-500">Members</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50">
                  {statusCounts.paid} Paid
                </Badge>
                <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50">
                  {statusCounts.approved} Approved
                </Badge>
              </div>
            </div>
          </div>

          {/* Pending Actions */}
          <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 hover:bg-white/90 hover:shadow-lg transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <AlertCircle className="w-24 h-24 text-rose-500" />
            </div>
            <div className="relative">
              <p className="text-slate-500 font-medium mb-1">Pending Actions</p>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-3xl font-bold text-slate-900">{statusCounts.draft + statusCounts.locked}</span>
                <span className="text-sm font-medium text-slate-500">Tasks</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="border-rose-200 text-rose-600 bg-rose-50">
                  {statusCounts.draft} Draft
                </Badge>
                <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50">
                  {statusCounts.locked} Locked
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white/50 backdrop-blur-lg border border-slate-200 p-1 rounded-2xl inline-flex">
            <TabsTrigger
              value="management"
              className="px-8 py-3 rounded-xl text-slate-500 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg active:scale-95 transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Payroll Management</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="policies"
              className="px-8 py-3 rounded-xl text-slate-500 data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg active:scale-95 transition-all duration-200"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Salary Policies</span>
              </div>
            </TabsTrigger>
          </TabsList>

          {/* Payroll Management Tab */}
          <TabsContent value="management" className="space-y-6">
            {/* Enhanced Control Panel */}
            <Card className="bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Month Selector */}
                  <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-2 border border-slate-200">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setSelectedRecords([]);
                      }}
                      className="w-48 bg-transparent border-none text-slate-900 font-semibold focus-visible:ring-0"
                    />
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 font-medium h-12 rounded-xl focus-visible:ring-indigo-500"
                    />
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44 bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl font-semibold">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="locked">Locked</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode */}
                  <Select value={viewMode} onValueChange={setViewMode}>
                    <SelectTrigger className="w-36 bg-slate-50 border-slate-200 text-slate-900 h-12 rounded-xl font-semibold">
                      <Eye className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      <SelectItem value="cards">Cards</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Actions */}
                  <div className="flex gap-2 ml-auto">
                    {/* Pending Requests Button */}
                    {allAdjustments.filter(a => a.status === 'pending').length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => { /* TODO: Open Review Dialog */ setReviewDialogOpen(true); }}
                        className="gap-2 bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 h-12 rounded-xl font-semibold hover:text-rose-700 transition-colors animate-pulse"
                      >
                        <AlertCircle className="w-4 h-4" />
                        Requests ({allAdjustments.filter(a => a.status === 'pending').length})
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!confirm(`Clean up duplicate attendance records for ${selectedMonth}?`)) return;
                        try {
                          const result = await base44.functions.invoke('cleanupDuplicateAttendance', {
                            month: selectedMonth
                          });
                          if (result.data.deleted > 0) {
                            await queryClient.refetchQueries(['attendance-records-salary']);
                            await recalculateMutation.mutate();
                            toast.success(`Cleaned up ${result.data.deleted} duplicate records`);
                          } else {
                            toast.info('No duplicates found');
                          }
                        } catch (error) {
                          toast.error('Cleanup failed: ' + error.message);
                        }
                      }}
                      className="gap-2 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 h-12 rounded-xl font-semibold hover:text-orange-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Cleanup
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => recalculateMutation.mutate()}
                      disabled={recalculateMutation.isPending || isCalculating}
                      className="gap-2 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 h-12 rounded-xl font-semibold hover:text-indigo-600 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                      Recalculate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRulesDialogOpen(true)}
                      className="gap-2 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 h-12 rounded-xl font-semibold hover:text-indigo-600 transition-colors"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Attendance Rules
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportCSVMutation.mutate()}
                      className="gap-2 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 h-12 rounded-xl font-semibold hover:text-emerald-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleExportPDF}
                    className="gap-2 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 h-12 rounded-xl font-semibold hover:text-blue-600 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Export PDF
                  </Button>
                </div>

                {/* Bulk Actions */}
                {selectedRecords.length > 0 && (
                  <div className="mt-4 flex items-center justify-between bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedRecords.length === filteredSalaries.length}
                        onCheckedChange={handleSelectAll}
                        className="border-indigo-400 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      />
                      <Badge className="bg-indigo-600 text-white text-base px-4 py-2 font-bold shadow-lg shadow-indigo-500/20">
                        {selectedRecords.length} Selected
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setLockDialogOpen(true)}
                        className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold"
                      >
                        <Lock className="w-4 h-4" />
                        Lock
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!confirm(`Unlock selected salary records?`)) return;
                          for (const id of selectedRecords) {
                            await base44.entities.SalaryRecord.update(id, { locked: false });
                          }
                          queryClient.invalidateQueries(['salary-records']);
                          setSelectedRecords([]);
                          toast.success('Salaries unlocked successfully');
                        }}
                        className="gap-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold"
                      >
                        Unlock
                      </Button>
                      <Button
                        onClick={() => approveMutation.mutate(selectedRecords)}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold shadow-lg shadow-blue-500/20"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => markAsPaidMutation.mutate(selectedRecords)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-lg shadow-emerald-500/20"
                      >
                        <DollarSign className="w-4 h-4" />
                        Mark Paid
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Salary List */}
            {salariesLoading ? (
              <div className="text-center py-16">
                <RefreshCw className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-400 font-medium">Loading payroll data...</p>
              </div>
            ) : filteredSalaries.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl">
                <CardContent className="p-16 text-center">
                  <AlertCircle className="w-20 h-20 text-slate-300 mx-auto mb-6" />
                  <h3 className="text-2xl font-bold text-slate-700 mb-2">No Records Found</h3>
                  <p className="text-slate-500 font-medium">
                    {salaries.length === 0
                      ? 'Click "Recalculate" to generate salary records from attendance data'
                      : 'No records match your search criteria'}
                  </p>
                </CardContent>
              </Card>
            ) : viewMode === 'cards' ? (
              <div className="space-y-6">
                {filteredSalaries.map((salary) => {
                  const calc = calculateEmployeeSalary(salary.employee_email);
                  const isExpanded = expandedRows[salary.id];

                  if (!calc.hasPolicy) {
                    return (
                      <Card key={salary.id} className="bg-amber-50 border border-amber-200 shadow-md">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <AlertCircle className="w-8 h-8 text-amber-500" />
                            <div>
                              <h3 className="font-bold text-lg text-slate-900">{salary.employee_name}</h3>
                              <p className="text-amber-600 font-medium">No active salary policy found</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card key={salary.id} className="group bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden">
                      {/* Hover Gradient Effect */}
                      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/50 rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <CardContent className="p-6 relative">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedRecords.includes(salary.id)}
                            onCheckedChange={() => handleSelectRecord(salary.id)}
                            disabled={salary.locked}
                            className="mt-2 border-slate-600 data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500"
                          />

                          <div className="flex-1">
                            {/* Employee Header */}
                            <div className="flex items-center justify-between mb-8">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20">
                                  {salary.employee_name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">{salary.employee_name}</h3>
                                  <p className="text-sm text-slate-500 font-medium">{getUserName(salary.employee_email)}</p>
                                </div>
                                <Badge className={
                                  salary.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                    salary.status === 'approved' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                      salary.status === 'locked' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        'bg-slate-100 text-slate-600 border border-slate-200'
                                }>
                                  {salary.locked && <Lock className="w-3 h-3 mr-1" />}
                                  {salary.status?.toUpperCase()}
                                </Badge>
                              </div>

                              <div className="text-right">
                                <p className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">NET SALARY</p>
                                <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                                  ₹{calc.net.toLocaleString()}
                                </p>

                                <div className="mt-4 flex items-center justify-end gap-3 text-sm">
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Monthly CTC</p>
                                    <p className="font-bold text-indigo-600">₹{calc.monthlyCTC1.toLocaleString()}</p>
                                  </div>
                                  <div className="w-px h-8 bg-slate-200 mx-1" />
                                  <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Yearly CTC</p>
                                    <p className="font-bold text-purple-600">₹{calc.yearlyCTC1.toLocaleString()}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Attendance Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Present</p>
                                <p className="text-2xl font-bold text-slate-900">{calc.effectivePresent}</p>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-[10px] font-bold text-rose-600 uppercase mb-1">Unpaid Absent</p>
                                <p className="text-2xl font-bold text-slate-900">{calc.unpaidAbsent}</p>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Week Off</p>
                                <p className="text-2xl font-bold text-slate-900">{calc.weekoff}</p>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-[10px] font-bold text-purple-600 uppercase mb-1">Paid Leave</p>
                                <p className="text-2xl font-bold text-slate-900">{calc.paidLeave}</p>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-[10px] font-bold text-sky-600 uppercase mb-1">Half Day</p>
                                <p className="text-2xl font-bold text-slate-900">{calc.halfDay}</p>
                              </div>
                              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Not Marked</p>
                                <p className="text-2xl font-bold text-slate-900">{calc.notMarked}</p>
                              </div>
                            </div>

                            {/* Salary Breakdown */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                              <div className="relative overflow-hidden bg-slate-50 rounded-2xl p-5 border border-slate-200 group/card hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="p-2 bg-blue-100 rounded-lg">
                                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Base Salary</p>
                                </div>
                                <p className="text-3xl font-bold text-slate-900 tracking-tight">₹{calc.baseSalary.toLocaleString()}</p>
                                <div className="mt-3 w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                  <div className="bg-blue-600 h-full rounded-full" style={{ width: `${(calc.paidDays / calc.totalDays) * 100}%` }} />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 font-medium">{calc.paidDays} payable days</p>
                              </div>

                              <div className="relative overflow-hidden bg-slate-50 rounded-2xl p-5 border border-slate-200 group/card hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="p-2 bg-amber-100 rounded-lg">
                                    <Zap className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Adjustments</p>
                                </div>
                                <p className="text-3xl font-bold text-slate-900 tracking-tight">₹{calc.adjustments.toLocaleString()}</p>
                                <div className="mt-3 w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                  <div className="bg-amber-500 h-full rounded-full" style={{ width: '100%' }} />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 font-medium">Incentives & Bonus</p>
                              </div>

                              <div className="relative overflow-hidden bg-slate-50 rounded-2xl p-5 border border-slate-200 group/card hover:bg-white hover:shadow-md transition-all">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="p-2 bg-rose-100 rounded-lg">
                                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                                  </div>
                                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Deductions</p>
                                </div>
                                <p className="text-3xl font-bold text-slate-900 tracking-tight">₹{calc.totalDeductions.toLocaleString()}</p>
                                <div className="mt-3 w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                  <div className="bg-rose-500 h-full rounded-full" style={{ width: '100%' }} />
                                </div>
                                <p className="text-xs text-slate-500 mt-2 font-medium">PF, ESI & Penalties</p>
                              </div>
                            </div>

                            {/* Expand Button */}
                            <Button
                              variant="ghost"
                              onClick={() => setExpandedRows(prev => ({ ...prev, [salary.id]: !prev[salary.id] }))}
                              className="w-full text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold rounded-xl h-12 mb-4 transition-all"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-5 h-5 mr-2" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-5 h-5 mr-2" />
                                  View Breakdown
                                </>
                              )}
                            </Button>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="space-y-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 mb-6 animate-in slide-in-from-top-4 duration-200">
                                {/* Components */}
                                <div>
                                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                                    Detailed Components
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {calc.earnedBasic > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Basic</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedBasic.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedHra > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">HRA</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedHra.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedTa > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Travel</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedTa.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedCea > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Child Edu</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedCea.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedFi > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Fixed Inc.</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedFi.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.empIncentive > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Emp. Inc.</span>
                                        <span className="font-bold text-slate-900">₹{calc.empIncentive.toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Deductions */}
                                <div>
                                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <TrendingDown className="w-4 h-4 text-rose-500" />
                                    Applied Deductions
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {calc.empPF > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">PF</span>
                                        <span className="font-bold text-rose-600">-₹{Math.round(calc.empPF).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.empESI > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">ESI</span>
                                        <span className="font-bold text-rose-600">-₹{Math.round(calc.empESI).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.lwf > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">LWF</span>
                                        <span className="font-bold text-rose-600">-₹{Math.round(calc.lwf).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.latePenalty > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">Late Penalty</span>
                                        <span className="font-bold text-rose-600">-₹{Math.round(calc.latePenalty).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.absentDeduction > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">Absent</span>
                                        <span className="font-bold text-rose-600">-₹{calc.absentDeduction.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.attendanceAdjustments < 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">Attendance</span>
                                        <span className="font-bold text-rose-600">-₹{Math.abs(calc.attendanceAdjustments).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {salary?.advance_recovery > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">Adv. Recov</span>
                                        <span className="font-bold text-rose-600">-₹{salary.advance_recovery.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {salary?.other_deductions > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200">
                                        <span className="text-slate-500 text-sm">Other</span>
                                        <span className="font-bold text-rose-600">-₹{salary.other_deductions.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.timesheetPenaltyDeduction > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-rose-200 col-span-2 md:col-span-3">
                                        <div className="flex items-center gap-2">
                                          <AlertCircle className="w-4 h-4 text-rose-500" />
                                          <span className="text-slate-500 text-sm">Timesheet Non-submission Penalty</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className="font-bold text-rose-600">-₹{Math.round(calc.timesheetPenaltyDeduction).toLocaleString()}</span>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 text-xs text-indigo-600 hover:text-indigo-800"
                                            onClick={() => {
                                              // Open Dialog to raise ticket
                                              // We need to pass the date of penalty. 
                                              // Since calc.timesheetPenaltyDeduction is aggregate, we should ideally show individual penalties or just pick the first one?
                                              // To keep UI simple, let's assume one button raises tickets for ALL found penalties or list them?
                                              // Actually, let's pass all penaltyDetails to the dialog and let user select or auto-create for all.
                                              setSelectedPenalty({ details: calc.penaltyDetails, employee: salary });
                                              setTicketDialogOpen(true);
                                            }}
                                          >
                                            Raise Ticket
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Daily Attendance Details */}
                                <div className="mt-6">
                                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    Daily Attendance Details
                                  </h4>
                                  <DailyAttendanceDetails
                                    dailyDetails={calc.dailyDetails}
                                    employeeAdjustments={calc.employeeAdjustments}
                                    salaryRecord={salary}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentRecord(salary);
                                  setAdjustmentDialogOpen(true);
                                }}
                                className="bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Adjustment
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(salary.employee_email);
                                  setAdvanceDialogOpen(true);
                                }}
                                className="bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg"
                              >
                                <Wallet className="w-4 h-4 mr-2" />
                                Advance
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateSlipMutation.mutate(salary.id)}
                                disabled={generateSlipMutation.isPending}
                                className="bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Slip
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => emailSlipMutation.mutate(salary.id)}
                                disabled={emailSlipMutation.isPending}
                                className="bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg"
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Email
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(salary.employee_email);
                                  setHistoryDialogOpen(true);
                                }}
                                className="bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg"
                              >
                                <History className="w-4 h-4 mr-2" />
                                History
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Delete ${salary.employee_name}'s record?`)) {
                                    deleteSalaryMutation.mutate(salary.id);
                                  }
                                }}
                                disabled={salary.locked}
                                className="bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg ml-auto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              // Compact View
              <Card className="bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl">
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left p-3 font-bold text-slate-500">
                            <Checkbox checked={selectedRecords.length === filteredSalaries.length} onCheckedChange={handleSelectAll} className="border-slate-300 data-[state=checked]:bg-indigo-600" />
                          </th>
                          <th className="text-left p-3 font-bold text-slate-500">Employee</th>
                          <th className="text-center p-3 font-bold text-slate-500">Attendance</th>
                          <th className="text-right p-3 font-bold text-slate-500">Base</th>
                          <th className="text-right p-3 font-bold text-slate-500">Adjustments</th>
                          <th className="text-right p-3 font-bold text-slate-500">Deductions</th>
                          <th className="text-right p-3 font-bold text-slate-500">Net</th>
                          <th className="text-center p-3 font-bold text-slate-500">Status</th>
                          <th className="text-center p-3 font-bold text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalaries.map((salary) => {
                          const calc = calculateEmployeeSalary(salary.employee_email);
                          return (
                            <tr key={salary.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="p-3">
                                <Checkbox
                                  checked={selectedRecords.includes(salary.id)}
                                  onCheckedChange={() => handleSelectRecord(salary.id)}
                                  disabled={salary.locked}
                                  className="border-slate-300 data-[state=checked]:bg-indigo-600"
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{salary.employee_name}</div>
                                <div className="text-xs text-slate-500">{salary.employee_email}</div>
                              </td>
                              <td className="p-3 text-center">
                                <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold">{calc.effectivePresent}P</Badge>
                                <Badge className="bg-rose-50 text-rose-600 border border-rose-200 font-bold ml-1">{calc.unpaidAbsent}A</Badge>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-600">₹{calc.baseSalary.toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-amber-600">+₹{calc.adjustments.toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-rose-600">-₹{calc.totalDeductions.toLocaleString()}</td>
                              <td className="p-3 text-right font-black text-emerald-600 text-lg">₹{calc.net.toLocaleString()}</td>
                              <td className="p-3 text-center">
                                <Badge className={
                                  salary.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                    salary.status === 'approved' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                      salary.status === 'locked' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                        'bg-slate-100 text-slate-600 border border-slate-200'
                                }>
                                  {salary.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1 justify-center">
                                  <Button size="sm" variant="ghost" onClick={() => { setCurrentRecord(salary); setAdjustmentDialogOpen(true); }} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => generateSlipMutation.mutate(salary.id)} className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div >
                </CardContent >
              </Card >
            )
            }
          </TabsContent >

          {/* Policies Tab */}
          < TabsContent value="policies" className="space-y-6" >
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingPolicy(null);
                  setPolicyFormOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-500/20 h-12 px-6 rounded-xl font-bold text-lg"
              >
                <Plus className="w-5 h-5" />
                Create New Policy
              </Button>
            </div>

            <div className="grid gap-6">
              {policiesLoading ? (
                <div className="text-center py-16">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">Loading policies...</p>
                </div>
              ) : policies.length === 0 ? (
                <Card className="bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl">
                  <CardContent className="p-16 text-center">
                    <Settings className="w-20 h-20 text-slate-300 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-slate-700 mb-2">No Policies Found</h3>
                    <p className="text-slate-500 font-medium mb-6">Create your first salary policy to get started</p>
                    <Button onClick={() => setPolicyFormOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Policy
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                policies.map((policy) => {
                  const user = allUsers.find(u => u.email === policy.user_email);
                  const monthlyGross = (policy.basic_salary || 0) + (policy.hra || 0) +
                    (policy.travelling_allowance || 0) + (policy.children_education_allowance || 0) +
                    (policy.fixed_incentive || 0);

                  return (
                    <Card key={policy.id} className="group bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-6 flex-1">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20">
                              {user?.full_name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-slate-900">{user?.full_name || 'Unknown'}</h3>
                                <Badge className={policy.is_active ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}>
                                  {policy.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500 font-medium">{policy.user_email}</p>

                              <div className="grid grid-cols-3 gap-4 mt-6">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                  <p className="text-[10px] text-indigo-600 font-bold uppercase mb-1">Monthly Gross</p>
                                  <p className="text-xl font-bold text-slate-900">₹{monthlyGross.toLocaleString()}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                  <p className="text-[10px] text-purple-600 font-bold uppercase mb-1">Type</p>
                                  <p className="text-lg font-bold text-slate-900 capitalize">{policy.salary_type?.replace('_', ' ')}</p>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                  <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Status</p>
                                  <p className="text-lg font-bold text-slate-900">{policy.is_active ? 'Active' : 'Inactive'}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingPolicy(policy);
                                setPolicyFormOpen(true);
                              }}
                              className="border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl"
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Delete this policy?')) {
                                  deletePolicyMutation.mutate(policy.id);
                                }
                              }}
                              className="border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent >
        </Tabs >
      </div >

      {/* Dialogs */}
      < SalaryAdjustmentDialog
        isOpen={adjustmentDialogOpen}
        onClose={() => {
          setAdjustmentDialogOpen(false);
          setCurrentRecord(null);
        }}
        salaryRecord={currentRecord}
        currentUser={user}
      />

      <SalaryLockDialog
        isOpen={lockDialogOpen}
        onClose={() => setLockDialogOpen(false)}
        salaryRecords={salaries.filter(s => selectedRecords.includes(s.id))}
        currentUser={user}
      />

      <SalaryPolicyForm
        isOpen={policyFormOpen}
        onClose={() => {
          setPolicyFormOpen(false);
          setEditingPolicy(null);
        }}
        policy={editingPolicy}
        allUsers={allUsers}
        leaveTypes={leaveTypes}
      />

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Salary History</DialogTitle>
            <DialogDescription>View past salary records for {getUserName(selectedEmployee)}</DialogDescription>
          </DialogHeader>
          <SalaryHistoryView employeeEmail={selectedEmployee} />
        </DialogContent>
      </Dialog>

      <AdvanceManagementDialog
        isOpen={advanceDialogOpen}
        onClose={() => {
          setAdvanceDialogOpen(false);
          setSelectedEmployee(null);
        }}
        employeeEmail={selectedEmployee}
        currentUser={user}
        allUsers={allUsers}
        onAdvanceCreated={() => recalculateMutation.mutate()}
      />

      <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
              Attendance Timing Rules
            </DialogTitle>
            <DialogDescription>
              Salary deductions are applied based on check-in and check-out times according to these mandatory rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Check-In Rules (Expected: 10:00 AM)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-200">
                  <span>10:01 AM - 11:00 AM</span>
                  <span className="font-semibold text-red-700">Deduct 25% of daily salary</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-200">
                  <span>11:01 AM - 12:00 PM</span>
                  <span className="font-semibold text-red-700">Deduct 50% of daily salary</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-200">
                  <span>12:01 PM - 2:00 PM</span>
                  <span className="font-semibold text-red-700">Deduct 50% of daily salary</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-200">
                  <span>2:01 PM - 4:00 PM</span>
                  <span className="font-semibold text-red-700">Pay only 25% of daily salary (75% deduction)</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-red-50 rounded-lg border border-red-200">
                  <span>4:01 PM - 6:00 PM</span>
                  <span className="font-semibold text-red-700">Deduct 100% of daily salary</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-3">Check-Out Rules (Only if check-in ≤10:00 AM)</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span>Before 2:00 PM</span>
                  <span className="font-semibold text-orange-700">Deduct 100% of daily salary</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span>2:01 PM - 5:00 PM</span>
                  <span className="font-semibold text-orange-700">Deduct 50% of daily salary</span>
                </div>
                <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded-lg border border-orange-200">
                  <span>5:01 PM - 6:00 PM</span>
                  <span className="font-semibold text-orange-700">Deduct 25% of daily salary</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-slate-900 mb-2">Additional Information</h4>
              <ul className="text-sm text-slate-700 space-y-1">
                <li>• Daily salary = (Basic + HRA + Travel + Child Edu + Fixed Incentive + Employer Incentive) ÷ Calendar days</li>
                <li>• Late penalty: Late days × Per minute rate × 10 (from salary policy)</li>
                <li>• First absent day is paid, additional absents are deducted prorated</li>
                <li>• Leave, half-day, weekoff, holiday: Paid as applicable</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}

// Daily Attendance Details Component
function DailyAttendanceDetails({ dailyDetails, employeeAdjustments = [], salaryRecord = null }) {
  // Filter out days with no changes (adjustment === 0)
  const filteredDailyDetails = dailyDetails.filter(detail => detail.adjustment !== 0);

  // Create adjustment details from SalaryAdjustment entity
  const adjustmentDetails = employeeAdjustments.map((adj, index) => ({
    id: `adj-${index}`,
    date: 'Monthly Adjustment',
    status: adj.adjustment_type,
    checkIn: null,
    checkOut: null,
    adjustment: adj.adjustment_type === 'penalty' || adj.adjustment_type === 'deduction' ? -Math.abs(adj.amount) : adj.amount,
    reason: adj.description || `${adj.adjustment_type} adjustment`,
    isAdjustment: true
  }));

  // Combine and sort by date (adjustments at end if no specific date)
  const allDetails = [
    ...filteredDailyDetails,
    ...adjustmentDetails
  ].sort((a, b) => {
    if (a.date === 'Monthly Adjustment' && b.date !== 'Monthly Adjustment') return 1;
    if (b.date === 'Monthly Adjustment' && a.date !== 'Monthly Adjustment') return -1;
    return a.date.localeCompare(b.date);
  });

  if (!allDetails || allDetails.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">No attendance adjustments or salary changes</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        {allDetails.map((detail, index) => (
          <Card key={detail.id || index} className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="text-sm font-bold text-slate-700">{detail.date}</p>
                    {!detail.isAdjustment ? (
                      <Badge className={
                        detail.status === 'present' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                          detail.status === 'checked_out' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            detail.status === 'absent' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                              detail.status === 'work_from_home' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                'bg-slate-100 text-slate-600 border border-slate-200'
                      }>
                        {detail.status?.replace('_', ' ').toUpperCase()}
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
                        {detail.status?.toUpperCase()}
                      </Badge>
                    )}
                  </div>

                  {!detail.isAdjustment ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 font-medium">Check-in</p>
                        <p className="text-slate-900 font-semibold">{detail.checkIn || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-medium">Check-out</p>
                        <p className="text-slate-900 font-semibold">{detail.checkOut || 'N/A'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <p className="text-slate-500 font-medium">Type</p>
                      <p className="text-slate-900 font-semibold capitalize">{detail.status?.replace('_', ' ')}</p>
                    </div>
                  )}

                  {detail.reason && (
                    <p className="text-xs text-slate-500 mt-2">{detail.reason}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${detail.adjustment > 0 ? 'text-emerald-600' : detail.adjustment < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                    {detail.adjustment > 0 ? '+' : ''}₹{Math.abs(detail.adjustment).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500 uppercase">
                    {detail.adjustment > 0 ? 'Addition' : 'Deduction'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Salary History Component
function SalaryHistoryView({ employeeEmail }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['salary-history', employeeEmail],
    queryFn: () => base44.entities.SalaryRecord.filter(
      { employee_email: employeeEmail },
      '-month'
    ),
    enabled: !!employeeEmail
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Loading history...</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-500 font-medium">No salary history found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((record) => (
        <Card key={record.id} className="bg-white border border-slate-200 shadow-lg hover:shadow-indigo-500/10 transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-2xl font-bold text-slate-900 mb-2">{record.month}</h4>
                <Badge className={
                  record.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    record.status === 'approved' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                      'bg-slate-100 text-slate-600 border border-slate-200'
                }>
                  {record.status?.toUpperCase()}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-slate-500 mb-1 uppercase">NET SALARY</p>
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                  ₹{(record.net_salary || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-[10px] text-indigo-600 font-bold uppercase">Gross</p>
                <p className="text-2xl font-bold text-slate-900">₹{(record.gross_salary || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-[10px] text-rose-600 font-bold uppercase">Deductions</p>
                <p className="text-2xl font-bold text-slate-900">₹{(record.total_deductions || 0).toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-[10px] text-emerald-600 font-bold uppercase">Present</p>
                <p className="text-2xl font-bold text-slate-900">{record.present_days || 0}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-[10px] text-amber-600 font-bold uppercase">Absent</p>
                <p className="text-2xl font-bold text-slate-900">{record.absent_days || 0}</p>
              </div>
            </div>

            {record.payment_date && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="font-semibold">Paid on: {format(new Date(record.payment_date), 'dd MMM yyyy')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      <TicketDialog
        open={ticketDialogOpen}
        onOpenChange={setTicketDialogOpen}
        selectedPenalty={selectedPenalty}
        ticketReason={ticketReason}
        setTicketReason={setTicketReason}
        onDateChange={(val) => setSelectedPenalty(prev => ({ ...prev, selectedDate: val }))}
        onSubmit={() => {
          if (!selectedPenalty?.selectedDate || !ticketReason) return toast.error('Please select date and provide reason');
          createTicketMutation.mutate({
            date: selectedPenalty.selectedDate,
            reason: ticketReason,
            employee_email: selectedPenalty.employee.employee_email
          });
        }}
        isPending={createTicketMutation.isPending}
      />

      <ReviewRequestsDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        requests={allAdjustments.filter(a => a.status === 'pending')}
        onApprove={(id) => approveRequestMutation.mutate(id)}
        onReject={(id) => rejectRequestMutation.mutate(id)}
      />
    </div>
  );
}

function ReviewRequestsDialog({ open, onOpenChange, requests, onApprove, onReject }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pending Adjustments & Tickets</DialogTitle>
          <DialogDescription>Review and approve salary adjustments and penalty waivers.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {requests.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No pending requests.</div>
          ) : (
            requests.map(req => (
              <div key={req.id} className="flex items-start justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={req.adjustment_type === 'penalty_waiver' ? 'outline' : 'default'} className="uppercase text-[10px]">
                      {req.adjustment_type.replace('_', ' ')}
                    </Badge>
                    <span className="font-bold text-slate-900">{req.employee_email}</span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{req.reason || 'No reason provided'}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {req.date}</span>
                    {req.amount !== 0 && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ₹{req.amount}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-rose-600 hover:bg-rose-50" onClick={() => onReject(req.id)}>Reject</Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(req.id)}>Approve</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Separate component for Ticket Dialog to avoid clutter if preferred, but keeping inline for now
function TicketDialog({ open, onOpenChange, selectedPenalty, ticketReason, setTicketReason, onSubmit, isPending, onDateChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise Penalty Dispute Ticket</DialogTitle>
          <DialogDescription>
            Request a waiver for the timesheet non-submission penalty.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Penalty</label>
            {(selectedPenalty?.details?.length > 0) ? (
              <Select onValueChange={(val) => onDateChange(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Date" />
                </SelectTrigger>
                <SelectContent>
                  {selectedPenalty.details.map((p, i) => (
                    <SelectItem key={i} value={p.date}>
                      {p.date} - {p.reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-slate-500">No penalties found to dispute.</p>
            )}

          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reason for Delay/Waiver</label>
            <Textarea
              placeholder="Explain why timesheet was not submitted on time..."
              value={ticketReason}
              onChange={e => setTicketReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSubmit}
            disabled={isPending}
          >
            Submit Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
