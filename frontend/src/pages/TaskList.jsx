import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, isToday, isTomorrow, isThisWeek, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  Grid3x3,
  List,
  Calendar,
  Flame,
  Sparkles,
  X,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp,
  Users,
  FolderKanban,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaskDetailModal from '@/components/calendar/TaskDetailModal';
import TaskListCard from '@/components/tasks/TaskListCard';
import TaskListTable from '@/components/tasks/TaskListTable';
import TaskListTimeline from '@/components/tasks/TaskListTimeline';
import TaskListFilters from '@/components/tasks/TaskListFilters';

export default function TaskList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // cards, table, timeline
  const [groupBy, setGroupBy] = useState('none'); // none, status, priority, project, due_date
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('updated_date');
  const [filters, setFilters] = useState({
    project: 'all',
    status: 'all',
    priority: 'all',
    type: 'all',
    assignee: 'all',
    sprint: 'all',
  });

  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-list'],
    queryFn: () => base44.auth.me(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks'] });
    },
  });

  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: async () => {
      await base44.functions.invoke('generateRecurringTaskInstances', {});
      const allTasks = await base44.entities.Task.list('-updated_date', 500);
      const today = format(new Date(), 'yyyy-MM-dd');
      return allTasks.filter(task => {
        if (task.is_recurring && !task.is_recurring_instance) return false;
        if (task.is_recurring_instance) {
          if (task.status === 'done') return false;
          if (!task.instance_date) return true;
          return task.instance_date <= today;
        }
        return true;
      });
    },
  });

  const tasks = useMemo(() => {
    if (!currentUser) return [];
    const isAdmin = currentUser.role === 'admin' || currentUser.role_id === 'super_admin' || currentUser.role_id === 'admin';
    if (isAdmin) return rawTasks;
    return rawTasks.filter(t =>
      t.reporter_email === currentUser.email ||
      t.assignee_email === currentUser.email ||
      (t.assignees && t.assignees.includes(currentUser.email))
    );
  }, [rawTasks, currentUser]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['all-sprints'],
    queryFn: () => base44.entities.Sprint.list(),
  });

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      if (search) {
        const searchLower = search.toLowerCase();
        if (!task.title.toLowerCase().includes(searchLower) &&
          !(task.description || '').toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      if (filters.project !== 'all' && task.project_id !== filters.project) return false;
      if (filters.status !== 'all' && task.status !== filters.status) return false;
      if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
      if (filters.type !== 'all' && task.task_type !== filters.type) return false;
      if (filters.assignee !== 'all' && task.assignee_email !== filters.assignee) return false;
      if (filters.sprint !== 'all') {
        if (filters.sprint === 'no_sprint' && task.sprint_id) return false;
        if (filters.sprint !== 'no_sprint' && task.sprint_id !== filters.sprint) return false;
      }
      return true;
    });
  }, [tasks, search, filters]);

  // Sort tasks
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
        case 'due_date':
          return (a.due_date || '9999') > (b.due_date || '9999') ? 1 : -1;
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        default:
          return (b.updated_date || '') > (a.updated_date || '') ? 1 : -1;
      }
    });
    return sorted;
  }, [filteredTasks, sortBy]);

  // Group tasks
  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Tasks': sortedTasks };
    }

    const groups = {};

    sortedTasks.forEach(task => {
      let groupKey;

      switch (groupBy) {
        case 'status':
          groupKey = task.status || 'no_status';
          break;
        case 'priority':
          groupKey = task.priority || 'no_priority';
          break;
        case 'project':
          groupKey = projects.find(p => p.id === task.project_id)?.name || 'No Project';
          break;
        case 'due_date':
          if (!task.due_date) {
            groupKey = 'No Due Date';
          } else {
            const dueDate = new Date(task.due_date);
            if (isPast(dueDate) && !isToday(dueDate)) {
              groupKey = 'Overdue';
            } else if (isToday(dueDate)) {
              groupKey = 'Today';
            } else if (isTomorrow(dueDate)) {
              groupKey = 'Tomorrow';
            } else if (isThisWeek(dueDate)) {
              groupKey = 'This Week';
            } else {
              groupKey = 'Later';
            }
          }
          break;
        default:
          groupKey = 'All Tasks';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });

    return groups;
  }, [sortedTasks, groupBy, projects]);

  // Quick stats
  const stats = useMemo(() => {
    const overdue = filteredTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && t.status !== 'done').length;
    const dueToday = filteredTasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'done').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const highPriority = filteredTasks.filter(t => (t.priority === 'high' || t.priority === 'critical') && t.status !== 'done').length;

    return { overdue, dueToday, inProgress, highPriority };
  }, [filteredTasks]);

  const clearFilters = () => {
    setFilters({
      project: 'all',
      status: 'all',
      priority: 'all',
      type: 'all',
      assignee: 'all',
      sprint: 'all',
    });
    setSearch('');
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length + (search ? 1 : 0);

  const handleReorder = (reorderedTasks) => {
    // Update task order in backend
    reorderedTasks.forEach((task, index) => {
      if (task.order !== index) {
        updateTaskMutation.mutate({ id: task.id, data: { order: index } });
      }
    });
  };

  const handleTaskClick = (task) => {
    navigate(createPageUrl(`TaskDetail?id=${task.id || task._id}`), { state: { returnPath: 'TaskList' } });
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="p-4 sm:p-6 lg:p-8 pb-4 space-y-4">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Task List
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {sortedTasks.length} {sortedTasks.length === 1 ? 'task' : 'tasks'}
              {filteredTasks.length !== tasks.length && ` (${filteredTasks.length} shown)`}
            </p>
          </div>

          {/* View Mode Switcher */}
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="table" className="flex items-center gap-1.5">
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </TabsTrigger>
              <TabsTrigger value="cards" className="flex items-center gap-1.5">
                <Grid3x3 className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Timeline</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-4 border border-red-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Flame className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                <p className="text-xs text-slate-600">Overdue</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 border border-amber-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.dueToday}</p>
                <p className="text-xs text-slate-600">Due Today</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 border border-blue-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                <p className="text-xs text-slate-600">In Progress</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-4 border border-purple-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{stats.highPriority}</p>
                <p className="text-xs text-slate-600">High Priority</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Search and Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search tasks by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white border-slate-200 focus:border-indigo-300 focus:ring-indigo-200"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "bg-white border-slate-200",
              showFilters && "bg-indigo-50 border-indigo-300 text-indigo-700"
            )}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-2 bg-indigo-600 text-white">{activeFilterCount}</Badge>
            )}
          </Button>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="updated_date">Recently Updated</option>
              <option value="priority">Priority</option>
              <option value="due_date">Due Date</option>
              <option value="title">Title</option>
            </select>

            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="none">No Grouping</option>
              <option value="status">Group by Status</option>
              <option value="priority">Group by Priority</option>
              <option value="project">Group by Project</option>
              <option value="due_date">Group by Due Date</option>
            </select>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <TaskListFilters
              filters={filters}
              setFilters={setFilters}
              projects={projects}
              users={users}
              sprints={sprints}
              onClear={clearFilters}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Content Area */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-6 overflow-auto">
        {viewMode === 'cards' && (
          <div className="space-y-6">
            {Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
              <motion.div
                key={groupName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{groupName}</h3>
                    <Badge variant="secondary">{groupTasks.length}</Badge>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupTasks.map((task) => (
                    <TaskListCard
                      key={task.id || task._id}
                      task={task}
                      projects={projects}
                      users={users}
                      onClick={() => handleTaskClick(task)}
                    />
                  ))}
                </div>
              </motion.div>
            ))}
            {sortedTasks.length === 0 && (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500">No tasks found</p>
                {activeFilterCount > 0 && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {viewMode === 'table' && (
          <TaskListTable
            tasks={sortedTasks}
            projects={projects}
            users={users}
            onTaskClick={handleTaskClick}
            onReorder={handleReorder}
          />
        )}

        {viewMode === 'timeline' && (
          <TaskListTimeline
            groupedTasks={groupedTasks}
            projects={projects}
            onTaskClick={handleTaskClick}
          />
        )}
      </div>
    </div>
  );
}