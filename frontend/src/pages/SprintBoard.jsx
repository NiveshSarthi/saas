import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Plus,
  MoreHorizontal,
  Target,
  Calendar,
  Users,
  TrendingDown,
  AlertCircle,
  LayoutDashboard,
  Filter,
  X,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SprintKanban from '@/components/sprints/SprintKanban';
import SprintSummary from '@/components/sprints/SprintSummary';
import BurndownChart from '@/components/sprints/BurndownChart';
import AddTaskToSprintDialog from '@/components/sprints/AddTaskToSprintDialog';

export default function SprintBoard() {
  const urlParams = new URLSearchParams(window.location.search);
  const sprintId = urlParams.get('id');
  const queryClient = useQueryClient();

  const [showAddTask, setShowAddTask] = useState(false);
  const [filterUser, setFilterUser] = useState('all');
  const [filterTags, setFilterTags] = useState([]);
  const [viewMode, setViewMode] = useState('kanban');
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: sprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['sprint', sprintId],
    queryFn: async () => {
      const sprints = await base44.entities.Sprint.filter({ id: sprintId });
      return sprints[0];
    },
    enabled: !!sprintId,
  });

  const { data: project } = useQuery({
    queryKey: ['sprint-project', sprint?.project_id],
    queryFn: async () => {
      const projects = await base44.entities.Project.filter({ id: sprint.project_id });
      return projects[0];
    },
    enabled: !!sprint?.project_id,
  });

  const { data: allSprintTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['sprint-tasks', sprintId],
    queryFn: () => base44.entities.Task.filter({ sprint_id: sprintId }),
    enabled: !!sprintId,
  });

  // Apply filters
  const sprintTasks = React.useMemo(() => {
    let filtered = allSprintTasks;

    // Apply user filter
    if (filterUser !== 'all') {
      filtered = filtered.filter(t =>
        t.assignee_email === filterUser ||
        (t.assignees && t.assignees.includes(filterUser))
      );
    }

    // Apply tags filter
    if (filterTags.length > 0) {
      filtered = filtered.filter(t =>
        t.tags && t.tags.some(tag => filterTags.includes(tag))
      );
    }

    return filtered;
  }, [allSprintTasks, filterUser, filterTags]);

  const { data: backlogTasks = [] } = useQuery({
    queryKey: ['backlog-tasks', sprint?.project_id],
    queryFn: () => base44.entities.Task.filter({
      project_id: sprint.project_id,
      sprint_id: null
    }),
    enabled: !!sprint?.project_id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list('name'),
  });

  const { data: allSprints = [] } = useQuery({
    queryKey: ['all-sprints-for-move'],
    queryFn: () => base44.entities.Sprint.filter({ status: 'active' }),
  });

  const updateSprintMutation = useMutation({
    mutationFn: (data) => base44.entities.Sprint.update(sprintId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint', sprintId] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprint-tasks', sprintId] });
      queryClient.invalidateQueries({ queryKey: ['backlog-tasks', sprint?.project_id] });
    },
  });

  const handleStartSprint = () => {
    updateSprintMutation.mutate({
      status: 'active',
      start_date: format(new Date(), 'yyyy-MM-dd')
    });
  };

  const handleCompleteSprint = () => {
    const completedPoints = sprintTasks
      .filter(t => t.status === 'done')
      .reduce((sum, t) => sum + (t.story_points || 0), 0);

    updateSprintMutation.mutate({
      status: 'completed',
      velocity: completedPoints
    });
    setShowCompleteDialog(false);
  };

  const handleTaskMove = (taskId, newStatus) => {
    updateTaskMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const handleAssignTask = (taskId, assigneeEmail = null) => {
    const data = { sprint_id: sprintId };
    if (assigneeEmail) data.assignee_email = assigneeEmail;
    updateTaskMutation.mutate({ id: taskId, data });
  };

  const handleRemoveTask = (taskId) => {
    updateTaskMutation.mutate({ id: taskId, data: { sprint_id: null } });
  };

  const handleMoveAllToSprint = async () => {
    if (!targetSprintId) return;

    const tasksToMove = sprintTasks.filter(t => t.status !== 'done');
    const targetSprint = allSprints.find(s => String(s.id) === String(targetSprintId));

    // Get all subtasks for the tasks being moved
    const allTasks = await base44.entities.Task.list();
    const taskIds = new Set(tasksToMove.map(t => t.id));
    const subtasksToMove = allTasks.filter(
      t => t.parent_task_id && taskIds.has(t.parent_task_id) && t.status !== 'done'
    );

    // Move parent tasks
    for (const task of tasksToMove) {
      const oldSprint = allSprints.find(s => String(s.id) === String(task.sprint_id));

      if (base44?.entities?.SprintChangeLog && typeof base44.entities.SprintChangeLog.create === 'function') {
        try {
          await base44.entities.SprintChangeLog.create({
            task_id: task.id,
            task_title: task.title,
            old_sprint_id: task.sprint_id || null,
            new_sprint_id: targetSprintId,
            old_sprint_name: oldSprint?.name || sprint.name,
            new_sprint_name: targetSprint?.name || 'Unknown Sprint',
            changed_by: user?.email,
            project_id: task.project_id,
            is_subtask: false
          });
        } catch (err) {
          console.warn('SprintChangeLog.create failed', err);
        }
      }

      await base44.entities.Task.update(task.id, { sprint_id: targetSprintId });
    }

    // Move subtasks
    for (const subtask of subtasksToMove) {
      const oldSprint = allSprints.find(s => String(s.id) === String(subtask.sprint_id));

      if (base44?.entities?.SprintChangeLog && typeof base44.entities.SprintChangeLog.create === 'function') {
        try {
          await base44.entities.SprintChangeLog.create({
            task_id: subtask.id,
            task_title: subtask.title,
            old_sprint_id: subtask.sprint_id || null,
            new_sprint_id: targetSprintId,
            old_sprint_name: oldSprint?.name || 'No Sprint',
            new_sprint_name: targetSprint?.name || 'Unknown Sprint',
            changed_by: user?.email,
            project_id: subtask.project_id,
            is_subtask: true
          });
        } catch (err) {
          console.warn('SprintChangeLog.create failed', err);
        }
      }

      await base44.entities.Task.update(subtask.id, { sprint_id: targetSprintId });
    }

    queryClient.invalidateQueries({ queryKey: ['sprint-tasks', sprintId] });
    setShowMoveDialog(false);
    setTargetSprintId('');
  };

  const isLoading = sprintLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Sprint not found</h2>
        <Link to={createPageUrl('Projects')}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  const daysRemaining = sprint.end_date
    ? Math.max(0, differenceInDays(parseISO(sprint.end_date), new Date()))
    : null;

  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
  const completedPoints = sprintTasks
    .filter(t => t.status === 'done')
    .reduce((sum, t) => sum + (t.story_points || 0), 0);
  const progress = sprintTasks.length > 0 ? Math.round((sprintTasks.filter(t => t.status === 'done').length / sprintTasks.length) * 100) : 0;
  const blockedTasks = sprintTasks.filter(t => t.status === 'blocked').length;

  const TaskListView = ({ tasks, users }) => {
    const statusConfig = {
      backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-700' },
      todo: { label: 'To Do', color: 'bg-blue-100 text-blue-700' },
      in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
      review: { label: 'Review', color: 'bg-purple-100 text-purple-700' },
      done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
      blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
    };

    const priorityConfig = {
      critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
      high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
      medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
      low: { label: 'Low', color: 'bg-slate-100 text-slate-700' },
    };

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Task</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Priority</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Assignee</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Story Points</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Type</th>
                <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const assignees = task.assignees || (task.assignee_email ? [task.assignee_email] : []);

                return (
                  <tr key={task.id || task._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}>
                        <div className="font-medium text-slate-900 hover:text-indigo-600 transition-colors line-clamp-2">
                          {task.title}
                        </div>
                      </Link>
                    </td>
                    <td className="p-4">
                      <Badge className={cn("text-xs", statusConfig[task.status]?.color)}>
                        {statusConfig[task.status]?.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge className={cn("text-xs", priorityConfig[task.priority]?.color)}>
                        {priorityConfig[task.priority]?.label}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {assignees.length > 0 ? (
                        <div className="text-sm text-slate-700">
                          {assignees.map((email, idx) => {
                            const user = users.find(u => u.email === email);
                            return (
                              <div key={idx} className="truncate">
                                {user?.full_name || email}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {task.story_points || '-'}
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">
                        {task.task_type || 'task'}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}>
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={createPageUrl(`EditTask?id=${task.id}`)}>
                              Edit Task
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRemoveTask(task.id)}
                            className="text-red-600"
                          >
                            Remove from Sprint
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {tasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No tasks in this sprint</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-6 lg:p-8 pb-4 space-y-4 bg-slate-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={project ? createPageUrl(`Sprints?project=${project.id}`) : createPageUrl('Projects')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {project && (
                  <span className="text-sm text-slate-500">{project.name}</span>
                )}
                <Badge className={cn(
                  "text-xs",
                  sprint.status === 'planned' && "bg-slate-100 text-slate-600",
                  sprint.status === 'active' && "bg-emerald-100 text-emerald-700",
                  sprint.status === 'completed' && "bg-blue-100 text-blue-700"
                )}>
                  {sprint.status}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{sprint.name}</h1>
              {sprint.goal && (
                <p className="text-slate-500 mt-1">{sprint.goal}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {sprint.status === 'planned' && (
              <Button
                onClick={handleStartSprint}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Sprint
              </Button>
            )}
            {sprint.status === 'active' && (
              <Button
                onClick={() => setShowCompleteDialog(true)}
                variant="outline"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Sprint
              </Button>
            )}
            {sprint.status !== 'completed' && (
              <>
                <Button onClick={() => setShowAddTask(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tasks
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowMoveDialog(true)}
                  disabled={sprintTasks.filter(t => t.status !== 'done').length === 0}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Move All to Sprint
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Filter className="w-4 h-4" />
            Filters:
          </div>

          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1 ml-auto">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="h-8 px-3"
            >
              <LayoutGrid className="w-4 h-4 mr-1.5" /> Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 px-3"
            >
              <ListIcon className="w-4 h-4 mr-1.5" /> List
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 w-20">
          </div>

          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users.map(u => (
                <SelectItem key={u.email} value={u.email}>
                  {u.full_name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-48 justify-between">
                <span className="truncate">
                  {filterTags.length === 0 ? 'All Tags' : `${filterTags.length} tag${filterTags.length > 1 ? 's' : ''}`}
                </span>
                <Filter className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
              {allTags.map(tag => (
                <DropdownMenuItem
                  key={tag.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    setFilterTags(prev =>
                      prev.includes(tag.name)
                        ? prev.filter(t => t !== tag.name)
                        : [...prev, tag.name]
                    );
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterTags.includes(tag.name)}
                    className="mr-2"
                    readOnly
                  />
                  {tag.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {(filterUser !== 'all' || filterTags.length > 0) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterUser('all');
                setFilterTags([]);
              }}
              className="text-slate-600 hover:text-slate-900"
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {/* Sprint Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
              <Target className="w-4 h-4 text-blue-500" />
              Progress
            </div>
            <div className="space-y-2">
              <span className="text-2xl font-bold text-slate-900">{progress}%</span>
              <Progress value={progress} className="h-1.5 bg-slate-100" />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
              <TrendingDown className="w-4 h-4 text-indigo-500" />
              Story Points
            </div>
            <span className="text-2xl font-bold text-slate-900">{completedPoints} <span className="text-slate-400 text-lg font-normal">/ {totalPoints}</span></span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
              <LayoutDashboard className="w-4 h-4 text-emerald-500" />
              Tasks
            </div>
            <span className="text-2xl font-bold text-slate-900">{sprintTasks.length}</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              Blocked
            </div>
            <span className={cn("text-2xl font-bold", blockedTasks > 0 ? "text-red-600" : "text-slate-900")}>
              {blockedTasks}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              Time Remaining
            </div>
            <span className="text-2xl font-bold text-slate-900">
              {daysRemaining !== null ? (
                <>{daysRemaining} <span className="text-slate-400 text-lg font-normal">days</span></>
              ) : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 flex flex-col gap-8 p-6 lg:p-8 pt-4 overflow-y-auto">
        {/* Board View */}
        <div className="w-full">
          {viewMode === 'kanban' ? (
            <SprintKanban
              tasks={sprintTasks}
              onTaskMove={handleTaskMove}
              onRemoveTask={handleRemoveTask}
            />
          ) : (
            <TaskListView
              tasks={sprintTasks}
              users={users}
            />
          )}
        </div>

        {/* Metrics & Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SprintSummary tasks={sprintTasks} sprint={sprint} />
          <BurndownChart sprint={sprint} tasks={sprintTasks} />
        </div>
      </div>

      {/* Add Task Dialog */}
      <AddTaskToSprintDialog
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        backlogTasks={backlogTasks}
        onAssign={handleAssignTask}
        users={users}
        departments={departments}
      />

      {/* Complete Sprint Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Sprint?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to complete this sprint? This action will mark the sprint as completed and calculate the final velocity based on completed story points.
              {sprintTasks.filter(t => t.status !== 'done').length > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
                  <strong>Note:</strong> There are {sprintTasks.filter(t => t.status !== 'done').length} incomplete task(s) in this sprint.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteSprint}>
              Complete Sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move All Tasks to Sprint Dialog */}
      <AlertDialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move All Incomplete Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-4">
                <p>
                  Move all incomplete tasks and their subtasks ({sprintTasks.filter(t => t.status !== 'done').length} tasks, excluding completed) from this sprint to another sprint.
                </p>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-900">Target Sprint</Label>
                  <Select value={targetSprintId} onValueChange={setTargetSprintId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select target sprint" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSprints.filter(s => s.id !== sprintId).map(s => (
                        <SelectItem key={s.id || s._id} value={s.id || s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTargetSprintId('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoveAllToSprint}
              disabled={!targetSprintId}
            >
              Move Tasks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}