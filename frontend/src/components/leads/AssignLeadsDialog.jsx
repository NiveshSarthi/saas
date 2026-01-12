import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AssignLeadsDialog({ 
  open, 
  onOpenChange, 
  selectedLeads, 
  leads, 
  salesUsers,
  onSuccess 
}) {
  const [selectedUser, setSelectedUser] = useState('');
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
        await base44.entities.Lead.update(lead.id, {
          assigned_to: userEmail,
          activity_log: [
            ...(lead.activity_log || []),
            {
              action: 'assigned',
              actor_email: currentUser.email,
              timestamp: new Date().toISOString(),
              note: `Assigned to ${salesUsers.find(u => u.email === userEmail)?.full_name || userEmail}`
            }
          ]
        });

        setProgress({ current: i + 1, total: leadsToAssign.length, step: 'notifying' });
        await base44.entities.Notification.create({
          user_email: userEmail,
          type: 'lead_assigned',
          title: 'New Lead Assigned',
          message: `${currentUser.full_name || currentUser.email} assigned you a lead: ${lead.lead_name}`,
          actor_email: currentUser.email,
          link: `LeadDetail?id=${lead.id}`,
          read: false
        });
      }
      
      setProgress({ current: leadsToAssign.length, total: leadsToAssign.length, step: 'complete' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success(`${selectedLeads.length} lead(s) assigned and notifications sent`);
      setSelectedUser('');
      setProgress({ current: 0, total: 0, step: '' });
      onSuccess();
    },
    onError: () => {
      toast.error('Failed to assign leads');
      setProgress({ current: 0, total: 0, step: '' });
    }
  });

  const handleAssign = () => {
    if (!selectedUser) {
      toast.error('Please select a team member');
      return;
    }
    assignMutation.mutate(selectedUser);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Leads</DialogTitle>
          <DialogDescription>
            Assign {selectedLeads.length} selected lead(s) to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Assign to Team Member</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {salesUsers.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {assignMutation.isPending && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-900">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">
                    {progress.step === 'assigning' && 'Assigning lead...'}
                    {progress.step === 'notifying' && 'Sending notification...'}
                    {progress.step === 'complete' && 'Complete!'}
                  </span>
                </div>
                <span className="text-sm text-blue-700 font-medium">
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
            disabled={!selectedUser || assignMutation.isPending}
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