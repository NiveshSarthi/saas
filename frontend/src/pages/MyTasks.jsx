// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, isPast, isToday, isTomorrow, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Plus,
  LayoutGrid,
  List,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  ArrowUpCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  GripVertical,
  Zap,
  Sparkles,
  TrendingUp,
  Target,
  Flame,
  Filter,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TaskCard from '@/components/tasks/TaskCard';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { MY_TASKS_FILTERS } from '@/components/filters/filterConfigs';

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const statusConfig = {
  backlog: { label: 'Backlog', icon: Circle, color: 'text-slate-400' },
  todo: { label: 'To Do', icon: Circle, color: 'text-blue-500' },
  in_progress: { label: 'In Progress', icon: ArrowUpCircle, color: 'text-amber-500' },
  review: { label: 'Review', icon: Clock, color: 'text-purple-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-500' },
  blocked: { label: 'Blocked', icon: AlertCircle, color: 'text-red-500' },
};

export default function MyTasks() {
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    type: 'all',
    sprint: 'all',
    timeline: 'all' // Linked to activeTab
  });
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);

  const queryClient = useQueryClient();

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

  // Sync timeline filter with activeTab
  useEffect(() => {
    if (activeTab === 'all' && filters.timeline !== 'all') {
      setFilters(prev => ({ ...prev, timeline: 'all' }));
    } else if (activeTab === 'today' && filters.timeline !== 'today') {
      setFilters(prev => ({ ...prev, timeline: 'today' }));
    } else if (activeTab === 'upcoming' && filters.timeline !== 'this_week') {
      // Mapping 'upcoming' roughly to 'this_week' or keeping distinct?
      // TeamTasks has 'this_week', 'today', 'overdue'.
      // MyTasks has 'today', 'tomorrow', 'upcoming', 'overdue', 'closed'.
      // Let's map 'upcoming' to 'this_week' for the dropdown if matches, else handle custom.
      // For now, let's just update the specific matching ones.
      if (filters.timeline !== 'this_week') setFilters(prev => ({ ...prev, timeline: 'this_week' }));
    } else if (activeTab === 'overdue' && filters.timeline !== 'overdue') {
      setFilters(prev => ({ ...prev, timeline: 'overdue' }));
    }
  }, [activeTab]);

  // Sync activeTab when timeline filter changes
  const handleTimelineChange = (value) => {
    setFilters(prev => ({ ...prev, timeline: value }));
    if (value === 'all') setActiveTab('all');
    if (value === 'today') setActiveTab('today');
    if (value === 'overdue') setActiveTab('overdue');
    if (value === 'this_week') setActiveTab('upcoming');
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      // Fetch all tasks
      const allTasks = await base44.entities.Task.list('-updated_date', 1000);

      const today = format(new Date(), 'yyyy-MM-dd');

      // Filter: Keep non-recurring tasks AND only today's recurring instances
      return allTasks.filter(task => {
        // Hide master recurring tasks (they're templates)
        if (task.is_recurring && !task.is_recurring_instance) return false;

        // For recurring instances, only show today's or overdue incomplete ones
        if (task.is_recurring_instance) {
          if (task.status === 'done') return false; // Hide completed instances
          if (!task.instance_date) return true;

          const instanceDate = task.instance_date;
          // Show if instance is for today or overdue
          return instanceDate <= today;
        }

        return true;
      });
    },
    enabled: !!user,
  });

  // Call recurring task generation once on mount
  useEffect(() => {
    const syncTasks = async () => {
      try {
        await base44.functions.invoke('generateRecurringTaskInstances', {});
      } catch (e) {
        console.error('Failed to sync recurring tasks', e);
      }
    };
    if (user) syncTasks();
  }, [user]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['all-sprints'],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'tasks'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'tasks' }),
    enabled: !!user,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });

  const updateTaskOrderMutation = useMutation({
    mutationFn: async ({ id, order }) => {
      await base44.entities.Task.update(id, { order });
    },
  });

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    const reorderedTasks = Array.from(filteredTasks);
    const [movedTask] = reorderedTasks.splice(sourceIndex, 1);
    reorderedTasks.splice(destIndex, 0, movedTask);

    // Update order for affected tasks
    const updates = reorderedTasks.map((task, index) => ({
      id: task.id,
      order: index
    }));

    // Optimistically update cache
    queryClient.setQueryData(['my-tasks'], (oldTasks) => {
      if (!oldTasks) return oldTasks;
      const taskMap = new Map(updates.map(u => [u.id, u.order]));
      return oldTasks.map(t => taskMap.has(t.id) ? { ...t, order: taskMap.get(t.id) } : t);
    });

    // Update in background
    for (const update of updates) {
      updateTaskOrderMutation.mutate(update);
    }
  };

  const myTasks = tasks.filter(t => {
    const userEmail = (user?.email || '').toLowerCase();
    // Show if directly assigned
    if ((t.assignee_email || '').toLowerCase() === userEmail) return true;
    // Show if assignees array includes user
    if (t.assignees && Array.isArray(t.assignees) && t.assignees.some(e => (e || '').toLowerCase() === userEmail)) return true;
    // Show if user created the task and it's unassigned
    if ((t.created_by || '').toLowerCase() === userEmail && !t.assignee_email && (!t.assignees || t.assignees.length === 0)) return true;
    return false;
  });

  const sortedMyTasks = [...myTasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const applyAdvancedFilters = (task) => {
    // Status filter
    if (advancedFilters.status?.length > 0 && !advancedFilters.status.includes(task.status)) {
      return false;
    }
    // Priority filter
    if (advancedFilters.priority?.length > 0 && !advancedFilters.priority.includes(task.priority)) {
      return false;
    }
    // Task type filter
    if (advancedFilters.task_type?.length > 0 && !advancedFilters.task_type.includes(task.task_type)) {
      return false;
    }
    // Assignees filter
    if (advancedFilters.assignees?.length > 0) {
      const taskAssignees = task.assignees || (task.assignee_email ? [task.assignee_email] : []);
      if (!advancedFilters.assignees.some(email => taskAssignees.includes(email))) {
        return false;
      }
    }
    // Created by filter
    if (advancedFilters.created_by?.length > 0 && !advancedFilters.created_by.includes(task.created_by)) {
      return false;
    }
    // Project filter
    if (advancedFilters.project_id && task.project_id !== advancedFilters.project_id) {
      return false;
    }
    // Recurring filter
    if (advancedFilters.is_recurring === 'true' && !task.is_recurring) {
      return false;
    }
    if (advancedFilters.is_recurring === 'false' && task.is_recurring) {
      return false;
    }
    // Date range filter
    if (advancedFilters.date_range) {
      const taskDate = task.due_date || task.created_date;
      if (!taskDate) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const taskDateObj = new Date(taskDate);
      taskDateObj.setHours(0, 0, 0, 0);

      switch (advancedFilters.date_range) {
        case 'today':
          if (taskDateObj.getTime() !== today.getTime()) return false;
          break;
        case 'yesterday':
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          if (taskDateObj.getTime() !== yesterday.getTime()) return false;
          break;
        case 'tomorrow':
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (taskDateObj.getTime() !== tomorrow.getTime()) return false;
          break;
        case 'this_week':
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - today.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          if (taskDateObj < weekStart || taskDateObj > weekEnd) return false;
          break;
        case 'this_month':
          if (taskDateObj.getMonth() !== today.getMonth() || taskDateObj.getFullYear() !== today.getFullYear()) return false;
          break;
        case 'last_7_days':
          const last7 = new Date(today);
          last7.setDate(today.getDate() - 7);
          if (taskDateObj < last7 || taskDateObj > today) return false;
          break;
        case 'last_30_days':
          const last30 = new Date(today);
          last30.setDate(today.getDate() - 30);
          if (taskDateObj < last30 || taskDateObj > today) return false;
          break;
      }
    }
    return true;
  };

  const filteredTasks = sortedMyTasks.filter(task => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(task)) return false;

    // --- Search Filter ---
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!task.title.toLowerCase().includes(searchLower) &&
        !(task.description || '').toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // --- Sprint Filter ---
    if (filters.sprint !== 'all') {
      if (filters.sprint === 'no_sprint' && task.sprint_id) return false;
      if (filters.sprint !== 'no_sprint' && String(task.sprint_id) !== String(filters.sprint)) return false;
    }

    // --- Status Filter ---
    // NOTE: Tabs can also filter by status (e.g. 'closed' tab), so we need to be careful.
    // If explicit status filter is set, it might conflict with Tabs.
    // TeamTasks logic: strict equality.
    if (filters.status !== 'all' && task.status !== filters.status) return false;


    // --- Tab / Timeline Filter Logic ---
    // We treat activeTab as the primary source of truth for the "Base View", 
    // but the dropdowns can refine it or switch it.

    if (activeTab === 'all') {
      // Exclude closed (done) tasks from 'all' tab unless specifically asked via status filter? 
      // Existing logic was: if (task.status === 'done') return false;
      // If user sets Status = 'Completed' in dropdown, they probably want to see them.
      if (filters.status === 'all' && task.status === 'done') return false;
    } else if (activeTab === 'today') {
      if (!task.due_date || !isToday(new Date(task.due_date))) return false;
      // Allow done tasks if status is explicitly set to done, otherwise hide?
      // Existing logic: if (task.status === 'done') return false; 
      if (filters.status !== 'done' && task.status === 'done') return false;
    } else if (activeTab === 'tomorrow') {
      if (!task.due_date || !isTomorrow(new Date(task.due_date))) return false;
      if (filters.status !== 'done' && task.status === 'done') return false;
    } else if (activeTab === 'upcoming') {
      // Logic: !isPast && > today && <= nextWeek
      if (!task.due_date) return false;
      const date = new Date(task.due_date);
      const nextWeek = addDays(new Date(), 7);
      if (isPast(date) || date > nextWeek) return false;
      if (filters.status !== 'done' && task.status === 'done') return false;
    } else if (activeTab === 'overdue') {
      if (!task.due_date || isToday(new Date(task.due_date)) || !isPast(new Date(task.due_date))) return false;
      if (task.status === 'done') return false; // Overdue inherently implies not done
    } else if (activeTab === 'closed') {
      if (task.status !== 'done') return false;
    }

    // --- Type & Priority Filters (from old or advanced) ---
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.type !== 'all' && task.task_type !== filters.type) return false;

    return true;
  });

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: user?.email,
      is_global: user?.role === 'admin'
    });
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
  };

  const handleLoadFilter = (savedFilter) => {
    setAdvancedFilters(savedFilter.filters);
  };

  const handleDeleteFilter = async (filterId) => {
    await base44.entities.SavedFilter.delete(filterId);
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
  };

  const handleRemoveFilter = (field) => {
    setAdvancedFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
  };

  const handleClearAllFilters = () => {
    setAdvancedFilters({});
  };

  const handleTaskSelect = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const getDueDateLabel = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM d');
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const todayTasks = myTasks.filter(t => t.due_date && isToday(new Date(t.due_date)) && t.status !== 'done');
  const tomorrowTasks = myTasks.filter(t => t.due_date && isTomorrow(new Date(t.due_date)) && t.status !== 'done');
  const upcomingTasks = myTasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    const date = new Date(t.due_date);
    const nextWeek = addDays(new Date(), 7);
    return !isPast(date) && date > new Date() && date <= nextWeek && !isToday(date) && !isTomorrow(date);
  });
  const overdueTasks = myTasks.filter(t => t.due_date && t.status !== 'done' && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const completedTasks = myTasks.filter(t => t.status === 'done');
  const inProgressTasks = myTasks.filter(t => t.status === 'in_progress');
  const activeTasks = myTasks.filter(t => t.status !== 'done');
  const completionRate = myTasks.length > 0 ? Math.round((completedTasks.length / myTasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
            <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600 flex-shrink-0" />
            <span className="truncate">My Tasks</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Comprehensive overview of all tasks and workload distribution
          </p>
        </div>
        <Link to={createPageUrl('NewTask')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Task
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
        <div className="bg-indigo-600 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-indigo-100 text-xs sm:text-sm font-medium">Total</span>
            <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200 flex-shrink-0" />
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{myTasks.length}</p>
        </div>

        <div className="bg-orange-500 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-orange-100 text-sm font-medium">In Progress</span>
            <ArrowUpCircle className="w-5 h-5 text-orange-200" />
          </div>
          <p className="text-3xl font-bold text-white">{inProgressTasks.length}</p>
        </div>

        <div className="bg-emerald-500 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-emerald-100 text-sm font-medium">Completed</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          </div>
          <p className="text-3xl font-bold text-white">{completedTasks.length}</p>
          <p className="text-xs text-emerald-100 mt-1">{completionRate}%</p>
        </div>

        <div className="bg-red-500 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-red-100 text-sm font-medium">Overdue</span>
            <Flame className="w-5 h-5 text-red-200" />
          </div>
          <p className="text-3xl font-bold text-white">{overdueTasks.length}</p>
        </div>

        <div className="bg-blue-500 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-100 text-sm font-medium">Due Today</span>
            <CalendarIcon className="w-5 h-5 text-blue-200" />
          </div>
          <p className="text-3xl font-bold text-white">{todayTasks.length}</p>
        </div>

        <div className="bg-purple-500 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-purple-100 text-sm font-medium">Assigned</span>
            <Target className="w-5 h-5 text-purple-200" />
          </div>
          <p className="text-3xl font-bold text-white">{myTasks.length}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 p-5 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200/50 shadow-lg">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            className="pl-9 bg-white"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <Button variant="outline" onClick={() => setShowAdvancedFilter(true)} className="whitespace-nowrap">
          <Filter className="w-4 h-4 mr-2" />
          Advanced Filters
        </Button>

        <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
          <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
            <SelectTrigger className="w-[140px] bg-white min-w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.timeline} onValueChange={handleTimelineChange}>
            <SelectTrigger className="w-[140px] bg-white min-w-[140px]">
              <SelectValue placeholder="Timeline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.sprint} onValueChange={(v) => setFilters(prev => ({ ...prev, sprint: v }))}>
            <SelectTrigger className="w-[140px] bg-white min-w-[140px]">
              <SelectValue placeholder="Sprint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sprints</SelectItem>
              <SelectItem value="no_sprint">No Sprint</SelectItem>
              {sprints.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 lg:ml-auto border-l pl-4 border-slate-200">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <TabsList className="bg-white border border-slate-200 shadow-sm">
            <TabsTrigger value="all">
              All ({activeTasks.length})
            </TabsTrigger>
            <TabsTrigger value="today">
              Today ({todayTasks.length})
            </TabsTrigger>
            <TabsTrigger value="tomorrow">
              Tomorrow ({tomorrowTasks.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming ({upcomingTasks.length})
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue ({overdueTasks.length})
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed ({completedTasks.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content */}
        <TabsContent value={activeTab} className="mt-0">
          {/* Filter Chips */}
          {Object.keys(advancedFilters).length > 0 && (
            <div className="mt-4">
              <FilterChips
                filters={advancedFilters}
                onRemoveFilter={handleRemoveFilter}
                onClearAll={handleClearAllFilters}
                moduleConfig={MY_TASKS_FILTERS}
              />
            </div>
          )}

          {/* Task List */}
          <div className="mt-6">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                  <CheckCircle2 className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {activeTab === 'overdue' ? 'All Caught Up!' : 'No tasks found'}
                </h3>
                <p className="text-slate-500 mb-6 max-w-md mx-auto text-sm">
                  {activeTab === 'overdue'
                    ? "You have no overdue tasks."
                    : "Create a new task to get started"}
                </p>
                <Link to={createPageUrl('NewTask')}>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Task
                  </Button>
                </Link>
              </div>
            ) : viewMode === 'list' ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="tasks">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden"
                    >
                      {filteredTasks.map((task, index) => {
                        const StatusIcon = statusConfig[task.status]?.icon || Circle;
                        const dueLabel = getDueDateLabel(task.due_date);
                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done';
                        const taskSprint = sprints.find(s => s.id === task.sprint_id);

                        return (
                          <Draggable key={task.id || task._id} draggableId={task.id || task._id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "flex items-center gap-4 p-4 hover:bg-slate-50 transition-all group",
                                  snapshot.isDragging && "shadow-xl rounded-lg border-2 border-indigo-300 bg-white"
                                )}
                              >
                                <div
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <Checkbox
                                  checked={selectedTasks.includes(task.id)}
                                  onCheckedChange={() => handleTaskSelect(task.id)}
                                  className="flex-shrink-0"
                                />

                                <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)} className="flex-1 min-w-0">
                                  <span className={cn(
                                    "font-medium text-slate-900 truncate group-hover:text-indigo-600 transition-colors",
                                    task.status === 'done' && "line-through text-slate-500"
                                  )}>
                                    {task.title}
                                  </span>
                                </Link>

                                <div className="hidden md:flex items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      task.priority === 'critical' && "border-red-200 bg-red-50 text-red-700",
                                      task.priority === 'high' && "border-orange-200 bg-orange-50 text-orange-700",
                                      task.priority === 'medium' && "border-blue-200 bg-blue-50 text-blue-700",
                                      task.priority === 'low' && "border-slate-200 bg-slate-50 text-slate-700"
                                    )}
                                  >
                                    {task.priority}
                                  </Badge>

                                  {taskSprint && (
                                    <Badge variant="outline" className="text-xs border-purple-200 bg-purple-50 text-purple-700">
                                      <Zap className="w-3 h-3 mr-1" />
                                      {taskSprint.name}
                                    </Badge>
                                  )}

                                  {dueLabel && (
                                    <div className={cn(
                                      "text-xs flex items-center gap-1 px-2 py-1 rounded font-medium",
                                      isOverdue ? "bg-red-50 text-red-700" :
                                        dueLabel === 'Today' ? "bg-blue-50 text-blue-700" :
                                          "bg-slate-100 text-slate-600"
                                    )}>
                                      {isOverdue ? <Flame className="w-3 h-3" /> : <CalendarIcon className="w-3 h-3" />}
                                      {dueLabel}
                                    </div>
                                  )}
                                </div>

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}>
                                        <Eye className="w-4 h-4 mr-2" />
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                      <Link to={createPageUrl(`EditTask?id=${task.id}`)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Edit
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600"
                                      onClick={() => deleteTaskMutation.mutate(task.id)}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredTasks.map((task) => (
                  <TaskCard key={task.id || task._id} task={task} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        filters={advancedFilters}
        onApplyFilters={setAdvancedFilters}
        moduleConfig={MY_TASKS_FILTERS}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />
    </div>
  );
}