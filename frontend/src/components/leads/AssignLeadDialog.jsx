// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { sendAssignmentNotification, MODULES } from '@/components/utils/notificationService';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';

export default function AssignLeadDialog({ open, onOpenChange, lead, users, currentUser, onSuccess }) {
  const [assignee, setAssignee] = useState(lead?.assigned_to || currentUser?.email || '');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState({ step: 0, message: '' });

  const queryClient = useQueryClient();

  const isAdmin = currentUser?.role === 'admin';

  // Fetch departments to find sales department
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: open && isAdmin,
  });

  // Filter users to only sales department members for assignment
  const salesDepartment = departments.find(d => d.name?.toLowerCase().includes('sales'));
  const assignableUsers = useMemo(() => {
    if (!isAdmin) return users.filter(u => u.email === currentUser?.email);
    if (!salesDepartment) return users; // Fallback if no sales department found

    return users.filter(u => u.department_id === salesDepartment.id || u.email === currentUser?.email);
  }, [users, departments, salesDepartment, currentUser?.email, isAdmin]);

  const assignMutation = useMutation({
    mutationFn: async () => {
      setProgress({ step: 1, message: 'Assigning lead...' });
      await base44.entities.Lead.update(lead.id, {
        assigned_to: assignee,
      });

      setProgress({ step: 2, message: 'Logging activity...' });
      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: 'Assignment',
        description: note || `Assigned to ${assignee}`,
        actor_email: currentUser?.email,
      });

      setProgress({ step: 3, message: 'Sending notification...' });
      await sendAssignmentNotification({
        assignedTo: assignee,
        assignedBy: currentUser?.email,
        assignedByName: currentUser?.full_name || currentUser?.email,
        module: MODULES.LEAD,
        itemName: lead.lead_name || lead.name,
        itemId: lead.id,
        description: note || '',
        link: `/LeadDetail?id=${lead.id}`,
        metadata: {}
      });

      setProgress({ step: 4, message: 'Complete!' });
      return { ...lead, assigned_to: assignee };
    },
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      onSuccess?.(updatedLead);
      setNote('');
      setProgress({ step: 0, message: '' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Lead</DialogTitle>
          <DialogDescription>
            Assign this lead to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Assign To *</Label>
            {isAdmin ? (
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentUser?.email}>
                    Myself ({currentUser?.email})
                  </SelectItem>
                  {assignableUsers
                    .filter(u => u.email !== currentUser?.email)
                    .map(user => (
                      <SelectItem key={user.email} value={user.email}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={currentUser?.email || ''}
                disabled
                className="bg-slate-100"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Note (Optional)</Label>
            <Textarea
              placeholder="Add a note about this assignment..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {assignMutation.isPending && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-blue-900">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="font-medium">{progress.message}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress.step >= 1 ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-600">Updating lead assignment</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress.step >= 2 ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-600">Creating activity log</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${progress.step >= 3 ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-600">Sending mobile notification</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assignMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => assignMutation.mutate()} disabled={!assignee || assignMutation.isPending}>
            {assignMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Assign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}