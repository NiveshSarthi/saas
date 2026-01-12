import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { sendAssignmentNotification, MODULES } from '@/components/utils/notificationService';

export default function MasterDataAssignDialog({
  open,
  onOpenChange,
  selectedRows,
  onSuccess,
  user,
  users
}) {
  const [assignTo, setAssignTo] = useState('');
  const [notes, setNotes] = useState('');

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignTo) {
        throw new Error('Please select a user');
      }

      const assignee = users.find(u => u.email === assignTo);
      const timestamp = new Date().toISOString();

      // Update all selected records
      for (const rowId of selectedRows) {
        await base44.entities.MasterData.update(rowId, {
          assigned_to: assignTo,
          assigned_by: user?.email,
          assigned_date: timestamp,
          assignment_type: 'admin_assigned',
          status: 'assigned'
        });

        // Create assignment record
        await base44.entities.MasterDataAssignment.create({
          master_data_id: rowId,
          assigned_to: assignTo,
          assigned_by: user?.email,
          assignment_type: 'bulk_assigned',
          assignment_date: timestamp,
          notes: notes
        });

        // Log audit
        await base44.entities.MasterDataAuditLog.create({
          master_data_id: rowId,
          action: 'assigned',
          actor_email: user?.email,
          actor_name: user?.full_name,
          after_value: assignTo,
          source: 'admin_update',
          timestamp: timestamp,
          metadata: {
            assigned_by: user?.email,
            assigned_to: assignTo,
            notes: notes
          }
        });

        // Send notification using global service
        await sendAssignmentNotification({
          assignedTo: assignTo,
          assignedBy: user?.email,
          assignedByName: user?.full_name || user?.email,
          module: MODULES.MASTER_DATA,
          itemName: 'Inventory Lead',
          itemId: rowId,
          link: '/master-data',
          description: notes
        });
      }

      return { count: selectedRows.length, assignee: assignee?.full_name || assignTo };
    },
    onSuccess: (data) => {
      toast.success(`Assigned ${data.count} records to ${data.assignee}. Refreshing data...`);
      setAssignTo('');
      setNotes('');
      
      // Small delay to ensure backend propagation
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to assign records');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            Assign Master Data Records
          </DialogTitle>
          <DialogDescription>
            Assign {selectedRows.length} selected record{selectedRows.length !== 1 ? 's' : ''} to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-900">
              <strong>{selectedRows.length}</strong> record{selectedRows.length !== 1 ? 's' : ''} will be assigned
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assign To *</Label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name || u.email}
                    {u.job_title && <span className="text-xs text-slate-500"> • {u.job_title}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add assignment notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assignMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || !assignTo}>
            {assignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Assign Records
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}