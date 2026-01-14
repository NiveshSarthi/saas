import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Calendar, 
  Phone, 
  Mail, 
  Clock,
  CheckCircle2,
  X,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FollowUpReminderDialog() {
  const [open, setOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setCurrentUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Fetch leads with follow-ups due today or overdue
  const { data: dueFollowUps = [] } = useQuery({
    queryKey: ['due-followups', currentUser?.email],
    queryFn: async () => {
      if (!currentUser) return [];
      
      const allLeads = await base44.entities.Lead.list('-next_follow_up', 10000);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Filter leads assigned to current user with follow-ups due today or overdue
      return allLeads.filter(lead => {
        if (!lead.next_follow_up) return false;
        if (lead.assigned_to !== currentUser.email && currentUser.role !== 'admin') return false;
        if (lead.status === 'lost' || lead.status === 'closed_won') return false;
        
        const followUpDate = new Date(lead.next_follow_up);
        return followUpDate <= tomorrow; // Due today or overdue
      });
    },
    enabled: !!currentUser,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Auto-open dialog when there are due follow-ups
  useEffect(() => {
    if (dueFollowUps.length > 0 && !open) {
      const hasShownToday = sessionStorage.getItem('followup-reminder-shown-' + new Date().toDateString());
      if (!hasShownToday) {
        setOpen(true);
        sessionStorage.setItem('followup-reminder-shown-' + new Date().toDateString(), 'true');
      }
    }
  }, [dueFollowUps, open]);

  const completeFollowUpMutation = useMutation({
    mutationFn: async ({ leadId, notes }) => {
      // Update lead: clear next_follow_up and update last_contact_date
      await base44.entities.Lead.update(leadId, {
        next_follow_up: null,
        last_contact_date: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      });

      // Log activity
      await base44.entities.RELeadActivity.create({
        lead_id: leadId,
        activity_type: 'Follow-up Completed',
        description: notes || 'Follow-up completed',
        actor_email: currentUser?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-followups'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      setSelectedLead(null);
      setCompletionNotes('');
      toast.success('Follow-up marked as completed');
    },
  });

  const snoozeFollowUpMutation = useMutation({
    mutationFn: async ({ leadId, hours }) => {
      const newDate = new Date();
      newDate.setHours(newDate.getHours() + hours);
      
      await base44.entities.Lead.update(leadId, {
        next_follow_up: newDate.toISOString(),
      });

      await base44.entities.RELeadActivity.create({
        lead_id: leadId,
        activity_type: 'Note',
        description: `Follow-up snoozed for ${hours} hours`,
        actor_email: currentUser?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['due-followups'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success('Follow-up snoozed');
    },
  });

  const isOverdue = (date) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const followUpDate = new Date(date);
    followUpDate.setHours(0, 0, 0, 0);
    return followUpDate < now;
  };

  if (dueFollowUps.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Follow-up Reminders</DialogTitle>
              <p className="text-sm text-slate-600 mt-1">
                You have {dueFollowUps.length} lead{dueFollowUps.length > 1 ? 's' : ''} requiring follow-up
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {dueFollowUps.map((lead) => (
            <Card key={lead.id} className={selectedLead?.id === lead.id ? "border-2 border-indigo-500" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Link 
                        to={createPageUrl('LeadDetail') + '?id=' + lead.id}
                        className="font-semibold text-slate-900 hover:text-indigo-600"
                        onClick={() => setOpen(false)}
                      >
                        {lead.lead_name || lead.name}
                      </Link>
                      {isOverdue(lead.next_follow_up) && (
                        <Badge className="bg-red-100 text-red-700">Overdue</Badge>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        <span>{lead.phone}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>{lead.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{new Date(lead.next_follow_up).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Complete
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => snoozeFollowUpMutation.mutate({ leadId: lead.id, hours: 2 })}
                    >
                      Snooze 2h
                    </Button>
                  </div>
                </div>

                {/* Completion Notes Section */}
                {selectedLead?.id === lead.id && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <Label>Completion Notes</Label>
                      <Textarea
                        placeholder="What was discussed? Any next steps?"
                        value={completionNotes}
                        onChange={(e) => setCompletionNotes(e.target.value)}
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedLead(null);
                          setCompletionNotes('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => completeFollowUpMutation.mutate({ 
                          leadId: lead.id, 
                          notes: completionNotes 
                        })}
                        disabled={completeFollowUpMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Mark Complete
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}