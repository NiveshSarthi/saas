import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
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
  Eye,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle
} from 'lucide-react';
import RowTimer from '@/components/tasks/RowTimer';
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
    description: '',
    overtime_reason: ''
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

  // Get user's assigned tasks (FIXED LOGIC)
  const { data: assignedTasks = [] } = useQuery({
    queryKey: ['my-tasks', user?.email],
    queryFn: () => base44.entities.Task.filter({
      assignees: user?.email
    }),
    enabled: !!user?.email,
  });

  // Also fetch tasks where user is the primary assignee (backward compatibility)
  const { data: directTasks = [] } = useQuery({
    queryKey: ['freelancer-tasks', user?.email],
    queryFn: () => base44.entities.Task.filter({
      assignedFreelancerId: user?.email
    }),
    enabled: !!user?.email,
  });

  // Combine and deduplicate tasks
  const allMyTasks = useMemo(() => {
    const taskMap = new Map();
    [...assignedTasks, ...directTasks].forEach(task => {
      taskMap.set(task.id, task);
    });
    return Array.from(taskMap.values());
  }, [assignedTasks, directTasks]);


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
      const task = allMyTasks.find(t => t.id === entryData.task_id);
      const project = projects.find(p => p.id === task?.project_id);

      const newEntry = {
        task_id: entryData.task_id,
        task_title: task?.title || 'Unknown Task',
        date: entryData.date,
        hours: parseFloat(entryData.hours),
        description: entryData.description,
        project_id: task?.project_id,
        project_name: project?.name || 'Unknown Project',
        overtime_reason: entryData.overtime_reason || ''
      };

      const updatedEntries = [...(currentTimesheet?.entries || []), newEntry];
      const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.hours, 0);

      // Sync with Task actual_hours
      if (task) {
        const currentActual = task.actual_hours || 0;
        await base44.entities.Task.update(task.id, {
          actual_hours: parseFloat((currentActual + newEntry.hours).toFixed(2))
        });
      }

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
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setEntryDialogOpen(false);
      setEntryForm({
        task_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        hours: '',
        description: '',
        overtime_reason: ''
      });
      toast.success('Time entry added successfully');
    },
    onError: (error) => {
      console.error('Add entry failed:', error);
      toast.error(`Failed to add entry: ${error.message}`);
    }
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ entryIndex, entryData }) => {
      const task = allMyTasks.find(t => t.id === entryData.task_id);
      const project = projects.find(p => p.id === task?.project_id);

      const updatedEntry = {
        task_id: entryData.task_id,
        task_title: task?.title || 'Unknown Task',
        date: entryData.date,
        hours: parseFloat(entryData.hours),
        description: entryData.description,
        project_id: task?.project_id,
        project_name: project?.name || 'Unknown Project',
        overtime_reason: entryData.overtime_reason || ''
      };

      const previousEntry = currentTimesheet.entries[entryIndex];
      const updatedEntries = [...currentTimesheet.entries];
      updatedEntries[entryIndex] = updatedEntry;
      const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.hours, 0);

      // Sync with Task actual_hours (difference)
      if (task) {
        const diff = updatedEntry.hours - (previousEntry?.hours || 0);
        const currentActual = task.actual_hours || 0;
        await base44.entities.Task.update(task.id, {
          actual_hours: parseFloat((currentActual + diff).toFixed(2))
        });
      }

      return await base44.entities.Timesheet.update(currentTimesheet.id, {
        entries: updatedEntries,
        total_hours: totalHours,
        updated_at: new Date()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      setEntryForm({
        task_id: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        hours: '',
        description: '',
        overtime_reason: ''
      });
      toast.success('Time entry updated successfully');
    },
    onError: (error) => {
      console.error('Update entry failed:', error);
      toast.error(`Failed to update entry: ${error.message}`);
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryIndex) => {
      const entryToRemove = currentTimesheet.entries[entryIndex];
      const updatedEntries = currentTimesheet.entries.filter((_, index) => index !== entryIndex);
      const totalHours = updatedEntries.reduce((sum, entry) => sum + entry.hours, 0);

      // Sync with Task actual_hours (decrement)
      if (entryToRemove?.task_id) {
        const task = allMyTasks.find(t => t.id === entryToRemove.task_id);
        if (task) {
          const currentActual = task.actual_hours || 0;
          await base44.entities.Task.update(task.id, {
            actual_hours: Math.max(0, parseFloat((currentActual - entryToRemove.hours).toFixed(2)))
          });
        }
      }

      return await base44.entities.Timesheet.update(currentTimesheet.id, {
        entries: updatedEntries,
        total_hours: totalHours,
        updated_at: new Date()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheet'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
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
    // Removed redundant createTimesheetMutation call to avoid race conditions
    setEditingEntry(null);
    setEntryForm({
      task_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      hours: '',
      description: '',
      overtime_reason: ''
    });
    setEntryDialogOpen(true);
  };

  const handleEditEntry = (entry, index) => {
    setEditingEntry(index);
    setEntryForm({
      task_id: entry.task_id,
      date: entry.date,
      hours: entry.hours.toString(),
      description: entry.description,
      overtime_reason: entry.overtime_reason || ''
    });
    setEntryDialogOpen(true);
  };

  const selectedTaskData = useMemo(() => {
    return allMyTasks.find(t => t.id === entryForm.task_id);
  }, [entryForm.task_id, allMyTasks]);

  const isOverTime = useMemo(() => {
    if (!selectedTaskData || !selectedTaskData.estimated_hours) return false;
    const currentHours = parseFloat(entryForm.hours) || 0;

    // Calculate total hours for this task across all entries in the week, EXCEPT the one we are editing
    const otherEntriesHours = (currentTimesheet?.entries || [])
      .filter((_, idx) => idx !== editingEntry)
      .filter(e => e.task_id === entryForm.task_id)
      .reduce((sum, e) => sum + e.hours, 0);

    // We also need to consider actual_hours from task, but subtract what's already in the current weekly timesheet to avoid double counting
    const taskActualOutsideThisWeek = Math.max(0, (selectedTaskData.actual_hours || 0) - (currentTimesheet?.entries || []).filter(e => e.task_id === entryForm.task_id).reduce((sum, e) => sum + e.hours, 0));

    return (taskActualOutsideThisWeek + otherEntriesHours + currentHours) > selectedTaskData.estimated_hours;
  }, [selectedTaskData, entryForm.hours, currentTimesheet, editingEntry, entryForm.task_id]);

  const handleSaveEntry = () => {
    if (isOverTime && !entryForm.overtime_reason?.trim()) {
      toast.error('Overtime detected. Please provide a reason.');
      return;
    }
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
      draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200' },
      submitted: { label: 'Submitted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
      approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' },
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">Please log in to access timesheets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="animate-in slide-in-from-left-4 duration-500">
            <h1 className="text-3xl font-bold text-slate-900">Timesheet</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Track and manage your work hours
            </p>
          </div>

          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-right-4 duration-500">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
              className="hover:bg-slate-100 text-slate-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-4 text-center min-w-[140px]">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Week of</p>
              <p className="font-bold text-slate-700">{format(weekStart, 'MMM d, yyyy')}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
              className="hover:bg-slate-100 text-slate-500"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Info & Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <Badge className={cn("px-3 py-1 rounded-lg border", getStatusBadge(currentTimesheet?.status || 'draft').color)}>
                    {getStatusBadge(currentTimesheet?.status || 'draft').label}
                  </Badge>
                </div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl">
                <Briefcase className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
            {currentTimesheet?.status === 'draft' && currentTimesheet.entries?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <Button
                  onClick={() => setSubmitDialogOpen(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit for Approval
                </Button>
              </div>
            )}
          </div>

          {/* Total Hours Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Total Hours</p>
                <p className="text-3xl font-bold text-slate-900">{currentTimesheet?.total_hours || 0}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <Clock className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400">Total logged hours this week</p>
            </div>
          </div>

          {/* Quick Action Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all"></div>
            <h3 className="text-lg font-bold mb-2 relative z-10">Log Time</h3>
            <p className="text-indigo-100 mb-6 text-sm relative z-10">Record your work for tasks and projects.</p>
            {(currentTimesheet?.status === 'draft' || !currentTimesheet) ? (
              <Button onClick={handleAddEntry} className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none">
                <Plus className="w-4 h-4 mr-2" />
                Add New Entry
              </Button>
            ) : (
              <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 text-center text-sm font-medium">
                Timesheet {currentTimesheet.status}
              </div>
            )}
          </div>
        </div>

        {/* Weekly Overview Calendar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-400" />
            Weekly Overview
          </h3>
          <div className="grid grid-cols-7 gap-2 md:gap-4">
            {DAYS_OF_WEEK.map((day, index) => {
              const date = addDays(weekStart, index);
              const hours = getDailyHours(date);
              const isToday = isSameDay(date, new Date());

              return (
                <div
                  key={day}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 md:p-4 rounded-xl border transition-all duration-200",
                    isToday
                      ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100 scale-105"
                      : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200"
                  )}
                >
                  <span className={cn("text-xs font-semibold mb-1", isToday ? "text-indigo-600" : "text-slate-400")}>
                    {day}
                  </span>
                  <span className={cn("text-lg md:text-xl font-bold mb-2", isToday ? "text-indigo-900" : "text-slate-700")}>
                    {format(date, 'd')}
                  </span>
                  {hours > 0 ? (
                    <Badge variant="secondary" className={cn("text-xs font-bold", isToday ? "bg-indigo-200 text-indigo-800 hover:bg-indigo-300" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200")}>
                      {hours}h
                    </Badge>
                  ) : (
                    <span className="h-5 w-full"></span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time Entries Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              Time Entries
            </h3>
            {currentTimesheet?.entries?.length > 0 && currentTimesheet.status === 'draft' && (
              <Button onClick={handleAddEntry} size="sm" variant="outline" className="border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50">
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            )}
          </div>

          {currentTimesheet?.entries?.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-slate-100">
                    <TableHead className="w-[180px] text-slate-500 font-semibold bg-slate-50/50">Date</TableHead>
                    <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Task</TableHead>
                    <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Project</TableHead>
                    <TableHead className="w-[120px] text-right text-slate-500 font-semibold bg-slate-50/50">Hours</TableHead>
                    <TableHead className="w-[25%] text-slate-500 font-semibold bg-slate-50/50">Description & Alerts</TableHead>
                    <TableHead className="w-[200px] text-center text-slate-500 font-semibold bg-slate-50/50">Tracking & Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentTimesheet.entries.map((entry, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/80 border-slate-100 transition-colors">
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex flex-col">
                          <span>{format(new Date(entry.date), 'MMM d, yyyy')}</span>
                          <span className="text-xs text-slate-400">{format(new Date(entry.date), 'EEEE')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{entry.task_title}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-normal">
                          {entry.project_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{entry.hours}h</span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="flex flex-col gap-1">
                          <p className="truncate text-slate-600 text-sm" title={entry.description || 'No description'}>{entry.description || 'No description'}</p>
                          {entry.overtime_reason && (
                            <div className="flex items-center gap-1.5 text-rose-500 text-[10px] font-medium bg-rose-50 px-2 py-0.5 rounded-full w-fit">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Overtime Reason: {entry.overtime_reason}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          {currentTimesheet.status === 'draft' ? (
                            <>
                              <RowTimer
                                uniqueKey={`${user?.email}_${entry.task_id}_${entry.date}_${index}`}
                                onSave={(newHours) => {
                                  const updatedHours = entry.hours + newHours;
                                  // Prompt for reason if new total is overtime
                                  // For simplicity in RowTimer stop/save, we might just update hours
                                  // But if it becomes overtime, we should ideally show the dialog.
                                  // To meet "Make reason mandatory", I will open the edit dialog instead of silent update
                                  // if it's overtime.
                                  handleEditEntry({ ...entry, hours: updatedHours.toString() }, index);
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditEntry(entry, index)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                                title="Edit Entry"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteEntryMutation.mutate(index)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full"
                                title="Delete Entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Locked</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-16 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Clock className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No time entries yet</h3>
              <p className="text-slate-500 mb-8 max-w-sm">Start tracking your work hours for this week. Click the button below to add your first entry.</p>

              <Button onClick={handleAddEntry} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 px-8 py-6 h-auto text-lg rounded-xl transition-all hover:scale-105 active:scale-95">
                <Plus className="w-5 h-5 mr-2" />
                Add Entry
              </Button>
            </div>
          )}
        </div>

        {/* Add/Edit Entry Dialog */}
        <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-slate-100">
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {editingEntry !== null ? <Edit className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
                {editingEntry !== null ? 'Edit Time Entry' : 'Add Time Entry'}
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                Record the time you spent working on a task
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="task" className="text-slate-700 font-semibold">Task</Label>
                <Select
                  value={entryForm.task_id}
                  onValueChange={(value) => {
                    const task = allMyTasks.find(t => t.id === value);
                    setEntryForm(prev => ({
                      ...prev,
                      task_id: value,
                      // Auto-fill hours if estimate exists and currently empty or manual override
                      hours: task?.estimated_hours ? task.estimated_hours.toString() : prev.hours
                    }));
                  }}
                >
                  <SelectTrigger className="bg-slate-50 border-slate-200 h-11 focus:ring-indigo-500">
                    <SelectValue placeholder="Select a task" />
                  </SelectTrigger>
                  <SelectContent>
                    {allMyTasks.length > 0 ? (
                      allMyTasks.map(task => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title} ({task.parent_id ? 'Subtask' : 'Task'}){(task.created_by || task.reporter_email) ? ` - Created by ${task.created_by || task.reporter_email}` : ''}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No tasks assigned.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-slate-700 font-semibold">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={entryForm.date}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, date: e.target.value }))}
                    min={format(weekStart, 'yyyy-MM-dd')}
                    max={format(weekEnd, 'yyyy-MM-dd')}
                    className="bg-slate-50 border-slate-200 h-11 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hours" className="text-slate-700 font-semibold">Hours</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    placeholder="e.g., 2.5"
                    value={entryForm.hours}
                    onChange={(e) => setEntryForm(prev => ({ ...prev, hours: e.target.value }))}
                    className="bg-slate-50 border-slate-200 h-11 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700 font-semibold">Description</Label>
                <Textarea
                  id="description"
                  placeholder="What did you work on?"
                  value={entryForm.description}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="bg-slate-50 border-slate-200 min-h-[100px] focus:ring-indigo-500 resize-none"
                />
              </div>

              {isOverTime && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center gap-2 text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-bold">Overtime Detected</p>
                      <p>Hours exceed the estimate ({selectedTaskData?.estimated_hours}h). Reason is required.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtime_reason" className="text-rose-700 font-semibold flex items-center gap-1">
                      Reason for Overtime <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      id="overtime_reason"
                      placeholder="Why is more time needed for this task?"
                      value={entryForm.overtime_reason}
                      onChange={(e) => setEntryForm(prev => ({ ...prev, overtime_reason: e.target.value }))}
                      rows={2}
                      className="bg-rose-50/30 border-rose-200 focus:ring-rose-500 resize-none"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setEntryDialogOpen(false)} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </Button>
              <Button
                onClick={handleSaveEntry}
                disabled={addEntryMutation.isPending || updateEntryMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
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
          <AlertDialogContent className="bg-white border-0 shadow-2xl rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold text-slate-900">Submit Timesheet for Approval</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 text-base mt-2">
                Once submitted, you won't be able to make changes until it's reviewed by an administrator.
                Are you sure all your time entries are correct?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel className="border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleSubmitTimesheet}
                disabled={submitTimesheetMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {submitTimesheetMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}