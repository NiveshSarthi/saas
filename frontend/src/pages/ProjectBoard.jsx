import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Plus,
  Settings,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  BarChart3,
  Users,
  MoreHorizontal,
  Filter,
  ChevronDown,
  ArrowLeft,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import KanbanBoard from '@/components/projects/KanbanBoard';
import TaskFilters from '@/components/tasks/TaskFilters';
import TaskCard from '@/components/tasks/TaskCard';
import TaskGroupManager from '@/components/tasks/TaskGroupManager';
import ProjectCalendarView from '@/components/projects/ProjectCalendarView';

export default function ProjectBoard() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('board');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    type: 'all',
    assignee: 'all',
    group: 'all'
  });

  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const project = await base44.entities.Project.get(projectId);
      return project;
    },
    enabled: !!projectId && projectId !== 'undefined',
  });

  const { data: rawTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      // Generate recurring instances
      await base44.functions.invoke('generateRecurringTaskInstances', {});

      const allTasks = await base44.entities.Task.filter({ project_id: projectId }, '-updated_date', 1000);

      const today = format(new Date(), 'yyyy-MM-dd');

      // Filter out master recurring tasks and future recurring instances
      return allTasks.filter(task => {
        if (task.is_recurring && !task.is_recurring_instance) return false;

        // For recurring instances, only show today's or overdue incomplete ones
        if (task.is_recurring_instance) {
          if (task.status === 'done') return false;
          if (!task.instance_date) return true;
          return task.instance_date <= today;
        }

        return true;
      });
    },
    enabled: !!projectId && projectId !== 'undefined',
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-board'],
    queryFn: () => base44.auth.me(),
  });

  const tasks = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return rawTasks;
    return rawTasks.filter(t =>
      t.reporter_email === currentUser.email ||
      t.assignee_email === currentUser.email ||
      (t.assignees && t.assignees.includes(currentUser.email))
    );
  }, [rawTasks, currentUser]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['task-groups', projectId],
    queryFn: () => base44.entities.TaskGroup.filter({ project_id: projectId }, 'order'),
    enabled: !!projectId && projectId !== 'undefined',
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
  });

  const handleTaskMove = (taskId, updates) => {
    updateTaskMutation.mutate({ id: taskId, data: updates });
  };

  const handleAddTask = (status) => {
    navigate(createPageUrl(`NewTask?project=${projectId}&status=${status}`), { state: { returnPath: `ProjectBoard?id=${projectId}` } });
  };

  // Apply filters
  const filteredTasks = tasks.filter(task => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!task.title.toLowerCase().includes(searchLower) &&
        !(task.description || '').toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.type !== 'all' && task.task_type !== filters.type) return false;
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned' && task.assignee_email) return false;
      if (filters.assignee !== 'unassigned' && task.assignee_email !== filters.assignee) return false;
    }
    if (filters.group !== 'all') {
      if (filters.group === 'ungrouped' && task.group_id) return false;
      if (filters.group !== 'ungrouped' && task.group_id !== filters.group) return false;
    }
    return true;
  });

  // Get workflow states from project or use defaults
  const workflowStates = project?.workflow_states || ['backlog', 'todo', 'in_progress', 'review', 'done'];
  const columns = workflowStates.map(state => ({
    id: state,
    title: state.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    color: {
      backlog: 'bg-slate-400',
      todo: 'bg-blue-500',
      in_progress: 'bg-amber-500',
      review: 'bg-purple-500',
      done: 'bg-emerald-500',
      blocked: 'bg-red-500'
    }[state] || 'bg-slate-400'
  }));

  // Calculate stats
  const stats = {
    total: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length
  };

  const isLoading = projectLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-80 flex-shrink-0 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Project not found</h2>
        <Link to={createPageUrl('Projects')}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 lg:p-8 pb-0 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to={createPageUrl('Projects')}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${project.color || '#6366F1'}20` }}
              >
                <LayoutGrid className="w-6 h-6" style={{ color: project.color || '#6366F1' }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="outline" className="capitalize">{project.domain}</Badge>
                  <span className="text-sm text-slate-500">{stats.total} tasks</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Team avatars */}
            <div className="hidden md:flex -space-x-2">
              {(project.members || []).slice(0, 4).map((email, i) => {
                const user = users.find(u => u.email === email);
                const initials = user?.full_name
                  ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                  : email.slice(0, 2).toUpperCase();

                return (
                  <Avatar key={i} className="w-8 h-8 border-2 border-white" title={user?.full_name || email}>
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {(project.members || []).length > 4 && (
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs text-slate-600">
                  +{project.members.length - 4}
                </div>
              )}
            </div>

            <Link to={createPageUrl(`Sprints?project=${projectId}`)}>
              <Button variant="outline">
                <Zap className="w-4 h-4 mr-2" />
                Sprints
              </Button>
            </Link>

            <Link to={createPageUrl(`NewTask?project=${projectId}`)}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Task
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => window.location.href = createPageUrl(`Settings?tab=projects&project=${projectId}`)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Project Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = createPageUrl(`Team?project=${projectId}`)}>
                  <Users className="w-4 h-4 mr-2" />
                  Manage Team
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = createPageUrl(`Reports?project=${projectId}`)}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Reports
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600">Done: {stats.done}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-slate-600">In Progress: {stats.inProgress}</span>
          </div>
          {stats.blocked > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-red-600 font-medium">Blocked: {stats.blocked}</span>
            </div>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Progress:</span>
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }}
              />
            </div>
            <span className="text-slate-600">{stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%</span>
          </div>
        </div>

        {/* View Toggle and Filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'board' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Board
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4 mr-2" />
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-indigo-50 border-indigo-200' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            <ChevronDown className={cn("w-4 h-4 ml-2 transition-transform", showFilters && "rotate-180")} />
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="pt-4">
            <TaskFilters
              filters={filters}
              onFilterChange={setFilters}
              users={users}
            />
          </div>
        )}
      </div>

      {/* Board Content */}
      <div className="flex-1 flex gap-6 p-6 lg:p-8 pt-4 min-h-0 overflow-hidden">
        {/* Task Groups Sidebar */}
        <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-slate-200 p-4 overflow-y-auto hidden lg:block">
          <h4 className="font-medium text-slate-900 mb-3 text-sm">Categories</h4>
          <TaskGroupManager
            projectId={projectId}
            groups={taskGroups}
            tasks={tasks}
            onSelectGroup={(groupId) => setFilters(prev => ({
              ...prev,
              group: groupId === null ? 'all' : groupId || 'ungrouped'
            }))}
          />
        </div>

        <div className="flex-1 h-full min-h-0 overflow-hidden relative">
          {viewMode === 'board' && (
            <KanbanBoard
              tasks={filteredTasks}
              columns={columns}
              onTaskMove={handleTaskMove}
              onAddTask={handleAddTask}
              users={users}
              className="h-full"
              returnPath={`ProjectBoard?id=${projectId}`}
            />
          )}

          {viewMode === 'list' && (
            <div className="h-full overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} returnPath={`ProjectBoard?id=${projectId}`} />
              ))}
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="h-full overflow-y-auto">
              <ProjectCalendarView
                tasks={filteredTasks}
                allTasks={tasks}
                onTaskUpdate={handleTaskMove}
                projectId={projectId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}