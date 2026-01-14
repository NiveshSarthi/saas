import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Phone, Mail, MapPin, CheckCircle2, Clock, User, Snowflake, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import LeadPipelineStages from '@/components/leads/LeadPipelineStages';
import StageChangeDialog from '@/components/leads/StageChangeDialog';
import AssignLeadDialog from '@/components/leads/AssignLeadDialog';
import LeadTimeline from '@/components/leads/LeadTimeline';
import LostLeadDialog from '@/components/leads/LostLeadDialog';
import ColdLeadDialog from '@/components/leads/ColdLeadDialog';
import LeadQuickActions from '@/components/leads/LeadQuickActions';

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-slate-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { key: 'screening', label: 'Screening', color: 'bg-indigo-500' },
  { key: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { key: 'proposal', label: 'Proposal', color: 'bg-violet-500' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { key: 'site_visit', label: 'Site Visit', color: 'bg-orange-500' },
  { key: 'agreement', label: 'Agreement', color: 'bg-emerald-500' },
  { key: 'payment', label: 'Payment', color: 'bg-green-600' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-green-700' }
];

export default function LeadDetailDialog({ 
  open, 
  onOpenChange, 
  lead, 
  users,
  currentUser,
  onContactToggle,
  onLeadUpdate
}) {
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [targetStage, setTargetStage] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [coldDialogOpen, setColdDialogOpen] = useState(false);

  if (!lead) return null;

  const handleStageClick = (stage) => {
    const currentIndex = STAGES.findIndex(s => s.key === lead.status);
    const targetIndex = STAGES.findIndex(s => s.key === stage.key);
    
    if (targetIndex === currentIndex + 1) {
      setTargetStage(stage);
      setStageDialogOpen(true);
    } else if (targetIndex > currentIndex + 1) {
      toast.error('Complete previous stages first');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-4 border-b bg-slate-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle className="text-2xl font-bold mb-2">{lead.lead_name || lead.name}</DialogTitle>
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <Mail className="w-4 h-4" />
                  <span>{lead.email || 'No email'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Quick Action Icons */}
                <LeadQuickActions lead={lead} currentUser={currentUser} />

                {/* Contact Status Buttons */}
                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "rounded-full w-10 h-10 p-0",
                    lead.last_contact_date && "bg-green-50 border-green-300"
                  )}
                  onClick={() => onContactToggle(lead, !lead.last_contact_date)}
                >
                  <CheckCircle2 className={cn(
                    "w-5 h-5",
                    lead.last_contact_date ? "text-green-600" : "text-slate-400"
                  )} />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className={cn(
                    "rounded-full w-10 h-10 p-0",
                    !lead.last_contact_date && "bg-orange-50 border-orange-300"
                  )}
                  onClick={() => onContactToggle(lead, false)}
                >
                  <Clock className={cn(
                    "w-5 h-5",
                    !lead.last_contact_date ? "text-orange-600" : "text-slate-400"
                  )} />
                </Button>

                {/* Assign Button */}
                <Button 
                  size="sm" 
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <User className="w-4 h-4 mr-2" />
                  {!lead.assigned_to ? 'Assign' : 'Reassign'}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="p-6">
              <div className="grid grid-cols-[1fr,300px] gap-6">
                {/* Left Column - Stages + Info */}
                <div className="space-y-6">
                  {/* Pipeline Stages */}
                  <div>
                    <LeadPipelineStages
                      stages={STAGES}
                      currentStage={lead.status || 'new'}
                      onStageClick={handleStageClick}
                      isLost={lead.status === 'lost'}
                    />
                  </div>

                  {/* Info Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-lg p-3 border">
                      <div className="text-xs text-slate-500 mb-1">Budget</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {lead.budget || '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border">
                      <div className="text-xs text-slate-500 mb-1">Location</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {lead.location || '-'}
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3 border">
                      <div className="text-xs text-slate-500 mb-1">Timeline</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {lead.timeline || '-'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    {!lead.is_cold && (
                      <Button
                        variant="outline"
                        onClick={() => setColdDialogOpen(true)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Snowflake className="w-4 h-4 mr-2" />
                        Mark as Cold
                      </Button>
                    )}
                    {lead.status !== 'lost' && (
                      <Button
                        variant="outline"
                        onClick={() => setLostDialogOpen(true)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark as Lost
                      </Button>
                    )}
                  </div>
                </div>

                {/* Right Column - Timeline */}
                <div>
                  <LeadTimeline leadId={lead.id} currentUser={currentUser} />
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Sub Dialogs */}
      <StageChangeDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        lead={lead}
        targetStage={targetStage}
        onSuccess={(updatedLead) => {
          onLeadUpdate(updatedLead);
          setStageDialogOpen(false);
        }}
      />

      <AssignLeadDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        lead={lead}
        users={users}
        currentUser={currentUser}
        onSuccess={(updatedLead) => {
          onLeadUpdate(updatedLead);
          setAssignDialogOpen(false);
        }}
      />

      <LostLeadDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        lead={lead}
        onSuccess={(updatedLead) => {
          onLeadUpdate(updatedLead);
          setLostDialogOpen(false);
        }}
      />

      <ColdLeadDialog
        open={coldDialogOpen}
        onOpenChange={setColdDialogOpen}
        lead={lead}
        onSuccess={(updatedLead) => {
          onLeadUpdate(updatedLead);
          setColdDialogOpen(false);
        }}
      />
    </>
  );
}