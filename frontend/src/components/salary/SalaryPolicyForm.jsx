import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function SalaryPolicyForm({ isOpen, onClose, policy, allUsers }) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    user_email: '',
    salary_type: 'per_day',
    basic_salary: '',
    hra: '',
    da: '',
    travelling_allowance: '',
    children_education_allowance: '',
    fixed_incentive: '',
    monthly_salary: '',
    per_day_salary: '',
    per_hour_salary: '',
    employee_pf_percentage: '',
    employee_pf_fixed: '',
    employee_esi_percentage: '',
    employee_esi_fixed: '',
    labour_welfare_employee: '',
    employer_pf_percentage: '',
    employer_pf_fixed: '',
    employer_esi_percentage: '',
    employer_esi_fixed: '',
    labour_welfare_employer: '',
    ex_gratia_percentage: '',
    ex_gratia_fixed: '',
    employer_incentive: '',
    late_penalty_enabled: false,
    late_penalty_per_minute: '',
    half_day_threshold_hours: 4,
    full_day_threshold_hours: 6,
    weekend_paid: false,
    is_active: true
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.list(),
  });

  // Calculate gross salary in real-time
  const calculatedGross = React.useMemo(() => {
    const basic = Number(formData.basic_salary) || 0;
    const hra = Number(formData.hra) || 0;
    const da = Number(formData.da) || 0;
    const ta = Number(formData.travelling_allowance) || 0;
    const cea = Number(formData.children_education_allowance) || 0;
    const fi = Number(formData.fixed_incentive) || 0;
    return basic + hra + da + ta + cea + fi;
  }, [formData.basic_salary, formData.hra, formData.da, formData.travelling_allowance, formData.children_education_allowance, formData.fixed_incentive]);

  useEffect(() => {
    if (policy) {
      setFormData({
        user_email: policy.user_email || '',
        salary_type: policy.salary_type || 'per_day',
        basic_salary: policy.basic_salary || '',
        hra: policy.hra || '',
        da: policy.da || '',
        travelling_allowance: policy.travelling_allowance || '',
        children_education_allowance: policy.children_education_allowance || '',
        fixed_incentive: policy.fixed_incentive || '',
        monthly_salary: policy.monthly_salary || '',
        per_day_salary: policy.per_day_salary || '',
        per_hour_salary: policy.per_hour_salary || '',
        employee_pf_percentage: policy.employee_pf_percentage || '',
        employee_pf_fixed: policy.employee_pf_fixed || '',
        employee_esi_percentage: policy.employee_esi_percentage || '',
        employee_esi_fixed: policy.employee_esi_fixed || '',
        labour_welfare_employee: policy.labour_welfare_employee || '',
        employer_pf_percentage: policy.employer_pf_percentage || '',
        employer_pf_fixed: policy.employer_pf_fixed || '',
        employer_esi_percentage: policy.employer_esi_percentage || '',
        employer_esi_fixed: policy.employer_esi_fixed || '',
        labour_welfare_employer: policy.labour_welfare_employer || '',
        ex_gratia_percentage: policy.ex_gratia_percentage || '',
        ex_gratia_fixed: policy.ex_gratia_fixed || '',
        employer_incentive: policy.employer_incentive || '',
        late_penalty_enabled: policy.late_penalty_enabled || false,
        late_penalty_per_minute: policy.late_penalty_per_minute || '',
        half_day_threshold_hours: policy.half_day_threshold_hours || 4,
        full_day_threshold_hours: policy.full_day_threshold_hours || 6,
        weekend_paid: policy.weekend_paid || false,
        is_active: policy.is_active !== false
      });
    } else {
      setFormData({
        user_email: '',
        salary_type: 'per_day',
        basic_salary: '',
        hra: '',
        da: '',
        travelling_allowance: '',
        children_education_allowance: '',
        fixed_incentive: '',
        monthly_salary: '',
        per_day_salary: '',
        per_hour_salary: '',
        employee_pf_percentage: '',
        employee_pf_fixed: '',
        employee_esi_percentage: '',
        employee_esi_fixed: '',
        labour_welfare_employee: '',
        employer_pf_percentage: '',
        employer_pf_fixed: '',
        employer_esi_percentage: '',
        employer_esi_fixed: '',
        labour_welfare_employer: '',
        ex_gratia_percentage: '',
        ex_gratia_fixed: '',
        employer_incentive: '',
        late_penalty_enabled: false,
        late_penalty_per_minute: '',
        half_day_threshold_hours: 4,
        full_day_threshold_hours: 6,
        weekend_paid: false,
        is_active: true
      });
    }
  }, [policy, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const cleanData = {
        ...data,
        basic_salary: parseFloat(data.basic_salary) || 0,
        hra: parseFloat(data.hra) || 0,
        da: parseFloat(data.da) || 0,
        travelling_allowance: parseFloat(data.travelling_allowance) || 0,
        children_education_allowance: parseFloat(data.children_education_allowance) || 0,
        fixed_incentive: parseFloat(data.fixed_incentive) || 0,
        monthly_salary: parseFloat(data.monthly_salary) || 0,
        per_day_salary: parseFloat(data.per_day_salary) || 0,
        per_hour_salary: parseFloat(data.per_hour_salary) || 0,
        employee_pf_percentage: parseFloat(data.employee_pf_percentage) || 0,
        employee_pf_fixed: parseFloat(data.employee_pf_fixed) || 0,
        employee_esi_percentage: parseFloat(data.employee_esi_percentage) || 0,
        employee_esi_fixed: parseFloat(data.employee_esi_fixed) || 0,
        labour_welfare_employee: parseFloat(data.labour_welfare_employee) || 0,
        employer_pf_percentage: parseFloat(data.employer_pf_percentage) || 0,
        employer_pf_fixed: parseFloat(data.employer_pf_fixed) || 0,
        employer_esi_percentage: parseFloat(data.employer_esi_percentage) || 0,
        employer_esi_fixed: parseFloat(data.employer_esi_fixed) || 0,
        labour_welfare_employer: parseFloat(data.labour_welfare_employer) || 0,
        ex_gratia_percentage: parseFloat(data.ex_gratia_percentage) || 0,
        ex_gratia_fixed: parseFloat(data.ex_gratia_fixed) || 0,
        employer_incentive: parseFloat(data.employer_incentive) || 0,
        late_penalty_per_minute: parseFloat(data.late_penalty_per_minute) || 0,
        half_day_threshold_hours: parseFloat(data.half_day_threshold_hours) || 4,
        full_day_threshold_hours: parseFloat(data.full_day_threshold_hours) || 6
      };

      if (policy?.id) {
        return await base44.entities.SalaryPolicy.update(policy.id, cleanData);
      } else {
        return await base44.entities.SalaryPolicy.create(cleanData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-policies']);
      toast.success(policy?.id ? 'Policy updated' : 'Policy created');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.user_email) {
      toast.error('Please select an employee');
      return;
    }

    if (!formData.basic_salary || parseFloat(formData.basic_salary) <= 0) {
      toast.error('Please enter basic salary');
      return;
    }

    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{policy?.id ? 'Edit' : 'Create'} Salary Policy</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Selection */}
          <div>
            <Label>Employee *</Label>
            <Select
              value={formData.user_email}
              onValueChange={(value) => setFormData({ ...formData, user_email: value })}
              disabled={!!policy?.id}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {allUsers?.map(user => (
                  <SelectItem key={user.email} value={user.email}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Salary Type */}
          <div>
            <Label>Salary Type *</Label>
            <Select
              value={formData.salary_type}
              onValueChange={(value) => setFormData({ ...formData, salary_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_day">Per Day</SelectItem>
                <SelectItem value="fixed_monthly">Fixed Monthly</SelectItem>
                <SelectItem value="per_hour">Per Hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Earnings Section */}
          <div className="p-4 bg-green-50 rounded-lg space-y-3">
            <h3 className="font-semibold text-green-900">💰 Earnings (Monthly)</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Basic Salary (₹) *</Label>
                <Input
                  type="number"
                  placeholder="15000"
                  value={formData.basic_salary}
                  onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                />
              </div>
              <div>
                <Label>HRA (₹)</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={formData.hra}
                  onChange={(e) => setFormData({ ...formData, hra: e.target.value })}
                />
              </div>
              <div>
                <Label>DA (₹)</Label>
                <Input
                  type="number"
                  placeholder="3000"
                  value={formData.da}
                  onChange={(e) => setFormData({ ...formData, da: e.target.value })}
                />
              </div>
              <div>
                <Label>Travelling Allowance (₹)</Label>
                <Input
                  type="number"
                  placeholder="2000"
                  value={formData.travelling_allowance}
                  onChange={(e) => setFormData({ ...formData, travelling_allowance: e.target.value })}
                />
              </div>
              <div>
                <Label>Children Education Allowance (₹)</Label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={formData.children_education_allowance}
                  onChange={(e) => setFormData({ ...formData, children_education_allowance: e.target.value })}
                />
              </div>
              <div>
                <Label>Fixed Incentive (₹)</Label>
                <Input
                  type="number"
                  placeholder="3000"
                  value={formData.fixed_incentive}
                  onChange={(e) => setFormData({ ...formData, fixed_incentive: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-green-700 mt-2 font-semibold">
              Gross = Basic + HRA + DA + TA + CEA + Fixed Incentive = ₹{calculatedGross.toLocaleString()}
            </p>
          </div>

          {/* Employee Deductions Section */}
          <div className="p-4 bg-red-50 rounded-lg space-y-3">
            <h3 className="font-semibold text-red-900">📉 Employee Deductions</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>PF (%) or Fixed (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="12%"
                    value={formData.employee_pf_percentage}
                    onChange={(e) => setFormData({ ...formData, employee_pf_percentage: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="₹"
                    value={formData.employee_pf_fixed}
                    onChange={(e) => setFormData({ ...formData, employee_pf_fixed: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>ESI (%) or Fixed (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.75%"
                    value={formData.employee_esi_percentage}
                    onChange={(e) => setFormData({ ...formData, employee_esi_percentage: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="₹"
                    value={formData.employee_esi_fixed}
                    onChange={(e) => setFormData({ ...formData, employee_esi_fixed: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Labour Welfare Fund (₹)</Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={formData.labour_welfare_employee}
                  onChange={(e) => setFormData({ ...formData, labour_welfare_employee: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-red-700 mt-2 font-semibold">
              Total Deductions = PF: ₹{(
                (Number(formData.employee_pf_percentage) > 0 ? (calculatedGross * Number(formData.employee_pf_percentage) / 100) : Number(formData.employee_pf_fixed)) || 0
              ).toLocaleString()} + ESI: ₹{(
                (Number(formData.employee_esi_percentage) > 0 ? (calculatedGross * Number(formData.employee_esi_percentage) / 100) : Number(formData.employee_esi_fixed)) || 0
              ).toLocaleString()} + LWF: ₹{(Number(formData.labour_welfare_employee) || 0).toLocaleString()} = ₹{(
                (Number(formData.employee_pf_percentage) > 0 ? (calculatedGross * Number(formData.employee_pf_percentage) / 100) : Number(formData.employee_pf_fixed)) +
                (Number(formData.employee_esi_percentage) > 0 ? (calculatedGross * Number(formData.employee_esi_percentage) / 100) : Number(formData.employee_esi_fixed)) +
                (Number(formData.labour_welfare_employee) || 0)
              ).toLocaleString()}
            </p>
          </div>

          {/* Employer Contributions Section */}
          <div className="p-4 bg-blue-50 rounded-lg space-y-3">
            <h3 className="font-semibold text-blue-900">🏢 Employer Contributions</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Employer PF (%) or Fixed (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="12%"
                    value={formData.employer_pf_percentage}
                    onChange={(e) => setFormData({ ...formData, employer_pf_percentage: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="₹"
                    value={formData.employer_pf_fixed}
                    onChange={(e) => setFormData({ ...formData, employer_pf_fixed: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Employer ESI (%) or Fixed (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="3.25%"
                    value={formData.employer_esi_percentage}
                    onChange={(e) => setFormData({ ...formData, employer_esi_percentage: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="₹"
                    value={formData.employer_esi_fixed}
                    onChange={(e) => setFormData({ ...formData, employer_esi_fixed: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Labour Welfare Fund (₹)</Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={formData.labour_welfare_employer}
                  onChange={(e) => setFormData({ ...formData, labour_welfare_employer: e.target.value })}
                />
              </div>
              <div>
                <Label>Gratuity (%) or Fixed (₹)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="5%"
                    value={formData.ex_gratia_percentage}
                    onChange={(e) => setFormData({ ...formData, ex_gratia_percentage: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="₹"
                    value={formData.ex_gratia_fixed}
                    onChange={(e) => setFormData({ ...formData, ex_gratia_fixed: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Employer Incentive (₹)</Label>
                <Input
                  type="number"
                  placeholder="2000"
                  value={formData.employer_incentive}
                  onChange={(e) => setFormData({ ...formData, employer_incentive: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-blue-700 mt-2 font-semibold">
              Total Employer Contributions = PF: ₹{(
                Math.round(Number(formData.employer_pf_percentage) > 0 ? (calculatedGross * Number(formData.employer_pf_percentage) / 100) : Number(formData.employer_pf_fixed)) || 0
              ).toLocaleString()} + ESI: ₹{(
                Math.round(Number(formData.employer_esi_percentage) > 0 ? (calculatedGross * Number(formData.employer_esi_percentage) / 100) : Number(formData.employer_esi_fixed)) || 0
              ).toLocaleString()} + LWF: ₹{(Number(formData.labour_welfare_employer) || 0).toLocaleString()} + Gratuity: ₹{(
                Math.round(Number(formData.ex_gratia_percentage) > 0 ? (Number(formData.basic_salary) * Number(formData.ex_gratia_percentage) / 100) : Number(formData.ex_gratia_fixed)) || 0
              ).toLocaleString()} + Incentive: ₹{(Number(formData.employer_incentive) || 0).toLocaleString()} = ₹{(
                Math.round(Number(formData.employer_pf_percentage) > 0 ? (calculatedGross * Number(formData.employer_pf_percentage) / 100) : Number(formData.employer_pf_fixed)) +
                Math.round(Number(formData.employer_esi_percentage) > 0 ? (calculatedGross * Number(formData.employer_esi_percentage) / 100) : Number(formData.employer_esi_fixed)) +
                (Number(formData.labour_welfare_employer) || 0) +
                Math.round(Number(formData.ex_gratia_percentage) > 0 ? (Number(formData.basic_salary) * Number(formData.ex_gratia_percentage) / 100) : Number(formData.ex_gratia_fixed)) +
                (Number(formData.employer_incentive) || 0)
              ).toLocaleString()}
            </p>
          </div>

          {/* CTC Calculation */}
          <div className="p-4 bg-purple-50 rounded-lg space-y-2 border-2 border-purple-200">
            <h3 className="font-semibold text-purple-900">💼 Cost to Company (CTC)</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-700">Policy Gross (Basic+HRA+DA+TA+CEA+FI):</span>
                <span className="font-semibold text-lg text-purple-900">₹{calculatedGross.toLocaleString()}</span>
              </div>
              <div className="text-xs text-purple-600 italic mb-2">
                ✓ Employer Incentive is separate and added to employer contributions below
              </div>
              <div className="border-t border-purple-300 pt-2"></div>
              <div className="flex justify-between">
                <span className="text-slate-700">Employer Contributions (PF+ESI+LWF+Gratuity+Incentive):</span>
                <span className="font-semibold">₹{(
                  Math.round(Number(formData.employer_pf_percentage) > 0 ? (calculatedGross * Number(formData.employer_pf_percentage) / 100) : Number(formData.employer_pf_fixed)) +
                  Math.round(Number(formData.employer_esi_percentage) > 0 ? (calculatedGross * Number(formData.employer_esi_percentage) / 100) : Number(formData.employer_esi_fixed)) +
                  (Number(formData.labour_welfare_employer) || 0) +
                  Math.round(Number(formData.ex_gratia_percentage) > 0 ? (Number(formData.basic_salary) * Number(formData.ex_gratia_percentage) / 100) : Number(formData.ex_gratia_fixed)) +
                  (Number(formData.employer_incentive) || 0)
                ).toLocaleString()}</span>
              </div>
              <div className="border-t border-purple-300 pt-2 mt-2"></div>
              <div className="flex justify-between text-base">
                <span className="font-bold text-purple-900">Monthly CTC-1 (Policy Based):</span>
                <span className="font-bold text-purple-900">₹{(
                  calculatedGross +
                  Math.round(Number(formData.employer_pf_percentage) > 0 ? (calculatedGross * Number(formData.employer_pf_percentage) / 100) : Number(formData.employer_pf_fixed)) +
                  Math.round(Number(formData.employer_esi_percentage) > 0 ? (calculatedGross * Number(formData.employer_esi_percentage) / 100) : Number(formData.employer_esi_fixed)) +
                  (Number(formData.labour_welfare_employer) || 0) +
                  Math.round(Number(formData.ex_gratia_percentage) > 0 ? (Number(formData.basic_salary) * Number(formData.ex_gratia_percentage) / 100) : Number(formData.ex_gratia_fixed)) +
                  (Number(formData.employer_incentive) || 0)
                ).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-bold text-purple-900">Annual CTC-1:</span>
                <span className="font-bold text-purple-900">₹{((
                  calculatedGross +
                  Math.round(Number(formData.employer_pf_percentage) > 0 ? (calculatedGross * Number(formData.employer_pf_percentage) / 100) : Number(formData.employer_pf_fixed)) +
                  Math.round(Number(formData.employer_esi_percentage) > 0 ? (calculatedGross * Number(formData.employer_esi_percentage) / 100) : Number(formData.employer_esi_fixed)) +
                  (Number(formData.labour_welfare_employer) || 0) +
                  Math.round(Number(formData.ex_gratia_percentage) > 0 ? (Number(formData.basic_salary) * Number(formData.ex_gratia_percentage) / 100) : Number(formData.ex_gratia_fixed)) +
                  (Number(formData.employer_incentive) || 0)
                ) * 12).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Old Salary Fields for backwards compatibility */}
          {formData.salary_type === 'per_day' && (
            <div>
              <Label>Per Day Salary (₹) (Optional - for per-day calculation)</Label>
              <Input
                type="number"
                placeholder="1000"
                value={formData.per_day_salary}
                onChange={(e) => setFormData({ ...formData, per_day_salary: e.target.value })}
              />
            </div>
          )}

          {formData.salary_type === 'fixed_monthly' && (
            <div>
              <Label>Total Monthly Salary (₹) (Auto-calculated from components)</Label>
              <Input
                type="number"
                placeholder="30000"
                value={calculatedGross}
                disabled
                className="bg-slate-100 font-semibold"
              />
            </div>
          )}

          {formData.salary_type === 'per_hour' && (
            <div>
              <Label>Per Hour Salary (₹) (Optional)</Label>
              <Input
                type="number"
                placeholder="125"
                value={formData.per_hour_salary}
                onChange={(e) => setFormData({ ...formData, per_hour_salary: e.target.value })}
              />
            </div>
          )}

          {/* Late Penalty */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label>Enable Late Penalty</Label>
              <p className="text-xs text-slate-500">Deduct amount for late arrivals</p>
            </div>
            <Switch
              checked={formData.late_penalty_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, late_penalty_enabled: checked })}
            />
          </div>

          {formData.late_penalty_enabled && (
            <div>
              <Label>Penalty Per Minute (₹)</Label>
              <Input
                type="number"
                placeholder="5"
                value={formData.late_penalty_per_minute}
                onChange={(e) => setFormData({ ...formData, late_penalty_per_minute: e.target.value })}
              />
            </div>
          )}

          {/* Half Day Rules */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Half Day Threshold (Hours)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.half_day_threshold_hours}
                onChange={(e) => setFormData({ ...formData, half_day_threshold_hours: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Below this = half day</p>
            </div>
            <div>
              <Label>Full Day Threshold (Hours)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.full_day_threshold_hours}
                onChange={(e) => setFormData({ ...formData, full_day_threshold_hours: e.target.value })}
              />
              <p className="text-xs text-slate-500 mt-1">Above this = full day</p>
            </div>
          </div>

          {/* Weekend Paid */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label>Weekend Paid</Label>
              <p className="text-xs text-slate-500">Pay for week-off days</p>
            </div>
            <Switch
              checked={formData.weekend_paid}
              onCheckedChange={(checked) => setFormData({ ...formData, weekend_paid: checked })}
            />
          </div>

          {/* Active */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-slate-500">Is this policy currently active</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Policy'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}