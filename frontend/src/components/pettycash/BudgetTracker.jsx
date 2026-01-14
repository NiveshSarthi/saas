import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function BudgetTracker() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    budget_name: '',
    budget_type: 'overall',
    target_identifier: '',
    monthly_limit: '',
    warning_threshold: 80
  });

  const queryClient = useQueryClient();

  const { data: budgets = [] } = useQuery({
    queryKey: ['petty-cash-budgets'],
    queryFn: () => base44.entities.PettyCashBudget.list('-created_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const currentMonth = new Date().toISOString().substring(0, 7);
      return base44.entities.PettyCashBudget.create({
        ...data,
        current_month: currentMonth,
        spent_amount: 0,
        remaining_amount: data.monthly_limit
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['petty-cash-budgets'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      budget_name: '',
      budget_type: 'overall',
      target_identifier: '',
      monthly_limit: '',
      warning_threshold: 80
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Budget Tracking</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Budget
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Budget Limit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Budget Name</Label>
                <Input
                  value={formData.budget_name}
                  onChange={(e) => setFormData({...formData, budget_name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Budget Type</Label>
                <Select value={formData.budget_type} onValueChange={(val) => setFormData({...formData, budget_type: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overall">Overall Company</SelectItem>
                    <SelectItem value="employee">Per Employee</SelectItem>
                    <SelectItem value="department">Per Department</SelectItem>
                    <SelectItem value="category">Per Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.budget_type !== 'overall' && (
                <div className="space-y-2">
                  <Label>Target (Email/Department/Category)</Label>
                  <Input
                    value={formData.target_identifier}
                    onChange={(e) => setFormData({...formData, target_identifier: e.target.value})}
                    placeholder="e.g., user@example.com or Sales"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Monthly Limit</Label>
                <Input
                  type="number"
                  value={formData.monthly_limit}
                  onChange={(e) => setFormData({...formData, monthly_limit: parseFloat(e.target.value)})}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Warning Threshold (%)</Label>
                <Input
                  type="number"
                  value={formData.warning_threshold}
                  onChange={(e) => setFormData({...formData, warning_threshold: parseFloat(e.target.value)})}
                  min="0"
                  max="100"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create Budget</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgets.map((budget) => {
          const usagePercent = budget.monthly_limit > 0 ? (budget.spent_amount / budget.monthly_limit) * 100 : 0;
          const isWarning = usagePercent >= budget.warning_threshold;
          const isOver = usagePercent >= 100;

          return (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{budget.budget_name}</CardTitle>
                    <p className="text-sm text-slate-500 capitalize">{budget.budget_type}</p>
                    {budget.target_identifier && (
                      <p className="text-xs text-slate-400">{budget.target_identifier}</p>
                    )}
                  </div>
                  {isOver ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Over Budget
                    </Badge>
                  ) : isWarning ? (
                    <Badge className="bg-yellow-100 text-yellow-700">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Warning
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      On Track
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Spent: ₹{(budget.spent_amount || 0).toLocaleString()}</span>
                    <span>Limit: ₹{(budget.monthly_limit || 0).toLocaleString()}</span>
                  </div>
                  <Progress value={Math.min(usagePercent, 100)} className="h-2" />
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{usagePercent.toFixed(1)}% used</span>
                    <span>₹{((budget.remaining_amount || 0) < 0 ? 0 : budget.remaining_amount).toLocaleString()} remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {budgets.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <p>No budgets set. Create budget limits to track spending.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}