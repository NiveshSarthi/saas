// @ts-nocheck
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sendAssignmentNotification, MODULES } from '@/components/utils/notificationService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import UserMultiSelect from '@/components/common/UserMultiSelect';

export default function AssignLeadsDialog({
  open,
  onOpenChange,
  selectedLeads,
  leads,
  salesUsers,
  departments = [],
  onSuccess
}) {
  const [selectedUserEmails, setSelectedUserEmails] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, step: '' });
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: async (userEmail) => {
      const leadsToAssign = leads.filter(l => selectedLeads.includes(l.id));
      const currentUser = await base44.auth.me();

      setProgress({ current: 0, total: leadsToAssign.length, step: 'starting' });

      for (let i = 0; i < leadsToAssign.length; i++) {
        const lead = leadsToAssign[i];

        setProgress({ current: i + 1, total: leadsToAssign.length, step: 'assigning' });
        // Update activity log with structured notes if possible, otherwise keep consistent
        await base44.entities.Lead.update(lead.id, {
          assigned_to: userEmail,
          notes: (lead.notes || '') + `\n[${new Date().toLocaleString()}] Assigned to ${salesUsers.find(u => u.email === userEmail)?.full_name || userEmail} by ${currentUser.full_name || currentUser.email}`
        });

        setProgress({ current: i + 1, total: leadsToAssign.length, step: 'notifying' });
        await sendAssignmentNotification({
          assignedTo: userEmail,
          assignedBy: currentUser?.email,
          assignedByName: currentUser?.full_name || currentUser?.email,
          module: MODULES.LEAD,
          itemName: lead.lead_name || lead.name,
          itemId: lead.id,
          link: `/LeadDetail?id=${lead.id}`,
          metadata: {}
        });
      }

      setProgress({ current: leadsToAssign.length, total: leadsToAssign.length, step: 'complete' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success(`${selectedLeads.length} lead(s) assigned and notifications sent`);
      setSelectedUserEmails([]);
      setProgress({ current: 0, total: 0, step: '' });
      onSuccess();
    },
    onError: (error) => {
      toast.error('Failed to assign leads: ' + error.message);
      setProgress({ current: 0, total: 0, step: '' });
    }
  });

  const handleAssign = () => {
    if (selectedUserEmails.length === 0) {
      toast.error('Please select a team member');
      return;
    }
    // For now, we only support assigning to one user at a time for simplicity in the loop,
    // but the UI allows picking from the list.
    assignMutation.mutate(selectedUserEmails[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Leads</DialogTitle>
          <DialogDescription>
            Assign {selectedLeads.length} selected lead(s) to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Assign to Team Member</Label>
            <UserMultiSelect
              users={salesUsers}
              departments={departments}
              selectedEmails={selectedUserEmails}
              onChange={setSelectedUserEmails}
              singleSelect={true}
              placeholder="Search and select a member..."
              className=""
            />
          </div>

          {assignMutation.isPending && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-900">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium text-sm">
                    {progress.step === 'assigning' && 'Assigning leads...'}
                    {progress.step === 'notifying' && 'Sending notifications...'}
                    {progress.step === 'complete' && 'Complete!'}
                  </span>
                </div>
                <span className="text-xs text-indigo-700 font-bold">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-indigo-200 rounded-full h-1.5">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={selectedUserEmails.length === 0 || assignMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {assignMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Assign Leads
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}