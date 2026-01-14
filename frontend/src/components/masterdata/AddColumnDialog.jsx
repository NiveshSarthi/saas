import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Columns, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddColumnDialog({ open, onOpenChange, onAddColumn, existingColumns }) {
  const [columnName, setColumnName] = useState('');
  const [columnKey, setColumnKey] = useState('');
  const [columnType, setColumnType] = useState('text');
  const [columnWidth, setColumnWidth] = useState(150);

  const handleAdd = () => {
    if (!columnName || !columnKey) {
      toast.error('Column name and key are required');
      return;
    }

    if (existingColumns.some(col => col.key === columnKey)) {
      toast.error('Column key already exists');
      return;
    }

    const newColumn = {
      key: columnKey,
      label: columnName,
      width: columnWidth,
      editable: true,
      type: columnType === 'text' ? undefined : columnType
    };

    onAddColumn(newColumn);
    
    // Reset form
    setColumnName('');
    setColumnKey('');
    setColumnType('text');
    setColumnWidth(150);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Columns className="w-5 h-5 text-indigo-600" />
            Add New Column
          </DialogTitle>
          <DialogDescription>
            Add a custom column to the master data spreadsheet
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Column Name *</Label>
            <Input
              value={columnName}
              onChange={(e) => {
                setColumnName(e.target.value);
                // Auto-generate key from name
                if (!columnKey) {
                  setColumnKey(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }
              }}
              placeholder="e.g., Budget"
            />
          </div>

          <div className="space-y-2">
            <Label>Column Key *</Label>
            <Input
              value={columnKey}
              onChange={(e) => setColumnKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="e.g., budget"
            />
            <p className="text-xs text-slate-500">
              Unique identifier (lowercase, no spaces)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Column Type</Label>
            <Select value={columnType} onValueChange={setColumnType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="select">Dropdown</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Column Width (px)</Label>
            <Input
              type="number"
              min={80}
              max={500}
              value={columnWidth}
              onChange={(e) => setColumnWidth(parseInt(e.target.value) || 150)}
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <strong>Note:</strong> Custom columns are stored in the session only.
              To make them permanent, contact your admin to update the database schema.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>
            <Columns className="w-4 h-4 mr-2" />
            Add Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}