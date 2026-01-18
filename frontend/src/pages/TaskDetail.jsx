import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  Clock,
  User,
  Flag,
  Tag,
  Paperclip,
  MessageSquare,
  MoreHorizontal,
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Video,
  Power
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import CommentSection from '@/components/tasks/CommentSection';
import FileUpload from '@/components/common/FileUpload';
import SubtaskList from '@/components/tasks/SubtaskList';
import TimeTracker from '@/components/tasks/TimeTracker';
import TaskMeetingSection from '@/components/meetings/TaskMeetingSection';
import TaskWatchers from '@/components/tasks/TaskWatchers';
import TaskDuplicateDialog from '@/components/tasks/TaskDuplicateDialog';
import RecurringTaskBadge from '@/components/tasks/RecurringTaskBadge';
import RecurringTaskCompletionLog from '@/components/tasks/RecurringTaskCompletionLog';
import { notifyStatusChange } from '@/components/utils/notificationHelper';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', icon: 'text-red-500' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: 'text-orange-500' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'text-blue-500' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'text-slate-400' },
};

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-600' },
  todo: { label: 'To Do', color: 'bg-blue-100 text-blue-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-600' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-600' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-600' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-600' },
};

export default function TaskDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const taskId = urlParams.get('id');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const task = await base44.entities.Task.get(taskId);
      return task;
    },
    enabled: !!taskId,
  });

  // Check task visibility
  const canViewTask = user && task && (
    user.role === 'admin' ||
    task.reporter_email === user.email ||
    task.created_by === user.email ||
    task.assignee_email === user.email ||
    (task.assignees && task.assignees.includes(user.email))
  );

  const { data: project } = useQuery({
    queryKey: ['task-project', task?.project_id],
    queryFn: async () => {
      if (!task?.project_id) return null;
      if (!task?.project_id) return null;
      const project = await base44.entities.Project.get(task.project_id);
      return project;
    },
    enabled: !!task?.project_id,
  });

  // Fetch all sprints so task sprint dropdown can show planned/active/completed as appropriate
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => base44.entities.Sprint.list('-created_date', 2000),
  });

  // Helper: create sprint change logs only if the backend entity exists
  const safeCreateSprintChangeLog = async (payload) => {
    if (!base44?.entities?.SprintChangeLog || typeof base44.entities.SprintChangeLog.create !== 'function') return null;
    try {
      return await base44.entities.SprintChangeLog.create(payload);
    } catch (err) {
      console.warn('SprintChangeLog.create failed', err);
      return null;
    }
  };

  const taskSprint = task ? (sprints.find(s => String(s.id) === String(task.sprint_id)) || (task.sprint_id ? { id: task.sprint_id, name: 'Unknown Sprint' } : null)) : null;

  const { data: userGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['task-groups', task?.project_id],
    queryFn: () => base44.entities.TaskGroup.filter({ project_id: task.project_id }),
    enabled: !!task?.project_id,
  });

  const assignedGroup = task?.assigned_group_id ? userGroups.find(g => g.id === task.assigned_group_id) : null;
  const taskGroup = task?.group_id ? taskGroups.find(g => g.id === task.group_id) : null;

  const { data: comments = [] } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: () => base44.entities.Comment.filter({ task_id: taskId }, 'created_date'),
    enabled: !!taskId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['task-activities', taskId],
    queryFn: () => base44.entities.Activity.filter({ task_id: taskId }, '-created_date', 20),
    enabled: !!taskId,
  });

  const { data: rawSubtasks = [] } = useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: () => base44.entities.Task.filter({ parent_task_id: taskId }),
    enabled: !!taskId,
  });

  const subtasks = React.useMemo(() => {
    if (!user || !task) return [];
    if (user.role === 'admin') return rawSubtasks;

    // If the user can view the parent task, they can view all its subtasks
    if (canViewTask) {
      return rawSubtasks;
    }

    return [];
  }, [rawSubtasks, user, task, canViewTask]);

  const updateTaskMutation = useMutation({
    mutationFn: async (data) => {
      const oldStatus = task.status;
      await base44.entities.Task.update(taskId, data);

      // If status changed, notify watchers
      if (data.status && data.status !== oldStatus && task.watchers && task.watchers.length > 0) {
        await notifyStatusChange({
          task,
          watchers: task.watchers,
          actorEmail: user?.email,
          actorName: user?.full_name || user?.email,
          oldStatus,
          newStatus: data.status
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (deleteType = 'single') => {
      // If deleteType is 'series', delete the entire recurring series
      if (deleteType === 'series') {
        const masterTaskId = task.is_recurring_instance
          ? task.parent_recurring_task_id
          : taskId;

        // Delete all instances
        const instances = await base44.entities.Task.filter({
          parent_recurring_task_id: masterTaskId
        });
        for (const instance of instances) {
          await base44.entities.Task.delete(instance.id);
        }

        // Delete completion logs
        const completions = await base44.entities.RecurringTaskCompletion.filter({
          recurring_task_id: masterTaskId
        });
        for (const completion of completions) {
          await base44.entities.RecurringTaskCompletion.delete(completion.id);
        }

        // Delete the master task
        await base44.entities.Task.delete(masterTaskId);
      } else {
        // Just delete this single task
        await base44.entities.Task.delete(taskId);
      }
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      toast.success('Task deleted successfully');
      setTimeout(() => {
        const returnPath = location.state?.returnPath || 'MyTasks';
        window.location.href = createPageUrl(returnPath);
      }, 500);
    },
    onError: (error) => {
      toast.error('Failed to delete task: ' + error.message);
    }
  });

  const handleStatusChange = async (status) => {
    // Handle recurring task completion
    if (task.is_recurring_instance && status === 'done') {
      const today = format(new Date(), 'yyyy-MM-dd');
      await base44.entities.RecurringTaskCompletion.create({
        recurring_task_id: task.parent_recurring_task_id,
        completion_date: task.instance_date || today,
        completed_by: user?.email
      });
    }

    updateTaskMutation.mutate({ status, progress: status === 'done' ? 100 : task.progress });
  };

  // Marketing Task Integration
  const { data: marketingTask } = useQuery({
    queryKey: ['marketing-task-linked', task?.marketing_task_id],
    queryFn: async () => {
      if (!task?.marketing_task_id) return null;
      const res = await base44.entities.MarketingTask.get(task.marketing_task_id);
      return res;
    },
    enabled: !!task?.marketing_task_id
  });

  const createMarketingTaskMutation = useMutation({
    mutationFn: async () => {
      // 1. Create Marketing Task with guaranteed campaign_name
      const mTask = await base44.entities.MarketingTask.create({
        campaign_name: task.title || 'Untitled Campaign',
        description: task.description || '',
        related_task_id: task.id,
        status: 'editing',
        task_type: 'video', // Default
        assignee_email: user?.email
      });
      // 2. Update current task to link it
      await base44.entities.Task.update(task.id, { marketing_task_id: mTask.id });
      return mTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['task', taskId]);
      toast.success('Marketing Campaign created!');
    }
  });

  // Fetch Departments for Permission Check
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const canManageMarketing = React.useMemo(() => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    // Check if user is in marketing department
    if (user.department_id && departments.length > 0) {
      const dept = departments.find(d => d.id === user.department_id);
      return dept?.name?.toLowerCase().includes('marketing');
    }

    return false;
  }, [user, departments]);

  const { data: teamData } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      // functions.invoke may return a double-wrapped payload ({ data: { users } })
      return response.data?.data || response.data;
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

  // Get team members working on this task's subtasks
  const subtaskTeamMembers = React.useMemo(() => {
    const assigneeEmails = new Set();
    subtasks.forEach(subtask => {
      if (subtask.assignee_email) assigneeEmails.add(subtask.assignee_email);
      if (subtask.assignees) {
        subtask.assignees.forEach(email => assigneeEmails.add(email));
      }
    });
    return Array.from(assigneeEmails)
      .map(email => users.find(u => u.email === email))
      .filter(Boolean);
  }, [subtasks, users]);

  const getInitials = (email) => {
    if (!email) return '?';
    return email.slice(0, 2).toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!task || !canViewTask) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">{!task ? "Task not found" : "Access Denied"}</h2>
        <p className="text-slate-500 mt-2">{!task ? "The requested task does not exist." : "You do not have permission to view this task."}</p>
        <Link to={createPageUrl('MyTasks')}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tasks
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (location.state?.returnPath) {
              navigate(createPageUrl(location.state.returnPath));
            } else {
              navigate(-1);
            }
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Badge className={cn("text-xs uppercase", (statusConfig[task.task_type] || statusConfig['backlog'])?.color || 'bg-blue-100 text-blue-700')}>
                {task.task_type || 'task'}
              </Badge>
              <RecurringTaskBadge task={task} />
              {project && (
                <Link
                  to={createPageUrl(`ProjectBoard?id=${project.id}`)}
                  className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                >
                  <LinkIcon className="w-3 h-3" />
                  {project.name}
                </Link>
              )}
            </div>
            <h1 className={cn(
              "text-2xl font-bold text-slate-900",
              task.status === 'done' && "line-through text-slate-500"
            )}>
              {task.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateOpen(true)}
          >
            <Copy className="w-4 h-4 mr-2" />
            Duplicate
          </Button>

          <Link
            to={createPageUrl(`EditTask?id=${task.id}`)}
            state={location.state}
          >
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>

          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {(task.is_recurring || task.is_recurring_instance) ? 'Delete Recurring Task' : 'Delete Task'}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {task.is_recurring ? (
                    <div className="space-y-3">
                      <p className="font-medium text-red-600">
                        This is the master recurring task. Deleting it will permanently remove:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li>The master recurring task</li>
                        <li>All generated instances</li>
                        <li>All completion history</li>
                      </ul>
                      <p className="mt-2 text-sm font-medium">This action cannot be undone.</p>
                    </div>
                  ) : task.is_recurring_instance ? (
                    <div className="space-y-3">
                      <p className="text-sm">
                        This is an instance of a recurring task. Choose what to delete:
                      </p>
                    </div>
                  ) : (
                    'Are you sure you want to delete this task? This action cannot be undone.'
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteTaskMutation.isPending}>Cancel</AlertDialogCancel>

                {task.is_recurring_instance ? (
                  <>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        deleteTaskMutation.mutate('single');
                      }}
                      disabled={deleteTaskMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete This Instance'}
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        deleteTaskMutation.mutate('series');
                      }}
                      disabled={deleteTaskMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteTaskMutation.isPending ? 'Deleting...' : 'Delete Entire Series'}
                    </AlertDialogAction>
                  </>
                ) : (
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      deleteTaskMutation.mutate(task.is_recurring ? 'series' : 'single');
                    }}
                    disabled={deleteTaskMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {deleteTaskMutation.isPending ? 'Deleting...' : task.is_recurring ? 'Delete Series' : 'Delete'}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Description</h3>
            {task.description ? (
              <p className="text-slate-600 whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-slate-400 italic">No description provided</p>
            )}
          </div>

          {/* Subtasks */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">
                  Subtasks {subtasks.length > 0 && `(${subtasks.length})`}
                </h3>
                {subtaskTeamMembers.length > 0 && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-slate-500">Team working on this:</span>
                    <div className="flex -space-x-2">
                      {subtaskTeamMembers.slice(0, 5).map((member, idx) => {
                        const initials = member?.full_name
                          ? member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                          : member?.email?.slice(0, 2);
                        return (
                          <Avatar key={idx} className="w-6 h-6 border-2 border-white" title={member?.full_name || member?.email}>
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px]">
                              {initials?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                      {subtaskTeamMembers.length > 5 && (
                        <Avatar className="w-6 h-6 border-2 border-white">
                          <AvatarFallback className="bg-slate-100 text-slate-600 text-[9px]">
                            +{subtaskTeamMembers.length - 5}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {task.parent_task_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = createPageUrl(`TaskDetail?id=${task.parent_task_id}`)}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Parent Task
                </Button>
              )}
            </div>
            <SubtaskList
              parentTaskId={taskId}
              projectId={task.project_id}
              subtasks={subtasks}
              users={users}
              parentSprintId={task.sprint_id}
            />
          </div>

          {/* Meetings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <TaskMeetingSection
              taskId={taskId}
              taskTitle={task.title}
              projectId={task.project_id}
              currentUserEmail={user?.email}
            />
          </div>

          {/* Attachments */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                Attachments ({task.attachments.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {task.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                  >
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="text-sm truncate">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">
              Comments ({comments.length})
            </h3>
            <CommentSection
              taskId={taskId}
              comments={comments}
              users={users}
              currentUser={user}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status & Priority */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-500 block mb-2">Status</label>
              <Select value={task.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <Badge className={cn("text-xs", config.color)}>
                        {config.label}
                      </Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-slate-500 block mb-2">Priority</label>
              <Badge className={cn("text-sm", (priorityConfig[task.priority] || priorityConfig['medium'])?.color)}>
                <Flag className={cn("w-3 h-3 mr-1", (priorityConfig[task.priority] || priorityConfig['medium'])?.icon)} />
                {(priorityConfig[task.priority] || priorityConfig['medium'])?.label}
              </Badge>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-slate-500 block mb-2">Sprint</label>
              <Select
                value={task.sprint_id ? String(task.sprint_id) : "none"}
                onValueChange={async (val) => {
                  const newSprintId = val === "none" ? null : val;
                  const oldSprintId = task.sprint_id;
                  const oldSprint = sprints.find(s => String(s.id) === String(oldSprintId));
                  const newSprint = sprints.find(s => String(s.id) === String(newSprintId));

                  // Log sprint change for parent task (guarded)
                  await safeCreateSprintChangeLog({
                    task_id: task.id,
                    task_title: task.title,
                    old_sprint_id: oldSprintId || null,
                    new_sprint_id: newSprintId || null,
                    old_sprint_name: oldSprint?.name || 'No Sprint',
                    new_sprint_name: newSprint?.name || 'No Sprint',
                    changed_by: user?.email,
                    project_id: task.project_id,
                    is_subtask: false
                  });

                  await updateTaskMutation.mutateAsync({ sprint_id: newSprintId });

                  // Update all subtasks to the same sprint
                  if (subtasks.length > 0) {
                    await Promise.all(
                      subtasks.map(async (subtask) => {
                        // Log sprint change for each subtask (guarded)
                        await safeCreateSprintChangeLog({
                          task_id: subtask.id,
                          task_title: subtask.title,
                          old_sprint_id: subtask.sprint_id || null,
                          new_sprint_id: newSprintId || null,
                          old_sprint_name: sprints.find(s => String(s.id) === String(subtask.sprint_id))?.name || 'No Sprint',
                          new_sprint_name: newSprint?.name || 'No Sprint',
                          changed_by: user?.email,
                          project_id: task.project_id,
                          is_subtask: true
                        });

                        const sid = subtask.id || subtask._id;
                        if (!sid) {
                          console.warn('Skipping subtask update: missing id', subtask);
                          return null;
                        }
                        return base44.entities.Task.update(sid, { sprint_id: newSprintId });
                      })
                    );
                    queryClient.invalidateQueries({ queryKey: ['subtasks', taskId] });
                    toast.success(`Updated ${subtasks.length} subtask(s) to ${val === "none" ? 'no sprint' : 'sprint'}`);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No Sprint" />
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

            <Separator />

            {taskGroup && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-500 block mb-2">Task Section</label>
                  <Badge variant="outline" className="flex items-center gap-2 w-fit">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: taskGroup.color || '#6366F1' }}
                    />
                    {taskGroup.name}
                  </Badge>
                </div>
                <Separator />
              </>
            )}

            <div>
              <label className="text-sm font-medium text-slate-500 block mb-2">
                Assignee{task.assignees && task.assignees.length > 1 ? 's' : ''}
              </label>
              {task.assignees && task.assignees.length > 0 ? (
                <div className="space-y-2">
                  {task.assignees.map((email, idx) => {
                    const assigneeUser = users.find(u => u.email === email);
                    const initials = assigneeUser?.full_name
                      ? assigneeUser.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                      : email.slice(0, 2);

                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                            {initials.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {assigneeUser?.full_name || email}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : task.assignee_email ? (
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                      {getInitials(task.assignee_email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{task.assignee_email}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">Unassigned</span>
              )}
            </div>

            <Separator />

            {assignedGroup && (
              <>
                <div>
                  <label className="text-sm font-medium text-slate-500 block mb-2">Assigned Group</label>
                  <Badge variant="outline" className="flex items-center gap-2 w-fit">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: assignedGroup.color || '#6366F1' }}
                    />
                    {assignedGroup.name}
                  </Badge>
                </div>
                <Separator />
              </>
            )}

            <div>
              <label className="text-sm font-medium text-slate-500 block mb-2">Reporter</label>
              {task.reporter_email ? (
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                      {getInitials(task.reporter_email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{task.reporter_email}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-400">Unknown</span>
              )}
            </div>
          </div>

          {/* Time Tracking */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <TimeTracker
              taskId={taskId}
              estimatedHours={task.estimated_hours || 0}
              actualHours={task.actual_hours || 0}
              onLogTime={(hours) => updateTaskMutation.mutate({ actual_hours: hours })}
              subtasks={subtasks}
            />
          </div>

          {/* Dates */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-500">Start Date</label>
              <span className="text-sm">
                {task.start_date && !isNaN(new Date(task.start_date)) ? format(new Date(task.start_date), 'MMM d, yyyy') : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-500">Due Date</label>
              <span className="text-sm">
                {task.due_date && !isNaN(new Date(task.due_date)) ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
              </span>
            </div>
            {task.story_points && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-500">Story Points</label>
                  <span className="text-sm font-medium">{task.story_points}</span>
                </div>
              </>
            )}
          </div>

          {/* Watchers */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <TaskWatchers
              task={task}
              users={users}
              currentUserEmail={user?.email}
            />
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <label className="text-sm font-medium text-slate-500 block mb-3">Tags</label>
              <div className="flex flex-wrap gap-2">
                {task.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Marketing Integration - Only visible if linked or user has permission */}
          {(task.marketing_task_id || canManageMarketing) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Video className="w-4 h-4 text-indigo-600" />
                  Marketing Campaign
                </h3>
              </div>

              {task.marketing_task_id && marketingTask ? (
                <div className="space-y-3">
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm text-indigo-900 line-clamp-1">{marketingTask.campaign_name}</span>
                      <Badge className="bg-white text-indigo-600 border-indigo-200 shadow-sm hover:bg-white">
                        {marketingTask.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-indigo-600/80 mb-3">
                      {marketingTask.task_type} • V{marketingTask.version}
                    </div>
                    <Link to={createPageUrl('Marketing')}>
                      <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">
                        Open Campaign Board
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-slate-500 mb-3">
                    No marketing campaign linked to this task.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600"
                    onClick={() => createMarketingTaskMutation.mutate()}
                    disabled={createMarketingTaskMutation.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Start Marketing Workflow
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Recurring Task Control - Admin & Creator */}
          {(user?.role === 'admin' || user?.email === task.created_by) && task.is_recurring && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Power className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-slate-900">Recurring Task</h3>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-slate-700 block">Enable Recurrence</span>
                  <span className="text-xs text-slate-500">Generate future instances</span>
                </div>
                <Switch
                  checked={task.recurring_enabled !== false}
                  onCheckedChange={(checked) => {
                    updateTaskMutation.mutate({ recurring_enabled: checked });
                    toast.success(checked ? 'Recurrence enabled' : 'Recurrence disabled');
                  }}
                />
              </div>
            </div>
          )}

          {/* Recurring Task Completion Log */}
          {(task.is_recurring || task.parent_recurring_task_id) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <RecurringTaskCompletionLog
                recurringTaskId={task.parent_recurring_task_id || task.id}
                users={users}
              />
            </div>
          )}

          {/* Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id || activity._id} className="flex gap-3 text-sm">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                      {getInitials(activity.actor_email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-slate-600">{activity.action}</span>
                    <span className="text-slate-400 ml-2">
                      {formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <p className="text-sm text-slate-400">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {task && (
        <TaskDuplicateDialog
          task={task}
          open={duplicateOpen}
          onOpenChange={setDuplicateOpen}
        />
      )}
    </div>
  );
}