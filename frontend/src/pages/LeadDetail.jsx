import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Clock,
  User,
  Snowflake,
  XCircle,
  DollarSign,
  Calendar as CalendarIcon,
  MessageSquare,
  PhoneCall,
  Building,
  Star,
  Target,
  TrendingUp,
  Activity,
  Facebook,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import LeadPipelineStages from '@/components/leads/LeadPipelineStages';
import StageChangeDialog from '@/components/leads/StageChangeDialog';
import AssignLeadDialog from '@/components/leads/AssignLeadDialog';
import LeadTimeline from '@/components/leads/LeadTimeline';
import LostLeadDialog from '@/components/leads/LostLeadDialog';
import ColdLeadDialog from '@/components/leads/ColdLeadDialog';
import LeadQuickActions from '@/components/leads/LeadQuickActions';
import LeadScoreBadge from '@/components/leads/LeadScoreBadge';
import LeadSourceBadge from '@/components/leads/LeadSourceBadge';
import LeadProgressBar from '@/components/leads/LeadProgressBar';
import NextActionSuggestion from '@/components/leads/NextActionSuggestion';
import StageDetailsHistory from '@/components/leads/StageDetailsHistory';
import { sendAssignmentNotification, MODULES } from '@/components/utils/notificationService';

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

export default function LeadDetail() {
  const [currentUser, setCurrentUser] = useState(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [targetStage, setTargetStage] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [coldDialogOpen, setColdDialogOpen] = useState(false);

  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('id');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setCurrentUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: lead, isLoading, error, refetch: refetchLead } = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: async () => {
      if (!leadId) return null;

      // Try all cache sources first
      const cachedFromManagement = queryClient.getQueryData(['leads-management']);
      if (cachedFromManagement) {
        const found = cachedFromManagement.find(l => l.id === leadId);
        if (found) return found;
      }

      const cachedFromLeads = queryClient.getQueryData(['leads']);
      if (cachedFromLeads) {
        const found = cachedFromLeads.find(l => l.id === leadId);
        if (found) return found;
      }

      // Fetch fresh data
      const allLeads = await base44.entities.Lead.list('-created_date', 10000);
      return allLeads.find(l => l.id === leadId) || null;
    },
    enabled: !!leadId,
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-leads'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data?.users || [];
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Lead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: (data) => base44.entities.RELeadActivity.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
    },
  });

  const handleContactToggle = async (contacted) => {
    if (!lead) return;

    // Check permissions: only admin or assigned user can change contact status
    const canEdit = currentUser?.role === 'admin' || lead.assigned_to === currentUser?.email;
    if (!canEdit) {
      toast.error('Only the assigned owner or admin can change the lead status');
      return;
    }

    const willChangeStage = contacted && lead.status === 'new';

    // Check for duplicate within last 5 seconds
    const recentActivities = await base44.entities.RELeadActivity.filter(
      { lead_id: lead.id },
      '-created_date',
      5
    );

    const noteText = contacted
      ? (willChangeStage ? 'Contacted & Stage Updated: New → Contacted' : 'Status: Marked as contacted')
      : 'Status: Marked as not contacted';

    const isDuplicate = recentActivities.some(activity => {
      const timeDiff = Date.now() - new Date(activity.created_date).getTime();
      return timeDiff < 5000 && activity.notes === noteText;
    });

    await updateLeadMutation.mutateAsync({
      id: lead.id,
      data: {
        last_contact_date: contacted ? new Date().toISOString() : null,
        status: willChangeStage ? 'contacted' : lead.status
      }
    });

    if (!isDuplicate) {
      await createActivityMutation.mutateAsync({
        lead_id: lead.id,
        activity_type: contacted && willChangeStage ? 'Stage Change' : 'Note',
        description: noteText,
        actor_email: currentUser?.email,
      });
    }

    // Invalidate queries to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
    queryClient.invalidateQueries({ queryKey: ['leads-management'] });

    toast.success(contacted ? 'Lead marked as contacted' : 'Contact status cleared');
  };

  const handleStageClick = (stage) => {
    if (!lead) return;

    // Check permissions: only admin or assigned user can change status
    const canEdit = currentUser?.role === 'admin' || lead.assigned_to === currentUser?.email;
    if (!canEdit) {
      toast.error('Only the assigned owner or admin can change the lead status');
      return;
    }

    const currentIndex = STAGES.findIndex(s => s.key === lead.status);
    const targetIndex = STAGES.findIndex(s => s.key === stage.key);

    if (targetIndex === currentIndex + 1) {
      setTargetStage(stage);
      setStageDialogOpen(true);
    } else if (targetIndex > currentIndex + 1) {
      toast.error('Complete previous stages first');
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleLeadUpdate = (updatedLead) => {
    queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
    queryClient.invalidateQueries({ queryKey: ['leads-management'] });
    queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
    queryClient.invalidateQueries({ queryKey: ['users-for-leads'] });

    if (updatedLead.status === 'closed_won') {
      triggerConfetti();
      toast.success('🎉 Deal Won! Congratulations!', { duration: 5000 });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-600">Loading lead details...</div>
      </div>
    );
  }

  if (!lead && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Lead not found</h2>
        <p className="text-slate-600 mb-4">Lead ID: {leadId}</p>
        {error && <p className="text-red-600 text-sm mb-4">Error: {error.message}</p>}
        <Link to={createPageUrl('LeadManagement')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
        </Link>
      </div>
    );
  }

  // Check access permission: only admin or assigned user can view lead details
  const canViewLead = currentUser?.role === 'admin' || lead.assigned_to === currentUser?.email;

  if (!canViewLead) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <XCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-600 mb-4">You don't have permission to view this lead.</p>
        <Link to={createPageUrl('LeadManagement')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leads
          </Button>
        </Link>
      </div>
    );
  }

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAssignedUser = () => {
    if (!lead?.assigned_to) return null;
    return users.find(u => u.email === lead.assigned_to);
  };

  const assignedUser = getAssignedUser();

  // Parse Facebook lead data from notes
  const parseFacebookData = () => {
    if (!lead?.notes || lead.lead_source !== 'facebook') return null;

    const data = {
      formName: null,
      pageId: null,
      pageName: null,
      formId: null,
      adId: null,
      adName: null,
      adSetId: null,
      adSetName: null,
      campaignId: null,
      campaignName: null,
      createdTime: null,
      leadId: null,
      questions: [],
      rawNotes: lead.notes
    };

    const lines = lead.notes.split('\n');
    let inFormFields = false;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Check if we're entering form fields section
      if (line.includes('--- Form Fields ---')) {
        inFormFields = true;
        continue;
      }

      if (!line.includes(':')) continue;

      const colonIndex = line.indexOf(':');
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      if (!value) continue;

      // Parse meta fields
      if (key === 'Form Name') {
        data.formName = value;
      } else if (key === 'Page ID') {
        data.pageId = value;
      } else if (key === 'Page Name') {
        data.pageName = value;
      } else if (key === 'Form') {
        data.formId = value;
      } else if (key === 'Lead ID') {
        data.leadId = value;
      } else if (key === 'Ad ID') {
        data.adId = value;
      } else if (key === 'Ad Name') {
        data.adName = value;
      } else if (key === 'Ad Set ID') {
        data.adSetId = value;
      } else if (key === 'Ad Set Name') {
        data.adSetName = value;
      } else if (key === 'Campaign ID') {
        data.campaignId = value;
      } else if (key === 'Campaign Name') {
        data.campaignName = value;
      } else if (key === 'Created Time') {
        data.createdTime = value;
      } else if (inFormFields) {
        // These are form questions and answers
        data.questions.push({ question: key, answer: value });
      }
    }

    return data;
  };

  const facebookData = parseFacebookData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to={createPageUrl('LeadManagement')}>
                <Button variant="ghost" size="icon" className="hover:bg-slate-100">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{lead.lead_name || lead.name}</h1>
                  {lead.is_cold && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      <Snowflake className="w-3 h-3 mr-1" />
                      Cold Lead
                    </Badge>
                  )}
                  {lead.status === 'lost' && (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                      Lost
                    </Badge>
                  )}
                  <LeadScoreBadge lead={lead} />
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Mail className="w-4 h-4" />
                    <span>{lead.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Phone className="w-4 h-4" />
                    <span>{lead.phone}</span>
                  </div>
                  {lead.lead_source && (
                    <LeadSourceBadge source={lead.lead_source} />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <LeadQuickActions lead={lead} currentUser={currentUser} />

              <Separator orientation="vertical" className="h-8" />

              {currentUser?.role === 'admin' ? (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                  onClick={() => setAssignDialogOpen(true)}
                >
                  <User className="w-4 h-4 mr-2" />
                  {!lead.assigned_to ? 'Assign Lead' : 'Reassign'}
                </Button>
              ) : !lead.assigned_to ? (
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md"
                  onClick={async () => {
                    await updateLeadMutation.mutateAsync({
                      id: lead.id,
                      data: { assigned_to: currentUser.email }
                    });
                    await createActivityMutation.mutateAsync({
                      lead_id: lead.id,
                      activity_type: 'Assignment',
                      actor_email: currentUser.email,
                    });

                    await sendAssignmentNotification({
                      assignedTo: currentUser.email,
                      assignedBy: currentUser.email,
                      assignedByName: currentUser.full_name || currentUser.email,
                      module: MODULES.LEAD,
                      itemName: lead.lead_name || lead.name,
                      itemId: lead.id,
                      description: 'Self-assigned'
                    });

                    toast.success('Lead assigned to you');
                  }}
                >
                  <User className="w-4 h-4 mr-2" />
                  Assign to Me
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-[1fr,400px] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Pipeline Progress */}
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Lead Pipeline Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LeadPipelineStages
                  stages={STAGES}
                  currentStage={lead.status || 'new'}
                  onStageClick={handleStageClick}
                  isLost={lead.status === 'lost'}
                />
                <div className="mt-4">
                  <LeadProgressBar status={lead.status || 'new'} />
                </div>
              </CardContent>
            </Card>

            {/* Next Action Suggestion */}
            <NextActionSuggestion lead={lead} />

            {/* Stage Details History */}
            <StageDetailsHistory leadId={lead.id} lead={lead} currentUser={currentUser} />

            {/* Lead Information Grid */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mb-1">Budget</div>
                  <div className="text-xl font-bold text-slate-900">
                    {lead.budget || 'Not specified'}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <MapPin className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mb-1">Location</div>
                  <div className="text-xl font-bold text-slate-900">
                    {lead.location || 'Not specified'}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-white">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <CalendarIcon className="w-5 h-5 text-amber-600" />
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mb-1">Timeline</div>
                  <div className="text-xl font-bold text-slate-900">
                    {lead.timeline || 'Flexible'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Status & Details */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  Contact Status & Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      lead.last_contact_date ? "bg-green-100" : "bg-orange-100"
                    )}>
                      {lead.last_contact_date ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <Clock className="w-6 h-6 text-orange-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">
                        {lead.last_contact_date ? 'Contacted' : 'Not Contacted Yet'}
                      </div>
                      <div className="text-sm text-slate-600">
                        {lead.last_contact_date
                          ? `Last contact: ${new Date(lead.last_contact_date).toLocaleDateString()}`
                          : 'Reach out to this lead soon'
                        }
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={lead.last_contact_date ? "default" : "outline"}
                      onClick={() => handleContactToggle(true)}
                      className={lead.last_contact_date ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      Mark Contacted
                    </Button>
                    {lead.last_contact_date && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleContactToggle(false)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {lead.assigned_to && assignedUser && (
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                          {getInitials(assignedUser.full_name || assignedUser.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-slate-900">
                          {assignedUser.full_name || assignedUser.email}
                        </div>
                        <div className="text-sm text-slate-600">Assigned Owner</div>
                      </div>
                    </div>
                  </div>
                )}

                {lead.next_follow_up && (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium text-blue-900">Next Follow-up Scheduled</div>
                      <div className="text-sm text-blue-700">
                        {new Date(lead.next_follow_up).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Facebook Lead Details */}
            {facebookData && (
              <Card className="border-0 shadow-md">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Facebook className="w-5 h-5 text-blue-600" />
                    Facebook Lead Information
                  </CardTitle>
                  {currentUser?.role === 'admin' && facebookData.leadId && facebookData.questions.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        toast.promise(
                          base44.functions.invoke('refetchFacebookLeadDetails', { leadId: lead.id }),
                          {
                            loading: 'Fetching complete data from Facebook...',
                            success: (response) => {
                              queryClient.invalidateQueries({ queryKey: ['lead-detail', leadId] });
                              return `Found ${response.data.fieldsFound} form fields`;
                            },
                            error: (err) => `Failed: ${err.message || 'Unknown error'}`
                          }
                        );
                      }}
                      className="text-xs"
                    >
                      Fetch Complete Data
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Form & Page Info */}
                  <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    {facebookData.formName && (
                      <div>
                        <div className="text-xs text-blue-600 font-medium mb-1">Form Name</div>
                        <div className="text-sm text-slate-900">{facebookData.formName}</div>
                      </div>
                    )}
                    {facebookData.pageName && (
                      <div>
                        <div className="text-xs text-blue-600 font-medium mb-1">Page</div>
                        <div className="text-sm text-slate-900">{facebookData.pageName}</div>
                      </div>
                    )}
                    {facebookData.createdTime && (
                      <div className="col-span-2">
                        <div className="text-xs text-blue-600 font-medium mb-1">Submitted</div>
                        <div className="text-sm text-slate-900">
                          {new Date(facebookData.createdTime).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Campaign Info */}
                  {(facebookData.campaignName || facebookData.adSetName || facebookData.adName) && (
                    <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-xs text-slate-600 font-medium mb-2">Campaign Details</div>
                      {facebookData.campaignName && facebookData.campaignName !== 'N/A' && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-slate-500 flex-shrink-0">Campaign:</span>
                          <span className="text-xs text-slate-900 text-right">{facebookData.campaignName}</span>
                        </div>
                      )}
                      {facebookData.adSetName && facebookData.adSetName !== 'N/A' && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-slate-500 flex-shrink-0">Ad Set:</span>
                          <span className="text-xs text-slate-900 text-right">{facebookData.adSetName}</span>
                        </div>
                      )}
                      {facebookData.adName && facebookData.adName !== 'N/A' && (
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-xs text-slate-500 flex-shrink-0">Ad:</span>
                          <span className="text-xs text-slate-900 text-right">{facebookData.adName}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Form Questions & Answers */}
                  {facebookData.questions.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        Form Responses ({facebookData.questions.length})
                      </div>
                      <div className="space-y-3">
                        {facebookData.questions.map((qa, idx) => (
                          <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg">
                            <div className="text-xs text-slate-500 mb-1.5 font-medium">{qa.question}</div>
                            <div className="text-sm text-slate-900 whitespace-pre-wrap">{qa.answer}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Data View */}
                  {facebookData.rawNotes && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Raw Data</span>
                        <span className="text-[10px]">▼</span>
                      </summary>
                      <div className="mt-2 text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {facebookData.rawNotes}
                      </div>
                    </details>
                  )}

                  {/* Technical IDs (collapsible) */}
                  {(facebookData.leadId || facebookData.formId || facebookData.pageId || facebookData.adId || facebookData.adSetId || facebookData.campaignId) && (
                    <details className="group">
                      <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                        <span>Technical Details</span>
                        <span className="text-[10px]">▼</span>
                      </summary>
                      <div className="mt-2 space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 font-mono">
                        {facebookData.leadId && <div>Lead ID: {facebookData.leadId}</div>}
                        {facebookData.formId && <div>Form ID: {facebookData.formId}</div>}
                        {facebookData.pageId && <div>Page ID: {facebookData.pageId}</div>}
                        {facebookData.campaignId && facebookData.campaignId !== 'N/A' && <div>Campaign ID: {facebookData.campaignId}</div>}
                        {facebookData.adSetId && facebookData.adSetId !== 'N/A' && <div>Ad Set ID: {facebookData.adSetId}</div>}
                        {facebookData.adId && facebookData.adId !== 'N/A' && <div>Ad ID: {facebookData.adId}</div>}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Additional Info */}
            {(lead.project_name || lead.requirements) && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Building className="w-5 h-5 text-indigo-600" />
                    Additional Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lead.project_name && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Project Interest</div>
                      <div className="text-sm font-medium text-slate-900">{lead.project_name}</div>
                    </div>
                  )}
                  {lead.requirements && (
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Requirements</div>
                      <div className="text-sm text-slate-700">{lead.requirements}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            {(currentUser?.role === 'admin' || lead.assigned_to === currentUser?.email) && (
              <div className="flex gap-3">
                {!lead.is_cold && (
                  <Button
                    variant="outline"
                    onClick={() => setColdDialogOpen(true)}
                    className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Snowflake className="w-4 h-4 mr-2" />
                    Mark as Cold Lead
                  </Button>
                )}
                {lead.status !== 'lost' && (
                  <Button
                    variant="outline"
                    onClick={() => setLostDialogOpen(true)}
                    className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Mark as Lost
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Timeline */}
          <div className="space-y-6">
            <Card className="border-0 shadow-md sticky top-24">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-600" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="px-6 pb-6">
                  <LeadTimeline leadId={lead.id} currentUser={currentUser} users={users} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <StageChangeDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        lead={lead}
        targetStage={targetStage}
        onSuccess={(updatedLead) => {
          handleLeadUpdate(updatedLead);
          setStageDialogOpen(false);
        }}
        onMarkAsLost={() => setLostDialogOpen(true)}
        onMarkAsCold={() => setColdDialogOpen(true)}
      />

      <AssignLeadDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        lead={lead}
        users={users}
        currentUser={currentUser}
        onSuccess={(updatedLead) => {
          handleLeadUpdate(updatedLead);
          setAssignDialogOpen(false);
        }}
      />

      <LostLeadDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        lead={lead}
        onSuccess={(updatedLead) => {
          handleLeadUpdate(updatedLead);
          setLostDialogOpen(false);
        }}
      />

      <ColdLeadDialog
        open={coldDialogOpen}
        onOpenChange={setColdDialogOpen}
        lead={lead}
        onSuccess={(updatedLead) => {
          handleLeadUpdate(updatedLead);
          setColdDialogOpen(false);
        }}
      />
    </div>
  );
}