import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function SalaryLockDialog({ isOpen, onClose, salaryRecords, currentUser }) {
  const queryClient = useQueryClient();

  const lockMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const record of salaryRecords) {
        await base44.entities.SalaryRecord.update(record.id, {
          locked: true,
          locked_by: currentUser?.email,
          locked_at: new Date().toISOString(),
          status: 'locked'
        });
        
        // Audit log
        await base44.entities.SalaryAuditLog.create({
          entity_type: 'salary_record',
          entity_id: record.id,
          employee_email: record.employee_email,
          month: record.month,
          action: 'locked',
          changed_by: currentUser?.email,
          reason: 'Salary locked for payroll processing'
        });
        
        results.push(record);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['salary-records']);
      toast.success(`${salaryRecords.length} salary record(s) locked`);
      onClose();
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-orange-600" />
            Lock Salary Records
          </DialogTitle>
          <DialogDescription>
            This will lock {salaryRecords.length} salary record(s) for processing
          </DialogDescription>
        </DialogHeader>
        
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>Warning:</strong> Once locked, attendance and leave edits will require admin override.
            Salary adjustments can still be made, but the record will remain in locked state.
          </AlertDescription>
        </Alert>

        <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
          {salaryRecords.map(record => (
            <div key={record.id} className="text-sm flex justify-between">
              <span>{record.employee_name}</span>
              <span className="text-slate-500">{record.month}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => lockMutation.mutate()}
            className="bg-orange-600 hover:bg-orange-700"
            disabled={lockMutation.isLoading}
          >
            <Lock className="w-4 h-4 mr-2" />
            Lock Records
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}