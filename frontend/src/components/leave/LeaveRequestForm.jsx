import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { differenceInDays, format, parseISO } from 'date-fns';
import { AlertCircle } from 'lucide-react';

export default function LeaveRequestForm({ isOpen, onClose, leaveTypes, balances, currentUser }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    contact_number: '',
    handover_notes: ''
  });

  const selectedLeaveType = leaveTypes.find(lt => lt.id === formData.leave_type_id);
  const balance = balances.find(b => b.leave_type_id === formData.leave_type_id);

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = parseISO(formData.start_date);
    const end = parseISO(formData.end_date);
    return differenceInDays(end, start) + 1;
  };

  const totalDays = calculateDays();

  const createRequestMutation = useMutation({
    mutationFn: async (data) => {
      // Create leave request
      const request = await base44.entities.LeaveRequest.create(data);

      // Get the latest balance (might have been just created)
      const latestBalances = await base44.entities.LeaveBalance.filter({
        user_email: currentUser.email,
        leave_type_id: formData.leave_type_id,
        year: new Date().getFullYear()
      });

      if (latestBalances.length > 0) {
        const latestBalance = latestBalances[0];
        await base44.entities.LeaveBalance.update(latestBalance.id, {
          pending: (latestBalance.pending || 0) + totalDays,
          available: latestBalance.available - totalDays
        });
      }

      // Send notifications
      try {
        await base44.functions.invoke('sendLeaveNotifications', {
          leaveRequestId: request.id,
          action: 'request'
        });
      } catch (e) {
        console.error('Failed to send notifications:', e);
      }

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my-leave-requests']);
      queryClient.invalidateQueries(['my-leave-balances']);
      toast.success('Leave request submitted successfully!');
      onClose();
      setFormData({
        leave_type_id: '',
        start_date: '',
        end_date: '',
        reason: '',
        contact_number: '',
        handover_notes: ''
      });
    },
    onError: (error) => {
      toast.error('Failed to submit request: ' + error.message);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (totalDays <= 0) {
      toast.error('Invalid date range');
      return;
    }

    if (!formData.leave_type_id) {
      toast.error('Please select a leave type');
      return;
    }

    // Create balance if it doesn't exist
    let userBalance = balance;
    if (!userBalance && selectedLeaveType) {
      try {
        userBalance = await base44.entities.LeaveBalance.create({
          user_email: currentUser.email,
          leave_type_id: formData.leave_type_id,
          year: new Date().getFullYear(),
          total_allocated: selectedLeaveType.annual_quota,
          used: 0,
          pending: 0,
          available: selectedLeaveType.annual_quota,
          carried_forward: 0
        });
        queryClient.invalidateQueries(['my-leave-balances']);
      } catch (error) {
        toast.error('Failed to initialize leave balance');
        return;
      }
    }

    if (userBalance && userBalance.available < totalDays) {
      toast.error('Insufficient leave balance');
      return;
    }

    createRequestMutation.mutate({
      user_email: currentUser.email,
      user_name: currentUser.full_name,
      department_id: currentUser.department_id,
      leave_type_id: formData.leave_type_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      total_days: totalDays,
      reason: formData.reason,
      contact_number: formData.contact_number,
      handover_notes: formData.handover_notes,
      status: 'pending'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Leave Type *</Label>
            <Select
              value={formData.leave_type_id}
              onValueChange={(value) => setFormData({ ...formData, leave_type_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes && leaveTypes.length > 0 ? (
                  leaveTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.code})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>No leave types available</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {balance && (
            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <p className="text-sm text-indigo-900">
                Available: <span className="font-bold">{balance.available}</span> days |
                Used: {balance.used} | Pending: {balance.pending}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Date *</Label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                min={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>
            <div>
              <Label>End Date *</Label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                min={formData.start_date || format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>
          </div>

          {totalDays > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-700">
                Total Days: <span className="font-bold">{totalDays}</span>
              </p>
            </div>
          )}

          {totalDays > 0 && balance && balance.available < totalDays && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm text-red-800">
                Insufficient balance! You need {totalDays} days but only have {balance.available} available.
              </span>
            </div>
          )}

          <div>
            <Label>Reason *</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Reason for leave..."
              required
            />
          </div>

          <div>
            <Label>Emergency Contact Number</Label>
            <Input
              value={formData.contact_number}
              onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
              placeholder="Contact number during leave"
            />
          </div>

          <div>
            <Label>Handover Notes</Label>
            <Textarea
              value={formData.handover_notes}
              onChange={(e) => setFormData({ ...formData, handover_notes: e.target.value })}
              placeholder="Work handover details..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createRequestMutation.isPending}>
              {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}