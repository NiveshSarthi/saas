import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
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
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addWeeks,
  subWeeks,
  startOfDay
} from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Video,
  LayoutGrid,
  List,
  Filter,
  Eye,
  EyeOff,
  CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import CalendarEventCard from '@/components/calendar/CalendarEventCard';
import DayDetailPanel from '@/components/calendar/DayDetailPanel';
import ScheduleMeetingDialog from '@/components/meetings/ScheduleMeetingDialog';

const priorityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [user, setUser] = useState(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [showCompleted, setShowCompleted] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState(['critical', 'high', 'medium', 'low']);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: () => base44.entities.Task.list('-due_date', 500),
    enabled: !!user,
  });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['calendar-meetings'],
    queryFn: () => base44.entities.Meeting.list('-start_date', 500),
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['calendar-projects'],
    queryFn: () => base44.entities.Project.list(),
    enabled: !!user,
  });

  const isLoading = tasksLoading || meetingsLoading;

  const myTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    
    // Admin sees all tasks
    if (user?.role === 'admin') {
      if (!showCompleted && t.status === 'done') return false;
      if (!priorityFilter.includes(t.priority)) return false;
      return true;
    }
    
    // Regular users see only their assigned or created tasks
    const isAssigned = t.assignee_email === user?.email || t.assignees?.includes(user?.email);
    const isCreator = t.created_by === user?.email;
    if (!isAssigned && !isCreator) return false;
    if (!showCompleted && t.status === 'done') return false;
    if (!priorityFilter.includes(t.priority)) return false;
    return true;
  });

  const myMeetings = meetings.filter(m => 
    (m.participants?.includes(user?.email) || m.created_by === user?.email) &&
    m.status !== 'cancelled'
  );

  const getTasksForDate = (date) => {
    if (!showTasks) return [];
    return myTasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(parseISO(task.due_date), date);
    });
  };

  const getMeetingsForDate = (date) => {
    if (!showMeetings) return [];
    return myMeetings.filter(meeting => {
      if (!meeting.start_date) return false;
      return isSameDay(parseISO(meeting.start_date), date);
    });
  };

  const getProjectInfo = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? { name: project.name, color: project.color } : null;
  };

  // Calculate tasks/meetings count per day for mini calendar
  const getCountsForDate = () => {
    const tasksCount = {};
    const meetingsCount = {};
    
    myTasks.forEach(t => {
      if (t.due_date) {
        const key = format(parseISO(t.due_date), 'yyyy-MM-dd');
        tasksCount[key] = (tasksCount[key] || 0) + 1;
      }
    });
    
    myMeetings.forEach(m => {
      if (m.start_date) {
        const key = format(parseISO(m.start_date), 'yyyy-MM-dd');
        meetingsCount[key] = (meetingsCount[key] || 0) + 1;
      }
    });
    
    return { tasksCount, meetingsCount };
  };

  const { tasksCount, meetingsCount } = getCountsForDate();

  const navigateMonth = (direction) => {
    if (viewMode === 'month') {
      setCurrentMonth(direction > 0 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1));
    } else {
      setCurrentMonth(direction > 0 ? addWeeks(currentMonth, 1) : subWeeks(currentMonth, 1));
    }
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700">
        {days.map(day => (
          <div key={day} className="text-center py-3 text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = viewMode === 'week' ? addDays(startOfWeek(currentMonth), 6) : endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = viewMode === 'week' ? startOfWeek(currentMonth) : startDate;
    const end = viewMode === 'week' ? addDays(startOfWeek(currentMonth), 6) : endDate;

    while (day <= end) {
      for (let i = 0; i < 7 && day <= end; i++) {
        const currentDay = day;
        const dayTasks = getTasksForDate(currentDay);
        const dayMeetings = getMeetingsForDate(currentDay);
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isSelected = selectedDate && isSameDay(currentDay, selectedDate);
        const isTodayDate = isToday(currentDay);
        const totalItems = dayTasks.length + dayMeetings.length;

        days.push(
          <div
            key={currentDay.toString()}
            onClick={() => setSelectedDate(currentDay)}
            className={cn(
              "min-h-[100px] sm:min-h-[120px] lg:min-h-[140px] p-1 sm:p-2 border-b border-r border-slate-100 dark:border-slate-700 cursor-pointer transition-all group relative",
              !isCurrentMonth && "bg-slate-50/50 dark:bg-slate-800/50",
              isSelected && "bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500 ring-inset",
              !isSelected && "hover:bg-slate-50 dark:hover:bg-slate-800"
            )}
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
                    setSelectedDate(currentDay);
                    setShowScheduleDialog(true);
                  }}>
                    <Video className="w-4 h-4 mr-2" />
                    Meeting
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = createPageUrl('NewTask');
                  }}>
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

            {/* Date Number */}
            <div className="flex items-center justify-between mb-1">
              <div className={cn(
                "w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-xs sm:text-sm font-medium",
                isTodayDate && "bg-indigo-600 text-white",
                !isTodayDate && isCurrentMonth && "text-slate-900 dark:text-white",
                !isTodayDate && !isCurrentMonth && "text-slate-400 dark:text-slate-500"
              )}>
                {format(currentDay, 'd')}
              </div>
              {totalItems > 0 && (
                <div className="flex gap-0.5">
                  {dayMeetings.length > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  )}
                  {dayTasks.length > 0 && (
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  )}
                </div>
              )}
            </div>
            
            {/* Events */}
            <div className="space-y-0.5 sm:space-y-1">
              {/* Meetings */}
              {dayMeetings.slice(0, viewMode === 'week' ? 4 : 2).map((meeting) => (
                <CalendarEventCard key={meeting.id} event={meeting} type="meeting" />
              ))}
              
              {/* Tasks */}
              {dayTasks.slice(0, dayMeetings.length > 0 ? (viewMode === 'week' ? 2 : 1) : (viewMode === 'week' ? 4 : 3)).map((task) => (
                <CalendarEventCard key={task.id} event={task} type="task" />
              ))}

              {/* More indicator */}
              {totalItems > (viewMode === 'week' ? 5 : 3) && (
                <div className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 pl-1 font-medium">
                  +{totalItems - (viewMode === 'week' ? 5 : 3)} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }
    return <div className="border-t border-l border-slate-100 dark:border-slate-700">{rows}</div>;
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-[600px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Calendar</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {myTasks.length} tasks · {myMeetings.length} meetings scheduled
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* View Toggle */}
          <div className="flex bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1">
            <Button
              variant={viewMode === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
              className="text-xs"
            >
              <LayoutGrid className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Month</span>
            </Button>
            <Button
              variant={viewMode === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
              className="text-xs"
            >
              <List className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Week</span>
            </Button>
          </div>

          {/* Filters */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Show/Hide</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={showTasks}
                onCheckedChange={setShowTasks}
              >
                Tasks
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showMeetings}
                onCheckedChange={setShowMeetings}
              >
                Meetings
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showCompleted}
                onCheckedChange={setShowCompleted}
              >
                Completed Tasks
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priority</DropdownMenuLabel>
              {['critical', 'high', 'medium', 'low'].map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={priorityFilter.includes(p)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setPriorityFilter([...priorityFilter, p]);
                    } else {
                      setPriorityFilter(priorityFilter.filter(x => x !== p));
                    }
                  }}
                >
                  <div className={cn("w-2 h-2 rounded-full mr-2", priorityColors[p])} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={() => setShowScheduleDialog(true)}>
            <Video className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Meeting</span>
          </Button>
          <Link to={createPageUrl('NewTask')}>
            <Button className="bg-indigo-600 hover:bg-indigo-700" size="sm">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Task</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {viewMode === 'week' 
                  ? `Week of ${format(startOfWeek(currentMonth), 'MMM d, yyyy')}`
                  : format(currentMonth, 'MMMM yyyy')
                }
              </h2>
              <div className="flex gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="text-xs sm:text-sm"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            {renderDays()}
            {renderCells()}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              Meetings
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Critical
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              High
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Medium
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              Low
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
          <DayDetailPanel
            date={selectedDate}
            tasks={getTasksForDate(selectedDate)}
            meetings={getMeetingsForDate(selectedDate)}
            onClose={() => setSelectedDate(null)}
            onScheduleMeeting={() => setShowScheduleDialog(true)}
          />
        </div>
      </div>

      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        defaultDate={selectedDate}
      />
    </div>
  );
}