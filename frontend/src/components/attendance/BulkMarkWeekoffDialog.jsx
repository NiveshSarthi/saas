import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BulkMarkWeekoffDialog({ isOpen, onClose, allUsers, selectedMonth }) {
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedUser, setSelectedUser] = useState('all');
  const queryClient = useQueryClient();

  const markWeekoffMutation = useMutation({
    mutationFn: async ({ dates, userEmail }) => {
      const users = userEmail === 'all' ? allUsers.map(u => u.email) : [userEmail];
      
      for (const user of users) {
        for (const date of dates) {
          const dateStr = format(date, 'yyyy-MM-dd');
          
          // Check if record exists
          const existing = await base44.entities.Attendance.filter({
            user_email: user,
            date: dateStr
          });
          
          if (existing.length > 0) {
            // Update existing
            await base44.entities.Attendance.update(existing[0].id, {
              status: 'weekoff',
              total_hours: 0
            });
          } else {
            // Create new
            await base44.entities.Attendance.create({
              user_email: user,
              date: dateStr,
              status: 'weekoff',
              total_hours: 0
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      queryClient.invalidateQueries(['attendance-records-salary']);
      toast.success('Weekoffs marked successfully');
      onClose();
      setSelectedDates([]);
      setSelectedUser('all');
    },
    onError: (error) => {
      toast.error('Failed to mark weekoffs: ' + error.message);
    }
  });

  const handleMarkWeekoff = () => {
    if (selectedDates.length === 0) {
      toast.error('Please select at least one date');
      return;
    }
    
    markWeekoffMutation.mutate({
      dates: selectedDates,
      userEmail: selectedUser
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mark Weekoffs Manually</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Select Employee
            </label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {allUsers.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 mb-2 block">
              Select Dates (Multiple)
            </label>
            <Calendar
              mode="multiple"
              selected={selectedDates}
              onSelect={setSelectedDates}
              month={selectedMonth}
              className="rounded-md border"
            />
            {selectedDates.length > 0 && (
              <p className="text-sm text-slate-600 mt-2">
                {selectedDates.length} date(s) selected
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleMarkWeekoff}
              disabled={markWeekoffMutation.isPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {markWeekoffMutation.isPending ? 'Marking...' : 'Mark Weekoff'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}