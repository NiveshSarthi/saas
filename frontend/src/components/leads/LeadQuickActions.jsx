import React, { useState } from 'react';
import { Phone, MessageCircle, Mail, Calendar, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function LeadQuickActions({ lead, currentUser }) {
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [callNotes, setCallNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  
  const queryClient = useQueryClient();

  const logActivityMutation = useMutation({
    mutationFn: async ({ type, description }) => {
      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: type,
        description,
        actor_email: currentUser?.email,
      });

      await base44.entities.Lead.update(lead.id, {
        last_activity: new Date().toISOString(),
        last_contact_date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
    },
  });

  const scheduleFollowUpMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Lead.update(lead.id, {
        next_follow_up: followUpDate,
      });

      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: 'Follow-up',
        description: `Follow-up scheduled for ${new Date(followUpDate).toLocaleDateString()}: ${followUpNotes}`,
        actor_email: currentUser?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      setFollowUpDialogOpen(false);
      setFollowUpDate('');
      setFollowUpNotes('');
      toast.success('Follow-up scheduled');
    },
  });

  const handleCall = async () => {
    await logActivityMutation.mutateAsync({ type: 'Call', description: callNotes || 'Call made' });
    setCallDialogOpen(false);
    setCallNotes('');
    toast.success('Call logged');
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(`Hi ${lead.name}, this is ${currentUser?.full_name} from our team.`);
    window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    logActivityMutation.mutate({ type: 'WhatsApp', description: 'WhatsApp message sent' });
  };

  const handleEmail = () => {
    window.open(`mailto:${lead.email}?subject=Regarding your inquiry&body=Hi ${lead.name},`);
    logActivityMutation.mutate({ type: 'Email', description: 'Email composed' });
  };

  return (
    <>
      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setCallDialogOpen(true)}
                className="rounded-full w-10 h-10 p-0 hover:bg-blue-50 hover:border-blue-300"
              >
                <Phone className="w-5 h-5 text-slate-700" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Call & Log</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleWhatsApp}
                className="rounded-full w-10 h-10 p-0 hover:bg-green-50 hover:border-green-300"
              >
                <MessageCircle className="w-5 h-5 text-slate-700" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WhatsApp</TooltipContent>
          </Tooltip>

          {lead.email && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleEmail}
                  className="rounded-full w-10 h-10 p-0 hover:bg-purple-50 hover:border-purple-300"
                >
                  <Mail className="w-5 h-5 text-slate-700" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send Email</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setFollowUpDialogOpen(true)}
                className="rounded-full w-10 h-10 p-0 hover:bg-indigo-50 hover:border-indigo-300"
              >
                <Calendar className="w-5 h-5 text-slate-700" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Schedule Follow-up</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Call Log Dialog */}
      <Dialog open={callDialogOpen} onOpenChange={setCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Call with {lead.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 text-blue-900">
                <Phone className="w-4 h-4" />
                <span className="font-medium">{lead.phone}</span>
              </div>
            </div>
            <Textarea
              placeholder="Call notes (optional)..."
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCall}>Log Call</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-up Dialog */}
      <Dialog open={followUpDialogOpen} onOpenChange={setFollowUpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Follow-up Date *</Label>
              <Input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="What to discuss in the follow-up..."
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => scheduleFollowUpMutation.mutate()}
              disabled={!followUpDate || scheduleFollowUpMutation.isPending}
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}