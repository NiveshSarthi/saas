import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Columns, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export default function ColumnManagementDialog({ open, onOpenChange }) {
  const [newColumn, setNewColumn] = useState({
    column_key: '',
    column_label: '',
    column_type: 'text',
    width: 150,
    is_required: false,
    is_editable: true,
    is_visible: true,
  });

  const queryClient = useQueryClient();

  const { data: columns = [] } = useQuery({
    queryKey: ['column-definitions'],
    queryFn: () => base44.entities.MasterDataColumnDefinition.list('order'),
    enabled: open,
  });

  const createColumnMutation = useMutation({
    mutationFn: (columnData) => base44.entities.MasterDataColumnDefinition.create(columnData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['column-definitions'] });
      toast.success('Column added successfully');
      setNewColumn({
        column_key: '',
        column_label: '',
        column_type: 'text',
        width: 150,
        is_required: false,
        is_editable: true,
        is_visible: true,
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id) => base44.entities.MasterDataColumnDefinition.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['column-definitions'] });
      toast.success('Column deleted');
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MasterDataColumnDefinition.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['column-definitions'] });
      toast.success('Column updated');
    },
  });

  const handleAddColumn = () => {
    if (!newColumn.column_key || !newColumn.column_label) {
      toast.error('Please provide column key and label');
      return;
    }

    createColumnMutation.mutate({
      ...newColumn,
      order: columns.length,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns className="w-5 h-5" />
            Column Management
          </DialogTitle>
          <DialogDescription>
            Add, remove, and configure custom columns for your data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Column */}
          <div className="border rounded-lg p-4 bg-slate-50">
            <h3 className="font-medium mb-4">Add New Column</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Column Key (unique identifier)</Label>
                <Input
                  value={newColumn.column_key}
                  onChange={(e) => setNewColumn({ ...newColumn, column_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., company_size"
                />
              </div>
              <div>
                <Label>Display Label</Label>
                <Input
                  value={newColumn.column_label}
                  onChange={(e) => setNewColumn({ ...newColumn, column_label: e.target.value })}
                  placeholder="e.g., Company Size"
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={newColumn.column_type} onValueChange={(v) => setNewColumn({ ...newColumn, column_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="dropdown">Dropdown</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="textarea">Text Area</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Width (px)</Label>
                <Input
                  type="number"
                  value={newColumn.width}
                  onChange={(e) => setNewColumn({ ...newColumn, width: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newColumn.is_required}
                  onCheckedChange={(checked) => setNewColumn({ ...newColumn, is_required: checked })}
                />
                <Label>Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newColumn.is_editable}
                  onCheckedChange={(checked) => setNewColumn({ ...newColumn, is_editable: checked })}
                />
                <Label>Editable</Label>
              </div>
            </div>
            <Button onClick={handleAddColumn} className="mt-4" disabled={createColumnMutation.isPending}>
              <Plus className="w-4 h-4 mr-2" />
              Add Column
            </Button>
          </div>

          {/* Existing Columns */}
          <div>
            <h3 className="font-medium mb-4">Existing Columns</h3>
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-medium">{col.column_label}</div>
                      <div className="text-sm text-slate-500">
                        {col.column_key} • {col.column_type}
                        {col.is_required && <Badge className="ml-2 text-xs">Required</Badge>}
                        {col.is_system_column && <Badge className="ml-2 text-xs" variant="secondary">System</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={col.is_visible}
                      onCheckedChange={(checked) => updateColumnMutation.mutate({ id: col.id, data: { is_visible: checked } })}
                    />
                    {!col.is_system_column && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteColumnMutation.mutate(col.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}