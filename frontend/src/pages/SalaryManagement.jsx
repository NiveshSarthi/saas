import React, { useState } from 'react';
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
  Unlock,
  CheckCircle,
  BarChart3,
  FileText,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import SalaryAdjustmentDialog from '@/components/salary/SalaryAdjustmentDialog';
import SalaryLockDialog from '@/components/salary/SalaryLockDialog';
import SalaryReportsDialog from '@/components/salary/SalaryReportsDialog';

export default function SalaryManagement() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [user, setUser] = useState(null);

  const queryClient = useQueryClient();

  const [isHRMember, setIsHRMember] = React.useState(false);
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
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

  const { data: salaries = [], isLoading } = useQuery({
    queryKey: ['salary-records', selectedMonth],
    queryFn: () => base44.entities.SalaryRecord.filter({ month: selectedMonth }, '-employee_name'),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      const usersData = response.data?.data || response.data;
      return [
        ...(usersData.users || []),
        ...(usersData.invitations || [])
          .filter(inv => inv.status === 'accepted')
          .filter(inv => !(usersData.users || []).some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
          .map(inv => ({
            email: inv.email,
            full_name: inv.full_name || inv.email?.split('@')[0]
          }))
      ];
    },
  });

  const getUserName = (email) => {
    const user = allUsers.find(u => u.email === email);
    return user?.full_name || user?.name || email;
  };

  const getDisplayName = (salary) => {
    // If employee_name exists and doesn't look like an email, use it
    if (salary.employee_name && !salary.employee_name.includes('@')) {
      return salary.employee_name;
    }
    // Otherwise look up by email
    return getUserName(salary.employee_email);
  };

  const { data: adjustments = [] } = useQuery({
    queryKey: ['salary-adjustments', selectedMonth],
    queryFn: () => base44.entities.SalaryAdjustment.filter({ month: selectedMonth }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      try {
        toast.info('Syncing WorkDay ledger...');
        // First sync WorkDay ledger
        const syncResponse = await base44.functions.invoke('syncWorkDayLedger', { month: selectedMonth });

        toast.info('Calculating salaries...');
        // Then calculate salaries
        const calcResponse = await base44.functions.invoke('calculateMonthlySalary', { month: selectedMonth });

        return calcResponse.data;
      } catch (error) {
        console.error('Sync error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['salary-records']);
      queryClient.invalidateQueries(['workday']);
      toast.success(`✅ Synced ${data?.total_processed || 0} salary records`);
    },
    onError: (error) => {
      console.error('Sync mutation error:', error);
      toast.error(`Sync failed: ${error?.message || 'Unknown error'}`);
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (recordIds) => {
      for (const id of recordIds) {
        await base44.entities.SalaryRecord.update(id, {
          status: 'approved',
          approved_by: user?.email,
          approved_at: new Date().toISOString()
        });

        const record = salaries.find(s => s.id === id);
        await base44.entities.SalaryAuditLog.create({
          entity_type: 'salary_record',
          entity_id: id,
          employee_email: record.employee_email,
          month: record.month,
          action: 'approved',
          changed_by: user?.email
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-records']);
      setSelectedRecords([]);
      toast.success('Salaries approved');
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
      // Download PDF
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

  const handleSelectRecord = (recordId) => {
    setSelectedRecords(prev =>
      prev.includes(recordId)
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const handleSelectAll = () => {
    if (selectedRecords.length === salaries.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(salaries.map(s => s.id));
    }
  };

  const totalGross = salaries.reduce((sum, s) => sum + (s.gross_salary || 0), 0);
  const totalNet = salaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
  const lockedCount = salaries.filter(s => s.locked).length;
  const pendingCount = salaries.filter(s => s.status === 'draft' || s.status === 'locked').length;

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'locked': return 'bg-orange-100 text-orange-700';
      case 'draft': return 'bg-slate-100 text-slate-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const selectedSalaries = salaries.filter(s => selectedRecords.includes(s.id));

  if (!isHRMember) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <Lock className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
        <p className="text-slate-500">Only admin and HR department members can access salary management.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Salary Management
          </h1>
          <p className="text-slate-600 mt-1">Complete salary calculation with attendance integration</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setReportsDialogOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Reports
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync & Calculate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Gross</p>
                <p className="text-2xl font-bold text-slate-900">₹{(totalGross / 100000).toFixed(2)}L</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Net Payable</p>
                <p className="text-2xl font-bold text-green-600">₹{(totalNet / 100000).toFixed(2)}L</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Locked Records</p>
                <p className="text-2xl font-bold text-orange-600">{lockedCount}</p>
              </div>
              <Lock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-4">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setSelectedRecords([]);
            }}
            className="w-48"
          />
          {selectedRecords.length > 0 && (
            <Badge variant="outline" className="text-indigo-600">
              {selectedRecords.length} selected
            </Badge>
          )}
        </div>

        {selectedRecords.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setLockDialogOpen(true)}
              className="gap-2"
            >
              <Lock className="w-4 h-4" />
              Lock Selected
            </Button>
            <Button
              onClick={() => approveMutation.mutate(selectedRecords)}
              disabled={approveMutation.isLoading}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Approve Selected
            </Button>
          </div>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedRecords.length === salaries.length && salaries.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Base Salary</TableHead>
              <TableHead>Adjustments</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net Salary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : salaries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                  No salary records found. Click "Sync & Calculate" to generate records.
                </TableCell>
              </TableRow>
            ) : (
              salaries.map((salary) => {
                const empAdjustments = adjustments.filter(a => a.employee_email === salary.employee_email);
                const totalAdjustments = empAdjustments.reduce((sum, a) => sum + (a.amount || 0), 0);

                return (
                  <TableRow key={salary.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRecords.includes(salary.id)}
                        onCheckedChange={() => handleSelectRecord(salary.id)}
                        disabled={salary.locked}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div>
                        <div>{getDisplayName(salary)}</div>
                        <div className="text-xs text-slate-500">{salary.employee_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        <div>P: {salary.present_days || 0} | A: {salary.absent_days || 0} | W: {salary.weekoff_days || 0}</div>
                        <div>PL: {salary.paid_leave_days || 0} | UL: {salary.unpaid_leave_days || 0}</div>
                        {salary.not_marked_days > 0 && (
                          <div
                            className="text-orange-600 font-medium cursor-help"
                            title={salary.not_marked_dates ? `Dates: ${salary.not_marked_dates.join(', ')}` : 'Not marked days'}
                          >
                            Not Marked: {salary.not_marked_days}
                            {salary.not_marked_dates && salary.not_marked_dates.length > 0 && (
                              <span className="text-[10px] text-slate-500 ml-1">
                                ({salary.not_marked_dates.slice(0, 3).map(d => format(new Date(d), 'dd')).join(', ')}
                                {salary.not_marked_dates.length > 3 && '...'})
                              </span>
                            )}
                          </div>
                        )}
                        {salary.overtime_hours > 0 && (
                          <Badge variant="outline" className="text-xs">OT: {salary.overtime_hours}h</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>₹{(salary.base_salary || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="text-xs space-y-1">
                        {(salary.incentive || 0) > 0 && (
                          <div className="text-green-600">+₹{salary.incentive.toLocaleString()} (I)</div>
                        )}
                        {(salary.bonus || 0) > 0 && (
                          <div className="text-green-600">+₹{salary.bonus.toLocaleString()} (B)</div>
                        )}
                        {(salary.overtime_amount || 0) > 0 && (
                          <div className="text-green-600">+₹{salary.overtime_amount.toLocaleString()} (OT)</div>
                        )}
                        {(salary.reimbursement || 0) > 0 && (
                          <div className="text-green-600">+₹{salary.reimbursement.toLocaleString()} (R)</div>
                        )}
                        {(salary.allowances || 0) > 0 && (
                          <div className="text-green-600">+₹{salary.allowances.toLocaleString()} (A)</div>
                        )}
                        {totalAdjustments !== 0 && (
                          <div className={totalAdjustments > 0 ? "text-green-600" : "text-red-600"}>
                            {totalAdjustments > 0 ? '+' : '-'}₹{Math.abs(totalAdjustments).toLocaleString()} (Adj)
                          </div>
                        )}
                        {(salary.incentive || 0) === 0 && (salary.bonus || 0) === 0 &&
                          (salary.overtime_amount || 0) === 0 && (salary.reimbursement || 0) === 0 &&
                          (salary.allowances || 0) === 0 && totalAdjustments === 0 && (
                            <div className="text-slate-400">-</div>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-red-600">₹{(salary.total_deductions || 0).toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="font-semibold">₹{(salary.net_salary || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(salary.status)}>
                          {salary.status}
                        </Badge>
                        {salary.locked && <Lock className="w-3 h-3 text-orange-600" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCurrentRecord(salary);
                            setAdjustmentDialogOpen(true);
                          }}
                          title="Add Adjustment"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => generateSlipMutation.mutate(salary.id)}
                          disabled={generateSlipMutation.isLoading}
                          title="Download Slip"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

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
        salaryRecords={selectedSalaries}
        currentUser={user}
      />

      <SalaryReportsDialog
        isOpen={reportsDialogOpen}
        onClose={() => setReportsDialogOpen(false)}
      />
    </div>
  );
}