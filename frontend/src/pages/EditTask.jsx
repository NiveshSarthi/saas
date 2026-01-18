// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Flag,
  Plus,
  X,
  Loader2,
  Paperclip,
  Video,
  Tag,
  Layers,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import RecurringTaskForm from '@/components/tasks/RecurringTaskForm';
import StandardTagSelect from '@/components/tasks/StandardTagSelect';
import AITaskSuggestions from '@/components/tasks/AITaskSuggestions';
import AIAssigneeSuggestions from '@/components/tasks/AIAssigneeSuggestions';
import AICompletionPredictor from '@/components/tasks/AICompletionPredictor';
import UserMultiSelect from '@/components/common/UserMultiSelect';
import CustomFieldsForm from '@/components/tasks/CustomFieldsForm';
import FileUpload from '@/components/common/FileUpload';
import { notifyMultipleAssignees, sendAssignmentNotification, MODULES } from '@/components/utils/notificationService';

export default function EditTask() {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const taskId = urlParams.get('id');

  const [formData, setFormData] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [taskCategory, setTaskCategory] = useState('normal');

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['edit-task', taskId],
    queryFn: async () => {
      const task = await base44.entities.Task.get(taskId);
      return task;
    },
    enabled: !!taskId,
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        project_id: task.project_id || '',
        group_id: task.group_id || '',
        assigned_group_id: task.assigned_group_id || '',
        status: task.status || 'backlog',
        priority: task.priority || 'medium',
        task_type: task.task_type || 'task',
        assignee_email: task.assignee_email || '',
        assignees: task.assignees || (task.assignee_email ? [task.assignee_email] : []),
        watchers: task.watchers || [],
        start_date: task.start_date || '',
        due_date: task.due_date || '',
        estimated_hours: task.estimated_hours || '',
        story_points: task.story_points || '',
        tags: task.tags || [],
        blocked_reason: task.blocked_reason || '',
        sprint_id: task.sprint_id || '',
        is_recurring: task.is_recurring || false,
        is_recurring_instance: task.is_recurring_instance || false,
        recurrence_type: task.recurrence_type || null,
        recurrence_day_of_week: task.recurrence_day_of_week || null,
        recurrence_day_of_month: task.recurrence_day_of_month || null,
        custom_fields: task.custom_fields || {},
        attachments: task.attachments || [],
        marketing_task_id: task.marketing_task_id || null,
      });

      if (task.marketing_task_id) {
        setTaskCategory('marketing');
      }
    }
  }, [task]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: teamData } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });

  const usersFromEntity = teamData?.users || teamData?.data?.users || [];
  const invitations = teamData?.invitations || teamData?.data?.invitations || [];

  // Normalize user shape
  const normalizedUsersFromEntity = (usersFromEntity || []).map(u => ({
    ...u,
    id: u.id || u._id || (u.email && String(u.email).toLowerCase()),
    email: u.email || u.email_address || u.username || null,
    department_id: u.department_id || (u.department && (u.department.id || u.department._id)) || null,
  }));

  const users = [
    ...normalizedUsersFromEntity,
    ...invitations
      .filter(inv => inv.status === 'accepted')
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
        role_id: inv.role_id,
      }))
  ];

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['active-sprints'],
    queryFn: () => base44.entities.Sprint.filter({ status: 'active' }),
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => base44.entities.CustomField.list('order'),
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks-for-ai', formData?.project_id],
    queryFn: () => base44.entities.Task.filter({ project_id: formData.project_id }, '-created_date', 20),
    enabled: !!formData?.project_id,
  });

  const selectedProject = projects.find(p => p.id === formData?.project_id);
  const projectDomain = selectedProject?.domain || 'generic';
  const relevantCustomFields = customFields.filter(f =>
    f.domain === 'all' || f.domain === projectDomain
  );

  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const updateTaskMutation = useMutation({
    mutationFn: async (data) => {
      // Track changes for activity log
      const fieldsToTrack = ['status', 'priority', 'assignee_email', 'due_date', 'sprint_id'];
      const activities = [];

      for (const field of fieldsToTrack) {
        if (task[field] !== data[field]) {
          activities.push({
            task_id: taskId,
            project_id: task.project_id,
            actor_email: user?.email,
            action: field === 'status' ? 'status_changed' : field === 'assignee_email' ? 'assigned' : 'updated',
            field_changed: field,
            old_value: task[field] ? String(task[field]) : null,
            new_value: data[field] ? String(data[field]) : null
          });
        }
      }

      // Log sprint change if sprint_id changed
      if (task.sprint_id !== data.sprint_id) {
        const oldSprint = sprints.find(s => String(s.id) === String(task.sprint_id));
        const newSprint = sprints.find(s => String(s.id) === String(data.sprint_id));

        if (base44?.entities?.SprintChangeLog && typeof base44.entities.SprintChangeLog.create === 'function') {
          try {
            await base44.entities.SprintChangeLog.create({
              task_id: taskId,
              task_title: task.title,
              old_sprint_id: task.sprint_id || null,
              new_sprint_id: data.sprint_id || null,
              old_sprint_name: oldSprint?.name || 'No Sprint',
              new_sprint_name: newSprint?.name || 'No Sprint',
              changed_by: user?.email,
              project_id: task.project_id,
              is_subtask: task.parent_task_id ? true : false
            });
          } catch (err) {
            console.warn('SprintChangeLog.create failed', err);
          }
        }
      }

      await base44.entities.Task.update(taskId, data);

      // If assignees changed, ensure assignee_email is consistent and update watchers
      try {
        const newAssignees = data.assignees || (data.assignee_email ? [data.assignee_email] : []);
        const newAssigneeEmail = (data.assignee_email) || (newAssignees && newAssignees.length > 0 ? newAssignees[0] : null);

        // Update assignees/assignee_email if needed
        if (newAssignees && (JSON.stringify(newAssignees) !== JSON.stringify(task.assignees || []))) {
          await base44.entities.Task.update(taskId, { assignees: newAssignees, assignee_email: newAssigneeEmail });
        }

        // Ensure new assignee is in watchers
        if (newAssigneeEmail) {
          const currentWatchers = task.watchers || [];
          const merged = Array.from(new Set([...(currentWatchers || []), newAssigneeEmail]));
          if (JSON.stringify(merged) !== JSON.stringify(currentWatchers)) {
            await base44.entities.Task.update(taskId, { watchers: merged });
          }
        }
      } catch (err) {
        console.warn('Assignee/watchers update failed', err);
      }

      // Log all changes
      for (const activity of activities) {
        await base44.entities.Activity.create(activity);
      }

      // Create notification if assignee changed
      // Create notification if assignee changed
      if (task.assignee_email !== data.assignee_email && data.assignee_email) {
        await sendAssignmentNotification({
          assignedTo: data.assignee_email,
          assignedBy: user?.email,
          assignedByName: user?.full_name || user?.email,
          module: MODULES.TASK,
          itemName: task.title,
          itemId: taskId,
          link: `/TaskDetail?id=${taskId}`,
          metadata: {}
        });
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries so UI reflects changes
      try {
        const qc = queryClient;
        qc.invalidateQueries({ queryKey: ['edit-task', taskId] });
        qc.invalidateQueries({ queryKey: ['task', taskId] });
        qc.invalidateQueries({ queryKey: ['my-tasks'] });
        qc.invalidateQueries({ queryKey: ['project-tasks-for-ai', formData?.project_id] });
      } catch (e) { }

      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(createPageUrl(`TaskDetail?id=${task.id || task._id}`), { state: location.state });
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      story_points: formData.story_points ? parseInt(formData.story_points) : null,
      assignee_email: formData.assignees.length > 0 ? (formData.assignees[0] || '').toLowerCase() : null,
      assignees: formData.assignees.map(e => (e || '').toLowerCase()),
    };
    updateTaskMutation.mutate(dataToSubmit);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      navigate('/');
    }
  };

  if (taskLoading || !formData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
          <p className="text-slate-500">Loading task details...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Task Not Found</h2>
          <p className="text-slate-500 mb-6">The task you are looking for does not exist or has been deleted.</p>
          <Link to={createPageUrl('MyTasks')}>
            <Button>Back to Tasks</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900 pb-20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <Button
            variant="ghost"
            className="mb-6 hover:bg-white/50 dark:hover:bg-slate-800/50 backdrop-blur-sm -ml-2 text-slate-600 hover:text-indigo-600 transition-all"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Task
          </Button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-indigo-100 dark:border-slate-700">
                  <ArrowLeft className="w-8 h-8 text-indigo-600 dark:text-indigo-400 rotate-180" /> {/* Using generic icon for 'Edit' feel */}
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 tracking-tight">
                  Edit Task
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Update task details and assignments</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                className="border-slate-200 hover:bg-white/50 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={updateTaskMutation.isPending || !formData.title}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {updateTaskMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Left Column: Task Details */}
            <div className="xl:col-span-2 space-y-8">
              {/* Task Details Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="bg-gradient-to-b from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 sm:p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <Tag className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Task Information</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title <span className="text-red-500">*</span></Label>
                      <Input
                        id="title"
                        placeholder="Enter a descriptive title..."
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="text-lg bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Add details, acceptance criteria, or context..."
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={6}
                        className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none p-4"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Attachments</Label>
                      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-2 border border-slate-100 dark:border-slate-700">
                        <FileUpload
                          files={formData.attachments}
                          onFilesChange={(files) => setFormData(prev => ({ ...prev, attachments: files }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Task Suggestions */}
                  {formData.project_id && user?.role === 'admin' && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                      <AITaskSuggestions
                        projectData={projects.find(p => p.id === formData.project_id)}
                        currentTitle={formData.title}
                        currentDescription={formData.description}
                        currentTags={formData.tags}
                        onApplyTitle={(title) => setFormData(prev => ({ ...prev, title }))}
                        onApplyDescription={(desc) => setFormData(prev => ({ ...prev, description: desc }))}
                        onApplyTag={(tag) => setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))}
                        existingTasks={projectTasks}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Settings */}
            <div className="space-y-8">
              {/* Settings Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                <div className="bg-gradient-to-b from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                      <Flag className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Settings</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project</Label>
                      <Select
                        value={formData.project_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, group_id: '' }))}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                          <SelectValue placeholder="Select Project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full ring-2 ring-white/50 dark:ring-slate-800/50"
                                  style={{ backgroundColor: project.color || '#6366F1' }}
                                />
                                {project.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Group</Label>
                      <Select
                        value={formData.assigned_group_id || "none"}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_group_id: value === "none" ? '' : value }))}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                          <SelectValue placeholder="No Group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Group</SelectItem>
                          {userGroups.map(group => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Task Type</Label>
                        <Select
                          value={formData.task_type}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, task_type: value }))}
                        >
                          <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="epic">Epic</SelectItem>
                            <SelectItem value="story">Story</SelectItem>
                            <SelectItem value="task">Task</SelectItem>
                            <SelectItem value="bug">Bug</SelectItem>
                            <SelectItem value="feature">Feature</SelectItem>
                            <SelectItem value="improvement">Improvement</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Priority</Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-indigo-600 font-semibold uppercase tracking-wide">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="backlog">Backlog</SelectItem>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Fields */}
                    {relevantCustomFields.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <CustomFieldsForm
                          fields={relevantCustomFields}
                          values={formData.custom_fields}
                          onChange={(newFields) => setFormData(prev => ({ ...prev, custom_fields: newFields }))}
                        />
                      </div>
                    )}

                    {/* Blocked Reason */}
                    {formData.status === 'blocked' && (
                      <div className="space-y-2 animate-in fade-in zoom-in-95">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-red-500">Blocked Reason</Label>
                        <Input
                          value={formData.blocked_reason}
                          onChange={(e) => setFormData(prev => ({ ...prev, blocked_reason: e.target.value }))}
                          placeholder="Why is this task blocked?"
                          className="bg-red-50 border-red-200 h-11 rounded-xl focus:border-red-500 focus:ring-red-200"
                        />
                      </div>
                    )}

                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</Label>
                      <StandardTagSelect
                        selectedTags={formData.tags}
                        onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                      />
                    </div>
                  </div>
                </div>
              </div>


              {/* Assignment Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                <div className="bg-gradient-to-b from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Assignment</h2>
                  </div>

                  <div className="space-y-4">
                    {/* AI Assignee Suggestions */}
                    {user?.role === 'admin' && (
                      <AIAssigneeSuggestions
                        taskData={{
                          ...formData,
                          project_name: projects.find(p => p.id === formData.project_id)?.name
                        }}
                        teamMembers={users}
                        tasks={projectTasks}
                        onSelectAssignee={(email) => {
                          setFormData(prev => ({ ...prev, assignee_email: email }));
                        }}
                        selectedAssignees={formData.assignee_email ? [formData.assignee_email] : []}
                      />
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assignees</Label>
                      <UserMultiSelect
                        users={users}
                        departments={departments}
                        selectedEmails={formData.assignees && formData.assignees.length > 0 ? formData.assignees : (formData.assignee_email ? [formData.assignee_email] : [])}
                        onChange={(selected) => {
                          const email = selected && selected.length > 0 ? selected[0] : null;
                          setFormData(prev => ({ ...prev, assignee_email: email, assignees: selected }));
                        }}
                        placeholder="Select team members..."
                        singleSelect={true}
                        className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-auto min-h-[44px] rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</Label>
                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl",
                                !formData.start_date && "text-slate-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.start_date ? format(new Date(formData.start_date), 'PPP') : 'Select'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.start_date ? new Date(formData.start_date) : undefined}
                              onSelect={(date) => {
                                setFormData(prev => ({
                                  ...prev,
                                  start_date: date ? format(date, 'yyyy-MM-dd') : ''
                                }));
                                setStartDateOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Due Date</Label>
                        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl",
                                !formData.due_date && "text-slate-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.due_date ? format(new Date(formData.due_date), 'PPP') : 'Select'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={formData.due_date ? new Date(formData.due_date) : undefined}
                              onSelect={(date) => {
                                setFormData(prev => ({
                                  ...prev,
                                  due_date: date ? format(date, 'yyyy-MM-dd') : ''
                                }));
                                setDueDateOpen(false);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sprint</Label>
                      <Select
                        value={formData.sprint_id || "none"}
                        onValueChange={(val) => setFormData(prev => ({ ...prev, sprint_id: val === "none" ? null : val }))}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                          <SelectValue placeholder="Select Sprint" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Sprint</SelectItem>
                          {sprints.map(s => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0"
                          value={formData.estimated_hours}
                          onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                          className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Points</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.story_points}
                          onChange={(e) => setFormData(prev => ({ ...prev, story_points: e.target.value }))}
                          className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* AI Completion Time Prediction */}
                    {user?.role === 'admin' && (
                      <div className="pt-2">
                        <AICompletionPredictor
                          taskData={formData}
                          tasks={projectTasks}
                        />
                      </div>
                    )}

                    {/* Recurring Task Options */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                      <RecurringTaskForm formData={formData} setFormData={setFormData} isEditing={true} />
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}