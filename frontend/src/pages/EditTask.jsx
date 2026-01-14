import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Flag,
  Plus,
  X,
  Loader2
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

export default function EditTask() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const taskId = urlParams.get('id');

  const [formData, setFormData] = useState(null);
  const [tagInput, setTagInput] = useState('');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

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
      });
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

  const usersFromEntity = teamData?.users || [];
  const invitations = teamData?.invitations || [];

  // Normalize user shape so downstream code can rely on `id`, `email`, `department_id`
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

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['task-groups', formData?.project_id],
    queryFn: async () => {
      if (!formData?.project_id) return [];
      const groups = await base44.entities.TaskGroup.filter({ project_id: formData.project_id });
      return groups;
    },
    enabled: !!formData?.project_id,
  });

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks-for-ai', formData?.project_id],
    queryFn: () => base44.entities.Task.filter({ project_id: formData.project_id }, '-created_date', 20),
    enabled: !!formData?.project_id,
  });

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
      if (task.assignee_email !== data.assignee_email && data.assignee_email && data.assignee_email !== user?.email) {
        await base44.entities.Notification.create({
          user_email: data.assignee_email,
          type: 'task_assigned',
          title: 'Task Assigned to You',
          message: `You have been assigned to task: ${task.title}`,
          task_id: taskId,
          project_id: task.project_id,
          actor_email: user?.email,
          link: `/TaskDetail?id=${taskId}`
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
      } catch (e) {}

      navigate(createPageUrl(`TaskDetail?id=${task.id || task._id}`));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      story_points: formData.story_points ? parseInt(formData.story_points) : null,
    };
    updateTaskMutation.mutate(dataToSubmit);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  if (taskLoading || !formData) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Task not found</h2>
        <Link to={createPageUrl('MyTasks')}>
          <Button className="mt-4">Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" className="mb-4 hover:bg-white/50" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Task
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <ArrowLeft className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Edit Task
              </h1>
              <p className="text-slate-600 mt-1">Update and refine your task details</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Form Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Task Details</h2>
              <p className="text-indigo-100 text-sm">Core information about your task</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Title */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                  <Label htmlFor="title" className="text-base font-semibold text-slate-900">
                    Task Title <span className="text-red-500">*</span>
                  </Label>
                </div>
                <Input
                  id="title"
                  placeholder="What needs to be done?"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="text-lg border-2 border-slate-200 focus:border-indigo-500 rounded-xl h-12 px-4 transition-all"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                  <Label htmlFor="description" className="text-base font-semibold text-slate-900">Description</Label>
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe the task in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-3 transition-all resize-none"
                />
              </div>

              {/* AI Task Suggestions */}
              {formData.project_id && user?.role === 'admin' && (
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
              )}

              {/* Row: Project & Task Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project</Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, group_id: '' }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Group (Optional)</Label>
                  <Select
                    value={formData.assigned_group_id || "none"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_group_id: value === "none" ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {userGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: group.color || '#6366F1' }}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row: Task Type & Assigned Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Task Type</Label>
                  <Select
                    value={formData.task_type}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, task_type: value }))}
                  >
                    <SelectTrigger>
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
                  <Label className="text-sm font-medium">Assigned Group (Optional)</Label>
                  <Select
                    value={formData.assigned_group_id || "none"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_group_id: value === "none" ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {userGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: group.color || '#6366F1' }}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row: Status & Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
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

              {/* Blocked Reason */}
              {formData.status === 'blocked' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Blocked Reason</Label>
                  <Input
                    value={formData.blocked_reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, blocked_reason: e.target.value }))}
                    placeholder="Why is this task blocked?"
                  />
                </div>
              )}

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

              {/* Assignee */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Assignee</Label>
                <UserMultiSelect
                  users={users}
                  departments={departments}
                  selectedEmails={formData.assignees && formData.assignees.length > 0 ? formData.assignees : (formData.assignee_email ? [formData.assignee_email] : [])}
                  onChange={(selected) => {
                    const email = selected && selected.length > 0 ? selected[0] : null;
                    setFormData(prev => ({ ...prev, assignee_email: email, assignees: selected }));
                  }}
                  placeholder="Select assignee"
                  singleSelect={true}
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Start Date</Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.start_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.start_date ? format(new Date(formData.start_date), 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
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
                  <Label className="text-sm font-medium">Due Date</Label>
                  <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.due_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.due_date ? format(new Date(formData.due_date), 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
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

              {/* Sprint Assignment */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sprint</Label>
                <Select
                  value={formData.sprint_id || "none"}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, sprint_id: val === "none" ? null : val }))}
                >
                  <SelectTrigger>
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

              {/* Estimates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Estimated Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Story Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.story_points}
                    onChange={(e) => setFormData(prev => ({ ...prev, story_points: e.target.value }))}
                  />
                </div>
              </div>

              {/* AI Completion Time Prediction */}
              {user?.role === 'admin' && (
                <AICompletionPredictor
                  taskData={formData}
                  tasks={projectTasks}
                />
              )}

              {/* Tags */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tags</Label>
                <StandardTagSelect
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                />
              </div>

              {/* Recurring Task Options */}
              <RecurringTaskForm formData={formData} setFormData={setFormData} isEditing={true} />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={updateTaskMutation.isPending || !formData.title}
            >
              {updateTaskMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}