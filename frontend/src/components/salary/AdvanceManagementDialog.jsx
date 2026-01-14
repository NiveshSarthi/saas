import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Calendar, TrendingDown, Plus, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AdvanceManagementDialog({ isOpen, onClose, employeeEmail, currentUser, allUsers, onAdvanceCreated }) {
  const [formData, setFormData] = useState({
    employee_email: employeeEmail || '',
    advance_amount: '',
    installments: '3',
    reason: '',
    advance_date: format(new Date(), 'yyyy-MM-dd'),
    recovery_start_month: format(new Date(), 'yyyy-MM')
  });

  const queryClient = useQueryClient();

  // Update employee_email when prop changes
  React.useEffect(() => {
    if (employeeEmail && isOpen) {
      setFormData(prev => ({ ...prev, employee_email: employeeEmail }));
    }
  }, [employeeEmail, isOpen]);

  const { data: advances = [] } = useQuery({
    queryKey: ['salary-advances', formData.employee_email],
    queryFn: () => base44.entities.SalaryAdvance.filter({ 
      employee_email: formData.employee_email 
    }, '-advance_date'),
    enabled: !!formData.employee_email && isOpen
  });

  const createAdvanceMutation = useMutation({
    mutationFn: async (data) => {
      const installmentAmount = parseFloat(data.advance_amount) / parseInt(data.installments);
      const employee = allUsers?.find(u => u.email === data.employee_email);
      
      return await base44.entities.SalaryAdvance.create({
        ...data,
        employee_name: employee?.full_name || employee?.name || data.employee_email,
        advance_amount: parseFloat(data.advance_amount),
        installments: parseInt(data.installments),
        installment_amount: installmentAmount,
        remaining_balance: parseFloat(data.advance_amount),
        recovered_amount: 0,
        approved_by: currentUser?.email,
        status: 'active'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-advances']);
      toast.success('Advance created successfully');
      setFormData({
        employee_email: employeeEmail || '',
        advance_amount: '',
        installments: '3',
        reason: '',
        advance_date: format(new Date(), 'yyyy-MM-dd'),
        recovery_start_month: format(new Date(), 'yyyy-MM')
      });
      if (onAdvanceCreated) {
        onAdvanceCreated();
      }
    }
  });

  const cancelAdvanceMutation = useMutation({
    mutationFn: async (advanceId) => {
      return await base44.entities.SalaryAdvance.update(advanceId, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-advances']);
      toast.success('Advance cancelled');
    }
  });

  const deleteAdvanceMutation = useMutation({
    mutationFn: async (advanceId) => {
      return await base44.entities.SalaryAdvance.delete(advanceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-advances']);
      toast.success('Advance deleted');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_email || !formData.advance_amount || !formData.installments) {
      toast.error('Please fill all required fields');
      return;
    }
    
    try {
      await createAdvanceMutation.mutateAsync(formData);
    } catch (error) {
      toast.error(error?.message || 'Failed to create advance');
    }
  };

  const activeAdvances = advances.filter(a => a.status === 'active');
  const totalAdvance = activeAdvances.reduce((sum, a) => sum + (a.remaining_balance || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            Advance Management
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Advance Form */}
          <div>
            <h3 className="font-semibold mb-4">Create New Advance</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Select
                  key={`employee-select-${formData.employee_email}-${isOpen}`}
                  value={formData.employee_email}
                  onValueChange={(value) => setFormData({ ...formData, employee_email: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers?.map(user => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.full_name || user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Advance Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.advance_amount}
                  onChange={(e) => setFormData({ ...formData, advance_amount: e.target.value })}
                  placeholder="10000"
                  required
                />
              </div>

              <div>
                <Label>Number of Installments</Label>
                <Select
                  value={formData.installments}
                  onValueChange={(value) => setFormData({ ...formData, installments: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Month</SelectItem>
                    <SelectItem value="2">2 Months</SelectItem>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                  </SelectContent>
                </Select>
                {formData.advance_amount && formData.installments && (
                  <p className="text-xs text-slate-600 mt-1">
                    ₹{(parseFloat(formData.advance_amount) / parseInt(formData.installments)).toFixed(2)} per month
                  </p>
                )}
              </div>

              <div>
                <Label>Advance Date</Label>
                <Input
                  type="date"
                  value={formData.advance_date}
                  onChange={(e) => setFormData({ ...formData, advance_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Recovery Start Month</Label>
                <Input
                  type="month"
                  value={formData.recovery_start_month}
                  onChange={(e) => setFormData({ ...formData, recovery_start_month: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Reason</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Emergency medical expense..."
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={createAdvanceMutation.isPending} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Create Advance
              </Button>
            </form>
          </div>

          {/* Existing Advances */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Existing Advances</h3>
              {formData.employee_email && (
                <Badge variant="outline" className="text-orange-600">
                  Total: ₹{totalAdvance.toLocaleString()}
                </Badge>
              )}
            </div>

            {!formData.employee_email ? (
              <div className="text-center py-8 text-slate-500">
                Select an employee to view advances
              </div>
            ) : advances.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                No advances found
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {advances.map((advance) => (
                  <Card key={advance.id} className={
                    advance.status === 'cancelled' ? 'opacity-50' : ''
                  }>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-semibold text-lg">₹{advance.advance_amount.toLocaleString()}</div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(advance.advance_date), 'dd MMM yyyy')}
                          </div>
                        </div>
                        <Badge className={
                          advance.status === 'completed' ? 'bg-green-100 text-green-700' :
                          advance.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          'bg-orange-100 text-orange-700'
                        }>
                          {advance.status}
                        </Badge>
                      </div>

                      {advance.reason && (
                        <p className="text-sm text-slate-600 mb-3">{advance.reason}</p>
                      )}

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-slate-500">Recovered</div>
                          <div className="font-semibold">₹{(advance.recovered_amount || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Remaining</div>
                          <div className="font-semibold text-orange-600">₹{(advance.remaining_balance || 0).toLocaleString()}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Installment</div>
                          <div className="font-semibold">₹{advance.installment_amount?.toLocaleString()}/mo</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Recovery From</div>
                          <div className="font-semibold">{advance.recovery_start_month}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-3">
                        {advance.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelAdvanceMutation.mutate(advance.id)}
                            className="flex-1 text-orange-600 hover:text-orange-700"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this advance? This action cannot be undone.')) {
                              deleteAdvanceMutation.mutate(advance.id);
                            }
                          }}
                          className="flex-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}