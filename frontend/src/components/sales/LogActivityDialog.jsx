// UPDATED v2: Lead Name*, Phone*, Lead Type dropdown, conditional Follow-up Date
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2, User, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { getUserDisplayName } from '@/components/utils/userDisplay';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function LogActivityDialog({ user, builders, allUsers, departments, projects, invitations, className }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('walk_in');
  const [onBehalfOf, setOnBehalfOf] = useState('self');
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [existingLead, setExistingLead] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    source: 'walk_in',
    property_type: 'residential',
    walk_in_at: [],
    deal_value: '',
    follow_up_date: '',
    status: 'new',
    lead_type: 'fresh_lead',
    lead_quality: '',
    builder_email: '',
    notes: ''
  });
  const [walkInInput, setWalkInInput] = useState('');

  const queryClient = useQueryClient();

  // Use props instead of fetching (data is passed from parent)
  const buildersData = builders || [];
  const users = allUsers || [];
  const depts = departments || [];
  const invites = invitations || [];
  const projectsList = projects || [];

  // Get sales department users
  const salesDeptIds = depts.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);
  
  const combinedUsers = useMemo(() => [
    ...users,
    ...invites
      .filter(inv => !users.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ], [users, invites]);

  // Get target email for builder filtering
  const targetEmail = useMemo(() => {
    if (!user?.email) return null;
    
    if (onBehalfOf === 'self') {
      return user.email.toLowerCase();
    }
    
    // When admin logs on behalf of someone
    const targetUser = combinedUsers.find(u => u.email?.toLowerCase() === onBehalfOf?.toLowerCase());
    return (targetUser?.email || user.email).toLowerCase();
  }, [onBehalfOf, combinedUsers, user]);

  // Filter builders assigned to current user
  const userBuilders = useMemo(() => {
    if (!buildersData || buildersData.length === 0) return [];
    if (!targetEmail) return [];
    
    const activeBuilders = buildersData.filter(b => b.is_active !== false);
    
    // Admin sees all active builders
    if (user?.role === 'admin') {
      return activeBuilders;
    }
    
    // Regular users see only assigned builders
    return activeBuilders.filter(builder => {
      if (!builder.assigned_users || !Array.isArray(builder.assigned_users)) return false;
      const normalizedAssignments = builder.assigned_users.map(e => e?.toLowerCase());
      return normalizedAssignments.includes(targetEmail);
    });
  }, [buildersData, user?.role, targetEmail]);

  const salesUsers = combinedUsers.filter(u => 
    u.department_id && 
    salesDeptIds.includes(u.department_id) &&
    u.active !== false
  );



  const { data: existingActivities = [] } = useQuery({
    queryKey: ['sales-activities-check'],
    queryFn: () => base44.entities.SalesActivity.filter({}, '-date', 5000),
  });

  const { data: connectedLeads = [] } = useQuery({
    queryKey: ['connected-leads'],
    queryFn: () => base44.entities.Lead.filter({ contact_status: 'connected' }, '-created_date', 500),
  });

  const logActivityMutation = useMutation({
    mutationFn: async (data) => {
      const targetUserEmail = onBehalfOf === 'self' ? user.email : onBehalfOf;
      
      // Check if user reports to someone (case insensitive email match)
      const currentUserData = combinedUsers.find(u => u.email?.toLowerCase() === targetUserEmail?.toLowerCase());
      // Ensure we treat empty string as no manager
      const hasManager = currentUserData?.reports_to && currentUserData.reports_to !== '' && currentUserData.reports_to !== 'none';
      const reportingOfficer = hasManager ? combinedUsers.find(u => u.email?.toLowerCase() === currentUserData.reports_to?.toLowerCase()) : null;

      // Determine initial status based on builder selection
      let initialStatus;
      if (data.builder_email) {
        // If builder selected, goes to builder first
        initialStatus = 'pending_builder';
      } else if (hasManager) {
        // No builder but has manager, goes directly to manager
        initialStatus = 'pending';
      } else {
        // No builder and no manager, needs assignment
        initialStatus = 'pending_assignment';
      }

      const activityData = await base44.entities.SalesActivity.create({
        user_email: targetUserEmail,
        created_on_behalf_of: onBehalfOf !== 'self' ? targetUserEmail : null,
        type: type,
        date: new Date().toISOString(),
        ...data,
        deal_value: data.deal_value ? parseFloat(data.deal_value) : 0,
        status: type === 'closure' ? 'closed_won' : data.status,
        approval_status: initialStatus,
        builder_verification_status: data.builder_email ? 'pending' : null,
        ro_verification_status: 'pending',
        workflow_logs: [
          {
            action: 'submitted',
            actor_email: user.email,
            timestamp: new Date().toISOString(),
            note: data.builder_email ? 'Activity submitted for builder verification' : 'Activity created'
          }
        ]
      });

      // Send notification to builder if selected
      if (data.builder_email) {
        await base44.entities.Notification.create({
          user_email: data.builder_email,
          type: 'review_requested',
          title: 'Builder Verification Required',
          message: `Sales activity from ${currentUserData?.full_name || targetUserEmail} requires your verification.`,
          read: false
        });
      }

      // Send notification to reporting officer if they exist
      if (hasManager && reportingOfficer?.email) {
        await base44.entities.Notification.create({
          user_email: reportingOfficer.email,
          type: 'review_requested',
          title: 'Activity Verification Required',
          message: `Sales activity from ${currentUserData?.full_name || targetUserEmail} requires your verification.`,
          read: false
        });
      }

      return { hasManager, reportingOfficer, hasBuilder: !!data.builder_email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['my-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities-check'] });
      queryClient.invalidateQueries({ queryKey: ['sales-hierarchy'] });
      
      const { hasManager, reportingOfficer, hasBuilder } = data;
      
      if (hasBuilder) {
        toast.success('Sales Activity logged successfully. Sent to Builder for verification.');
      } else if (hasManager && reportingOfficer) {
        toast.success(`Sales Activity logged successfully. This has been forwarded to your Reporting Officer: ${reportingOfficer.full_name || reportingOfficer.email}`);
      } else {
        toast.success('Sales Activity logged successfully.');
      }
      
      setOpen(false);
      setFormData({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        source: 'walk_in',
        property_type: 'residential',
        walk_in_at: [],
        deal_value: '',
        follow_up_date: '',
        status: 'new',
        lead_type: 'fresh_lead',
        lead_quality: '',
        builder_email: '',
        notes: ''
      });
      setWalkInInput('');
      setOnBehalfOf('self');
    },
  });

  const checkDuplicate = () => {
    if (!formData.customer_phone || formData.customer_phone.trim() === '') return false;
    
    const duplicate = existingActivities.find(
      activity => activity.customer_phone === formData.customer_phone
    );
    
    return duplicate;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.customer_name || !formData.customer_phone) {
      toast.error('Lead Name and Phone are required');
      return;
    }
    
    // Validate follow-up date if status is follow_up
    if (formData.status === 'follow_up' && !formData.follow_up_date) {
      toast.error('Follow-up Date is required when status is Follow Up');
      return;
    }
    
    // Validate property type if status is interested or meeting scheduled
    if ((formData.status === 'negotiation' || formData.status === 'follow_up') && !formData.property_type) {
      toast.error('Property Type is required for Interested or Meeting Scheduled status');
      return;
    }
    
    // Check for duplicate
    const duplicate = checkDuplicate();
    if (duplicate) {
      setExistingLead(duplicate);
      setDuplicateDialogOpen(true);
      return;
    }
    
    // Submit
    logActivityMutation.mutate(formData);
  };

  const handleConfirmDuplicate = () => {
    setDuplicateDialogOpen(false);
    logActivityMutation.mutate(formData);
  };

  const handleWalkInKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = walkInInput.trim();
      if (value && !formData.walk_in_at.includes(value)) {
        setFormData({
          ...formData,
          walk_in_at: [...formData.walk_in_at, value]
        });
        setWalkInInput('');
      }
    }
  };

  const removeWalkInTag = (tagToRemove) => {
    setFormData({
      ...formData,
      walk_in_at: formData.walk_in_at.filter(tag => tag !== tagToRemove)
    });
  };

  const handleLeadSelect = (leadId) => {
    if (leadId === 'manual') {
      setFormData({
        ...formData,
        customer_name: '',
        customer_phone: '',
        customer_email: ''
      });
      return;
    }

    const selectedLead = connectedLeads.find(l => l.id === leadId);
    if (selectedLead) {
      setFormData({
        ...formData,
        customer_name: selectedLead.lead_name || '',
        customer_phone: selectedLead.phone || '',
        customer_email: selectedLead.email || ''
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={className}>
          <Plus className="w-4 h-4 mr-2" />
          Log Sales Activity
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh]">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
              <Plus className="w-5 h-5 text-white" />
            </div>
            Log Sales Activity
          </DialogTitle>
          <DialogDescription className="text-base">
            Record new walk-in or deal closure with complete lead information
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form id="sales-activity-form" onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Admin Section */}
          {user?.role === 'admin' && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
              <Label className="text-base font-semibold text-amber-900 mb-2 block">Admin: Log on Behalf Of</Label>
              <Select value={onBehalfOf} onValueChange={setOnBehalfOf}>
                <SelectTrigger className="bg-white border-amber-300 h-11">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Myself ({getUserDisplayName(user)})
                    </div>
                  </SelectItem>
                  {salesUsers
                    .filter(u => u.email !== user?.email)
                    .map(u => (
                      <SelectItem key={u.email} value={u.email}>
                        {getUserDisplayName(u)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-700 mt-2">Admin privilege: Log activity for any sales member</p>
            </div>
          )}

          {/* Activity Type Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-slate-900">Activity Type</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('walk_in')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  type === 'walk_in'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-left">
                  <div className="text-base font-semibold text-slate-900">Walk-In</div>
                  <div className="text-xs text-slate-600 mt-1">New customer visit or inquiry</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('closure')}
                className={`p-4 border-2 rounded-xl transition-all ${
                  type === 'closure'
                    ? 'border-emerald-500 bg-emerald-50 shadow-md'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                <div className="text-left">
                  <div className="text-base font-semibold text-slate-900">Closure / Booking</div>
                  <div className="text-xs text-slate-600 mt-1">Completed deal or booking</div>
                </div>
              </button>
            </div>
          </div>

          {/* Customer Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-slate-900">Customer Information</h3>
            </div>
            
            {/* Fetch from Connected Leads */}
            {connectedLeads.length > 0 && (
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl space-y-2">
                <Label className="text-sm font-semibold text-green-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Fetch from Connected Leads
                </Label>
                <Select onValueChange={handleLeadSelect}>
                  <SelectTrigger className="h-11 bg-white border-green-300">
                    <SelectValue placeholder="Select a connected lead or enter manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">— Enter Manually —</SelectItem>
                    {connectedLeads.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.lead_name} - {lead.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-green-700">✓ {connectedLeads.length} connected lead(s) available</p>
              </div>
            )}

            <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-xl space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1">
                    Lead Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    className="h-11 bg-white"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    placeholder="Full name of customer"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    required
                    className="h-11 bg-white"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    placeholder="Contact number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Email Address (Optional)</Label>
                <Input
                  type="email"
                  className="h-11 bg-white"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
            </div>
          </div>

          {/* Lead Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-slate-900">Lead Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Lead Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">🚶 Walk-In</SelectItem>
                    <SelectItem value="referral">🤝 Referral</SelectItem>
                    <SelectItem value="online">🌐 Online</SelectItem>
                    <SelectItem value="phone">📞 Phone</SelectItem>
                    <SelectItem value="social_media">📱 Social Media</SelectItem>
                    <SelectItem value="other">📋 Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Lead Type</Label>
                <Select value={formData.lead_type} onValueChange={(v) => setFormData({ ...formData, lead_type: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresh_lead">✨ Fresh Lead</SelectItem>
                    <SelectItem value="repeat_lead">🔄 Repeat Lead</SelectItem>
                    <SelectItem value="referral_lead">🎯 Referral Lead</SelectItem>
                    <SelectItem value="channel_partner_lead">🤝 Channel Partner Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Property Type
                  {(formData.status === 'negotiation' || formData.status === 'follow_up') && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Select 
                  value={formData.property_type} 
                  onValueChange={(v) => setFormData({ ...formData, property_type: v })}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">🏘️ Residential</SelectItem>
                    <SelectItem value="commercial">🏢 Commercial</SelectItem>
                    <SelectItem value="others">📦 Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Lead Quality</Label>
                <Select value={formData.lead_quality} onValueChange={(v) => setFormData({ ...formData, lead_quality: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="genuine">✅ Genuine</SelectItem>
                    <SelectItem value="not_genuine">❌ Not Genuine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Builder Selection */}
          <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl space-y-2">
            <Label className="text-sm font-semibold text-orange-900">Builder (Optional)</Label>
            <Select 
              value={formData.builder_email || 'none'} 
              onValueChange={(v) => setFormData({ ...formData, builder_email: v === 'none' ? '' : v })}
            >
              <SelectTrigger className="h-11 bg-white border-orange-300">
                <SelectValue placeholder={userBuilders.length === 0 ? "No builders assigned" : "Select builder"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {userBuilders.map(builder => (
                  <SelectItem key={builder.id} value={builder.email}>
                    🏗️ {builder.builder_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {userBuilders.length === 0 ? (
              <p className="text-xs text-amber-700 font-medium">⚠️ No builders assigned to you</p>
            ) : (
              <p className="text-xs text-orange-700">✓ {userBuilders.length} builder(s) available • Select if verification needed</p>
            )}
          </div>

          {/* Walk-in Locations */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Walk-in At (Optional)</Label>
            <div className="p-3 bg-gradient-to-br from-slate-50 to-indigo-50 border-2 border-slate-200 rounded-xl space-y-3">
              <div className="flex flex-wrap gap-2 min-h-[48px]">
                {formData.walk_in_at.length === 0 && (
                  <span className="text-slate-400 text-sm">No locations added yet...</span>
                )}
                {formData.walk_in_at.map((tag, index) => (
                  <span 
                    key={index} 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-medium shadow-md"
                  >
                    {tag}
                    <button 
                      type="button"
                      onClick={() => removeWalkInTag(tag)}
                      className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                className="h-11 bg-white"
                value={walkInInput}
                onChange={(e) => setWalkInInput(e.target.value)}
                onKeyDown={handleWalkInKeyDown}
                placeholder="Type location and press Enter (e.g., Office, Site Visit, Expo)"
              />
              <p className="text-xs text-slate-600">💡 Examples: Office, Site Visit, Expo/Booth, Online Inquiry</p>
            </div>
          </div>

          {/* Deal Value for Closures */}
          {type === 'closure' && (
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-xl space-y-2">
              <Label className="text-base font-semibold text-emerald-900 flex items-center gap-1">
                💰 Deal Value <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                required={type === 'closure'}
                className="h-12 text-lg font-semibold bg-white border-emerald-300"
                value={formData.deal_value}
                onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                placeholder="Enter deal amount"
              />
              <p className="text-xs text-emerald-700">Total value of the closed deal</p>
            </div>
          )}

          {/* Status & Follow-up Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
              <h3 className="text-lg font-semibold text-slate-900">Status & Follow-up</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Lead Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">🆕 New</SelectItem>
                    <SelectItem value="follow_up">📞 Follow Up</SelectItem>
                    <SelectItem value="negotiation">💼 Negotiation</SelectItem>
                    <SelectItem value="on_hold">⏸️ On Hold</SelectItem>
                    <SelectItem value="closed_won">✅ Closed Won</SelectItem>
                    <SelectItem value="closed_lost">❌ Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Follow-up Date {formData.status === 'follow_up' && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  type="date"
                  className="h-11"
                  required={formData.status === 'follow_up'}
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Additional Notes (Optional)</Label>
            <Textarea
              className="min-h-[100px] resize-none"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any additional remarks, observations, or important details about this interaction..."
            />
          </div>

          </form>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t mt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 px-6">
            Cancel
          </Button>
          <Button 
            type="submit" 
            form="sales-activity-form" 
            disabled={logActivityMutation.isPending} 
            className="h-11 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-base font-semibold shadow-lg"
          >
            {logActivityMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {logActivityMutation.isPending ? 'Logging...' : 'Log Activity'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Duplicate Check Alert Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Duplicate Lead Found
            </AlertDialogTitle>
            <AlertDialogDescription>
              This lead already exists in the system with phone number: <strong>{formData.customer_phone}</strong>
              <br /><br />
              Existing lead: <strong>{existingLead?.customer_name}</strong>
              <br />
              Do you want to continue creating a new entry or update the existing record?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate} className="bg-indigo-600 hover:bg-indigo-700">
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}