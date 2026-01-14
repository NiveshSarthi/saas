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
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AddRowDialog({ open, onOpenChange, columns, onAddRow }) {
  const [rowCount, setRowCount] = useState(1);
  const [rowData, setRowData] = useState({});
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!rowData.name || !rowData.phone) {
      toast.error('Name and Phone are required');
      return;
    }

    setLoading(true);
    try {
      if (rowCount === 1) {
        await onAddRow(rowData);
      } else {
        // Bulk add rows
        for (let i = 0; i < rowCount; i++) {
          await onAddRow({
            ...rowData,
            name: `${rowData.name || 'New Lead'} ${i + 1}`
          });
        }
      }
      setRowData({});
      setRowCount(1);
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to add row');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Add New Row
          </DialogTitle>
          <DialogDescription>
            Add one or multiple rows to the master data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Number of Rows to Add</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={rowCount}
              onChange={(e) => setRowCount(parseInt(e.target.value) || 1)}
              placeholder="1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={rowData.name || ''}
                onChange={(e) => setRowData({ ...rowData, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                value={rowData.phone || ''}
                onChange={(e) => setRowData({ ...rowData, phone: e.target.value })}
                placeholder="Enter phone"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={rowData.email || ''}
                onChange={(e) => setRowData({ ...rowData, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>

            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={rowData.city || ''}
                onChange={(e) => setRowData({ ...rowData, city: e.target.value })}
                placeholder="Enter city"
              />
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Input
                value={rowData.state || ''}
                onChange={(e) => setRowData({ ...rowData, state: e.target.value })}
                placeholder="Enter state"
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                value={rowData.category || ''}
                onChange={(e) => setRowData({ ...rowData, category: e.target.value })}
                placeholder="Enter category"
              />
            </div>
          </div>

          {rowCount > 1 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                Will create <strong>{rowCount}</strong> rows with the above data.
                Each row will have a numbered suffix.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add {rowCount > 1 ? `${rowCount} Rows` : 'Row'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}