import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import {
  Plus,
  Footprints,
  CheckCircle2,
  Calendar as CalendarIcon,
  AlertTriangle,
  Trash2,
  Edit,
  DollarSign,
  User,
  FileText,
  TrendingUp,
  Target,
  Award,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export default function SalesActivity() {
  const [user, setUser] = useState(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState(null);
  const [activityToEdit, setActivityToEdit] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState('walk_in');
  const [onBehalfOf, setOnBehalfOf] = useState('self');
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    source: 'walk_in',
    property_interest: '',
    follow_up_date: '',
    status: 'new',
    notes: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: activities = [] } = useQuery({
    queryKey: ['my-sales-activities', user?.email],
    queryFn: () => base44.entities.SalesActivity.filter(
      { user_email: user.email },
      '-date',
      500
    ),
    enabled: !!user?.email,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const { data: kpiSettings = [] } = useQuery({
    queryKey: ['kpi-settings'],
    queryFn: () => base44.entities.SalesKPISettings.list('-created_date', 1),
  });

  const settings = kpiSettings[0] || {
    tracking_period_days: 7,
    min_walkins_per_day: 1,
    min_closures_per_period: 1
  };

  // Get sales department users
  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);
  
  const allUsers = [
    ...users,
    ...invitations
      .filter(inv => !users.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ];

  const salesUsers = allUsers.filter(u => u.department_id && salesDeptIds.includes(u.department_id));

  const getUserName = (email) => allUsers.find(u => u.email?.toLowerCase() === email?.toLowerCase())?.full_name || email;

  const createActivityMutation = useMutation({
    mutationFn: (data) => base44.entities.SalesActivity.create(data),
    onSuccess: (newActivity) => {
      queryClient.invalidateQueries({ queryKey: ['my-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      
      // Show confirmation message
      const activityUser = allUsers.find(u => u.email?.toLowerCase() === newActivity.user_email?.toLowerCase());
      const reportingOfficer = activityUser?.reports_to;
      const isOnBehalf = onBehalfOf !== 'self';
      const memberName = activityUser?.full_name || newActivity.user_email;
      
      if (reportingOfficer) {
        const officerName = getUserName(reportingOfficer);
        const message = isOnBehalf 
          ? `Log Activity created by ${user.full_name || user.email} on behalf of ${memberName}. This has been forwarded to ${memberName}'s Reporting Officer: ${officerName}.`
          : `Log Activity created by ${user.full_name || user.email}. This has been forwarded to your Reporting Officer: ${officerName}.`;
        toast.success(message, { duration: 5000 });
      } else {
        const message = isOnBehalf
          ? `Log Activity created by ${user.full_name || user.email} on behalf of ${memberName}. No reporting officer assigned - Admin will assign a reviewer.`
          : `Log Activity created by ${user.full_name || user.email}. No reporting officer assigned - Admin will assign a reviewer.`;
        toast.warning(message, { duration: 5000 });
      }
      
      setLogDialogOpen(false);
      resetForm();
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesActivity.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      setEditDialogOpen(false);
      setActivityToEdit(null);
      resetForm();
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesActivity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      setDeleteDialogOpen(false);
      setActivityToDelete(null);
    },
  });

  const resetForm = () => {
    setFormData({ 
      customer_name: '', 
      customer_phone: '',
      customer_email: '',
      source: 'walk_in',
      property_interest: '',
      follow_up_date: '',
      status: 'new',
      notes: '' 
    });
    setOnBehalfOf('self');
  };

  const handleEditClick = (activity) => {
    setActivityToEdit(activity);
    setFormData({
      customer_name: activity.customer_name || '',
      customer_phone: activity.customer_phone || '',
      customer_email: activity.customer_email || '',
      source: activity.source || 'walk_in',
      property_interest: activity.property_interest || '',
      follow_up_date: activity.follow_up_date || '',
      status: activity.status || 'new',
      notes: activity.notes || ''
    });
    setActivityType(activity.type);
    setEditDialogOpen(true);
  };

  const handleSubmit = async () => {
    const targetUserEmail = onBehalfOf === 'self' ? user.email : onBehalfOf;
    const isClosure = activityType === 'closure' || formData.status === 'closed_won';

    // Determine the user for whom activity is logged
    const activityUser = allUsers.find(u => u.email?.toLowerCase() === targetUserEmail?.toLowerCase());
    const reportingOfficer = activityUser?.reports_to;

    // Set approval status based on hierarchy
    let approvalStatus = 'pending_assignment'; // Default if no manager
    let initialLog = {
      action: 'created',
      actor_email: user.email,
      timestamp: new Date().toISOString(),
      note: `Activity logged by ${user.full_name || user.email}`
    };

    if (reportingOfficer) {
      approvalStatus = 'pending';
      initialLog.note += `. Forwarded to ${getUserName(reportingOfficer)} for review.`;
    } else {
      initialLog.note += `. No reporting officer assigned - awaiting admin assignment.`;
    }

    createActivityMutation.mutate({
      user_email: targetUserEmail,
      created_on_behalf_of: onBehalfOf !== 'self' ? targetUserEmail : null,
      type: activityType,
      date: new Date().toISOString(),
      closure_date: isClosure ? new Date().toISOString() : null,
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      customer_email: formData.customer_email,
      source: formData.source,
      property_interest: formData.property_interest,
      follow_up_date: formData.follow_up_date || null,
      status: formData.status,
      notes: formData.notes,
      approval_status: approvalStatus,
      workflow_logs: [initialLog]
    });
  };

  const handleUpdate = () => {
    const isClosure = formData.status === 'closed_won';
    
    updateActivityMutation.mutate({
      id: activityToEdit.id,
      data: {
        ...formData,
        closure_date: isClosure && !activityToEdit.closure_date ? new Date().toISOString() : activityToEdit.closure_date,
      }
    });
  };

  // Calculate KPI stats
  const today = new Date();
  const periodStart = subDays(today, settings.tracking_period_days);
  // Include all activities in period for walk-in count
  const periodActivities = activities.filter(a => new Date(a.date) >= periodStart);
  
  // Walk-ins: Any activity created as 'walk_in' in the period
  const walkIns = periodActivities.filter(a => a.type === 'walk_in');
  
  // Closures: Any activity with status 'closed_won' (check closure_date if available, else use updated logic)
  // We count closures that happened in the last 7 days
  const closures = activities.filter(a => {
    const closureDate = a.closure_date ? new Date(a.closure_date) : new Date(a.date);
    return a.status === 'closed_won' && closureDate >= periodStart;
  });
  
  // Count days with walk-ins
  let daysWithWalkIn = 0;
  for (let i = 0; i < settings.tracking_period_days; i++) {
    const day = subDays(today, i);
    if (walkIns.some(w => isSameDay(parseISO(w.date), day))) {
      daysWithWalkIn++;
    }
  }

  const todayWalkIns = walkIns.filter(w => isSameDay(parseISO(w.date), today)).length;
  
  const walkInKPIMet = daysWithWalkIn === settings.tracking_period_days;
  const closureKPIMet = closures.length >= settings.min_closures_per_period;
  
  const walkInPercentage = Math.round((daysWithWalkIn / settings.tracking_period_days) * 100);
  const closurePercentage = Math.min(100, Math.round((closures.length / settings.min_closures_per_period) * 100));

  // Check permissions
  const isSalesUser = salesDeptIds.includes(user?.department_id);
  const isAdmin = user?.role === 'admin';

  if (user && !isSalesUser && !isAdmin) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only sales team members and administrators can access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            My Sales Activity
          </h1>
          <p className="text-slate-600 mt-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Log and track your walk-ins and closures
          </p>
        </div>
        <Button 
          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
          onClick={() => setLogDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Activity
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 via-white to-blue-50/30 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Footprints className="w-7 h-7 text-white" />
              </div>
              <Badge className={`${todayWalkIns >= settings.min_walkins_per_day ? 'bg-emerald-500' : 'bg-amber-500'} text-white`}>
                {todayWalkIns >= settings.min_walkins_per_day ? '✓ On Track' : 'Attention'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Today's Walk-Ins</p>
              <h3 className="text-4xl font-bold text-blue-600 mt-2">{todayWalkIns}</h3>
              <div className="flex items-center gap-2 mt-3">
                <Target className="w-4 h-4 text-slate-400" />
                <p className="text-sm text-slate-500">
                  Target: <span className="font-semibold">{settings.min_walkins_per_day}</span> per day
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 via-white to-indigo-50/30 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
                <CalendarIcon className="w-7 h-7 text-white" />
              </div>
              <Badge className={`${walkInKPIMet ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                {walkInPercentage}%
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{settings.tracking_period_days}-Day Walk-Ins</p>
              <div className="flex items-baseline gap-3 mt-2">
                <h3 className="text-4xl font-bold text-indigo-600">{daysWithWalkIn}</h3>
                <span className="text-2xl text-slate-400 font-light">/ {settings.tracking_period_days}</span>
              </div>
              <div className="mt-3">
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all ${walkInKPIMet ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${walkInPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {walkInKPIMet ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <Award className="w-3 h-3" /> KPI Met!
                    </span>
                  ) : (
                    <span className="text-red-500 font-semibold">{settings.tracking_period_days - daysWithWalkIn} days missed</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <Badge className={`${closureKPIMet ? 'bg-emerald-500' : 'bg-red-500'} text-white`}>
                {closurePercentage}%
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{settings.tracking_period_days}-Day Closures</p>
              <h3 className="text-4xl font-bold text-emerald-600 mt-2">{closures.length}</h3>
              <div className="mt-3">
                <div className="w-full bg-slate-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all ${closureKPIMet ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${closurePercentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Target: <span className="font-semibold">{settings.min_closures_per_period}</span> per {settings.tracking_period_days} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Status Banner */}
      <Card className={`relative overflow-hidden ${walkInKPIMet && closureKPIMet ? 'border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50' : 'border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50'}`}>
        {walkInKPIMet && closureKPIMet && (
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-200/20 rounded-full -mr-16 -mt-16" />
        )}
        <CardContent className="p-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full ${walkInKPIMet && closureKPIMet ? 'bg-emerald-500' : 'bg-amber-500'} shadow-lg`}>
              {walkInKPIMet && closureKPIMet ? (
                <Award className="w-6 h-6 text-white" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="flex-1">
              {walkInKPIMet && closureKPIMet ? (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-emerald-800 text-lg">🎉 Excellent Work!</h3>
                    <Badge className="bg-emerald-600 text-white">All KPIs Met</Badge>
                  </div>
                  <p className="text-emerald-700 mt-1">You're on track! All KPIs met for the current period. Keep up the great work!</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-amber-800 text-lg">Attention Needed</h3>
                    <Badge className="bg-amber-600 text-white">Action Required</Badge>
                  </div>
                  <p className="text-amber-700 mt-1">
                    {!walkInKPIMet && ` Missing walk-ins on ${settings.tracking_period_days - daysWithWalkIn} day(s).`}
                    {!closureKPIMet && ` Need ${settings.min_closures_per_period - closures.length} more closure(s).`}
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All ({periodActivities.length})</TabsTrigger>
              <TabsTrigger value="walk_in">Walk-Ins ({walkIns.length})</TabsTrigger>
              <TabsTrigger value="closure">Closures ({closures.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <ActivityList 
                activities={periodActivities} 
                onEdit={handleEditClick}
                onDelete={(activity) => {
                  setActivityToDelete(activity);
                  setDeleteDialogOpen(true);
                }}
              />
            </TabsContent>
            <TabsContent value="walk_in">
              <ActivityList 
                activities={walkIns}
                onEdit={handleEditClick}
                onDelete={(activity) => {
                  setActivityToDelete(activity);
                  setDeleteDialogOpen(true);
                }}
              />
            </TabsContent>
            <TabsContent value="closure">
              <ActivityList 
                activities={closures}
                onEdit={handleEditClick}
                onDelete={(activity) => {
                  setActivityToDelete(activity);
                  setDeleteDialogOpen(true);
                }}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Log Activity Dialog */}
      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Sales Activity</DialogTitle>
            <DialogDescription>
              Record a new walk-in
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Created on behalf of</Label>
              <Select value={onBehalfOf} onValueChange={setOnBehalfOf}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Myself ({user?.full_name})
                    </div>
                  </SelectItem>
                  {salesUsers
                    .filter(u => u.email !== user?.email)
                    .map(u => (
                      <SelectItem key={u.email} value={u.email}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  placeholder="Enter customer name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="Enter phone number"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lead Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                  <SelectTrigger>
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
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Property/Product Interest</Label>
              <Input
                placeholder="Enter property or product interest"
                value={formData.property_interest}
                onChange={(e) => setFormData({ ...formData, property_interest: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
              <div></div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLogDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createActivityMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {createActivityMutation.isPending ? 'Saving...' : 'Log Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Activity Status</DialogTitle>
            <DialogDescription>
              Update the status and details of this walk-in
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Property/Interest</Label>
                <Input
                  value={formData.property_interest}
                  onChange={(e) => setFormData({ ...formData, property_interest: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add any notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={updateActivityMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateActivityMutation.isPending ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteActivityMutation.mutate(activityToDelete?.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActivityList({ activities, onDelete, onEdit }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-4">
          <FileText className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">No activities logged yet</p>
        <p className="text-sm text-slate-400 mt-1">Start by logging your first walk-in or closure</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {activities.map((activity) => (
          <div 
            key={activity.id} 
            className="group flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-white rounded-xl hover:shadow-md hover:from-indigo-50 hover:to-purple-50 transition-all border border-slate-100"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className={`p-3 rounded-xl shadow-sm ${activity.type === 'walk_in' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-emerald-500 to-emerald-600'}`}>
                {activity.type === 'walk_in' ? <Footprints className="w-6 h-6 text-white" /> : <CheckCircle2 className="w-6 h-6 text-white" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-900">
                    {activity.customer_name || 'Unknown Customer'}
                  </span>
                  <Badge className={`${
                    activity.status === 'closed_won' ? 'bg-emerald-500' :
                    activity.status === 'follow_up' ? 'bg-blue-500' :
                    activity.status === 'negotiation' ? 'bg-purple-500' :
                    'bg-slate-500'
                  } text-white capitalize`}>
                    {activity.status?.replace('_', ' ') || 'New'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {format(parseISO(activity.date), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                {activity.notes && (
                  <p className="text-sm text-slate-600 mt-2 bg-white/50 p-2 rounded border border-slate-100">{activity.notes}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                onClick={() => onEdit(activity)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-red-500 hover:bg-red-50"
                onClick={() => onDelete(activity)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}