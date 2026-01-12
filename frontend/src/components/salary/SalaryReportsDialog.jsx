import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, DollarSign, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function SalaryReportsDialog({ isOpen, onClose }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: salaries = [] } = useQuery({
    queryKey: ['salary-records', selectedMonth],
    queryFn: () => base44.entities.SalaryRecord.filter({ month: selectedMonth }),
    enabled: isOpen
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: isOpen
  });

  // Department-wise salary
  const deptSalary = departments.map(dept => {
    const deptSalaries = salaries.filter(s => s.department === dept.id || s.department === dept.name);
    return {
      name: dept.name,
      total: deptSalaries.reduce((sum, s) => sum + (s.net_salary || 0), 0),
      count: deptSalaries.length
    };
  }).filter(d => d.count > 0);

  // Deduction reasons breakdown
  const deductionReasons = [
    { name: 'Late Penalties', value: salaries.reduce((sum, s) => sum + (s.late_penalty || 0), 0) },
    { name: 'Absent Deduction', value: salaries.reduce((sum, s) => sum + (s.absent_deduction || 0), 0) },
    { name: 'Unpaid Leave', value: salaries.reduce((sum, s) => sum + (s.unpaid_leave_deduction || 0), 0) },
    { name: 'Advance Recovery', value: salaries.reduce((sum, s) => sum + (s.advance_recovery || 0), 0) },
    { name: 'PF', value: salaries.reduce((sum, s) => sum + (s.pf_amount || 0), 0) },
    { name: 'ESI', value: salaries.reduce((sum, s) => sum + (s.esi_amount || 0), 0) },
    { name: 'TDS', value: salaries.reduce((sum, s) => sum + (s.tds_amount || 0), 0) },
    { name: 'Other', value: salaries.reduce((sum, s) => sum + (s.other_deductions || 0), 0) }
  ].filter(d => d.value > 0);

  // Status distribution
  const statusDist = [
    { name: 'Draft', value: salaries.filter(s => s.status === 'draft').length },
    { name: 'Locked', value: salaries.filter(s => s.status === 'locked').length },
    { name: 'Approved', value: salaries.filter(s => s.status === 'approved').length },
    { name: 'Paid', value: salaries.filter(s => s.status === 'paid').length }
  ].filter(s => s.value > 0);

  const totalGross = salaries.reduce((sum, s) => sum + (s.gross_salary || 0), 0);
  const totalNet = salaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
  const totalDeductions = salaries.reduce((sum, s) => sum + (s.total_deductions || 0), 0);
  const avgSalary = salaries.length > 0 ? totalNet / salaries.length : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Salary Reports & Analytics</DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="department">Department-wise</TabsTrigger>
            <TabsTrigger value="deductions">Deductions</TabsTrigger>
            <TabsTrigger value="history">Employee History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm text-slate-600">Employees</span>
                  </div>
                  <p className="text-2xl font-bold">{salaries.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-600">Total Payable</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">₹{(totalNet / 100000).toFixed(2)}L</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-slate-600">Total Deductions</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">₹{(totalDeductions / 100000).toFixed(2)}L</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-600">Avg Salary</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">₹{(avgSalary / 1000).toFixed(0)}K</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={statusDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {statusDist.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="department" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Department-wise Salary Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={deptSalary}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#4F46E5" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {deptSalary.map(dept => (
                <Card key={dept.name}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">{dept.name}</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Employees:</span>
                      <span className="font-medium">{dept.count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Cost:</span>
                      <span className="font-medium text-green-600">₹{(dept.total / 100000).toFixed(2)}L</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Avg per Employee:</span>
                      <span className="font-medium">₹{(dept.total / dept.count / 1000).toFixed(0)}K</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="deductions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Deduction Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={deductionReasons}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={(entry) => `${entry.name}: ₹${(entry.value / 1000).toFixed(0)}K`}
                    >
                      {deductionReasons.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {salaries.filter(s => (s.total_deductions || 0) > 0).map(salary => (
                <Card key={salary.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold">{salary.employee_name}</h4>
                        <div className="text-xs text-slate-500 space-y-1 mt-2">
                          {(salary.late_penalty || 0) > 0 && <div>Late: ₹{salary.late_penalty.toLocaleString()}</div>}
                          {(salary.absent_deduction || 0) > 0 && <div>Absent: ₹{salary.absent_deduction.toLocaleString()}</div>}
                          {(salary.unpaid_leave_deduction || 0) > 0 && <div>Unpaid Leave: ₹{salary.unpaid_leave_deduction.toLocaleString()}</div>}
                          {(salary.advance_recovery || 0) > 0 && <div>Advance: ₹{salary.advance_recovery.toLocaleString()}</div>}
                          {(salary.pf_amount || 0) > 0 && <div>PF: ₹{salary.pf_amount.toLocaleString()}</div>}
                          {(salary.esi_amount || 0) > 0 && <div>ESI: ₹{salary.esi_amount.toLocaleString()}</div>}
                          {(salary.tds_amount || 0) > 0 && <div>TDS: ₹{salary.tds_amount.toLocaleString()}</div>}
                          {(salary.other_deductions || 0) > 0 && <div>Other: ₹{salary.other_deductions.toLocaleString()}</div>}
                        </div>
                      </div>
                      <Badge className="bg-red-100 text-red-700">
                        ₹{(salary.total_deductions || 0).toLocaleString()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Employee Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-500">Select an employee to view salary history across months</p>
                {/* Future: Add employee selector and trend chart */}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}