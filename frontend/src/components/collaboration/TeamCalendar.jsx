import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  Milestone,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export default function TeamCalendar({ user, onTaskClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('all'); // all, tasks, meetings, milestones

  const { data: tasks = [] } = useQuery({
    queryKey: ['team-calendar-tasks'],
    queryFn: () => base44.entities.Task.list('-created_date', 500),
  });

  const { data: meetings = [] } = useQuery({
    queryKey: ['team-calendar-meetings'],
    queryFn: () => base44.entities.Meeting.list('-start_date', 200),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['team-calendar-projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['team-calendar-users'],
    queryFn: () => base44.entities.User.list(),
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get events for a specific day
  const getEventsForDay = (day) => {
    const events = [];
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);

    // Tasks with due dates
    tasks.forEach(task => {
      if (task.due_date) {
        const dueDate = parseISO(task.due_date);
        if (isSameDay(dueDate, day)) {
          events.push({
            type: 'task',
            data: task,
            priority: task.priority,
            title: task.title,
            status: task.status
          });
        }
      }
    });

    // Meetings
    meetings.forEach(meeting => {
      if (meeting.start_date) {
        const meetingStart = parseISO(meeting.start_date);
        if (isSameDay(meetingStart, day)) {
          events.push({
            type: 'meeting',
            data: meeting,
            title: meeting.title,
            participants: meeting.participants?.length || 0
          });
        }
      }
    });

    // Project milestones (start/end dates)
    projects.forEach(project => {
      if (project.start_date && isSameDay(parseISO(project.start_date), day)) {
        events.push({
          type: 'milestone',
          subtype: 'start',
          data: project,
          title: `${project.name} starts`,
        });
      }
      if (project.end_date && isSameDay(parseISO(project.end_date), day)) {
        events.push({
          type: 'milestone',
          subtype: 'end',
          data: project,
          title: `${project.name} ends`,
        });
      }
    });

    return events;
  };

  // Filter events by view
  const filterEventsByView = (events) => {
    if (view === 'all') return events;
    if (view === 'tasks') return events.filter(e => e.type === 'task');
    if (view === 'meetings') return events.filter(e => e.type === 'meeting');
    if (view === 'milestones') return events.filter(e => e.type === 'milestone');
    return events;
  };

  // Get team availability summary
  const getTeamAvailability = (day) => {
    const dayTasks = tasks.filter(t => 
      t.due_date && isSameDay(parseISO(t.due_date), day) && t.status !== 'done'
    );
    
    const busyUsers = new Set(dayTasks.map(t => t.assignee_email).filter(Boolean));
    return {
      busy: busyUsers.size,
      available: users.length - busyUsers.size,
      total: users.length
    };
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  // Summary stats
  const monthStats = useMemo(() => {
    const monthTasks = tasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = parseISO(t.due_date);
      return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
    });

    const monthMeetings = meetings.filter(m => {
      if (!m.start_date) return false;
      const startDate = parseISO(m.start_date);
      return isWithinInterval(startDate, { start: monthStart, end: monthEnd });
    });

    return {
      tasks: monthTasks.length,
      meetings: monthMeetings.length,
      completed: monthTasks.filter(t => t.status === 'done').length,
      overdue: monthTasks.filter(t => t.status !== 'done' && parseISO(t.due_date) < new Date()).length,
    };
  }, [tasks, meetings, monthStart, monthEnd]);

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Team Calendar</h2>
          <p className="text-slate-500 mt-1">Shared timeline for milestones and team availability</p>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
              <TabsTrigger value="meetings" className="text-xs">Meetings</TabsTrigger>
              <TabsTrigger value="milestones" className="text-xs">Milestones</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{monthStats.tasks}</p>
                <p className="text-xs text-slate-500">Tasks Due</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{monthStats.meetings}</p>
                <p className="text-xs text-slate-500">Meetings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{monthStats.completed}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{monthStats.overdue}</p>
                <p className="text-xs text-slate-500">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-indigo-600" />
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, idx) => {
              const events = getEventsForDay(day);
              const filteredEvents = filterEventsByView(events);
              const isToday = isSameDay(day, new Date());
              const availability = getTeamAvailability(day);

              return (
                <HoverCard key={idx}>
                  <HoverCardTrigger asChild>
                    <div
                      className={cn(
                        "min-h-[100px] p-2 border rounded-lg transition-all cursor-pointer hover:shadow-md",
                        isToday ? "bg-indigo-50 border-indigo-300" : "bg-white border-slate-200",
                        !isSameMonth(day, currentDate) && "opacity-40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn(
                          "text-sm font-medium",
                          isToday ? "text-indigo-600" : "text-slate-700"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {filteredEvents.length > 0 && (
                          <Badge variant="secondary" className="text-xs h-5 px-1.5">
                            {filteredEvents.length}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1">
                        {filteredEvents.slice(0, 2).map((event, i) => (
                          <div
                            key={i}
                            className={cn(
                              "text-xs p-1 rounded truncate",
                              event.type === 'task' && "bg-blue-100 text-blue-700",
                              event.type === 'meeting' && "bg-purple-100 text-purple-700",
                              event.type === 'milestone' && "bg-orange-100 text-orange-700"
                            )}
                            onClick={() => event.type === 'task' && onTaskClick?.(event.data)}
                          >
                            {event.title}
                          </div>
                        ))}
                        {filteredEvents.length > 2 && (
                          <div className="text-xs text-slate-500 pl-1">
                            +{filteredEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80">
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-slate-900 mb-1">
                          {format(day, 'EEEE, MMMM d, yyyy')}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users className="w-4 h-4" />
                          <span>
                            {availability.available} of {availability.total} team members available
                          </span>
                        </div>
                      </div>

                      {filteredEvents.length > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          {filteredEvents.map((event, i) => (
                            <div key={i} className="flex items-start gap-2">
                              {event.type === 'task' && <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />}
                              {event.type === 'meeting' && <Users className="w-4 h-4 text-purple-600 mt-0.5" />}
                              {event.type === 'milestone' && <Milestone className="w-4 h-4 text-orange-600 mt-0.5" />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900">{event.title}</p>
                                {event.type === 'task' && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs">
                                      {event.status}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {event.priority}
                                    </Badge>
                                  </div>
                                )}
                                {event.type === 'meeting' && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    {event.participants} participants
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100" />
          <span className="text-slate-600">Tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-100" />
          <span className="text-slate-600">Meetings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-100" />
          <span className="text-slate-600">Milestones</span>
        </div>
      </div>
    </div>
  );
}