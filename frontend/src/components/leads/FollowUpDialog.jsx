import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, format } from 'date-fns';
import { 
  Bell, 
  Calendar, 
  Phone, 
  X, 
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Mail
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function FollowUpDialog({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLeadIndex, setCurrentLeadIndex] = useState(0);
  const [completionNotes, setCompletionNotes] = useState('');
  const [dismissedLeads, setDismissedLeads] = useState([]);

  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ['follow-up-leads', user?.email],
    queryFn: async () => {
      const allLeads = await base44.entities.Lead.filter(
        { assigned_to: user?.email },
        '-next_follow_up',
        500
      );
      
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      return allLeads.filter(lead => {
        if (!lead.next_follow_up) return false;
        const followUpDate = new Date(lead.next_follow_up);
        followUpDate.setHours(0, 0, 0, 0);
        
        // Show if due today or overdue
        return followUpDate <= now;
      }).sort((a, b) => {
        const dateA = new Date(a.next_follow_up);
        const dateB = new Date(b.next_follow_up);
        return dateA - dateB; // Oldest first
      });
    },
    enabled: !!user?.email,
    refetchInterval: 60000, // Check every minute
  });

  // Filter out dismissed leads
  const activeLeads = leads.filter(lead => !dismissedLeads.includes(lead.id));

  // Auto-open dialog when there are follow-ups due
  useEffect(() => {
    if (activeLeads.length > 0 && !isOpen) {
      // Check if we should show the dialog (not dismissed today)
      const dismissedToday = localStorage.getItem('followUpDialogDismissedDate');
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (dismissedToday !== today) {
        setIsOpen(true);
      }
    }
  }, [activeLeads.length]);

  const markCompletedMutation = useMutation({
    mutationFn: async ({ lead, notes }) => {
      // Update lead - clear next_follow_up
      await base44.entities.Lead.update(lead.id, {
        next_follow_up: null,
        last_activity: new Date().toISOString(),
        last_contact_date: new Date().toISOString(),
      });

      // Log activity
      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: 'Follow-up',
        description: `Follow-up completed${notes ? ': ' + notes : ''}`,
        actor_email: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      toast.success('Follow-up marked as completed');
      setCompletionNotes('');
      
      // Move to next lead or close dialog
      if (currentLeadIndex < activeLeads.length - 1) {
        setCurrentLeadIndex(currentLeadIndex + 1);
      } else {
        handleClose();
      }
    },
  });

  const snoozeFollowUpMutation = useMutation({
    mutationFn: async ({ lead, days }) => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);
      
      await base44.entities.Lead.update(lead.id, {
        next_follow_up: newDate.toISOString(),
      });

      // Log activity
      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: 'Follow-up',
        description: `Follow-up snoozed for ${days} day(s)`,
        actor_email: user?.email,
      });
    },
    onSuccess: (_, { days }) => {
      queryClient.invalidateQueries({ queryKey: ['follow-up-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      toast.success(`Follow-up snoozed for ${days} day(s)`);
      
      // Move to next lead or close dialog
      if (currentLeadIndex < activeLeads.length - 1) {
        setCurrentLeadIndex(currentLeadIndex + 1);
      } else {
        handleClose();
      }
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setCurrentLeadIndex(0);
    setCompletionNotes('');
    
    // Mark as dismissed for today
    localStorage.setItem('followUpDialogDismissedDate', format(new Date(), 'yyyy-MM-dd'));
  };

  const handleSkip = () => {
    if (currentLeadIndex < activeLeads.length - 1) {
      setCurrentLeadIndex(currentLeadIndex + 1);
    } else {
      handleClose();
    }
  };

  const handleDismissLead = (leadId) => {
    setDismissedLeads([...dismissedLeads, leadId]);
    handleSkip();
  };

  if (activeLeads.length === 0) return null;

  const currentLead = activeLeads[currentLeadIndex];
  if (!currentLead) return null;

  const followUpDate = new Date(currentLead.next_follow_up);
  const daysOverdue = differenceInDays(new Date(), followUpDate);
  const isOverdue = daysOverdue > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isOverdue ? "bg-red-500" : "bg-amber-500"
              )}>
                <Bell className={cn(
                  "w-5 h-5 text-white",
                  isOverdue && "animate-pulse"
                )} />
              </div>
              <span>Follow-up Reminder</span>
              {activeLeads.length > 1 && (
                <Badge variant="secondary" className="ml-2">
                  {currentLeadIndex + 1} of {activeLeads.length}
                </Badge>
              )}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isOverdue 
              ? `This follow-up is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue` 
              : 'This follow-up is due today'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Lead Info Card */}
          <div className={cn(
            "p-4 rounded-lg border-2",
            isOverdue 
              ? "bg-red-50 border-red-300" 
              : "bg-amber-50 border-amber-300"
          )}>
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 border-2 border-white shadow-lg">
                <AvatarFallback className={cn(
                  "text-lg font-bold",
                  isOverdue 
                    ? "bg-red-600 text-white" 
                    : "bg-amber-600 text-white"
                )}>
                  {currentLead.lead_name?.slice(0, 2).toUpperCase() || '??'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {currentLead.lead_name}
                  </h3>
                  {currentLead.company && (
                    <p className="text-sm text-slate-600">{currentLead.company}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="font-medium">{currentLead.phone}</span>
                  </div>
                  {currentLead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span className="font-medium truncate">{currentLead.email}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className={cn(
                    "w-4 h-4",
                    isOverdue ? "text-red-600" : "text-amber-600"
                  )} />
                  <span className={cn(
                    "font-semibold",
                    isOverdue ? "text-red-700" : "text-amber-700"
                  )}>
                    Scheduled: {format(followUpDate, 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label>Completion Notes (Optional)</Label>
            <Textarea
              placeholder="Add notes about this follow-up..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => window.location.href = `tel:${currentLead.phone}`}
              className="border-green-300 hover:bg-green-50 text-green-700"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Now
            </Button>
            <Link to={createPageUrl('LeadDetail') + `?id=${currentLead.id}`}>
              <Button
                variant="outline"
                className="w-full border-indigo-300 hover:bg-indigo-50 text-indigo-700"
                onClick={() => setIsOpen(false)}
              >
                <User className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </Link>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              onClick={() => snoozeFollowUpMutation.mutate({ lead: currentLead, days: 1 })}
              disabled={snoozeFollowUpMutation.isPending}
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-2" />
              Snooze 1 Day
            </Button>
            <Button
              variant="outline"
              onClick={() => snoozeFollowUpMutation.mutate({ lead: currentLead, days: 3 })}
              disabled={snoozeFollowUpMutation.isPending}
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-2" />
              Snooze 3 Days
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => handleDismissLead(currentLead.id)}
            >
              Skip
            </Button>
            <Button
              onClick={() => markCompletedMutation.mutate({ 
                lead: currentLead, 
                notes: completionNotes 
              })}
              disabled={markCompletedMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark Completed
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}