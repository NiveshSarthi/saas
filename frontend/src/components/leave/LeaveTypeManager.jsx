import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function LeaveTypeManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    annual_quota: 10,
    carry_forward: false,
    max_carry_forward_days: 0,
    requires_documents: false,
    min_notice_days: 0,
    max_consecutive_days: null,
    color: '#6366F1',
    is_paid: true,
    is_active: true
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.list(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingType) {
        return await base44.entities.LeaveType.update(editingType.id, data);
      } else {
        return await base44.entities.LeaveType.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-types']);
      toast.success(editingType ? 'Leave type updated' : 'Leave type created');
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LeaveType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-types']);
      toast.success('Leave type deleted');
    },
  });

  const handleEdit = (type) => {
    setEditingType(type);
    setFormData(type);
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingType(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      annual_quota: 10,
      carry_forward: false,
      max_carry_forward_days: 0,
      requires_documents: false,
      min_notice_days: 0,
      max_consecutive_days: null,
      color: '#6366F1',
      is_paid: true,
      is_active: true
    });
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Leave Types</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Leave Type
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {leaveTypes.map(type => (
          <Card key={type.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  {type.name}
                  <Badge variant="secondary" className="text-xs">{type.code}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(type)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(type.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate-600">{type.description}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-slate-500">Annual Quota</p>
                  <p className="font-medium">{type.annual_quota} days</p>
                </div>
                <div>
                  <p className="text-slate-500">Type</p>
                  <p className="font-medium">{type.is_paid ? 'Paid' : 'Unpaid'}</p>
                </div>
              </div>
              {type.carry_forward && (
                <Badge variant="outline">Carry Forward Allowed</Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit' : 'Add'} Leave Type</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., SL, CL"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Annual Quota (days) *</Label>
                <Input
                  type="number"
                  value={formData.annual_quota}
                  onChange={(e) => setFormData({ ...formData, annual_quota: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Color</Label>
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <Label>Paid Leave</Label>
                <Switch
                  checked={formData.is_paid}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_paid: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <Label>Carry Forward Allowed</Label>
                <Switch
                  checked={formData.carry_forward}
                  onCheckedChange={(checked) => setFormData({ ...formData, carry_forward: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <Label>Requires Documents</Label>
                <Switch
                  checked={formData.requires_documents}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_documents: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <Label>Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>

            {formData.carry_forward && (
              <div>
                <Label>Max Carry Forward Days</Label>
                <Input
                  type="number"
                  value={formData.max_carry_forward_days}
                  onChange={(e) => setFormData({ ...formData, max_carry_forward_days: parseInt(e.target.value) })}
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}