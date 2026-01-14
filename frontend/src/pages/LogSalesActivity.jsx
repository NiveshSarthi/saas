import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, User, AlertCircle, X, Activity, TrendingUp } from 'lucide-react';
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

export default function LogSalesActivity() {
  const [user, setUser] = useState(null);
  const [onBehalfOf, setOnBehalfOf] = useState('self');
  const [type, setType] = useState('walk_in');
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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const { data: buildersData = [] } = useQuery({
    queryKey: ['builders'],
    queryFn: async () => {
      const builders = await base44.entities.Builder.list('builder_name', 1000);
      console.log('Fetched builders:', builders);
      return builders;
    },
    enabled: !!user,
  });

  // Combine users and invitations
  const allUsers = useMemo(() => [
    ...users,
    ...invitations
      .filter(inv => !users.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
        user_category: inv.user_category
      }))
  ], [users, invitations]);

  // Get target email for builder filtering
  const targetEmail = useMemo(() => {
    if (!user?.email) return null;
    
    if (onBehalfOf === 'self') {
      return user.email.toLowerCase();
    }
    
    // When admin logs on behalf of someone
    const targetUser = allUsers.find(u => u.email?.toLowerCase() === onBehalfOf?.toLowerCase());
    return (targetUser?.email || user.email).toLowerCase();
  }, [onBehalfOf, allUsers, user]);

  // Filter builders assigned to current user
  const userBuilders = useMemo(() => {
    console.log('=== Builder Filtering Debug ===');
    console.log('User email:', user?.email);
    console.log('On behalf of:', onBehalfOf);
    console.log('Target email:', targetEmail);
    console.log('Builders data:', buildersData);
    console.log('User role:', user?.role);
    
    if (!buildersData || buildersData.length === 0) {
      console.log('❌ No builders data');
      return [];
    }
    
    if (!targetEmail) {
      console.log('❌ No target email');
      return [];
    }
    
    const activeBuilders = buildersData.filter(b => b.is_active !== false);
    console.log('✓ Active builders count:', activeBuilders.length);
    
    // Admin sees all active builders
    if (user?.role === 'admin') {
      console.log('✓ Admin user - showing all active builders');
      return activeBuilders;
    }
    
    // Regular users see only assigned builders
    const filteredBuilders = activeBuilders.filter(builder => {
      console.log(`Checking builder: ${builder.builder_name}`);
      console.log('  - assigned_users:', builder.assigned_users);
      
      if (!builder.assigned_users || !Array.isArray(builder.assigned_users)) {
        console.log('  ❌ No assigned_users array');
        return false;
      }
      
      const normalizedAssignments = builder.assigned_users.map(e => e?.toLowerCase());
      console.log('  - normalized assignments:', normalizedAssignments);
      console.log('  - looking for:', targetEmail);
      
      const isAssigned = normalizedAssignments.includes(targetEmail);
      console.log(`  ${isAssigned ? '✓' : '❌'} Is assigned:`, isAssigned);
      
      return isAssigned;
    });
    
    console.log('Final filtered builders:', filteredBuilders.map(b => b.builder_name));
    console.log('=== End Debug ===');
    
    return filteredBuilders;
  }, [buildersData, user?.role, user?.email, targetEmail, onBehalfOf]);

  // Get sales department users
  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);
  const salesUsers = allUsers.filter(u => 
    u.department_id && 
    salesDeptIds.includes(u.department_id) &&
    u.active !== false
  );

  const { data: existingActivities = [] } = useQuery({
    queryKey: ['sales-activities-check'],
    queryFn: () => base44.entities.SalesActivity.filter({}, '-date', 5000),
  });

  const logActivityMutation = useMutation({
    mutationFn: async (data) => {
      const targetUserEmail = onBehalfOf === 'self' ? user.email : onBehalfOf;

      const currentUser = allUsers.find(u => u.email?.toLowerCase() === targetUserEmail?.toLowerCase());
      const hasManager = currentUser?.reports_to && currentUser.reports_to !== '' && currentUser.reports_to !== 'none';
      const reportingOfficer = hasManager ? allUsers.find(u => u.email?.toLowerCase() === currentUser.reports_to?.toLowerCase()) : null;

      // Dual verification statuses
      const builderStatus = data.builder_email ? 'pending' : null;
      const roStatus = hasManager ? 'pending' : null;

      const activityData = await base44.entities.SalesActivity.create({
        user_email: targetUserEmail,
        created_on_behalf_of: onBehalfOf !== 'self' ? targetUserEmail : null,
        type: type,
        date: new Date().toISOString(),
        ...data,
        deal_value: data.deal_value ? parseFloat(data.deal_value) : 0,
        status: type === 'closure' ? 'closed_won' : data.status,
        builder_verification_status: builderStatus || 'pending',
        ro_verification_status: roStatus || 'pending',
        workflow_logs: [
          {
            action: 'submitted',
            actor_email: user.email,
            timestamp: new Date().toISOString(),
            note: 'Activity submitted for verification'
          }
        ]
      });

      // Send notification to builder if selected
      if (data.builder_email) {
        await base44.entities.Notification.create({
          user_email: data.builder_email,
          type: 'review_requested',
          title: 'Builder Verification Required',
          message: `Sales activity from ${currentUser?.full_name || targetUserEmail} requires your verification.`,
          read: false
        });
      }

      // Send notification to RO if exists
      if (hasManager && reportingOfficer) {
        await base44.entities.Notification.create({
          user_email: reportingOfficer.email,
          type: 'review_requested',
          title: 'Activity Verification Required',
          message: `Sales activity from ${currentUser?.full_name || targetUserEmail} requires your verification.`,
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

      toast.success('Sales Activity logged successfully and sent for verification.');

      // Reset form
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
      setType('walk_in');
      setOnBehalfOf('self');

      // Navigate to sales performance page
      setTimeout(() => {
        window.location.href = createPageUrl('SalesPerformance');
      }, 1500);
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
    
    // Validate property type if status is negotiation or follow_up
    if ((formData.status === 'negotiation' || formData.status === 'follow_up') && !formData.property_type) {
      toast.error('Property Type is required for Negotiation or Follow Up status');
      return;
    }

    // Validate deal value for closure
    if (type === 'closure' && !formData.deal_value) {
      toast.error('Deal Value is required for Closure/Booking');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/30 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to={createPageUrl('SalesPerformance')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-600" />
              Log Sales Activity
            </h1>
            <p className="text-slate-600 mt-1">Record walk-ins and closures with complete lead details</p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-2 border-slate-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Activity Details
            </CardTitle>
            <CardDescription>Fill in all required fields marked with asterisk (*)</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="max-h-[calc(100vh-300px)]">
              <form onSubmit={handleSubmit} className="space-y-6 pr-4">
                {/* Admin: Created on behalf of */}
                {user?.role === 'admin' && (
                  <div className="space-y-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <Label className="text-amber-900 font-semibold">Created on behalf of</Label>
                    <Select value={onBehalfOf} onValueChange={setOnBehalfOf}>
                      <SelectTrigger className="bg-white">
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
                    <p className="text-xs text-amber-700">Admin privilege: Log activity for any sales member</p>
                  </div>
                )}

                {/* Activity Type */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Activity Type *</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk_in">Walk-In</SelectItem>
                      <SelectItem value="closure">Closure / Booking</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Walk-In for new visits | Closure for completed deals</p>
                </div>

                {/* Lead Name & Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Lead Name *</Label>
                    <Input
                      required
                      className="h-11"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      placeholder="Full name of customer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Phone *</Label>
                    <Input
                      required
                      className="h-11"
                      value={formData.customer_phone}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      placeholder="Contact number"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label>Email (Optional)</Label>
                  <Input
                    type="email"
                    className="h-11"
                    value={formData.customer_email}
                    onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                    placeholder="customer@example.com"
                  />
                </div>

                {/* Lead Source & Lead Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Lead Source</Label>
                    <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="walk_in">Walk-In</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="social_media">Social Media</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Type</Label>
                    <Select value={formData.lead_type} onValueChange={(v) => setFormData({ ...formData, lead_type: v })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fresh_lead">Fresh Lead</SelectItem>
                        <SelectItem value="repeat_lead">Repeat Lead</SelectItem>
                        <SelectItem value="referral_lead">Referral Lead</SelectItem>
                        <SelectItem value="channel_partner_lead">Channel Partner Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Lead Quality */}
                <div className="space-y-2">
                  <Label>Lead Quality - RM Feedback (Optional)</Label>
                  <Select value={formData.lead_quality} onValueChange={(v) => setFormData({ ...formData, lead_quality: v })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select lead quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="genuine">✓ Genuine</SelectItem>
                      <SelectItem value="not_genuine">✗ Not Genuine</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500">Reporting Manager's assessment of lead authenticity</p>
                </div>

                {/* Builder - FIXED */}
                <div className="space-y-2">
                  <Label>Builder (Optional)</Label>
                  <Select 
                    value={formData.builder_email || 'none'} 
                    onValueChange={(v) => setFormData({ ...formData, builder_email: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue 
                        placeholder={userBuilders.length === 0 ? "No builders assigned to you" : "Select builder if applicable"} 
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {userBuilders.map(builder => (
                        <SelectItem key={builder.id} value={builder.email}>
                          {builder.builder_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userBuilders.length === 0 ? (
                    <p className="text-xs text-amber-600 font-medium">⚠️ No builders assigned to you</p>
                  ) : (
                    <p className="text-xs text-slate-500">✓ {userBuilders.length} builder(s) available • Select if verification needed</p>
                  )}
                </div>

                {/* Property Type */}
                <div className="space-y-2">
                  <Label>
                    Type of Property
                    {(formData.status === 'negotiation' || formData.status === 'follow_up') && <span className="text-red-500"> *</span>}
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

                {/* Walk-in At - NEW MULTI-TAG */}
                <div className="space-y-2">
                  <Label>Walk-in At (Optional)</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[48px] p-3 border-2 border-slate-200 rounded-lg bg-slate-50">
                      {formData.walk_in_at.length === 0 && (
                        <span className="text-slate-400 text-sm">No locations added yet...</span>
                      )}
                      {formData.walk_in_at.map((tag, index) => (
                        <span 
                          key={index} 
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 rounded-full text-sm font-medium shadow-sm"
                        >
                          {tag}
                          <button 
                            type="button"
                            onClick={() => removeWalkInTag(tag)}
                            className="hover:text-indigo-900 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <Input
                      className="h-11"
                      value={walkInInput}
                      onChange={(e) => setWalkInInput(e.target.value)}
                      onKeyDown={handleWalkInKeyDown}
                      placeholder="Type location and press Enter or comma (e.g., Office, Site Visit, Expo)"
                    />
                    <p className="text-xs text-slate-500">💡 Examples: Office, Site Visit, Expo/Booth, Online Inquiry, Referral Meeting</p>
                  </div>
                </div>

                {/* Deal Value - Conditional for Closure */}
                {type === 'closure' && (
                  <div className="space-y-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <Label className="text-base font-semibold text-green-900">Deal Value *</Label>
                    <Input
                      type="number"
                      required={type === 'closure'}
                      className="h-11 bg-white"
                      value={formData.deal_value}
                      onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                      placeholder="Enter deal amount"
                    />
                    <p className="text-xs text-green-700">Total value of the closed deal</p>
                  </div>
                )}

                {/* Status & Follow-up Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="closed_won">Closed Won</SelectItem>
                        <SelectItem value="closed_lost">Closed Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Follow-up Date 
                      {formData.status === 'follow_up' && <span className="text-red-500"> *</span>}
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

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional remarks or observations..."
                    rows={4}
                    className="resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t-2">
                  <Link to={createPageUrl('SalesPerformance')} className="flex-1">
                    <Button type="button" variant="outline" className="w-full h-11">
                      Cancel
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    disabled={logActivityMutation.isPending} 
                    className="flex-1 h-11 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-base font-semibold"
                  >
                    {logActivityMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Log Activity
                  </Button>
                </div>
              </form>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Check Alert Dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Duplicate Lead Found
            </AlertDialogTitle>
            <AlertDialogDescription>
              This lead already exists with phone: <strong>{formData.customer_phone}</strong>
              <br /><br />
              Existing lead: <strong>{existingLead?.customer_name}</strong>
              <br /><br />
              Continue creating a new entry?
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
    </div>
  );
}