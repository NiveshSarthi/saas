import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  addMonths, 
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth, 
  isSameDay, 
  isToday,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Filter,
  Flag,
  X,
  Video,
  CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CalendarTaskCard from '@/components/calendar/CalendarTaskCard';
import TaskDetailModal from '@/components/calendar/TaskDetailModal';
import ScheduleMeetingDialog from '@/components/meetings/ScheduleMeetingDialog';

const priorityIcons = {
  critical: { color: 'text-red-500', bg: 'bg-red-500' },
  high: { color: 'text-orange-500', bg: 'bg-orange-500' },
  medium: { color: 'text-blue-500', bg: 'bg-blue-500' },
  low: { color: 'text-slate-400', bg: 'bg-slate-400' },
};

const statusColors = {
  backlog: 'bg-slate-400',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  blocked: 'bg-red-500',
};

export default function TaskCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'week'
  const [selectedTask, setSelectedTask] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draggedTask, setDraggedTask] = useState(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedDateForAction, setSelectedDateForAction] = useState(new Date());
  const [filters, setFilters] = useState({
    project: 'all',
    status: 'all',
    priority: 'all',
    group: 'all',
    assignee: 'all'
  });

  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  // Calculate date range based on view
  const getDateRange = () => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        start: startOfWeek(monthStart, { weekStartsOn: 0 }),
        end: endOfWeek(monthEnd, { weekStartsOn: 0 })
      };
    } else {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 })
      };
    }
  };

  const dateRange = getDateRange();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: () => base44.entities.Task.list('-updated_date', 500),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['all-task-groups'],
    queryFn: () => base44.entities.TaskGroup.list(),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    // Admin sees all tasks, regular users see only their assigned/created tasks
    if (user?.role !== 'admin') {
      const isAssigned = task.assignee_email === user?.email || task.assignees?.includes(user?.email);
      const isCreator = task.created_by === user?.email;
      if (!isAssigned && !isCreator) return false;
    }
    
    if (filters.project !== 'all' && task.project_id !== filters.project) return false;
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.group !== 'all') {
      if (filters.group === 'ungrouped' && task.group_id) return false;
      if (filters.group !== 'ungrouped' && task.group_id !== filters.group) return false;
    }
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned' && task.assignee_email) return false;
      if (filters.assignee !== 'unassigned' && task.assignee_email !== filters.assignee) return false;
    }
    return true;
  });

  // Get tasks for a specific date
  const getTasksForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return filteredTasks.filter(task => {
      const startDate = task.start_date ? format(parseISO(task.start_date), 'yyyy-MM-dd') : null;
      const dueDate = task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : null;
      return startDate === dateStr || dueDate === dateStr;
    });
  };

  // Navigation
  const navigatePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  // Generate calendar days
  const generateCalendarDays = () => {
    const days = [];
    let day = dateRange.start;
    while (day <= dateRange.end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, date) => {
    e.preventDefault();
    if (draggedTask) {
      const newDueDate = format(date, 'yyyy-MM-dd');
      updateTaskMutation.mutate({
        id: draggedTask.id,
        data: { due_date: newDueDate }
      });
      setDraggedTask(null);
    }
  };

  const handleCreateTask = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    window.location.href = createPageUrl(`NewTask?due_date=${dateStr}`);
  };

  const getProjectShortName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return '';
    return project.name.substring(0, 3).toUpperCase();
  };

  const getProjectColor = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.color || '#6366F1';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 lg:p-8 pb-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navigatePrev}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              {viewMode === 'month' 
                ? format(currentDate, 'MMMM yyyy')
                : `Week of ${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
              }
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'month' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('month')}
                className="rounded-none"
              >
                <LayoutGrid className="w-4 h-4 mr-2" />
                Month
              </Button>
              <Button
                variant={viewMode === 'week' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('week')}
                className="rounded-none"
              >
                <List className="w-4 h-4 mr-2" />
                Week
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
            </Button>

            <Link to={createPageUrl('NewTask')}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-4 bg-slate-50 rounded-xl">
            <Select value={filters.project} onValueChange={(v) => setFilters(p => ({ ...p, project: v }))}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.status} onValueChange={(v) => setFilters(p => ({ ...p, status: v }))}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="done">Done</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.priority} onValueChange={(v) => setFilters(p => ({ ...p, priority: v }))}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.group} onValueChange={(v) => setFilters(p => ({ ...p, group: v }))}>
              <SelectTrigger className="w-36 bg-white">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="ungrouped">Ungrouped</SelectItem>
                {taskGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.assignee} onValueChange={(v) => setFilters(p => ({ ...p, assignee: v }))}>
              <SelectTrigger className="w-40 bg-white">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setFilters({ project: 'all', status: 'all', priority: 'all', group: 'all', assignee: 'all' })}
            >
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 px-6 lg:px-8 pb-6 overflow-auto">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden h-full">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {weekDays.map(day => (
              <div key={day} className="p-3 text-center text-sm font-medium text-slate-600">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className={cn(
            "grid grid-cols-7",
            viewMode === 'month' ? 'auto-rows-fr' : ''
          )} style={{ minHeight: viewMode === 'week' ? '500px' : 'calc(100% - 44px)', overflow: 'visible' }}>
            {calendarDays.map((day, idx) => {
              const dayTasks = getTasksForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={idx}
                  className={cn(
                    "border-r border-b border-slate-100 p-2 min-h-[120px] transition-colors relative group",
                    !isCurrentMonth && viewMode === 'month' && "bg-slate-50/50",
                    isCurrentDay && "bg-indigo-50/50",
                    draggedTask && "hover:bg-indigo-50"
                  )}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  {/* Add Button (Centered) */}
                  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="pointer-events-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-md bg-white/80 hover:bg-indigo-50 text-indigo-600 border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100">
                            <Plus className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="center">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateForAction(day);
                          setShowScheduleDialog(true);
                        }}>
                          <Video className="w-4 h-4 mr-2" />
                          Meeting
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleCreateTask(day);
                        }}>
                          <CheckSquare className="w-4 h-4 mr-2" />
                          Task
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-sm font-medium",
                      isCurrentDay 
                        ? "bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center"
                        : isCurrentMonth ? "text-slate-900" : "text-slate-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[150px] lg:max-h-[calc(100%-32px)]">
                    {dayTasks.slice(0, viewMode === 'month' ? 3 : 10).map(task => (
                      <CalendarTaskCard
                        key={task.id}
                        task={task}
                        projectShortName={getProjectShortName(task.project_id)}
                        projectColor={getProjectColor(task.project_id)}
                        onClick={() => setSelectedTask(task)}
                        onDragStart={(e) => handleDragStart(e, task)}
                      />
                    ))}
                    {dayTasks.length > (viewMode === 'month' ? 3 : 10) && (
                      <button 
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        onClick={() => {
                          setViewMode('week');
                          setCurrentDate(day);
                        }}
                      >
                        +{dayTasks.length - (viewMode === 'month' ? 3 : 10)} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        project={projects.find(p => p.id === selectedTask?.project_id)}
        onClose={() => setSelectedTask(null)}
      />

      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        defaultDate={selectedDateForAction}
      />
    </div>
  );
}