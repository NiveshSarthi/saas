import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CalendarSidebar({ 
  currentMonth, 
  onMonthChange, 
  selectedDate, 
  onDateSelect,
  tasksCount = {},
  meetingsCount = {}
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = [];
  let day = startDate;
  while (day <= endDate) {
    days.push(day);
    day = addDays(day, 1);
  }

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getDateKey = (date) => format(date, 'yyyy-MM-dd');

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      {/* Mini Calendar Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMonthChange(-1)}
          >
            <ChevronLeft className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMonthChange(1)}
          >
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="space-y-0.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0.5">
            {week.map((d, di) => {
              const dateKey = getDateKey(d);
              const hasItems = (tasksCount[dateKey] || 0) + (meetingsCount[dateKey] || 0) > 0;
              const isCurrentMonth = isSameMonth(d, monthStart);
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const isTodayDate = isToday(d);

              return (
                <button
                  key={di}
                  onClick={() => onDateSelect(d)}
                  className={cn(
                    "w-7 h-7 rounded-full text-xs font-medium relative transition-all",
                    !isCurrentMonth && "text-slate-300 dark:text-slate-600",
                    isCurrentMonth && !isSelected && !isTodayDate && "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700",
                    isTodayDate && !isSelected && "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400",
                    isSelected && "bg-indigo-600 text-white"
                  )}
                >
                  {format(d, 'd')}
                  {hasItems && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-500" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}