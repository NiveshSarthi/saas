import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Save, Target, Trash2, Zap, Users, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SalesTargetsManager({ users = [], projects = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [targetType, setTargetType] = useState('user'); // 'user' or 'group'
  const [distributionMode, setDistributionMode] = useState(false);
  const [distributionLevel, setDistributionLevel] = useState({ managers: false, executives: false });
  const [totalTarget, setTotalTarget] = useState({ walkins: 0, meetings: 0, closures: 0 });
  const [distributedTargets, setDistributedTargets] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [formData, setFormData] = useState({
    user_email: '',
    group_id: '',
    project_id: 'all',
    walkin_target: 0,
    meeting_target: 0,
    followup_target: 0,
    site_visit_target: 0,
    booking_count_target: 0,
    booking_value_target: 0,
    weekly_booking_target: 0,
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setCurrentUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
  });

  const queryClient = useQueryClient();

  const { data: targets = [] } = useQuery({
    queryKey: ['sales-targets', selectedMonth],
    queryFn: () => base44.entities.SalesTarget.filter({ month: selectedMonth }, '-created_date', 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesTarget.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Check if target already exists
      const existing = targets.find(t => {
        const sameProject = (!t.project_id && data.project_id === 'all') || t.project_id === data.project_id;
        if (targetType === 'user') {
          return t.user_email === data.user_email && t.month === selectedMonth && sameProject;
        } else {
          return t.group_id === data.group_id && t.month === selectedMonth && sameProject;
        }
      });

      const payload = {
        ...data,
        month: selectedMonth,
        project_id: data.project_id === 'all' ? null : data.project_id,
        user_email: targetType === 'user' ? data.user_email : null,
        group_id: targetType === 'group' ? data.group_id : null,
      };

      if (existing) {
        return base44.entities.SalesTarget.update(existing.id, payload);
      }
      return base44.entities.SalesTarget.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      setIsDialogOpen(false);
      setFormData(prev => ({
        ...prev,
        walkin_target: 0,
        meeting_target: 0,
        followup_target: 0,
        site_visit_target: 0,
        booking_count_target: 0,
        booking_value_target: 0,
        weekly_booking_target: 0,
      }));
    },
  });

  const getUserName = (email) => users.find(u => u.email === email)?.full_name || email;
  const getGroupName = (id) => groups.find(g => g.id === id)?.name || 'Unknown Group';
  const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'All Projects';

  // Filter users based on job title
  const salesManagers = users.filter(u => u.job_title?.toLowerCase().includes('sales manager'));
  const salesExecutives = users.filter(u => u.job_title?.toLowerCase().includes('sales executive'));

  const handleDistribute = () => {
    const selectedUsers = [];
    
    if (distributionLevel.managers) {
      selectedUsers.push(...salesManagers);
    }
    if (distributionLevel.executives) {
      selectedUsers.push(...salesExecutives);
    }

    if (selectedUsers.length === 0) {
      toast.error('Please select at least one distribution level');
      return;
    }

    const count = selectedUsers.length;
    const walkinsPerUser = Math.round(totalTarget.walkins / count);
    const meetingsPerUser = Math.round(totalTarget.meetings / count);
    const closuresPerUser = Math.round(totalTarget.closures / count);

    const distributed = selectedUsers.map((user, idx) => {
      // Adjust last user to handle rounding differences
      const isLast = idx === count - 1;
      return {
        user_email: user.email,
        user_name: user.full_name || user.email,
        job_title: user.job_title,
        walkin_target: isLast ? totalTarget.walkins - (walkinsPerUser * (count - 1)) : walkinsPerUser,
        meeting_target: isLast ? totalTarget.meetings - (meetingsPerUser * (count - 1)) : meetingsPerUser,
        booking_count_target: isLast ? totalTarget.closures - (closuresPerUser * (count - 1)) : closuresPerUser,
        auto_distributed_value: closuresPerUser,
        manually_adjusted: false,
      };
    });

    setDistributedTargets(distributed);
    toast.success(`Target distributed to ${count} users`);
  };

  const handleManualAdjust = (email, field, value) => {
    setDistributedTargets(prev => prev.map(t => 
      t.user_email === email 
        ? { ...t, [field]: parseInt(value) || 0, manually_adjusted: true }
        : t
    ));
  };

  const handleSaveDistributed = async () => {
    try {
      for (const target of distributedTargets) {
        const existing = targets.find(t => 
          t.user_email === target.user_email && 
          t.month === selectedMonth &&
          (!t.project_id && formData.project_id === 'all' || t.project_id === formData.project_id)
        );

        const payload = {
          user_email: target.user_email,
          month: selectedMonth,
          project_id: formData.project_id === 'all' ? null : formData.project_id,
          walkin_target: target.walkin_target,
          meeting_target: target.meeting_target,
          booking_count_target: target.booking_count_target,
          site_visit_target: 0,
          followup_target: 0,
          weekly_booking_target: 0,
          distribution_type: 'auto_distributed',
          auto_distributed_value: target.auto_distributed_value,
          manually_adjusted: target.manually_adjusted,
          assigned_by: currentUser?.email,
        };

        if (existing) {
          await base44.entities.SalesTarget.update(existing.id, payload);
        } else {
          await base44.entities.SalesTarget.create(payload);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      setIsDialogOpen(false);
      setDistributionMode(false);
      setDistributedTargets([]);
      setTotalTarget({ walkins: 0, meetings: 0, closures: 0 });
      setDistributionLevel({ managers: false, executives: false });
      toast.success('Targets saved successfully!');
    } catch (error) {
      toast.error('Failed to save targets');
    }
  };

  const handleDuplicateLastMonth = async () => {
    const lastMonth = format(new Date(new Date(selectedMonth).setMonth(new Date(selectedMonth).getMonth() - 1)), 'yyyy-MM');
    const lastMonthTargets = await base44.entities.SalesTarget.filter({ month: lastMonth }, '-created_date', 100);
    
    if (lastMonthTargets.length === 0) {
      toast.error('No targets found for previous month');
      return;
    }

    try {
      for (const target of lastMonthTargets) {
        const payload = {
          ...target,
          month: selectedMonth,
          id: undefined,
          created_date: undefined,
          updated_date: undefined,
        };
        delete payload.id;
        delete payload.created_date;
        delete payload.updated_date;
        
        await base44.entities.SalesTarget.create(payload);
      }
      
      queryClient.invalidateQueries({ queryKey: ['sales-targets'] });
      toast.success('Previous month targets duplicated successfully!');
    } catch (error) {
      toast.error('Failed to duplicate targets');
    }
  };

  const handleEdit = (target) => {
      setTargetType(target.group_id ? 'group' : 'user');
      setFormData({
          user_email: target.user_email || '',
          group_id: target.group_id || '',
          project_id: target.project_id || 'all',
          walkin_target: target.walkin_target || 0,
          meeting_target: target.meeting_target || 0,
          followup_target: target.followup_target || 0,
          site_visit_target: target.site_visit_target || 0,
          booking_count_target: target.booking_count_target || 0,
          booking_value_target: target.booking_value_target || 0,
          weekly_booking_target: target.weekly_booking_target || 0,
      });
      setIsDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="w-5 h-5" />
            Monthly Targets
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label>Month:</Label>
            <Input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-40 h-8"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDuplicateLastMonth}
            className="text-slate-700"
          >
            <Target className="w-4 h-4 mr-2" />
            Duplicate Last Month
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setDistributionMode(false);
              setDistributedTargets([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Set Target
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Set Monthly Target</DialogTitle>
              <DialogDescription>
                Assign sales targets for {format(new Date(selectedMonth), 'MMMM yyyy')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 mb-2 p-3 bg-slate-50 rounded-lg">
                <Label>Assignment Mode:</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant={!distributionMode ? 'default' : 'outline'}
                    onClick={() => {
                      setDistributionMode(false);
                      setDistributedTargets([]);
                    }}
                  >
                    <Edit2 className="w-3 h-3 mr-1" />
                    Manual
                  </Button>
                  <Button 
                    type="button" 
                    size="sm" 
                    variant={distributionMode ? 'default' : 'outline'}
                    onClick={() => setDistributionMode(true)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Auto Distribute
                  </Button>
                </div>
              </div>

              {!distributionMode && (
                <>
                  <div className="flex items-center gap-4 mb-2">
                    <Label>Target Type:</Label>
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        size="sm" 
                        variant={targetType === 'user' ? 'default' : 'outline'}
                        onClick={() => setTargetType('user')}
                      >
                        Individual
                      </Button>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant={targetType === 'group' ? 'default' : 'outline'}
                        onClick={() => setTargetType('group')}
                      >
                        Team
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {distributionMode ? (
                <>
                  {/* Auto Distribution UI */}
                  <div className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-semibold text-indigo-900">Distribution Settings</h3>
                    </div>

                    <div className="space-y-2">
                      <Label>Project (Optional)</Label>
                      <Select 
                        value={formData.project_id} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, project_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Projects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects / General</SelectItem>
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-semibold">Select Distribution Level:</Label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={distributionLevel.managers}
                            onChange={(e) => setDistributionLevel(prev => ({ ...prev, managers: e.target.checked }))}
                            className="w-4 h-4"
                          />
                          <span>Sales Managers ({salesManagers.length})</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={distributionLevel.executives}
                            onChange={(e) => setDistributionLevel(prev => ({ ...prev, executives: e.target.checked }))}
                            className="w-4 h-4"
                          />
                          <span>Sales Executives ({salesExecutives.length})</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                      <div className="space-y-2">
                        <Label className="text-blue-600">Total Walk-ins</Label>
                        <Input 
                          type="number" 
                          value={totalTarget.walkins}
                          onChange={(e) => setTotalTarget(prev => ({ ...prev, walkins: parseInt(e.target.value) || 0 }))}
                          placeholder="e.g., 300"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-purple-600">Total Meetings</Label>
                        <Input 
                          type="number" 
                          value={totalTarget.meetings}
                          onChange={(e) => setTotalTarget(prev => ({ ...prev, meetings: parseInt(e.target.value) || 0 }))}
                          placeholder="e.g., 150"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-emerald-600">Total Closures</Label>
                        <Input 
                          type="number" 
                          value={totalTarget.closures}
                          onChange={(e) => setTotalTarget(prev => ({ ...prev, closures: parseInt(e.target.value) || 0 }))}
                          placeholder="e.g., 50"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleDistribute} 
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
                      disabled={!distributionLevel.managers && !distributionLevel.executives}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Calculate Distribution
                    </Button>
                  </div>

                  {/* Distributed Results */}
                  {distributedTargets.length > 0 && (
                    <div className="border-2 border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-emerald-900">Distribution Preview (Editable)</h3>
                        <Badge className="bg-emerald-600 text-white">
                          {distributedTargets.length} Users
                        </Badge>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {distributedTargets.map(target => (
                          <div key={target.user_email} className="bg-white p-3 rounded border">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium">{target.user_name}</p>
                                <p className="text-xs text-slate-500">{target.job_title}</p>
                              </div>
                              {target.manually_adjusted && (
                                <Badge variant="outline" className="text-amber-600 border-amber-400">
                                  Adjusted
                                </Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs text-blue-600">Walk-ins</Label>
                                <Input 
                                  type="number" 
                                  value={target.walkin_target}
                                  onChange={(e) => handleManualAdjust(target.user_email, 'walkin_target', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-purple-600">Meetings</Label>
                                <Input 
                                  type="number" 
                                  value={target.meeting_target}
                                  onChange={(e) => handleManualAdjust(target.user_email, 'meeting_target', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-emerald-600">Closures</Label>
                                <Input 
                                  type="number" 
                                  value={target.booking_count_target}
                                  onChange={(e) => handleManualAdjust(target.user_email, 'booking_count_target', e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Manual Assignment UI */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{targetType === 'user' ? 'Sales Executive' : 'Team'}</Label>
                      {targetType === 'user' ? (
                        <Select 
                          value={formData.user_email} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, user_email: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map(u => (
                              <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select 
                          value={formData.group_id} 
                          onValueChange={(v) => setFormData(prev => ({ ...prev, group_id: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                          <SelectContent>
                            {groups.map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Project</Label>
                      <Select 
                        value={formData.project_id} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, project_id: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Projects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects / General</SelectItem>
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              {!distributionMode && (
                <>
                  <div className="grid grid-cols-2 gap-4 border-t pt-4">
                    <div className="space-y-2">
                      <Label className="text-blue-600">Walk-ins</Label>
                      <Input 
                        type="number" 
                        value={formData.walkin_target} 
                        onChange={(e) => setFormData(prev => ({ ...prev, walkin_target: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-purple-600">Meetings</Label>
                      <Input 
                        type="number" 
                        value={formData.meeting_target} 
                        onChange={(e) => setFormData(prev => ({ ...prev, meeting_target: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-indigo-600">Site Visits</Label>
                      <Input 
                        type="number" 
                        value={formData.site_visit_target} 
                        onChange={(e) => setFormData(prev => ({ ...prev, site_visit_target: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t pt-4 bg-slate-50 p-2 rounded-md">
                    <div className="space-y-2">
                      <Label className="text-emerald-600 font-semibold">Closures (Monthly)</Label>
                      <Input 
                        type="number" 
                        value={formData.booking_count_target} 
                        onChange={(e) => setFormData(prev => ({ ...prev, booking_count_target: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                     <div className="space-y-2">
                        <Label className="text-blue-600 font-semibold">Weekly Closures Target</Label>
                        <Input 
                          type="number" 
                          value={formData.weekly_booking_target} 
                          onChange={(e) => setFormData(prev => ({ ...prev, weekly_booking_target: parseInt(e.target.value) || 0 }))}
                          placeholder="Optional"
                        />
                     </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              {distributionMode ? (
                <Button 
                  onClick={handleSaveDistributed}
                  disabled={distributedTargets.length === 0}
                  className="bg-gradient-to-r from-emerald-600 to-green-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save All Distributed Targets
                </Button>
              ) : (
                <Button 
                  onClick={() => createMutation.mutate(formData)} 
                  disabled={createMutation.isPending || (targetType === 'user' ? !formData.user_email : !formData.group_id)}
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Target'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
          </Dialog>
          </div>
          </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Target For</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-center">Walk-ins</TableHead>
              <TableHead className="text-center">Meetings</TableHead>
              <TableHead className="text-center">Site Visits</TableHead>
              <TableHead className="text-center">Closures (M/W)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {targets.map(target => (
              <TableRow key={target.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col gap-1">
                    {target.group_id ? (
                       <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                         Team: {getGroupName(target.group_id)}
                       </Badge>
                    ) : target.user_email ? (
                       <span>{getUserName(target.user_email)}</span>
                    ) : (
                       <span className="text-red-500 italic text-sm">Unassigned (Invalid)</span>
                    )}
                    {target.distribution_type === 'auto_distributed' && (
                      <div className="flex gap-1 items-center text-xs text-slate-500">
                        <Zap className="w-3 h-3 text-indigo-500" />
                        <span>Auto-distributed</span>
                        {target.manually_adjusted && (
                          <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                            Adjusted
                          </Badge>
                        )}
                      </div>
                    )}
                    {target.assigned_by && (
                      <span className="text-xs text-slate-500">
                        By: {getUserName(target.assigned_by)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getProjectName(target.project_id)}</Badge>
                </TableCell>
                <TableCell className="text-center">{target.walkin_target}</TableCell>
                <TableCell className="text-center">{target.meeting_target}</TableCell>
                <TableCell className="text-center">{target.site_visit_target}</TableCell>
                <TableCell className="text-center">
                   <div className="flex flex-col items-center">
                     <span>{target.booking_count_target} / mo</span>
                     {target.weekly_booking_target > 0 && (
                       <span className="text-xs text-emerald-600 font-medium">{target.weekly_booking_target} / wk</span>
                     )}

                   </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(target)}>
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" 
                      onClick={() => deleteMutation.mutate(target.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {targets.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No targets set for this month
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}