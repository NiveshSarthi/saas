import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Plus,
  Target,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Calendar,
  UserPlus,
  FileCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const TARGET_TYPES = [
  { value: 'attendance_rate', label: 'Attendance Rate', icon: Users, unit: '%' },
  { value: 'working_hours', label: 'Working Hours', icon: Clock, unit: 'hours' },
  { value: 'timesheet_compliance', label: 'Timesheet Compliance', icon: FileCheck, unit: '%' },
  { value: 'leave_utilization', label: 'Leave Utilization', icon: Calendar, unit: '%' },
  { value: 'recruitment', label: 'Recruitment Targets', icon: UserPlus, unit: 'count' },
  { value: 'onboarding_completion', label: 'Onboarding Completion', icon: CheckCircle, unit: '%' }
];

const TARGET_PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' }
];

export default function HRTargetsManagement({ user }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [formData, setFormData] = useState({
    target_type: '',
    target_name: '',
    target_value: '',
    target_unit: '%',
    period: 'monthly',
    department_id: '',
    description: ''
  });

  const queryClient = useQueryClient();

  // Fetch HR targets
  const { data: hrTargets = [], isLoading } = useQuery({
    queryKey: ['hr-targets'],
    queryFn: () => base44.entities.HRTarget.list({ status: 'active' }),
    enabled: user?.role === 'admin'
  });

  // Fetch departments for filtering
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: user?.role === 'admin'
  });

  const createTargetMutation = useMutation({
    mutationFn: (data) => base44.entities.HRTarget.create({
      ...data,
      created_by: user?.email,
      status: 'active'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-targets'] });
      setDialogOpen(false);
      resetForm();
      toast.success('HR target created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create target: ' + error.message);
    }
  });

  const updateTargetMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.HRTarget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-targets'] });
      setDialogOpen(false);
      setEditingTarget(null);
      resetForm();
      toast.success('HR target updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update target: ' + error.message);
    }
  });

  const deleteTargetMutation = useMutation({
    mutationFn: (id) => base44.entities.HRTarget.update(id, { status: 'inactive' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-targets'] });
      toast.success('HR target deactivated');
    }
  });

  const resetForm = () => {
    setFormData({
      target_type: '',
      target_name: '',
      target_value: '',
      target_unit: '%',
      period: 'monthly',
      department_id: '',
      description: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (editingTarget) {
      updateTargetMutation.mutate({
        id: editingTarget.id,
        data: {
          ...formData,
          updated_at: new Date().toISOString()
        }
      });
    } else {
      createTargetMutation.mutate(formData);
    }
  };

  const handleEdit = (target) => {
    setEditingTarget(target);
    setFormData({
      target_type: target.target_type,
      target_name: target.target_name,
      target_value: target.target_value,
      target_unit: target.target_unit,
      period: target.period,
      department_id: target.department_id || '',
      description: target.description || ''
    });
    setDialogOpen(true);
  };

  const handleTypeChange = (type) => {
    const targetType = TARGET_TYPES.find(t => t.value === type);
    setFormData(prev => ({
      ...prev,
      target_type: type,
      target_unit: targetType?.unit || '%'
    }));
  };

  const getTargetTypeInfo = (type) => {
    return TARGET_TYPES.find(t => t.value === type) || TARGET_TYPES[0];
  };

  const getDepartmentName = (deptId) => {
    if (!deptId) return 'All Departments';
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || 'Unknown Department';
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">Admin Access Required</h3>
        <p className="text-slate-500">Only administrators can manage HR targets.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">HR Targets Management</h2>
          <p className="text-slate-600 mt-1">Set and monitor HR performance targets</p>
        </div>
        <Button
          onClick={() => {
            setEditingTarget(null);
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Target
        </Button>
      </div>

      {/* Current Targets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hrTargets.map((target) => {
          const typeInfo = getTargetTypeInfo(target.target_type);
          const Icon = typeInfo.icon;

          return (
            <Card key={target.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Icon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{target.target_name}</CardTitle>
                      <p className="text-sm text-slate-500 capitalize">{target.period}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(target)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Deactivate this target?')) {
                          deleteTargetMutation.mutate(target.id);
                        }
                      }}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Target Value</span>
                    <span className="text-2xl font-bold text-indigo-600">
                      {target.target_value}{target.target_unit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Type</span>
                    <Badge variant="outline">{typeInfo.label}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Department</span>
                    <span className="font-medium">{getDepartmentName(target.department_id)}</span>
                  </div>

                  {target.description && (
                    <p className="text-sm text-slate-600 mt-2">{target.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hrTargets.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-16 h-16 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No HR Targets Set</h3>
            <p className="text-slate-500 text-center mb-4">Create your first HR performance target to get started.</p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Target
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Target Type Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Target Categories</CardTitle>
          <p className="text-sm text-slate-600">Available HR performance metrics</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TARGET_TYPES.map((type) => {
              const Icon = type.icon;
              const activeTargets = hrTargets.filter(t => t.target_type === type.value).length;

              return (
                <div key={type.value} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{type.label}</p>
                    <p className="text-sm text-slate-500">{activeTargets} active target{activeTargets !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Target Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTarget ? 'Edit HR Target' : 'Create HR Target'}</DialogTitle>
            <DialogDescription>
              {editingTarget ? 'Update the target details below.' : 'Define a new HR performance target.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Target Type *</Label>
              <Select
                value={formData.target_type}
                onValueChange={handleTypeChange}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select target type" />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Name *</Label>
              <Input
                value={formData.target_name}
                onChange={(e) => setFormData(prev => ({ ...prev, target_name: e.target.value }))}
                placeholder="e.g., Monthly Attendance Rate"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Value *</Label>
                <Input
                  type="number"
                  value={formData.target_value}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_value: parseFloat(e.target.value) || '' }))}
                  placeholder="e.g., 95"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={formData.target_unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, target_unit: e.target.value }))}
                  placeholder="e.g., %"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Period *</Label>
              <Select
                value={formData.period}
                onValueChange={(value) => setFormData(prev => ({ ...prev, period: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TARGET_PERIODS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department (Optional)</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, department_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Additional details about this target..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingTarget(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createTargetMutation.isPending || updateTargetMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {createTargetMutation.isPending || updateTargetMutation.isPending ? 'Saving...' : (editingTarget ? 'Update Target' : 'Create Target')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}