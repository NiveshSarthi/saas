import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

export default function SalaryPolicyForm({ isOpen, onClose, policy, allUsers }) {
  const queryClient = useQueryClient();

  // We use 'basic_salary' to store the combined "Basic + DA" value entered by user.
  // 'da' field is kept 0 or internal.
  const [formData, setFormData] = useState({
    user_email: '',
    salary_type: 'per_day',

    // Earnings
    basic_salary: '', // Stores Basic + DA Combined Input
    da: 0,
    hra: '', // calculated
    conveyance_allowance: '',
    special_allowance: 1000,
    other_allowance: '',

    // Deductions
    employee_pf_percentage: 12,
    employee_pf_fixed: '',
    employee_esi_percentage: 0.75,
    employee_esi_fixed: '',
    labour_welfare_employee: 50,
    professional_tax: 0, // Default 0

    // Employer Contributions
    employer_pf_percentage: 12,
    employer_esi_percentage: 3.25,
    pf_admin_charges: '',
    bonus_amount: '',
    gratuity_amount: '',
    labour_welfare_employer: 50,

    // Other settings
    late_penalty_enabled: false,
    late_penalty_per_minute: '',
    is_active: true
  });

  // Auto-calculation Effect
  useEffect(() => {
    const basicCombined = Number(formData.basic_salary) || 0;

    // Formulas based on User Request:
    // 1. HRA = 50% of (Basic + DA)
    const hra = Math.round(basicCombined * 0.50);

    // 2. Conveyance = 15% of (Basic + DA)
    const conveyance = Math.round(basicCombined * 0.15);

    // 3. Special Allowance = 1000 (Fixed)
    const special = 1000;

    // 4. Other Allowance = ((Basic + DA) * 35%) - Special Allowance
    const otherRaw = (basicCombined * 0.35) - special;
    const other = Math.max(0, Math.round(otherRaw)); // Clamp to 0 if negative

    const gross = basicCombined + hra + conveyance + special + other;

    // 5. PF: 12% of (Basic + DA) OR Max 1800
    // Handled in calculateValues generally, but good to ensure inputs consistent.

    // 6. ESIC Logic (Gross <= 21000)
    // Updated threshold from 15472 -> 21000
    let newEsiEmpPct = 0.75;
    let newEsiEmplrPct = 3.25;

    if (gross > 21000) {
      newEsiEmpPct = 0;
      newEsiEmplrPct = 0;
    }

    // 7. Bonus: 8.33% of max(Basic+DA, 7000)
    const bonusBase = Math.max(basicCombined, 7000);
    const bonus = Math.round(bonusBase * 0.0833);

    // 8. Gratuity: 4.81% of (Basic + DA)
    const gratuity = Math.round(basicCombined * 0.0481);

    // 9. LWF Employee: 0.20% Max 34
    const lwfRaw = gross * 0.002;
    const lwf = Math.min(Math.round(lwfRaw), 34);

    // 10. LWF Employer: 0.40% Max 68
    const lwfEmplrRaw = gross * 0.004;
    const lwfEmplr = Math.min(Math.round(lwfEmplrRaw), 68);

    setFormData(prev => {
      // Prevent infinite loop by checking current values
      if (prev.hra === hra &&
        prev.conveyance_allowance === conveyance &&
        prev.special_allowance === special &&
        prev.other_allowance === other &&
        prev.bonus_amount === bonus &&
        prev.gratuity_amount === gratuity &&
        prev.employee_esi_percentage === newEsiEmpPct &&
        prev.labour_welfare_employee === lwf &&
        prev.labour_welfare_employer === lwfEmplr) {
        return prev;
      }

      return {
        ...prev,
        da: 0, // Ensure DA is 0 as it's merged
        hra: hra,
        conveyance_allowance: conveyance,
        special_allowance: special,
        other_allowance: other,
        bonus_amount: bonus,
        gratuity_amount: gratuity,
        employee_esi_percentage: newEsiEmpPct,
        employer_esi_percentage: newEsiEmplrPct,
        labour_welfare_employee: lwf,
        labour_welfare_employer: lwfEmplr
      };
    });

  }, [formData.basic_salary]); // Only depend on basic_salary input


  // Calculation Helpers for Render
  const calculateValues = () => {
    const basicCombined = Number(formData.basic_salary) || 0;
    const hra = Number(formData.hra) || 0;
    const conv = Number(formData.conveyance_allowance) || 0;
    const special = Number(formData.special_allowance) || 0;
    const other = Number(formData.other_allowance) || 0;

    const gross = basicCombined + hra + conv + special + other;

    // PF: 12% of BasicCombined OR MAX 1800
    const pfBase = basicCombined;
    let pfEmp = Math.round(pfBase * (Number(formData.employee_pf_percentage) / 100));
    let pfEmplr = Math.round(pfBase * (Number(formData.employer_pf_percentage) / 100));

    // Apply 1800 Cap
    pfEmp = Math.min(pfEmp, 1800);
    pfEmplr = Math.min(pfEmplr, 1800);

    const pfAdmin = Math.round(pfBase * 0.01); // 1% of Basic+DA (No Cap)

    // ESIC: Use Math.ceil (ROUNDUP)
    const esiEmp = Math.ceil(gross * (Number(formData.employee_esi_percentage) / 100));
    const esiEmplr = Math.ceil(gross * (Number(formData.employer_esi_percentage) / 100));

    // Deductions
    const pt = Number(formData.professional_tax) || 0;
    const lwfEmp = Number(formData.labour_welfare_employee) || 0;

    const totalDed = pfEmp + esiEmp + pt + lwfEmp;
    const netSalary = gross - totalDed;

    // Employer Liability
    const lwfEmplr = Number(formData.labour_welfare_employer) || 0;
    const bonus = Number(formData.bonus_amount) || 0;
    const gratuity = Number(formData.gratuity_amount) || 0;

    const ctc = gross + pfEmplr + esiEmplr + lwfEmplr + bonus + gratuity + pfAdmin;
    const statutoryCost = pfEmplr + esiEmplr + lwfEmplr + bonus + gratuity + pfAdmin;

    return { gross, pfEmp, pfEmplr, pfAdmin, esiEmp, esiEmplr, totalDed, netSalary, ctc, statutoryCost };
  };

  const calcs = calculateValues();

  useEffect(() => {
    if (policy) {
      // Load existing policy
      const loadedBasic = (policy.basic_salary || 0) + (policy.da || 0);

      setFormData({
        ...policy,
        basic_salary: loadedBasic,
        da: 0,
        conveyance_allowance: policy.conveyance_allowance || 0,
        special_allowance: policy.special_allowance || 1000,
        other_allowance: policy.other_allowance || 0,
        professional_tax: policy.professional_tax || 0,
        bonus_amount: policy.bonus_amount || 0,
        gratuity_amount: policy.gratuity_amount || 0,
        pf_admin_charges: policy.pf_admin_charges || 0,
      });
    }
  }, [policy, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Ensure we send numbers
      const cleanData = {
        ...data,
        basic_salary: Number(data.basic_salary),
        da: 0,
        hra: Number(data.hra),
        conveyance_allowance: Number(data.conveyance_allowance),
        special_allowance: Number(data.special_allowance),
        other_allowance: Number(data.other_allowance),
        professional_tax: Number(data.professional_tax),
        pf_admin_charges: Number(data.pf_admin_charges) || calcs.pfAdmin,
        bonus_amount: Number(data.bonus_amount),
        gratuity_amount: Number(data.gratuity_amount),
        // Ensure ESIC percentages are sent correctly as calculated
        employee_esi_percentage: data.employee_esi_percentage,
        employer_esi_percentage: data.employer_esi_percentage,
        monthly_salary: calcs.gross, // Save calculated gross as monthly_salary
      };

      if (policy?.id) {
        return await base44.entities.SalaryPolicy.update(policy.id, cleanData);
      } else {
        return await base44.entities.SalaryPolicy.create(cleanData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-policies']);
      toast.success('Policy saved successfully');
      onClose();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.basic_salary) {
      toast.error("Basic Salary + DA value is required");
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto w-full">
        <DialogHeader>
          <DialogTitle>{policy?.id ? 'Edit' : 'Create'} Salary Policy</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee *</Label>
              <Select value={formData.user_email} onValueChange={v => setFormData({ ...formData, user_email: v })} disabled={!!policy?.id}>
                <SelectTrigger><SelectValue placeholder="Select Employee" /></SelectTrigger>
                <SelectContent>
                  {allUsers?.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salary Type</Label>
              <Select value={formData.salary_type} onValueChange={v => setFormData({ ...formData, salary_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_day">Per Day</SelectItem>
                  <SelectItem value="fixed_monthly">Fixed Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* SECTION 1: GROSS WAGE */}
            <div className="bg-slate-50 p-4 rounded border">
              <h3 className="font-bold text-lg mb-3 border-b pb-2 text-slate-700">1. Total Gross Wage</h3>

              <div className="space-y-3">
                <div>
                  <Label className="text-green-700 font-bold">Minimum Wages (BASIC + DA) *</Label>
                  <Input
                    placeholder="Enter Amount"
                    type="number"
                    value={formData.basic_salary}
                    onChange={e => setFormData({ ...formData, basic_salary: e.target.value })}
                    className="text-lg font-semibold"
                  />
                </div>

                <div>
                  <Label>HRA (Auto 50%)</Label>
                  <Input value={formData.hra} readOnly className="bg-slate-100" />
                </div>

                <div>
                  <Label>Conveyance (15%)</Label>
                  <Input value={formData.conveyance_allowance} readOnly className="bg-slate-100" />
                </div>

                <div>
                  <Label className="text-red-500">Special Allowance (Fixed 1000)</Label>
                  <Input value={formData.special_allowance} readOnly className="bg-slate-100" />
                </div>

                <div>
                  <Label>Other Allowance (35% - Special)</Label>
                  <Input value={formData.other_allowance} readOnly className="bg-slate-100" />
                </div>

                <div className="bg-slate-200 p-2 rounded flex justify-between items-center font-bold text-lg">
                  <span>Total Gross Wage:</span>
                  <span>₹{calcs.gross.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* SECTION 2: DEDUCTIONS */}
            <div className="bg-red-50 p-4 rounded border">
              <h3 className="font-bold text-lg mb-3 border-b pb-2 text-red-800">2. Employee Deductions</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <Label>PF Contribution (12%)</Label>
                  <span className="font-mono">₹{calcs.pfEmp}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>ESIC (0.75% of Gross)</Label>
                  {formData.employee_esi_percentage === 0 && <span className="text-xs text-slate-500">(Gross {'>'} 21000)</span>}
                  <span className="font-mono">₹{calcs.esiEmp}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>LWF</Label>
                  <div className="w-20">
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.labour_welfare_employee}
                      onChange={e => setFormData({ ...formData, labour_welfare_employee: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>Professional Tax</Label>
                  <div className="w-20">
                    <Input
                      type="number"
                      className="h-8"
                      value={formData.professional_tax}
                      onChange={e => setFormData({ ...formData, professional_tax: e.target.value })}
                    />
                  </div>
                </div>

                <Separator className="bg-red-200" />

                <div className="flex justify-between items-center font-bold text-red-900">
                  <span>Total Deductions:</span>
                  <span>₹{calcs.totalDed.toLocaleString()}</span>
                </div>

                <div className="bg-green-600 text-white p-3 rounded mt-4 text-center shadow-lg">
                  <div className="text-sm opacity-90">Net Salary in Hand</div>
                  <div className="text-3xl font-bold">₹{calcs.netSalary.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* SECTION 3: EMPLOYER LIABILITY */}
            <div className="bg-blue-50 p-4 rounded border">
              <h3 className="font-bold text-lg mb-3 border-b pb-2 text-blue-800">3. Employer Liability</h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <Label>PF 12% on Basic+DA</Label>
                  <span className="font-mono">₹{calcs.pfEmplr}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>PF Admin Charges (1%)</Label>
                  <span className="font-mono">₹{calcs.pfAdmin}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>ESIC (3.25% of Gross)</Label>
                  <span className="font-mono">₹{calcs.esiEmplr}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>LWF (Employer)</Label>
                  <Input
                    type="number"
                    className="h-8 w-20"
                    value={formData.labour_welfare_employer}
                    onChange={e => setFormData({ ...formData, labour_welfare_employer: e.target.value })}
                  />
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>Bonus (8.33%)</Label>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={formData.bonus_amount}
                    onChange={e => setFormData({ ...formData, bonus_amount: e.target.value })}
                  />
                </div>

                <div className="flex justify-between items-center text-sm">
                  <Label>Gratuity (4.81%)</Label>
                  <Input
                    type="number"
                    className="h-8 w-24"
                    value={formData.gratuity_amount}
                    onChange={e => setFormData({ ...formData, gratuity_amount: e.target.value })}
                  />
                </div>

                <div className="flex justify-between items-center text-sm font-semibold text-blue-800">
                  <Label>Statutory Cost</Label>
                  <span className="font-mono">₹{calcs.statutoryCost.toLocaleString()}</span>
                </div>

                <Separator className="bg-blue-200" />

                <div className="flex justify-between items-center font-bold text-blue-900">
                  <span>CTC (Cost to Company):</span>
                  <span>₹{calcs.ctc.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Policy'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog >
  );
}