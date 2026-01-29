import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
  EyeOff,
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
  const [hideNoPolicyUsers, setHideNoPolicyUsers] = useState(false);

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
    if (user) {
      const isSuperAdmin = user.role_id === 'super_admin';
      const isAdminRole = user.role === 'admin' || user.role_id === 'admin';

      // If user is clearly an admin via role, grant access immediately
      if (isSuperAdmin || isAdminRole) {
        setIsHRMember(true);
        return;
      }

      // Check Departments
      if (Array.isArray(departments) && departments.length > 0) {
        const hrDept = departments.find(d => d.name?.toLowerCase().includes('hr') || d.name?.toLowerCase().includes('human resource'));
        const adminDept = departments.find(d => d.name?.toLowerCase().includes('administration') || d.name?.toLowerCase() === 'admin');

        const isHRDept = user.department_id && hrDept && user.department_id === hrDept.id;
        const isAdminDept = user.department_id && adminDept && user.department_id === adminDept.id;

        setIsHRMember(isHRDept || isAdminDept);
      }
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

  const { data: gracePeriods = [] } = useQuery({
    queryKey: ['grace-periods', selectedMonth],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMonthlyGracePeriods', { month: selectedMonth });
      return res.data || [];
    },
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
    if (!Array.isArray(usersList)) return [];
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
      const salariesArr = Array.isArray(salaries) ? salaries : [];
      const salary = salariesArr.find(s => s.id === recordId);
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
      // Fetch user details for Designation, DOJ, etc.
      const usersList = await base44.entities.User.list();

      const headers = [
        'Name', 'Designation', 'Department', 'DOJ', 'Total Working Days', 'Present',
        'Weekoff days', 'Leave Days', 'Absent', 'Paid Days', 'Policy Gross',
        'Absent Deduction', 'Basic', 'DA', 'HRA', 'TA', 'CEA', 'FI',
        'Gross Salary', 'Salary Advanced (Minus)', 'Performance Allowance (Addition)',
        'ESI', 'PF', 'Labour Welfare Fund', 'Employee Total Deduction', 'Net Salary In hand',
        'Gratuity', 'ESI.1', 'PF.1', 'LWF', 'Total Employer Contribution',
        'CTC (based on NetSalary)', 'Employer Contribution (CTC)', 'CTC1', 'CTC Final'
      ];

      const rows = filteredSalaries
        .filter(s => {
          const calc = calculateEmployeeSalary(s.employee_email);
          return calc.hasPolicy;
        })
        .map(s => {
          const calc = calculateEmployeeSalary(s.employee_email);
          const userDetails = usersList.find(u => u.email === s.employee_email);
          const departmentName = departments.find(d => d.id === userDetails?.department_id)?.name || 'N/A';

          // Employer Contributions
          const employerContribution = (calc.employerPF || 0) + (calc.employerESI || 0) + (calc.employerLWF || 0);

          // CTC Calculations
          const ctcFinal = (calc.monthlyCTC2 || 0);

          return [
            s.employee_name,
            userDetails?.job_title || userDetails?.designation || userDetails?.role || 'N/A',
            departmentName,
            userDetails?.joining_date ? format(new Date(userDetails.joining_date), 'yyyy-MM-dd') : 'N/A',
            calc.totalDays,
            calc.effectivePresent,
            calc.weekoff,
            calc.paidLeave,
            calc.absent,
            calc.paidDays,
            (calc.monthlyCTC1 || 0),
            calc.absentDeduction,
            calc.earnedBasic,
            0,
            calc.earnedHra,
            calc.earnedTa,
            calc.earnedCea,
            calc.earnedFi,
            calc.gross,
            (s.advance_recovery || 0),
            (calc.adjustments > 0 ? calc.adjustments : 0),
            calc.empESI,
            calc.empPF,
            calc.lwf,
            calc.totalDeductions,
            calc.net,
            calc.exGratia,
            calc.employerESI,
            calc.employerPF,
            calc.employerLWF,
            employerContribution,
            (calc.net + calc.totalDeductions + employerContribution),
            employerContribution,
            (calc.monthlyCTC1 || 0),
            ctcFinal
          ];
        });

      // Calculate Totals Row - ONLY for Base Salary, Earned Salary, and Net Pay
      const totalRow = new Array(headers.length).fill('');
      totalRow[0] = 'TOTAL';

      // Target Indices: 10 (Policy Gross), 18 (Gross Salary), 25 (Net Salary)
      const targetIndices = [10, 18, 25];

      targetIndices.forEach(i => {
        const total = rows.reduce((sum, row) => {
          const val = parseFloat(row[i]);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
        totalRow[i] = Math.round(total * 100) / 100;
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const val = (cell === null || cell === undefined) ? '' : cell;
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')),
        totalRow.map(cell => {
          const val = (cell === null || cell === undefined) ? '' : cell;
          return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `salary_detailed_${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Detailed CSV exported successfully'),
    onError: (e) => toast.error('Export failed: ' + e.message)
  });

  const exportDetailedCSVMutation = useMutation({
    mutationFn: async () => {
      // Prepare Header Rows for Excel
      // We want 'BASE SALARY' at col 9 (index 9) to merge 9-14 (6 cols)
      // We want 'EARNED SALARY' at col 15 (index 15) to merge 15-21 (7 cols)
      const headerRow1 = [
        '', '', '', '', '', '', '', '', '', // 0-8 empty
        'BASE SALARY', '', '', '', '', '', // 9 is Base Salary, 10-14 empty
        'EARNED SALARY', '', '', '', '', '', '', // 15 is Earned Salary, 16-21 empty
        'DEDUCTIONS', '', '', '', // 22-25 Deductions
        'NET PAY'
      ];

      // Row 2: Detailed Headers
      const headerRow2 = [
        '', // 0
        'Name', // 1
        'Designation', // 2
        'Department', // 3 (NEW)
        'DOJ', // 4
        'Base Days', // 5
        'Leave Taken', // 6
        'Leave Deduction Days', // 7
        'Effective days', // 8
        // Base Salary Group (9-14)
        'Minimum Wages (BASIC+DA)', 'HRA', 'Conveyance', 'Special Allowance', 'Other Allowance', 'Total',
        // Earned Salary Group (15-21)
        'Minimum Wages (BASIC+DA)', 'HRA', 'Conveyance', 'Special Allowance', 'Other Allowance',
        'Performance Allowance', // Index 20
        'Net Amount', // Gross (Index 21)
        // Deductions & Payables
        'ESI@.75%', 'EPF', 'LWF',
        'Advance Deduction', // Index 25
        'Net Salary Payables' // (Index 26)
      ];

      const rows = filteredSalaries
        .filter(s => {
          const calc = calculateEmployeeSalary(s.employee_email);
          return calc.hasPolicy;
        })
        .map(s => {
          const calc = calculateEmployeeSalary(s.employee_email);
          const policy = calc.policy || {};
          const user = allUsers.find(u => u.email === s.employee_email) || {};

          const baseOther = (policy.other_allowance || 0) +
            (policy.travelling_allowance || 0) +
            (policy.children_education_allowance || 0) +
            (policy.fixed_incentive || 0) +
            (policy.employer_incentive || 0);

          const earnedOther = (calc.earnedOther || 0) +
            (calc.earnedTa || 0) +
            (calc.earnedCea || 0) +
            (calc.earnedFi || 0) +
            (calc.empIncentive || 0);

          const baseTotal = (policy.basic_salary || 0) + (policy.hra || 0) + (policy.conveyance_allowance || 0) + (policy.special_allowance || 0) + baseOther;

          const dept = departments.find(d => d.id === user.department_id || d._id === user.department_id);
          const deptName = dept?.name || 'N/A';

          return [
            '',
            s.employee_name,
            user.job_title || user.designation || 'N/A',
            deptName,
            user.joining_date ? format(new Date(user.joining_date), 'yyyy-MM-dd') : 'N/A',
            calc.totalDays,
            calc.originalPaidLeave || 0,
            calc.unpaidAbsent || 0,
            calc.paidDays,
            // Base
            policy.basic_salary || 0,
            policy.hra || 0,
            policy.conveyance_allowance || 0,
            policy.special_allowance || 0,
            baseOther,
            baseTotal,
            // Earned
            calc.earnedBasic,
            calc.earnedHra,
            calc.earnedConv,
            calc.earnedSpecial,
            earnedOther,
            calc.positiveAdjustments, // Performance Allowance
            calc.gross, // Gross
            // Deductions
            calc.empESI,
            calc.empPF,
            calc.lwf,
            calc.negativeAdjustments, // Advance Deduction
            // Net
            calc.net
          ];
        });

      // Calculate Totals Row for Detailed Excel - ONLY for Base Total, Gross, and Net
      const totalRowExcel = new Array(headerRow2.length).fill('');
      totalRowExcel[1] = 'TOTAL';

      // Target Indices: 14 (Base Total), 21 (Net Amount/Gross), 26 (Net Salary Payables)
      const targetIndicesExcel = [14, 21, 26];

      targetIndicesExcel.forEach(i => {
        const total = rows.reduce((sum, row) => {
          const val = parseFloat(row[i]);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
        totalRowExcel[i] = Math.round(total * 100) / 100;
      });

      // Combine all data
      const data = [headerRow1, headerRow2, ...rows, totalRowExcel];

      // Create Workskeet
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Define Merges
      ws['!merges'] = [
        { s: { r: 0, c: 9 }, e: { r: 0, c: 14 } }, // BASE SALARY (6 cols)
        { s: { r: 0, c: 15 }, e: { r: 0, c: 21 } }, // EARNED SALARY (7 cols)
        { s: { r: 0, c: 22 }, e: { r: 0, c: 25 } }  // DEDUCTIONS (4 cols)
      ];

      // Create Workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Salary Register");

      // Write and Download
      XLSX.writeFile(wb, `salary_register_${selectedMonth}.xlsx`);
    },
    onSuccess: () => toast.success('Salary Register (Excel) exported successfully'),
    onError: (e) => toast.error('Export failed: ' + e.message)
  });

  const numberToWords = (n) => {
    if (n < 0) return false;
    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const formatTenth = (n) => {
      const s = n.toString();
      let word = '';
      if (s[0] === '0') return '';
      if (parseInt(s) < 10) return single[parseInt(s)];
      if (parseInt(s) < 20) return double[parseInt(s) - 10];
      word += tens[parseInt(s[0])];
      if (s[1] !== '0') word += ' ' + single[parseInt(s[1])];
      return word;
    };
    const convert = (n) => {
      if (n < 100) return formatTenth(n);
      if (n < 1000) return single[Math.floor(n / 100)] + ' Hundred ' + (n % 100 !== 0 ? convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand ' + (n % 1000 !== 0 ? convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh ' + (n % 100000 !== 0 ? convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore ' + (n % 10000000 !== 0 ? convert(n % 10000000) : '');
    };
    return (convert(n) + ' Only').trim();
  };

  const downloadPayslip = (salary) => {
    const calc = calculateEmployeeSalary(salary.employee_email);
    const user = allUsers.find(u => u.email === salary.employee_email) || {};
    const policy = calc.policy || {};

    const doc = new jsPDF('p', 'mm', 'a4');

    // 1. Header Section
    // Outer Border
    doc.rect(5, 5, 200, 287); // Page Border

    // Header Content
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Nivesh Sarthi', 105, 15, { align: 'center' }); // Company Name

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const address = "628~630, 6th Floor, Puri 81 Business Hub, Sector 81, Faridabad";
    doc.text(address, 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const monthStr = format(new Date(selectedMonth), 'MMMM yyyy');
    doc.text(`Payslip for the month of ${monthStr}`, 105, 28, { align: 'center' });

    doc.line(5, 32, 205, 32); // Separator line

    // 2. Employee Details Table
    // Left Column Data
    const leftData = [
      ['Name:', `${salary.employee_name} [${user.employee_id || salary.id.slice(0, 6)}]`],
      ['Join Date:', user.joining_date ? format(new Date(user.joining_date), 'dd MMM yyyy') : 'N/A'],
      ['Designation:', user.job_title || user.designation || 'N/A'],
      ['Department:', departments.find(d => d.id === user.department_id)?.name || 'N/A'],
      ['Location:', user.location || 'Faridabad'],
      ['Effective Work Days:', calc.paidDays],
      ['Days In Month:', calc.totalDays],
      ['Leaving Date:', user.leaving_date ? format(new Date(user.leaving_date), 'dd MMM yyyy') : '']
    ];

    const rightData = [
      ['Bank Name:', user.bank_name || 'HDFC Bank'],
      ['Bank Account No:', user.account_number || 'XXXXXXXXXX'],
      ['PF No:', user.pf_account_number || ''],
      ['UAN:', user.uan || ''],
      ['ESI No:', user.esi_number || ''],
      ['PAN No:', user.pan_number || ''],
      ['LOP:', calc.unpaidAbsent] // Loss of Pay days
    ];

    // Render Grid using autoTable for alignment
    // We create a merged data array for 2 columns -> 4 visual columns
    const gridData = [];
    const maxRows = Math.max(leftData.length, rightData.length);
    for (let i = 0; i < maxRows; i++) {
      const left = leftData[i] || ['', ''];
      const right = rightData[i] || ['', ''];
      gridData.push([left[0], left[1], right[0], right[1]]);
    }

    autoTable(doc, {
      startY: 33,
      head: [],
      body: gridData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 1.5, lineColor: 10, lineWidth: 0 },
      columnStyles: {
        0: { fontStyle: 'normal', cellWidth: 35 },
        1: { fontStyle: 'bold', cellWidth: 55 }, // Name/Value
        2: { fontStyle: 'normal', cellWidth: 35 },
        3: { fontStyle: 'bold', cellWidth: 'auto' }
      },
      margin: { left: 10, right: 10 }
    });

    const finalY = doc.lastAutoTable.finalY + 5;
    doc.line(5, finalY, 205, finalY); // Line after details

    // 3. Earnings & Deductions Table

    // Construct Rows
    // Logic: Align Earnings and Deductions side by side.
    const earningsList = [
      { label: 'BASIC', full: policy.basic_salary, actual: calc.earnedBasic },
      { label: 'HRA', full: policy.hra, actual: calc.earnedHra },
      { label: 'CHILDREN EDUCATION ALLOWANCE', full: policy.children_education_allowance, actual: calc.earnedCea },
      { label: 'FIXED INCENTIVE', full: policy.fixed_incentive, actual: calc.earnedFi },
      { label: 'SPECIAL ALLOWANCE', full: policy.special_allowance, actual: calc.earnedSpecial },
      { label: 'CONVEYANCE', full: policy.conveyance_allowance, actual: calc.earnedConv },
      { label: 'OTHER ALLOWANCE', full: policy.other_allowance, actual: calc.earnedOther },
      // Add others if > 0
      ...(calc.earnedTa > 0 ? [{ label: 'TRAVELLING ALLOWANCE', full: policy.travelling_allowance, actual: calc.earnedTa }] : []),
      ...(calc.empIncentive > 0 ? [{ label: 'EMPLOYER INCENTIVE', full: policy.employer_incentive, actual: calc.empIncentive }] : []),
      ...(calc.salesIncentive > 0 ? [{ label: 'SALES INCENTIVE', full: 0, actual: calc.salesIncentive }] : []),
      ...(calc.salesReward > 0 ? [{ label: 'PERFORMANCE REWARD', full: 0, actual: calc.salesReward }] : []),
      // Adjustments (Positive)
      ...(calc.adjustments > 0 ? [{ label: 'ADJUSTMENTS (BONUS/ETC)', full: 0, actual: calc.adjustments }] : [])
    ].filter(e => (e.full > 0 || e.actual > 0)); // Filter empty

    const deductionsList = [
      { label: 'PF', amount: calc.empPF },
      { label: 'ESI', amount: calc.empESI },
      { label: 'LWF', amount: calc.lwf },
      { label: 'PROFESSIONAL TAX', amount: salary.other_deductions }, // Mapping 'other_deductions' to generic or PT
      { label: 'SALARY ADVANCE', amount: salary.advance_recovery },
      { label: 'LATE PENALTY', amount: calc.latePenalty },
      { label: 'ABSENT DEDUCTION', amount: calc.absentDeduction },
      { label: 'ATTENDANCE PENALTY', amount: calc.attendancePenalty },
      { label: 'TIMESHEET PENALTY', amount: calc.timesheetPenaltyDeduction }
    ].filter(d => d.amount > 0);

    const maxTableRows = Math.max(earningsList.length, deductionsList.length);
    const tableBody = [];

    // Totals for Footer
    let totalFullEarnings = 0;
    let totalActualEarnings = 0;
    let totalDeductionsCalc = 0;

    for (let i = 0; i < maxTableRows; i++) {
      const earn = earningsList[i] || { label: '', full: '', actual: '' };
      const ded = deductionsList[i] || { label: '', amount: '' };

      tableBody.push([
        earn.label,
        earn.full ? earn.full.toFixed(2) : '',
        earn.actual ? earn.actual.toFixed(2) : '',
        ded.label,
        ded.amount ? ded.amount.toFixed(2) : ''
      ]);

      if (earn.full) totalFullEarnings += Number(earn.full);
      if (earn.actual) totalActualEarnings += Number(earn.actual);
      if (ded.amount) totalDeductionsCalc += Number(ded.amount);
    }

    // Total Row
    const totalRow = [
      'Total Earnings: Rs.',
      totalFullEarnings.toFixed(2),
      totalActualEarnings.toFixed(2),
      'Total Deductions: Rs.',
      totalDeductionsCalc.toFixed(2)
    ];

    autoTable(doc, {
      startY: finalY, // Start right after the line
      head: [['Earnings', 'Full', 'Actual', 'Deductions', 'Actual']],
      body: tableBody,
      foot: [totalRow],
      theme: 'grid', // Grid theme for borders
      styles: { fontSize: 9, cellPadding: 2, lineColor: 10, lineWidth: 0.1 },
      headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 10 },
      footStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 10 },
      columnStyles: {
        0: { cellWidth: 55 }, // Earnings Label
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 55 }, // Deductions Label
        4: { cellWidth: 25, halign: 'right' }
      },
      margin: { left: 10, right: 10 }
    });

    const tableFinalY = doc.lastAutoTable.finalY + 10;

    // 4. Net Pay Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Pay for the month ( Total Earnings - Total Deductions):       ${calc.net.toFixed(2)}`, 15, tableFinalY);

    doc.setFont('helvetica', 'italic');
    doc.text(`(Rupees ${numberToWords(Math.round(calc.net))} Only)`, 15, tableFinalY + 6);

    // 5. Footer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('This is a system generated payslip and does not require signature.', 105, 280, { align: 'center' });
    doc.line(5, 275, 205, 275);

    doc.save(`Payslip_${salary.employee_name}_${selectedMonth}.pdf`);
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
    // Safety check for all array dependencies
    const policiesArr = Array.isArray(allPolicies) ? allPolicies : [];
    const salariesArr = Array.isArray(salaries) ? salaries : [];
    const attendanceArr = Array.isArray(attendanceRecords) ? attendanceRecords : [];
    const gracePeriodsArr = Array.isArray(gracePeriods) ? gracePeriods : [];
    const adjustmentsArr = Array.isArray(allAdjustments) ? allAdjustments : [];
    const tasksArr = Array.isArray(allTasksForPenalty) ? allTasksForPenalty : [];
    const timesheetsArr = Array.isArray(allTimesheetsForPenalty) ? allTimesheetsForPenalty : [];

    const policy = policiesArr.find(p => p.user_email === employeeEmail && p.is_active);
    const salary = salariesArr.find(s => s.employee_email === employeeEmail);
    const empAttendance = attendanceArr.filter(a => a.user_email === employeeEmail);

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

    const dailySalary = policy ? ((policy.basic_salary || 0) + (policy.hra || 0) + (policy.conveyance_allowance || 0) + (policy.special_allowance || 0) + (policy.other_allowance || 0) + (policy.travelling_allowance || 0) + (policy.children_education_allowance || 0) + (policy.fixed_incentive || 0) + (policy.employer_incentive || 0)) / totalDays : 0;

    // --- Timesheet Penalty Calculation ---
    const penaltyDates = new Set();
    let timesheetPenaltyDeduction = 0;
    const penaltyDetails = [];

    // Filter tasks for this employee
    const employeeTasks = tasksArr.filter(t =>
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
        const hasEntry = timesheetsArr.some(sheet =>
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

      // Check for Grace Period
      const graceDay = gracePeriodsArr.find(g => g.date === att.date);
      const graceMinutes = graceDay ? (graceDay.minutes || 30) : 0;
      const effectiveExpectedCheckIn = (expectedCheckIn * 60) + graceMinutes;

      // Check-in rules (only if present or checked_out)
      if (['present', 'checked_out', 'work_from_home'].includes(att.status) && checkInTime) {
        const checkInHour = checkInTime.getHours();
        const checkInMinute = checkInTime.getMinutes();
        const checkInTotalMinutes = checkInHour * 60 + checkInMinute;

        if (checkInTotalMinutes > effectiveExpectedCheckIn) {
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
        if (checkInTotalMinutes <= effectiveExpectedCheckIn && checkOutTime) {
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


    // Only one leave is paid, rest are treated as absent (unpaid)
    const effectivePaidLeave = Math.min(paidLeave, 1);

    // Calculate paid days
    // Note: paidAbsent allows 1 unauthorized absence to be paid (existing rule). 
    // effectivePaidLeave allows only 1 authorized leave to be paid (new rule).
    const paidDays = present + weekoff + holiday + effectivePaidLeave + paidAbsent + (halfDay * 0.5);

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
    const convPerDay = (policy.conveyance_allowance || 0) / totalDays;
    const specialPerDay = (policy.special_allowance || 0) / totalDays;
    const otherPerDay = (policy.other_allowance || 0) / totalDays;
    const taPerDay = (policy.travelling_allowance || 0) / totalDays;
    const ceaPerDay = (policy.children_education_allowance || 0) / totalDays;
    const fiPerDay = (policy.fixed_incentive || 0) / totalDays;

    const earnedBasic = Math.round(basicPerDay * paidDays);
    const earnedHra = Math.round(hraPerDay * paidDays);
    const earnedConv = Math.round(convPerDay * paidDays);
    const earnedSpecial = Math.round(specialPerDay * paidDays);
    const earnedOther = Math.round(otherPerDay * paidDays);
    const earnedTa = Math.round(taPerDay * paidDays);
    const earnedCea = Math.round(ceaPerDay * paidDays);
    const earnedFi = Math.round(fiPerDay * paidDays);
    const empIncentive = policy.employer_incentive || 0;

    const baseSalary = earnedBasic + earnedHra + earnedConv + earnedSpecial + earnedOther + earnedTa + earnedCea + earnedFi + empIncentive;

    // CTC 1: Based on salary policy only (full month salary, not pro-rated, including employer contributions)
    const fullMonthGross = (policy.basic_salary || 0) + (policy.hra || 0) +
      (policy.conveyance_allowance || 0) + (policy.special_allowance || 0) + (policy.other_allowance || 0) +
      (policy.travelling_allowance || 0) + (policy.children_education_allowance || 0) +
      (policy.fixed_incentive || 0) + (policy.employer_incentive || 0);

    // Employer contributions for CTC calculation
    // PF is calculated on Basic Salary (capped at 15000 standard limit usually for 1800 max)
    const pfBasis = Math.min((policy.basic_salary || 0), 15000);
    const employerPF = (policy.employer_pf_percentage > 0)
      ? Math.round(pfBasis * (policy.employer_pf_percentage / 100))
      : (policy.employer_pf_fixed || 0);

    // ESI is only applicable if Gross <= 21000
    const employerESI = (fullMonthGross <= 21000 && policy.employer_esi_percentage > 0)
      ? Math.round(fullMonthGross * (policy.employer_esi_percentage / 100))
      : (policy.employer_esi_fixed || 0);

    const employerLWF = policy.labour_welfare_employer || 0;

    const exGratia = (policy.ex_gratia_percentage > 0)
      ? Math.round((policy.basic_salary || 0) * (policy.ex_gratia_percentage / 100))
      : (policy.ex_gratia_fixed || policy.bonus_amount || 0);

    const monthlyCTC1 = fullMonthGross + employerPF + employerESI + employerLWF + exGratia + (policy.pf_admin_charges || 0) + (policy.gratuity_amount || 0);

    console.log('CTC Breakdown:', {
      fullMonthGross,
      employerPF,
      employerESI,
      employerLWF,
      exGratia,
      pf_admin: policy.pf_admin_charges,
      gratuity: policy.gratuity_amount,
      total: monthlyCTC1
    });

    const yearlyCTC1 = monthlyCTC1 * 12;

    // Adjustments from SalaryAdjustment entity
    const employeeAdjustments = adjustmentsArr.filter(adj =>
      adj.employee_email === employeeEmail && adj.status === 'approved'
    );

    // Rounding helper
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

    let positiveAdjustments = 0;
    let negativeAdjustments = 0;

    employeeAdjustments.forEach(adj => {
      if (adj.adjustment_type === 'penalty_waiver') return;

      if (['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type)) {
        positiveAdjustments += (adj.amount || 0);
      } else {
        // All others are negative (advance_deduction, penalty, deduction, other)
        negativeAdjustments += Math.abs(adj.amount || 0);
      }
    });

    // Sales Policy Components
    const salesIncentive = salary?.sales_incentive || 0;
    const salesReward = salary?.sales_reward || 0;
    const salesMeta = salary?.sales_performance_meta || {};

    const adjustments = positiveAdjustments - negativeAdjustments;

    // Gross should only include EARNINGS (Positive Adjustments)
    const gross = round2(baseSalary + positiveAdjustments + salesIncentive + salesReward + (attendanceAdjustments > 0 ? attendanceAdjustments : 0));

    // CTC 2: Including adjustments and sales incentives
    const monthlyCTC2 = monthlyCTC1 + adjustments + salesIncentive + salesReward;
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
    const latePenalty = round2(late * (policy.late_penalty_per_minute || 0) * 10);
    // Absent deduction should be 0 because we already reduced 'paidDays' which reduces 'baseSalary'. 
    // Adding it here would be double deduction.
    const absentDeduction = 0;

    // Attendance penalty (from daily adjustments e.g. late check-in bracket)
    const attendancePenalty = attendanceAdjustments < 0 ? Math.abs(round2(attendanceAdjustments)) : 0;
    // Note: timesheetPenaltyDeduction is explicitly based on dailySalary (float). Round it.
    const roundedTimesheetPenalty = round2(timesheetPenaltyDeduction);

    // Total Deductions should include NEGATIVE Adjustments (Advance, Penalty from Adjustments)
    const totalDeductions = round2(empPF + empESI + lwf + latePenalty + absentDeduction +
      (salary?.advance_recovery || 0) + (salary?.other_deductions || 0) + roundedTimesheetPenalty + attendancePenalty + negativeAdjustments);

    const net = round2(gross - totalDeductions);

    // Attendance percentage
    const attendancePercentage = totalDays > 0 ? Math.round((paidDays / totalDays) * 100) : 0;

    return {
      totalDays, present, absent, unpaidAbsent: unpaidAbsent + (paidLeave - effectivePaidLeave),
      effectivePresent, halfDay, paidLeave: effectivePaidLeave, originalPaidLeave: paidLeave,
      weekoff, holiday, late, paidDays, notMarked,
      baseSalary, earnedBasic, earnedHra, earnedConv, earnedSpecial, earnedOther, earnedTa, earnedCea, earnedFi, empIncentive,
      adjustments, positiveAdjustments, negativeAdjustments, gross, empPF, empESI, lwf, latePenalty, absentDeduction,
      totalDeductions, net, attendancePercentage, policy, hasPolicy: true,
      employeeAdjustments, monthlyCTC1, yearlyCTC1, monthlyCTC2, yearlyCTC2,
      attendanceAdjustments, dailyDetails, timesheetPenaltyDeduction, penaltyDetails,
      employerPF, employerESI, employerLWF, exGratia,
      salesIncentive, salesReward, salesMeta
    };
  }, [allPolicies, salaries, attendanceRecords, selectedMonth, allAdjustments, gracePeriods]);

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

      // Filter by Policy existence if toggle is active
      let matchesPolicy = true;
      if (hideNoPolicyUsers) {
        const calc = calculateEmployeeSalary(salary.employee_email);
        if (!calc.hasPolicy) matchesPolicy = false;
      }

      return matchesSearch && matchesStatus && matchesPolicy;
    });
  }, [salaries, searchQuery, statusFilter, hideNoPolicyUsers]);

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

                  {/* Hide No Policy Toggle */}
                  <Button
                    variant={hideNoPolicyUsers ? "default" : "outline"}
                    onClick={() => setHideNoPolicyUsers(!hideNoPolicyUsers)}
                    className={`h-12 px-4 rounded-xl border font-semibold transition-all ${hideNoPolicyUsers
                      ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    {hideNoPolicyUsers ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                    {hideNoPolicyUsers ? "Hidden No-Policy" : "Show All Users"}
                  </Button>

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
                    <Button
                      variant="outline"
                      onClick={() => exportDetailedCSVMutation.mutate()}
                      className="gap-2 bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 h-12 rounded-xl font-semibold hover:text-emerald-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export Register
                    </Button>
                  </div>

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

                                {/* Sales Performance Section */}
                                {calc.salesMeta && calc.salesMeta.role_type && calc.salesMeta.role_type !== 'none' && (
                                  <div>
                                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                                      Sales Performance ({calc.salesMeta.role_type === 'manager' ? 'Manager Policy' : 'Executive Policy'})
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                      {calc.salesMeta.role_type === 'manager' ? (
                                        <>
                                          <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Team Avg Sales</p>
                                            <p className="text-lg font-bold text-slate-900">{calc.salesMeta.avg_sales_count?.toFixed(2) || 0}</p>
                                            <p className="text-[10px] text-slate-400">Target: 3.0</p>
                                          </div>
                                          <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Team CV Volume</p>
                                            <p className="text-lg font-bold text-slate-900">₹{(calc.salesMeta.team_sales_volume || 0).toLocaleString()}</p>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Personal Sales</p>
                                            <p className="text-lg font-bold text-slate-900">{calc.salesMeta.personal_sales_count || 0}</p>
                                            <p className="text-[10px] text-slate-400">Target: 3</p>
                                          </div>
                                          <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold">Total CV Volume</p>
                                            <p className="text-lg font-bold text-slate-900">₹{(calc.salesMeta.personal_sales_volume || 0).toLocaleString()}</p>
                                          </div>
                                        </>
                                      )}

                                      <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Incentive Applied</p>
                                        <div className="flex justify-between items-end">
                                          <p className="text-lg font-bold text-emerald-600">₹{(calc.salesIncentive || 0).toLocaleString()}</p>
                                          <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                            {((calc.salesMeta.applied_incentive_rate || 0) * 100).toFixed(2)}%
                                          </span>
                                        </div>
                                      </div>

                                      <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                        <p className="text-[10px] text-slate-500 uppercase font-bold">Performance Reward</p>
                                        <p className="text-lg font-bold text-emerald-600">₹{(calc.salesReward || 0).toLocaleString()}</p>
                                        {calc.salesMeta.reward_applied && <span className="text-[10px] text-emerald-600 font-bold">Target Achieved!</span>}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Components */}
                                <div>
                                  <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                                    Detailed Components
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {calc.earnedBasic > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Earned Basic</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedBasic.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedHra > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Earned HRA</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedHra.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedConv > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Earned Conv.</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedConv.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedSpecial > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Earned Special</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedSpecial.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedOther > 0 && (
                                      <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-sm">Earned Other</span>
                                        <span className="font-bold text-slate-900">₹{calc.earnedOther.toLocaleString()}</span>
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
                                onClick={() => downloadPayslip(salary)}
                                className="bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-indigo-600 rounded-lg"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Payslip
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
                    (policy.conveyance_allowance || 0) + (policy.special_allowance || 0) + (policy.other_allowance || 0) +
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
    adjustment: ['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type)
      ? Math.abs(adj.amount)
      : -Math.abs(adj.amount),
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
