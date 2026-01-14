import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Search,
  Filter,
  Footprints,
  CheckCircle2,
  Trash2,
  Edit,
  Eye,
  Download,
  Plus,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  User,
  DollarSign,
  Building
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const sourceLabels = {
  walk_in: 'Walk-In',
  referral: 'Referral',
  online: 'Online',
  phone: 'Phone',
  social_media: 'Social Media',
  other: 'Other'
};

const statusLabels = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  follow_up: { label: 'Follow Up', color: 'bg-amber-100 text-amber-700' },
  negotiation: { label: 'Negotiation', color: 'bg-purple-100 text-purple-700' },
  closed_won: { label: 'Closed Won', color: 'bg-emerald-100 text-emerald-700' },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-100 text-red-700' }
};

export default function SalesAdmin() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [formData, setFormData] = useState({});

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

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['all-sales-activities'],
    queryFn: () => base44.entities.SalesActivity.filter({}, '-date', 1000),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: usersFromEntity = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  // Get sales department users
  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);
  
  const allUsers = [
    ...usersFromEntity,
    ...invitations
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ];

  const salesUsers = allUsers.filter(u => u.department_id && salesDeptIds.includes(u.department_id));

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesActivity.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      setEditDialogOpen(false);
      setSelectedActivity(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesActivity.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-sales-activities'] });
      queryClient.invalidateQueries({ queryKey: ['sales-activities'] });
      setDeleteDialogOpen(false);
      setSelectedActivity(null);
    },
  });

  const filteredActivities = activities.filter(activity => {
    if (typeFilter !== 'all' && activity.type !== typeFilter) return false;
    if (memberFilter !== 'all' && activity.user_email !== memberFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        activity.customer_name?.toLowerCase().includes(query) ||
        activity.customer_phone?.includes(query) ||
        activity.customer_email?.toLowerCase().includes(query) ||
        activity.user_email?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleEdit = (activity) => {
    setSelectedActivity(activity);
    setFormData({
      customer_name: activity.customer_name || '',
      customer_phone: activity.customer_phone || '',
      customer_email: activity.customer_email || '',
      source: activity.source || 'walk_in',
      property_interest: activity.property_interest || '',
      deal_value: activity.deal_value || '',
      follow_up_date: activity.follow_up_date || '',
      status: activity.status || 'new',
      notes: activity.notes || ''
    });
    setEditDialogOpen(true);
  };

  const handleView = (activity) => {
    setSelectedActivity(activity);
    setViewDialogOpen(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      id: selectedActivity.id,
      data: {
        ...formData,
        deal_value: formData.deal_value ? parseFloat(formData.deal_value) : null
      }
    });
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const getUserName = (email) => allUsers.find(u => u.email === email)?.full_name || email;

  // Stats
  const totalWalkIns = activities.filter(a => a.type === 'walk_in').length;
  const totalClosures = activities.filter(a => a.type === 'closure').length;
  const totalValue = activities.filter(a => a.type === 'closure').reduce((sum, a) => sum + (a.deal_value || 0), 0);

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only administrators can access this page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Activity Management</h1>
          <p className="text-slate-500 mt-1">View and manage all sales team activities</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Footprints className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Walk-Ins</p>
              <h3 className="text-2xl font-bold text-slate-900">{totalWalkIns}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Closures</p>
              <h3 className="text-2xl font-bold text-slate-900">{totalClosures}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Deal Value</p>
              <h3 className="text-2xl font-bold text-slate-900">${totalValue.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by customer name, phone, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Activity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="walk_in">Walk-Ins</SelectItem>
                <SelectItem value="closure">Closures</SelectItem>
              </SelectContent>
            </Select>
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Team Member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {salesUsers.map(u => (
                  <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activities ({filteredActivities.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Sales Member</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <Badge className={activity.type === 'walk_in' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}>
                        {activity.type === 'walk_in' ? 'Walk-In' : 'Closure'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">{getInitials(getUserName(activity.user_email))}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{getUserName(activity.user_email)}</span>
                        </div>
                        {activity.created_on_behalf_of && (
                          <span className="text-xs text-slate-500 ml-8">On behalf of</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{activity.customer_name || '-'}</p>
                        {activity.customer_phone && (
                          <p className="text-xs text-slate-500">{activity.customer_phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{sourceLabels[activity.source] || '-'}</TableCell>
                    <TableCell>
                      {activity.status && (
                        <Badge className={statusLabels[activity.status]?.color}>
                          {statusLabels[activity.status]?.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {activity.deal_value ? `$${activity.deal_value.toLocaleString()}` : '-'}
                    </TableCell>
                    <TableCell>{format(parseISO(activity.date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(activity)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(activity)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            setSelectedActivity(activity);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredActivities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                      No activities found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
          </DialogHeader>
          {selectedActivity && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Badge className={selectedActivity.type === 'walk_in' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}>
                  {selectedActivity.type === 'walk_in' ? 'Walk-In' : 'Closure'}
                </Badge>
                <span className="text-sm text-slate-500">
                  {format(parseISO(selectedActivity.date), 'PPP p')}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500">Sales Member</Label>
                  <p className="font-medium">{getUserName(selectedActivity.user_email)}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Customer Name</Label>
                  <p className="font-medium">{selectedActivity.customer_name || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Phone</Label>
                  <p className="font-medium">{selectedActivity.customer_phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Email</Label>
                  <p className="font-medium">{selectedActivity.customer_email || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Source</Label>
                  <p className="font-medium">{sourceLabels[selectedActivity.source] || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Status</Label>
                  <p className="font-medium">{statusLabels[selectedActivity.status]?.label || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Property Interest</Label>
                  <p className="font-medium">{selectedActivity.property_interest || '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Deal Value</Label>
                  <p className="font-medium">{selectedActivity.deal_value ? `$${selectedActivity.deal_value.toLocaleString()}` : '-'}</p>
                </div>
                <div>
                  <Label className="text-slate-500">Follow-up Date</Label>
                  <p className="font-medium">{selectedActivity.follow_up_date ? format(parseISO(selectedActivity.follow_up_date), 'PPP') : '-'}</p>
                </div>
              </div>
              
              {selectedActivity.notes && (
                <div>
                  <Label className="text-slate-500">Notes</Label>
                  <p className="mt-1 p-3 bg-slate-50 rounded-lg text-sm">{selectedActivity.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Activity</DialogTitle>
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
                <Label>Phone</Label>
                <Input
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
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
                    <SelectItem value="closed_won">Closed Won</SelectItem>
                    <SelectItem value="closed_lost">Closed Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Property/Product Interest</Label>
              <Input
                value={formData.property_interest}
                onChange={(e) => setFormData({ ...formData, property_interest: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deal Value ($)</Label>
                <Input
                  type="number"
                  value={formData.deal_value}
                  onChange={(e) => setFormData({ ...formData, deal_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={formData.follow_up_date}
                  onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
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
              onClick={() => deleteMutation.mutate(selectedActivity?.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}