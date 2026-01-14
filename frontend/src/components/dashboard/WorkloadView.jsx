import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { LayoutGrid, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const priorityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
};

export default function WorkloadView({ tasks }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Start on Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getTasksForDay = (day) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), day);
    });
  };

  const maxTasksPerDay = Math.max(...weekDays.map(day => getTasksForDay(day).length), 1);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">My Workload</h3>
        </div>
        <Link to={createPageUrl('MyTasks')}>
          <Button variant="ghost" size="sm" className="text-indigo-600 text-xs sm:text-sm">
            <span className="hidden sm:inline">View All</span>
            <ArrowRight className="w-4 h-4 sm:ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((day, i) => {
          const dayTasks = getTasksForDay(day);
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;
          const loadPercentage = (dayTasks.length / maxTasksPerDay) * 100;

          return (
            <div 
              key={i}
              className={cn(
                "text-center p-2 rounded-lg",
                isToday && "bg-indigo-50 ring-1 ring-indigo-200",
                isPast && "opacity-50"
              )}
            >
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase">{format(day, 'EEE')}</p>
              <p className={cn(
                "text-sm sm:text-lg font-semibold",
                isToday ? "text-indigo-600" : "text-slate-900 dark:text-white"
              )}>
                {format(day, 'd')}
              </p>
              
              {/* Task count indicator */}
              <div className="mt-1 sm:mt-2 h-10 sm:h-16 flex flex-col justify-end">
                {dayTasks.length > 0 ? (
                  <div 
                    className="bg-indigo-100 rounded-t transition-all"
                    style={{ height: `${loadPercentage}%`, minHeight: '20%' }}
                  >
                    <span className="text-xs font-medium text-indigo-600">
                      {dayTasks.length}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-300">-</span>
                )}
              </div>

              {/* Priority dots */}
              {dayTasks.length > 0 && (
                <div className="flex justify-center gap-0.5 mt-1">
                  {dayTasks.slice(0, 4).map((task, j) => (
                    <div 
                      key={j}
                      className={cn("w-1.5 h-1.5 rounded-full", priorityColors[task.priority] || 'bg-slate-400')}
                    />
                  ))}
                  {dayTasks.length > 4 && (
                    <span className="text-[10px] text-slate-400">+{dayTasks.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
        {Object.entries(priorityColors).map(([priority, color]) => (
          <div key={priority} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", color)} />
            <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}