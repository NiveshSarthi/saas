import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Video, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ScheduleMeetingDialog from '@/components/meetings/ScheduleMeetingDialog';
import AddExistingTaskDialog from '@/components/projects/AddExistingTaskDialog';

const priorityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

export default function ProjectCalendarView({ tasks, allTasks = [], onTaskUpdate, projectId }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDay = monthStart.getDay();
  const paddingDays = Array(startDay).fill(null);

  const getTasksForDay = (date) => {
    return tasks.filter(task => {
      if (task.due_date && isSameDay(new Date(task.due_date), date)) return true;
      if (task.start_date && isSameDay(new Date(task.start_date), date)) return true;
      return false;
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setCurrentMonth(new Date())}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1 flex-1">
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="bg-slate-50 rounded" />
        ))}
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[80px] p-1 rounded border border-transparent hover:border-slate-200 transition-colors relative group",
                !isSameMonth(day, currentMonth) && "bg-slate-50 text-slate-400",
                isCurrentDay && "bg-indigo-50 border-indigo-200"
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
                        setSelectedDate(day);
                        setShowScheduleDialog(true);
                      }}>
                        <Video className="w-4 h-4 mr-2" />
                        Meeting
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDate(day);
                        setShowTaskDialog(true);
                      }}>
                        <CheckSquare className="w-4 h-4 mr-2" />
                        Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className={cn(
                "text-xs font-medium mb-1",
                isCurrentDay && "text-indigo-600"
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map(task => (
                  <Link
                    key={task.id}
                    to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
                    className="block"
                  >
                    <div className={cn(
                      "text-[10px] px-1 py-0.5 rounded truncate text-white",
                      priorityColors[task.priority] || 'bg-slate-400'
                    )}>
                      {task.title}
                    </div>
                  </Link>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-slate-500 px-1">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        defaultDate={selectedDate}
      />

      <AddExistingTaskDialog
        open={showTaskDialog}
        onClose={() => setShowTaskDialog(false)}
        date={selectedDate}
        tasks={allTasks}
        onAssign={onTaskUpdate}
        projectId={projectId}
      />
    </div>
  );
}