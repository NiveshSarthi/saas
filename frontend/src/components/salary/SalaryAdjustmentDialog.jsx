import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SalaryAdjustmentDialog({ isOpen, onClose, salaryRecord, currentUser }) {
  const [formData, setFormData] = useState({
    adjustment_type: 'bonus',
    amount: '',
    reason: ''
  });
  
  const queryClient = useQueryClient();

  // Fetch existing adjustments
  const { data: adjustments = [] } = useQuery({
    queryKey: ['salary-adjustments', salaryRecord?.employee_email, salaryRecord?.month],
    queryFn: () => base44.entities.SalaryAdjustment.filter({
      employee_email: salaryRecord?.employee_email,
      month: salaryRecord?.month
    }),
    enabled: !!salaryRecord
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SalaryAdjustment.create({
      ...data,
      salary_record_id: salaryRecord.id,
      employee_email: salaryRecord.employee_email,
      month: salaryRecord.month,
      added_by: currentUser?.email,
      status: 'approved' // Auto-approve for admin
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-adjustments']);
      queryClient.invalidateQueries(['salary-records']);
      toast.success('Adjustment added successfully');
      setFormData({ adjustment_type: 'bonus', amount: '', reason: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalaryAdjustment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-adjustments']);
      queryClient.invalidateQueries(['salary-records']);
      toast.success('Adjustment deleted');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      amount: parseFloat(formData.amount)
    });
  };

  const getAdjustmentLabel = (type) => {
    const labels = {
      bonus: 'Bonus',
      incentive: 'Incentive',
      reimbursement: 'Reimbursement',
      allowance: 'Allowance',
      advance_deduction: 'Advance Deduction',
      penalty: 'Penalty',
      other: 'Other'
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Salary Adjustments - {salaryRecord?.employee_name}</DialogTitle>
        </DialogHeader>

        {/* Existing Adjustments */}
        {adjustments.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-sm text-slate-700">Existing Adjustments</h3>
            {adjustments.map((adj) => (
              <Card key={adj.id}>
                <CardContent className="p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{getAdjustmentLabel(adj.adjustment_type)}</Badge>
                        <span className={`font-semibold ${
                          ['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type)
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {['bonus', 'incentive', 'reimbursement', 'allowance'].includes(adj.adjustment_type) ? '+' : '-'}
                          ₹{Math.abs(adj.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{adj.reason}</p>
                      <p className="text-xs text-slate-400 mt-1">Added by: {adj.added_by}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Delete this adjustment?')) {
                          deleteMutation.mutate(adj.id);
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add New Adjustment Form */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-sm text-slate-700 mb-4">Add New Adjustment</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Adjustment Type</Label>
            <Select 
              value={formData.adjustment_type} 
              onValueChange={(v) => setFormData({...formData, adjustment_type: v})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bonus">Bonus (Addition)</SelectItem>
                <SelectItem value="incentive">Incentive (Addition)</SelectItem>
                <SelectItem value="reimbursement">Reimbursement (Addition)</SelectItem>
                <SelectItem value="allowance">Allowance (Addition)</SelectItem>
                <SelectItem value="advance_deduction">Advance Deduction</SelectItem>
                <SelectItem value="penalty">Penalty</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              placeholder="Enter amount"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {['bonus', 'incentive', 'reimbursement', 'allowance'].includes(formData.adjustment_type) 
                ? 'Positive amount will be added to salary' 
                : 'Amount will be deducted from salary'}
            </p>
          </div>

          <div>
            <Label>Reason</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              placeholder="Enter reason for this adjustment"
              required
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
              Add Adjustment
            </Button>
          </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}