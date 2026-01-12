import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'leave', label: 'Leave' },
  { value: 'work_from_home', label: 'Work From Home' },
  { value: 'sick_leave', label: 'Sick Leave' },
  { value: 'casual_leave', label: 'Casual Leave' },
  { value: 'weekoff', label: 'Week Off' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' }
];

export default function EditAttendanceDialog({ isOpen, onClose, record, allUsers }) {
  const [formData, setFormData] = useState({
    status: '',
    check_in_time: '',
    check_out_time: '',
    total_hours: '',
    is_late: false,
    is_early_checkout: false,
    notes: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (record) {
      // Parse check-in and check-out times
      let checkInTime = '';
      let checkOutTime = '';
      
      if (record.check_in_time) {
        try {
          const date = new Date(record.check_in_time);
          checkInTime = format(date, 'HH:mm');
        } catch (e) {
          checkInTime = record.check_in_time;
        }
      }
      
      if (record.check_out_time) {
        try {
          const date = new Date(record.check_out_time);
          checkOutTime = format(date, 'HH:mm');
        } catch (e) {
          checkOutTime = record.check_out_time;
        }
      }

      setFormData({
        status: record.status || 'present',
        check_in_time: checkInTime,
        check_out_time: checkOutTime,
        total_hours: record.total_hours || '',
        is_late: record.is_late || false,
        is_early_checkout: record.is_early_checkout || false,
        notes: record.notes || ''
      });
    }
  }, [record]);

  const updateAttendanceMutation = useMutation({
    mutationFn: async (data) => {
      const updateData = { ...data };
      
      // Convert time strings to ISO timestamps if provided
      if (data.check_in_time && data.check_in_time.includes(':')) {
        const [hours, minutes] = data.check_in_time.split(':');
        const checkInDate = new Date(record.date);
        checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        updateData.check_in_time = checkInDate.toISOString();
      }
      
      if (data.check_out_time && data.check_out_time.includes(':')) {
        const [hours, minutes] = data.check_out_time.split(':');
        const checkOutDate = new Date(record.date);
        checkOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        updateData.check_out_time = checkOutDate.toISOString();
      }

      // Calculate total hours if both times are provided
      if (updateData.check_in_time && updateData.check_out_time) {
        const checkIn = new Date(updateData.check_in_time);
        const checkOut = new Date(updateData.check_out_time);
        const diffMs = checkOut - checkIn;
        updateData.total_hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return await base44.entities.Attendance.update(record.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['all-attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['today-all-attendance'] });
      toast.success('Attendance updated successfully');
      onClose();
    },
    onError: (error) => {
      toast.error('Failed to update attendance: ' + error.message);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateAttendanceMutation.mutate(formData);
  };

  const getUserName = (email) => {
    const user = allUsers.find(u => u.email === email);
    return user?.full_name || email;
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
          <div className="text-sm text-slate-600 mt-2">
            <div><strong>User:</strong> {getUserName(record.user_email)}</div>
            <div><strong>Date:</strong> {format(new Date(record.date), 'MMM dd, yyyy')}</div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check In Time</Label>
              <Input
                type="time"
                value={formData.check_in_time}
                onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Check Out Time</Label>
              <Input
                type="time"
                value={formData.check_out_time}
                onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Total Hours (optional - auto-calculated)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.total_hours}
              onChange={(e) => setFormData({ ...formData, total_hours: e.target.value })}
              placeholder="Auto-calculated from times"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_late"
                checked={formData.is_late}
                onChange={(e) => setFormData({ ...formData, is_late: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <Label htmlFor="is_late" className="cursor-pointer">Mark as Late</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_early_checkout"
                checked={formData.is_early_checkout}
                onChange={(e) => setFormData({ ...formData, is_early_checkout: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              <Label htmlFor="is_early_checkout" className="cursor-pointer">Early Checkout</Label>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAttendanceMutation.isPending}>
              {updateAttendanceMutation.isPending ? 'Updating...' : 'Update Attendance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}