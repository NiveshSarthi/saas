import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSameMonth, isWithinInterval, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LeaveCalendar({ approvedLeaves, leaveTypes }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getLeavesForDay = (day) => {
    return approvedLeaves.filter(leave => {
      const start = parseISO(leave.start_date);
      const end = parseISO(leave.end_date);
      return isWithinInterval(day, { start, end });
    });
  };

  const handleMonthChange = (direction) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => handleMonthChange(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold text-slate-900">
          {format(selectedMonth, 'MMMM yyyy')}
        </h2>
        <Button variant="ghost" onClick={() => handleMonthChange(1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Week Days */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center font-semibold text-sm text-slate-600 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map(day => {
          const dayLeaves = getLeavesForDay(day);
          const isCurrentMonth = isSameMonth(day, selectedMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toString()}
              className={cn(
                "min-h-[100px] p-2 rounded-lg border transition-colors",
                isCurrentMonth ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100",
                isToday && "border-indigo-600 border-2"
              )}
            >
              <div className="text-sm font-medium text-slate-700 mb-2">
                {format(day, 'd')}
              </div>

              <div className="space-y-1">
                {dayLeaves.map(leave => {
                  const leaveType = leaveTypes.find(lt => lt.id === leave.leave_type_id);
                  return (
                    <div
                      key={leave.id}
                      className="text-xs p-1 rounded"
                      style={{ backgroundColor: leaveType?.color + '20', color: leaveType?.color }}
                    >
                      <div className="font-medium truncate">{leave.user_name}</div>
                      <div className="text-[10px] opacity-75">{leaveType?.code}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <p className="text-sm font-medium text-slate-700 mb-3">Leave Types:</p>
        <div className="flex flex-wrap gap-3">
          {leaveTypes.map(type => (
            <Badge
              key={type.id}
              variant="outline"
              className="flex items-center gap-2"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: type.color }}
              />
              {type.name} ({type.code})
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}