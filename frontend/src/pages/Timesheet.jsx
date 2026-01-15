import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Clock,
  Calendar,
  Plus,
  Save,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Edit,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { toast } from 'sonner';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Timesheet() {
  const [user, setUser] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const [entryForm, setEntryForm] = useState({
    task_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    hours: '',
    description: ''
  });

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

  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 }); // Sunday

  // Get freelancer's assigned tasks
  const { data: assignedTasks = [] } = useQuery({
    queryKey: ['freelancer-tasks', user?.email],
    queryFn: () => base44.entities.Task.filter({
      assignedFreelancerId: user?.email,
      assignmentType: 'FREELANCER'
    }),
    enabled: !!user?.email,
  });

  // Get current week's timesheet
  const { data: currentTimesheet } = useQuery({
    queryKey: ['timesheet', user?.email, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const timesheets = await base44.entities.Timesheet.filter({
        freelancer_email: user?.email,
        week_start_date: format(weekStart, 'yyyy-MM-dd')
      });
      return timesheets[0] || null;
    },
    enabled: !!user?.email,
  });

  // Get projects for task selection
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
  });

  const createTimesheetMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.Timesheet.create({
        freelancer_email: user.email,
        freelancer_name: user.full_name,
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        period_start: format(weekStart, 'yyyy-MM-dd'),
        period_end: format(weekEnd, 'yyyy-MM-dd'),
        status: 'draft',
        entries: [],
        total_hours: 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      toast.success('Timesheet created successfully');
    },
  });

  const addEntryMutation = useMutation({
    mutationFn: async (entryData) => {
      const task = assignedTasks.find(t => t.id === entryData.task_id);
      const project = projects.find(p => p.id === task?.project_id);

      const newEntry = {
        task_id: entryData.task_id,
        task_title: task?.title || 'Unknown Task',
        date: entryData.date,
        hours: parseFloat(entryData.hours),
        description: entryData.description,
        project_id: task?.project_id,
        project_name: project?.name || 'Unknown Project'
      };

      const updatedEntries = [...(currentTimesheet?.entries || []), newEntry];
      const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.hours, 0);

      if (currentTimesheet) {
        return await base44.entities.Timesheet.update(currentTimesheet.id, {
          entries: updatedEntries,
          total_hours: totalHours,
          updated_at: new Date()
        });
      } else {
        // Create new timesheet if doesn't exist
        return await base44.entities.Timesheet.create({
          freelancer_email: user.email,
          freelancer_name: user.full_name,
          week_start_date: format(weekStart, 'yyyy-MM-dd'),
          period_start: format(weekStart, 'yyyy-MM-dd'),
          period_end: format(weekEnd, 'yyyy-MM-dd'),
          status: 'draft',
          entries: [newEntry],
          total_hours: totalHours
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setEntryDialogOpen(false);
      setEntryForm({
        task_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        hours: '',
        description: ''
      });
      toast.success('Time entry added successfully');
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ entryIndex, entryData }) => {
      const task = assignedTasks.find(t => t.id === entryData.task_id);
      const project = projects.find(p => p.id === task?.project_id);

      const updatedEntry = {
        task_id: entryData.task_id,
        task_title: task?.title || 'Unknown Task',
        date: entryData.date,
        hours: parseFloat(entryData.hours),
        description: entryData.description,
        project_id: task?.project_id,
        project_name: project?.name || 'Unknown Project'
      };

      const updatedEntries = [...currentTimesheet.entries];
      updatedEntries[entryIndex] = updatedEntry;
      const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.hours, 0);

      return await base44.entities.Timesheet.update(currentTimesheet.id, {
        entries: updatedEntries,
        total_hours: totalHours,
        updated_at: new Date()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      setEntryForm({
        task_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        hours: '',
        description: ''
      });
      toast.success('Time entry updated successfully');
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryIndex) => {
      const updatedEntries = currentTimesheet.entries.filter((_, index) => index !== entryIndex);
      const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.hours, 0);

      return await base44.entities.Timesheet.update(currentTimesheet.id, {
        entries: updatedEntries,
        total_hours: totalHours,
        updated_at: new Date()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      toast.success('Time entry deleted successfully');
    },
  });

  const submitTimesheetMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.Timesheet.update(currentTimesheet.id, {
        status: 'submitted',
        submitted_at: new Date()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      setSubmitDialogOpen(false);
      toast.success('Timesheet submitted for approval');
    },
  });

  const handleAddEntry = () => {
    if (!currentTimesheet) {
      createTimesheetMutation.mutate();
    }
    setEditingEntry(null);
    setEntryForm({
      task_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      hours: '',
      description: ''
    });
    setEntryDialogOpen(true);
  };

  const handleEditEntry = (entry, index) => {
    setEditingEntry(index);
    setEntryForm({
      task_id: entry.task_id,
      date: entry.date,
      hours: entry.hours.toString(),
      description: entry.description
    });
    setEntryDialogOpen(true);
  };

  const handleSaveEntry = () => {
    if (editingEntry !== null) {
      updateEntryMutation.mutate({ entryIndex: editingEntry, entryData: entryForm });
    } else {
      addEntryMutation.mutate(entryForm);
    }
  };

  const handleSubmitTimesheet = () => {
    submitTimesheetMutation.mutate();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
      submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
    };
    return statusConfig[status] || statusConfig.draft;
  };

  const getDailyHours = (date) => {
    if (!currentTimesheet?.entries) return 0;
    return currentTimesheet.entries
      .filter(entry => entry.date === format(date, 'yyyy-MM-dd'))
      .reduce((sum, entry) => sum + entry.hours, 0);
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Please log in to access timesheets.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Timesheet</h1>
            <p className="text-slate-600 mt-1">Track and manage your work hours</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            >
              Previous Week
            </Button>
            <div className="text-center">
              <p className="text-sm text-slate-500">Week of</p>
              <p className="font-semibold">{format(weekStart, 'MMM d, yyyy')}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            >
              Next Week
            </Button>
          </div>
        </div>
      </div>

      {/* Status and Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Current Status</h2>
              <Badge className={cn("mt-1", getStatusBadge(currentTimesheet?.status || 'draft').color)}>
                {getStatusBadge(currentTimesheet?.status || 'draft').label}
              </Badge>
            </div>
            {currentTimesheet && (
              <div className="text-center">
                <p className="text-sm text-slate-500">Total Hours</p>
                <p className="text-2xl font-bold text-indigo-600">{currentTimesheet.total_hours || 0}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(currentTimesheet?.status === 'draft' || !currentTimesheet) && (
              <Button onClick={handleAddEntry}>
                <Plus className="w-4 h-4 mr-2" />
                Add Entry
              </Button>
            )}

            {currentTimesheet?.status === 'draft' && currentTimesheet.entries?.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setSubmitDialogOpen(true)}
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <Send className="w-4 h-4 mr-2" />
                Submit for Approval
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Weekly Overview</h3>
        <div className="grid grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day, index) => {
            const date = addDays(weekStart, index);
            const hours = getDailyHours(date);
            const isToday = isSameDay(date, new Date());

            return (
              <div
                key={day}
                className={cn(
                  "text-center p-4 rounded-lg border",
                  isToday ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-slate-50"
                )}
              >
                <p className={cn("text-sm font-medium", isToday ? "text-indigo-600" : "text-slate-600")}>
                  {day}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {format(date, 'MMM d')}
                </p>
                <p className={cn("text-lg font-bold mt-2", hours > 0 ? "text-green-600" : "text-slate-400")}>
                  {hours}h
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Entries Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Time Entries</h3>
        </div>

        {currentTimesheet?.entries?.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTimesheet.entries.map((entry, index) => (
                <TableRow key={index}>
                  <TableCell>{format(new Date(entry.date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{entry.task_title}</TableCell>
                  <TableCell>{entry.project_name}</TableCell>
                  <TableCell>{entry.hours}h</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell>
                    {currentTimesheet.status === 'draft' && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditEntry(entry, index)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEntryMutation.mutate(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No time entries yet</h3>
            <p className="text-slate-500 mb-6">Start tracking your work hours for this week</p>
            <Button onClick={handleAddEntry}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Entry
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingEntry !== null ? 'Edit Time Entry' : 'Add Time Entry'}
            </DialogTitle>
            <DialogDescription>
              Record the time you spent working on a task
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="task">Task</Label>
              <Select
                value={entryForm.task_id}
                onValueChange={(value) => setEntryForm(prev => ({ ...prev, task_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a task" />
                </SelectTrigger>
                <SelectContent>
                  {assignedTasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={entryForm.date}
                onChange={(e) => setEntryForm(prev => ({ ...prev, date: e.target.value }))}
                min={format(weekStart, 'yyyy-MM-dd')}
                max={format(weekEnd, 'yyyy-MM-dd')}
              />
            </div>

            <div>
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                placeholder="e.g., 2.5"
                value={entryForm.hours}
                onChange={(e) => setEntryForm(prev => ({ ...prev, hours: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What did you work on?"
                value={entryForm.description}
                onChange={(e) => setEntryForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEntry}
              disabled={addEntryMutation.isPending || updateEntryMutation.isPending}
            >
              {addEntryMutation.isPending || updateEntryMutation.isPending ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Entry
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Timesheet for Approval</AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, you won't be able to make changes until it's reviewed by an administrator.
              Are you sure all your time entries are correct?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitTimesheet}
              disabled={submitTimesheetMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitTimesheetMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}