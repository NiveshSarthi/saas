import React, { useState, useMemo } from 'react';
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
  Info
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
  const [isCalculating, setIsCalculating] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [viewMode, setViewMode] = useState('cards');

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
    enabled: (activeTab === 'policies' || advanceDialogOpen) && isHRMember,
  });

  const usersFromEntity = teamData?.users || [];
  const invitations = teamData?.invitations || [];

  const allUsers = React.useMemo(() => [
    ...usersFromEntity,
    ...invitations
      .filter(inv => inv.status === 'accepted')
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
      }))
  ], [usersFromEntity, invitations]);

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
    
    // Count attendance types from actual records
    const present = empAttendance.filter(a => ['present', 'checked_out', 'work_from_home'].includes(a.status)).length;
    const absent = empAttendance.filter(a => a.status === 'absent').length;
    const halfDay = empAttendance.filter(a => a.status === 'half_day').length;
    const paidLeave = empAttendance.filter(a => ['leave', 'sick_leave', 'casual_leave'].includes(a.status)).length;
    const weekoff = empAttendance.filter(a => a.status === 'weekoff').length;
    const holiday = empAttendance.filter(a => a.status === 'holiday').length;
    const late = empAttendance.filter(a => a.is_late).length;
    
    // First absent is paid, rest are unpaid
    const paidAbsent = Math.min(absent, 1);
    const unpaidAbsent = Math.max(0, absent - 1);
    const effectivePresent = present + paidAbsent;
    
    // Calculate paid days
    const paidDays = present + weekoff + holiday + paidLeave + paidAbsent + (halfDay * 0.5);
    
    // Not marked days
    const notMarked = totalDays - empAttendance.length;
    
    if (!policy) {
      return {
        totalDays, present, absent, unpaidAbsent, effectivePresent, halfDay, paidLeave,
        weekoff, holiday, late, paidDays, notMarked,
        baseSalary: 0, adjustments: 0, gross: 0, totalDeductions: 0, net: 0,
        earnedBasic: 0, earnedHra: 0, earnedTa: 0, earnedCea: 0, earnedFi: 0, empIncentive: 0,
        empPF: 0, empESI: 0, lwf: 0, latePenalty: 0, absentDeduction: 0,
        attendancePercentage: 0, hasPolicy: false
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
      if (['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type)) {
        return total + (adj.amount || 0);
      } else {
        return total - Math.abs(adj.amount || 0);
      }
    }, 0);
    
    const gross = baseSalary + adjustments;
    
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
                           (salary?.advance_recovery || 0) + (salary?.other_deductions || 0);
    
    const net = gross - totalDeductions;
    
    // Attendance percentage
    const attendancePercentage = totalDays > 0 ? Math.round((paidDays / totalDays) * 100) : 0;
    
    return {
      totalDays, present, absent, unpaidAbsent, effectivePresent, halfDay, paidLeave,
      weekoff, holiday, late, paidDays, notMarked,
      baseSalary, earnedBasic, earnedHra, earnedTa, earnedCea, earnedFi, empIncentive,
      adjustments, gross, empPF, empESI, lwf, latePenalty, absentDeduction,
      totalDeductions, net, attendancePercentage, policy, hasPolicy: true,
      employeeAdjustments, monthlyCTC1, yearlyCTC1, monthlyCTC2, yearlyCTC2
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Enhanced Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <div className="absolute inset-0 bg-black/5" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA4IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        
        <div className="relative max-w-[1800px] mx-auto px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-5 bg-white/20 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30">
                <DollarSign className="w-12 h-12 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-black text-white drop-shadow-lg">Payroll Hub</h1>
                <p className="text-white/90 text-lg mt-1 font-medium">Real-time salary powered by live attendance</p>
              </div>
            </div>
            
            {isCalculating && (
              <div className="flex items-center gap-3 bg-white/20 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/30">
                <RefreshCw className="w-5 h-5 text-white animate-spin" />
                <span className="text-white font-semibold">Calculating...</span>
              </div>
            )}
          </div>

          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="group relative overflow-hidden bg-white/15 backdrop-blur-2xl rounded-3xl border-2 border-white/30 p-6 hover:bg-white/25 transition-all hover:scale-105 shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/80 text-sm font-bold uppercase tracking-wide">Gross Payroll</span>
                  <TrendingUp className="w-6 h-6 text-emerald-300" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white">₹{(totals.gross / 100000).toFixed(1)}</span>
                  <span className="text-xl font-bold text-white/70">Lakhs</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: '75%' }} />
                  </div>
                  <span className="text-xs text-white/70 font-semibold">{totals.employees} employees</span>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-white/15 backdrop-blur-2xl rounded-3xl border-2 border-white/30 p-6 hover:bg-white/25 transition-all hover:scale-105 shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-transparent rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/80 text-sm font-bold uppercase tracking-wide">Net Payable</span>
                  <CheckCircle className="w-6 h-6 text-blue-300" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-white">₹{(totals.net / 100000).toFixed(1)}</span>
                  <span className="text-xl font-bold text-white/70">Lakhs</span>
                </div>
                <div className="mt-2 text-sm text-white/80 font-medium">
                  After ₹{(totals.deductions / 1000).toFixed(0)}K deductions
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-white/15 backdrop-blur-2xl rounded-3xl border-2 border-white/30 p-6 hover:bg-white/25 transition-all hover:scale-105 shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-400/20 to-transparent rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/80 text-sm font-bold uppercase tracking-wide">Status Overview</span>
                  <BarChart3 className="w-6 h-6 text-amber-300" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/10 rounded-xl p-2">
                    <div className="text-2xl font-black text-white">{statusCounts.approved}</div>
                    <div className="text-xs text-white/70 font-semibold">Approved</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-2">
                    <div className="text-2xl font-black text-white">{statusCounts.paid}</div>
                    <div className="text-xs text-white/70 font-semibold">Paid</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-white/15 backdrop-blur-2xl rounded-3xl border-2 border-white/30 p-6 hover:bg-white/25 transition-all hover:scale-105 shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-rose-400/20 to-transparent rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white/80 text-sm font-bold uppercase tracking-wide">Pending Actions</span>
                  <Clock className="w-6 h-6 text-rose-300" />
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-black text-white">{statusCounts.draft + statusCounts.locked}</span>
                  <span className="text-xl font-bold text-white/70">items</span>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-orange-500/30 text-white border-orange-300/50 font-semibold">
                    {statusCounts.draft} Draft
                  </Badge>
                  <Badge className="bg-yellow-500/30 text-white border-yellow-300/50 font-semibold">
                    {statusCounts.locked} Locked
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 lg:px-8 py-8 -mt-6 relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border-2 border-white/50 p-2 mb-6">
            <TabsList className="grid w-full grid-cols-2 gap-2 bg-transparent">
              <TabsTrigger 
                value="management" 
                className="rounded-2xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all py-4"
              >
                <Users className="w-5 h-5 mr-2" />
                <span className="font-bold text-lg">Payroll Management</span>
              </TabsTrigger>
              <TabsTrigger 
                value="policies" 
                className="rounded-2xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all py-4"
              >
                <Settings className="w-5 h-5 mr-2" />
                <span className="font-bold text-lg">Salary Policies</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Payroll Management Tab */}
          <TabsContent value="management" className="space-y-6">
            {/* Enhanced Control Panel */}
            <Card className="bg-white/90 backdrop-blur-2xl border-2 border-white/50 shadow-2xl">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Month Selector */}
                  <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-3 border-2 border-indigo-200">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <Input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setSelectedRecords([]);
                      }}
                      className="w-48 border-2 border-indigo-300 font-semibold"
                    />
                  </div>

                  {/* Search */}
                  <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 border-2 font-medium h-12 rounded-2xl"
                    />
                  </div>

                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44 border-2 h-12 rounded-2xl font-semibold">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="locked">Locked</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* View Mode */}
                  <Select value={viewMode} onValueChange={setViewMode}>
                    <SelectTrigger className="w-36 border-2 h-12 rounded-2xl font-semibold">
                      <Eye className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cards">Cards</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Actions */}
                  <div className="flex gap-2 ml-auto">
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
                      className="gap-2 border-2 h-12 rounded-2xl font-semibold hover:bg-orange-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Cleanup
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => recalculateMutation.mutate()}
                      disabled={recalculateMutation.isPending || isCalculating}
                      className="gap-2 border-2 h-12 rounded-2xl font-semibold hover:bg-indigo-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                      Recalculate
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => exportCSVMutation.mutate()}
                      className="gap-2 border-2 h-12 rounded-2xl font-semibold hover:bg-green-50"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedRecords.length > 0 && (
                  <div className="mt-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border-2 border-indigo-300">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedRecords.length === filteredSalaries.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <Badge className="bg-indigo-600 text-white text-base px-4 py-2 font-bold shadow-lg">
                        {selectedRecords.length} Selected
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => setLockDialogOpen(true)}
                        className="gap-2 border-2 font-semibold"
                      >
                        <Lock className="w-4 h-4" />
                        Lock
                      </Button>
                      <Button 
                        onClick={() => approveMutation.mutate(selectedRecords)}
                        className="bg-blue-600 hover:bg-blue-700 gap-2 font-semibold shadow-lg"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button 
                        onClick={() => markAsPaidMutation.mutate(selectedRecords)}
                        className="bg-green-600 hover:bg-green-700 gap-2 font-semibold shadow-lg"
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
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Loading payroll data...</p>
              </div>
            ) : filteredSalaries.length === 0 ? (
              <Card className="bg-white/90 backdrop-blur-2xl border-2 shadow-2xl">
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
                      <Card key={salary.id} className="bg-amber-50/80 backdrop-blur-xl border-2 border-amber-200 shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <AlertCircle className="w-8 h-8 text-amber-600" />
                            <div>
                              <h3 className="font-bold text-lg text-slate-900">{salary.employee_name}</h3>
                              <p className="text-amber-700 font-medium">No active salary policy found</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  
                  return (
                    <Card key={salary.id} className="group bg-white/90 backdrop-blur-2xl border-2 border-white/50 shadow-2xl hover:shadow-3xl transition-all overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-100/30 via-purple-100/20 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <CardContent className="p-6 relative">
                        <div className="flex items-start gap-4">
                          <Checkbox
                            checked={selectedRecords.includes(salary.id)}
                            onCheckedChange={() => handleSelectRecord(salary.id)}
                            disabled={salary.locked}
                            className="mt-2"
                          />
                          
                          <div className="flex-1">
                            {/* Employee Header */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl">
                                  {salary.employee_name?.charAt(0) || 'U'}
                                </div>
                                <div>
                                  <h3 className="text-2xl font-black text-slate-900 mb-1">{salary.employee_name}</h3>
                                  <p className="text-sm text-slate-600 font-medium">{getUserName(salary.employee_email)}</p>
                                </div>
                                <Badge className={
                                  salary.status === 'paid' ? 'bg-green-500 text-white shadow-lg shadow-green-200' :
                                  salary.status === 'approved' ? 'bg-blue-500 text-white shadow-lg shadow-blue-200' :
                                  salary.status === 'locked' ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' :
                                  'bg-slate-400 text-white shadow-lg'
                                }>
                                  {salary.locked && <Lock className="w-3 h-3 mr-1" />}
                                  {salary.status?.toUpperCase()}
                                </Badge>
                              </div>

                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-600 mb-1">NET SALARY</p>
                                <p className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                                  ₹{calc.net.toLocaleString()}
                                </p>
                                <div className="mt-3 space-y-2">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">CTC 1 (Policy)</p>
                                    <div className="flex items-center justify-end gap-2 text-xs">
                                      <span className="text-slate-500 font-semibold">Monthly:</span>
                                      <span className="font-black text-indigo-700">₹{calc.monthlyCTC1.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 text-xs">
                                      <span className="text-slate-500 font-semibold">Yearly:</span>
                                      <span className="font-black text-purple-700">₹{calc.yearlyCTC1.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1 pt-2 border-t">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">CTC 2 (With Adjustments)</p>
                                    <div className="flex items-center justify-end gap-2 text-xs">
                                      <span className="text-slate-500 font-semibold">Monthly:</span>
                                      <span className="font-black text-emerald-700">₹{calc.monthlyCTC2.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 text-xs">
                                      <span className="text-slate-500 font-semibold">Yearly:</span>
                                      <span className="font-black text-teal-700">₹{calc.yearlyCTC2.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <Progress value={calc.attendancePercentage} className="w-32 h-2" />
                                  <span className="text-xs font-bold text-slate-600">{calc.attendancePercentage}%</span>
                                </div>
                              </div>
                            </div>

                            {/* Attendance Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4 border-2 border-emerald-200 shadow-lg">
                                <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Present</p>
                                <p className="text-3xl font-black text-emerald-900">{calc.effectivePresent}</p>
                              </div>
                              <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-4 border-2 border-rose-200 shadow-lg">
                                <p className="text-xs font-bold text-rose-700 uppercase mb-1">Unpaid Absent</p>
                                <p className="text-3xl font-black text-rose-900">{calc.unpaidAbsent}</p>
                              </div>
                              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border-2 border-amber-200 shadow-lg">
                                <p className="text-xs font-bold text-amber-700 uppercase mb-1">Week Off</p>
                                <p className="text-3xl font-black text-amber-900">{calc.weekoff}</p>
                              </div>
                              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-4 border-2 border-violet-200 shadow-lg">
                                <p className="text-xs font-bold text-violet-700 uppercase mb-1">Paid Leave</p>
                                <p className="text-3xl font-black text-violet-900">{calc.paidLeave}</p>
                              </div>
                              <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-4 border-2 border-sky-200 shadow-lg">
                                <p className="text-xs font-bold text-sky-700 uppercase mb-1">Half Day</p>
                                <p className="text-3xl font-black text-sky-900">{calc.halfDay}</p>
                              </div>
                              <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-4 border-2 border-slate-300 shadow-lg">
                                <p className="text-xs font-bold text-slate-700 uppercase mb-1">Not Marked</p>
                                <p className="text-3xl font-black text-slate-900">{calc.notMarked}</p>
                              </div>
                            </div>

                            {/* Salary Breakdown */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 shadow-xl">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
                                <div className="relative">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ArrowUpRight className="w-5 h-5 text-white" />
                                    <p className="text-sm font-bold text-white/90 uppercase">Base Salary</p>
                                  </div>
                                  <p className="text-3xl font-black text-white">₹{calc.baseSalary.toLocaleString()}</p>
                                  <p className="text-xs text-white/80 mt-2 font-semibold">{calc.paidDays.toFixed(1)} / {calc.totalDays} days</p>
                                </div>
                              </div>

                              <div className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 shadow-xl">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
                                <div className="relative">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-white" />
                                    <p className="text-sm font-bold text-white/90 uppercase">Adjustments</p>
                                  </div>
                                  <p className="text-3xl font-black text-white">₹{calc.adjustments.toLocaleString()}</p>
                                  <p className="text-xs text-white/80 mt-2 font-semibold">Bonus & Incentives</p>
                                </div>
                              </div>

                              <div className="relative overflow-hidden bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-5 shadow-xl">
                                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10" />
                                <div className="relative">
                                  <div className="flex items-center gap-2 mb-2">
                                    <ArrowDownRight className="w-5 h-5 text-white" />
                                    <p className="text-sm font-bold text-white/90 uppercase">Deductions</p>
                                  </div>
                                  <p className="text-3xl font-black text-white">₹{calc.totalDeductions.toLocaleString()}</p>
                                  <p className="text-xs text-white/80 mt-2 font-semibold">PF, ESI, Penalties</p>
                                </div>
                              </div>
                            </div>

                            {/* Expand Button */}
                            <Button
                              variant="ghost"
                              onClick={() => setExpandedRows(prev => ({ ...prev, [salary.id]: !prev[salary.id] }))}
                              className="w-full text-indigo-600 hover:bg-indigo-50 font-semibold rounded-2xl h-12 mb-4"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-5 h-5 mr-2" />
                                  Hide Detailed Breakdown
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-5 h-5 mr-2" />
                                  View Detailed Breakdown
                                </>
                              )}
                            </Button>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="space-y-4 p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200 mb-4">
                                {/* Components */}
                                <div>
                                  <h4 className="font-black text-slate-900 mb-3 flex items-center gap-2 text-lg">
                                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                                    Salary Components
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    {calc.earnedBasic > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-slate-200">
                                        <span className="text-slate-700 font-semibold">Basic</span>
                                        <span className="font-black text-slate-900">₹{calc.earnedBasic.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedHra > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-slate-200">
                                        <span className="text-slate-700 font-semibold">HRA</span>
                                        <span className="font-black text-slate-900">₹{calc.earnedHra.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedTa > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-slate-200">
                                        <span className="text-slate-700 font-semibold">Travel</span>
                                        <span className="font-black text-slate-900">₹{calc.earnedTa.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedCea > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-slate-200">
                                        <span className="text-slate-700 font-semibold">Child Edu</span>
                                        <span className="font-black text-slate-900">₹{calc.earnedCea.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.earnedFi > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-slate-200">
                                        <span className="text-slate-700 font-semibold">Fixed Inc.</span>
                                        <span className="font-black text-slate-900">₹{calc.earnedFi.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.empIncentive > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-slate-200">
                                        <span className="text-slate-700 font-semibold">Employer Inc.</span>
                                        <span className="font-black text-slate-900">₹{calc.empIncentive.toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Deductions */}
                                <div>
                                  <h4 className="font-black text-slate-900 mb-3 flex items-center gap-2 text-lg">
                                    <TrendingDown className="w-5 h-5 text-red-600" />
                                    Deductions
                                  </h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    {calc.empPF > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">PF</span>
                                        <span className="font-black text-red-600">-₹{Math.round(calc.empPF).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.empESI > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">ESI</span>
                                        <span className="font-black text-red-600">-₹{Math.round(calc.empESI).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.lwf > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">LWF</span>
                                        <span className="font-black text-red-600">-₹{Math.round(calc.lwf).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.latePenalty > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">Late Penalty</span>
                                        <span className="font-black text-red-600">-₹{Math.round(calc.latePenalty).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.absentDeduction > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">Absent</span>
                                        <span className="font-black text-red-600">-₹{calc.absentDeduction.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {salary?.advance_recovery > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">Advance Recovery</span>
                                        <span className="font-black text-red-600">-₹{salary.advance_recovery.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {salary?.other_deductions > 0 && (
                                      <div className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">Other Deductions</span>
                                        <span className="font-black text-red-600">-₹{salary.other_deductions.toLocaleString()}</span>
                                      </div>
                                    )}
                                    {calc.employeeAdjustments?.filter(adj => !['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type)).map(adj => (
                                      <div key={adj.id} className="flex justify-between bg-white p-3 rounded-xl border-2 border-red-100">
                                        <span className="text-slate-700 font-semibold">{adj.adjustment_type === 'advance_deduction' ? 'Advance' : adj.adjustment_type === 'penalty' ? 'Penalty' : 'Deduction'}</span>
                                        <span className="font-black text-red-600">-₹{Math.abs(adj.amount || 0).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2">
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCurrentRecord(salary);
                                  setAdjustmentDialogOpen(true);
                                }}
                                className="gap-2 border-2 font-semibold rounded-xl hover:bg-indigo-50"
                              >
                                <Plus className="w-4 h-4" />
                                Adjustment
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(salary.employee_email);
                                  setAdvanceDialogOpen(true);
                                }}
                                className="gap-2 border-2 font-semibold rounded-xl hover:bg-purple-50"
                              >
                                <Wallet className="w-4 h-4" />
                                Advance
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => generateSlipMutation.mutate(salary.id)}
                                disabled={generateSlipMutation.isPending}
                                className="gap-2 border-2 font-semibold rounded-xl hover:bg-blue-50"
                              >
                                <FileText className="w-4 h-4" />
                                Slip
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => emailSlipMutation.mutate(salary.id)}
                                disabled={emailSlipMutation.isPending}
                                className="gap-2 border-2 font-semibold rounded-xl hover:bg-green-50"
                              >
                                <Mail className="w-4 h-4" />
                                Email
                              </Button>
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedEmployee(salary.employee_email);
                                  setHistoryDialogOpen(true);
                                }}
                                className="gap-2 border-2 font-semibold rounded-xl hover:bg-amber-50"
                              >
                                <History className="w-4 h-4" />
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
                                className="gap-2 border-2 font-semibold rounded-xl text-red-600 hover:bg-red-50"
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
              <Card className="bg-white/90 backdrop-blur-2xl border-2 shadow-2xl">
                <CardContent className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-200">
                          <th className="text-left p-3 font-black text-slate-700">
                            <Checkbox checked={selectedRecords.length === filteredSalaries.length} onCheckedChange={handleSelectAll} />
                          </th>
                          <th className="text-left p-3 font-black text-slate-700">Employee</th>
                          <th className="text-center p-3 font-black text-slate-700">Attendance</th>
                          <th className="text-right p-3 font-black text-slate-700">Base</th>
                          <th className="text-right p-3 font-black text-slate-700">Adjustments</th>
                          <th className="text-right p-3 font-black text-slate-700">Deductions</th>
                          <th className="text-right p-3 font-black text-slate-700">Net</th>
                          <th className="text-center p-3 font-black text-slate-700">Status</th>
                          <th className="text-center p-3 font-black text-slate-700">Actions</th>
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
                                />
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-900">{salary.employee_name}</div>
                                <div className="text-xs text-slate-500">{salary.employee_email}</div>
                              </td>
                              <td className="p-3 text-center">
                                <Badge className="bg-green-100 text-green-700 font-bold">{calc.effectivePresent}P</Badge>
                                <Badge className="bg-red-100 text-red-700 font-bold ml-1">{calc.unpaidAbsent}A</Badge>
                              </td>
                              <td className="p-3 text-right font-bold">₹{calc.baseSalary.toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-amber-600">+₹{calc.adjustments.toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-red-600">-₹{calc.totalDeductions.toLocaleString()}</td>
                              <td className="p-3 text-right font-black text-green-600 text-lg">₹{calc.net.toLocaleString()}</td>
                              <td className="p-3 text-center">
                                <Badge className={
                                  salary.status === 'paid' ? 'bg-green-500 text-white' :
                                  salary.status === 'approved' ? 'bg-blue-500 text-white' :
                                  salary.status === 'locked' ? 'bg-orange-500 text-white' :
                                  'bg-slate-400 text-white'
                                }>
                                  {salary.status}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-1 justify-center">
                                  <Button size="sm" variant="ghost" onClick={() => { setCurrentRecord(salary); setAdjustmentDialogOpen(true); }}>
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => generateSlipMutation.mutate(salary.id)}>
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-6">
            <div className="flex justify-end">
              <Button 
                onClick={() => {
                  setEditingPolicy(null);
                  setPolicyFormOpen(true);
                }}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 gap-2 shadow-2xl h-12 px-6 rounded-2xl font-bold text-lg"
              >
                <Plus className="w-5 h-5" />
                Create New Policy
              </Button>
            </div>

            <div className="grid gap-6">
              {policiesLoading ? (
                <div className="text-center py-16">
                  <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">Loading policies...</p>
                </div>
              ) : policies.length === 0 ? (
                <Card className="bg-white/90 backdrop-blur-2xl border-2 shadow-2xl">
                  <CardContent className="p-16 text-center">
                    <Settings className="w-20 h-20 text-slate-300 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-slate-700 mb-2">No Policies Found</h3>
                    <p className="text-slate-500 font-medium mb-6">Create your first salary policy to get started</p>
                    <Button onClick={() => setPolicyFormOpen(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600">
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
                    <Card key={policy.id} className="bg-white/90 backdrop-blur-2xl border-2 shadow-2xl hover:shadow-3xl transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-xl">
                              {user?.full_name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-black text-slate-900">{user?.full_name || 'Unknown'}</h3>
                                <Badge className={policy.is_active ? 'bg-green-500 text-white shadow-lg' : 'bg-slate-400 text-white'}>
                                  {policy.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 font-medium">{policy.user_email}</p>
                              
                              <div className="grid grid-cols-3 gap-3 mt-4">
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 border-2 border-blue-200">
                                  <p className="text-xs text-blue-700 font-bold uppercase">Monthly Gross</p>
                                  <p className="text-xl font-black text-blue-900">₹{monthlyGross.toLocaleString()}</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 border-2 border-purple-200">
                                  <p className="text-xs text-purple-700 font-bold uppercase">Type</p>
                                  <p className="text-lg font-black text-purple-900">{policy.salary_type?.replace('_', ' ')}</p>
                                </div>
                                <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-3 border-2 border-emerald-200">
                                  <p className="text-xs text-emerald-700 font-bold uppercase">Status</p>
                                  <p className="text-lg font-black text-emerald-900">{policy.is_active ? 'Active' : 'Inactive'}</p>
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
                              className="border-2 font-semibold rounded-xl"
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
                              className="border-2 font-semibold rounded-xl text-red-600 hover:bg-red-50"
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
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <SalaryAdjustmentDialog
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
        <p className="text-slate-600">Loading history...</p>
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
        <Card key={record.id} className="bg-gradient-to-br from-white to-slate-50 border-2 shadow-lg hover:shadow-xl transition-all">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="text-2xl font-black text-slate-900 mb-2">{record.month}</h4>
                <Badge className={
                  record.status === 'paid' ? 'bg-green-500 text-white shadow-lg' :
                  record.status === 'approved' ? 'bg-blue-500 text-white shadow-lg' :
                  'bg-slate-400 text-white shadow-lg'
                }>
                  {record.status?.toUpperCase()}
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-600 mb-1">NET SALARY</p>
                <p className="text-4xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  ₹{(record.net_salary || 0).toLocaleString()}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                <p className="text-xs text-blue-700 font-bold uppercase">Gross</p>
                <p className="text-2xl font-black text-blue-900">₹{(record.gross_salary || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-4 border-2 border-red-200">
                <p className="text-xs text-red-700 font-bold uppercase">Deductions</p>
                <p className="text-2xl font-black text-red-900">₹{(record.total_deductions || 0).toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border-2 border-emerald-200">
                <p className="text-xs text-emerald-700 font-bold uppercase">Present</p>
                <p className="text-2xl font-black text-emerald-900">{record.present_days || 0}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border-2 border-amber-200">
                <p className="text-xs text-amber-700 font-bold uppercase">Absent</p>
                <p className="text-2xl font-black text-amber-900">{record.absent_days || 0}</p>
              </div>
            </div>

            {record.payment_date && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-semibold">Paid on: {format(new Date(record.payment_date), 'dd MMM yyyy')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}