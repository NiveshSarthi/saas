import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function ClearMonthDataDialog({ isOpen, onClose, allUsers = [], selectedMonth = new Date() }) {
  const [selectedUser, setSelectedUser] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const queryClient = useQueryClient();

  const safeMonth = selectedMonth instanceof Date && !isNaN(selectedMonth) ? selectedMonth : new Date();

  const clearDataMutation = useMutation({
    mutationFn: async (userEmail) => {
      const monthStr = format(safeMonth, 'yyyy-MM');
      const startDate = format(startOfMonth(safeMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(safeMonth), 'yyyy-MM-dd');

      // Delete attendance records
      const records = await base44.entities.Attendance.filter({
        user_email: userEmail,
        date: { $gte: startDate, $lte: endDate }
      });

      for (const record of records) {
        await base44.entities.Attendance.delete(record.id);
      }

      // Delete salary record if exists
      const salaryRecords = await base44.entities.SalaryRecord.filter({
        employee_email: userEmail,
        month: monthStr
      });

      for (const record of salaryRecords) {
        await base44.entities.SalaryRecord.delete(record.id);
      }

      return records.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries(['attendance']);
      queryClient.invalidateQueries(['attendance-records-salary']);
      queryClient.invalidateQueries(['salary-records']);
      toast.success(`Cleared ${count} attendance records successfully`);
      onClose();
      setSelectedUser('');
      setConfirmText('');
    },
    onError: (error) => {
      toast.error('Failed to clear data: ' + error.message);
    }
  });

  const handleClear = () => {
    if (!selectedUser) {
      toast.error('Please select an employee');
      return;
    }

    if (confirmText !== 'DELETE') {
      toast.error('Please type DELETE to confirm');
      return;
    }

    clearDataMutation.mutate(selectedUser);
  };

  const selectedUserName = (allUsers || []).find(u => u.email === selectedUser)?.full_name || selectedUser;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Clear Month Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This will permanently delete all attendance and salary records
              for the selected employee for <strong>{format(safeMonth, 'MMMM yyyy')}</strong>.
            </p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Select Employee
            </label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Choose employee" />
              </SelectTrigger>
              <SelectContent>
                {(allUsers || []).map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-2 block">
                Type <span className="text-red-600 font-bold">DELETE</span> to confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="border-red-300"
              />
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleClear}
              disabled={!selectedUser || confirmText !== 'DELETE' || clearDataMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {clearDataMutation.isPending ? 'Clearing...' : 'Clear Data'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}