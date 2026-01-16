import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig = {
  present: { label: 'P', color: 'bg-green-500 text-white' },
  absent: { label: 'A', color: 'bg-red-500 text-white' },
  half_day: { label: 'HD', color: 'bg-yellow-500 text-white' },
  leave: { label: 'L', color: 'bg-purple-500 text-white' },
  work_from_home: { label: 'WFH', color: 'bg-blue-500 text-white' },
  sick_leave: { label: 'SL', color: 'bg-orange-500 text-white' },
  casual_leave: { label: 'CL', color: 'bg-indigo-500 text-white' },
  holiday: { label: 'H', color: 'bg-pink-500 text-white' },
  checked_in: { label: 'CI', color: 'bg-cyan-500 text-white' },
  checked_out: { label: 'CO', color: 'bg-teal-500 text-white' },
  weekoff: { label: 'WO', color: 'bg-orange-500 text-white' }
};

export default function AttendanceCalendar({ selectedMonth, records, onMarkAttendance, isAdmin, currentUserEmail, approvedLeaves = [], holidays = [] }) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getRecordsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayRecords = records.filter(record => {
      // Handle both date string formats
      if (record.date === dayStr) return true;
      try {
        return isSameDay(new Date(record.date), day);
      } catch {
        return false;
      }
    });
    // Non-admin users only see their own records
    if (!isAdmin) {
      return dayRecords.filter(record => record.user_email === currentUserEmail);
    }
    return dayRecords;
  };

  const isWeekOff = (day) => {
    // Check if there's a weekoff attendance record for this day
    const dayStr = format(day, 'yyyy-MM-dd');
    return records.some(record => record.date === dayStr && record.status === 'weekoff');
  };

  const getHoliday = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return holidays.find(h => h.date === dayStr);
  };

  const getLeavesForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayLeaves = approvedLeaves.filter(leave => {
      const start = new Date(leave.start_date);
      const end = new Date(leave.end_date);
      const current = new Date(dayStr);
      return current >= start && current <= end;
    });
    // Non-admin users only see their own leaves
    if (!isAdmin) {
      return dayLeaves.filter(leave => leave.user_email === currentUserEmail);
    }
    return dayLeaves;
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-2xl overflow-hidden">
      {/* Week Days Header - Gradient */}
      <div className="grid grid-cols-7 gap-3 mb-3 bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-t-2xl">
        {weekDays.map(day => (
          <div key={day} className="text-center font-bold text-sm text-white py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid - Modern Cards */}
      <div className="grid grid-cols-7 gap-3 p-4 bg-white/50 rounded-b-2xl">
        {calendarDays.map(day => {
          const dayRecords = getRecordsForDay(day);
          const isCurrentMonth = isSameMonth(day, selectedMonth);
          const isToday = isSameDay(day, new Date());
          const isWeekOffDay = isWeekOff(day);
          const holiday = getHoliday(day);

          return (
            <div
              key={day.toString()}
              className={cn(
                "min-h-[110px] p-3 rounded-2xl border-2 transition-all cursor-pointer transform hover:scale-105 hover:shadow-xl",
                isCurrentMonth
                  ? "bg-white border-slate-200 hover:border-indigo-400 shadow-sm"
                  : "bg-slate-50/50 border-slate-100 hover:border-slate-300",
                isToday && "border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 ring-2 ring-indigo-300 shadow-lg",
                isWeekOffDay && "bg-orange-50 border-orange-300",
                holiday && "bg-pink-50 border-pink-300"
              )}
              onClick={() => onMarkAttendance(day)}
            >
              <div className={cn(
                "text-sm font-bold mb-2 flex items-center justify-center w-8 h-8 rounded-full",
                isToday
                  ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md"
                  : isWeekOffDay
                    ? "bg-orange-500 text-white"
                    : holiday
                      ? "bg-pink-500 text-white"
                      : "text-slate-700"
              )}>
                {format(day, 'd')}
              </div>
              {isWeekOffDay && (
                <div className="text-[10px] text-orange-600 font-bold text-center mb-1">WEEKOFF</div>
              )}
              {holiday && (
                <div className="text-[10px] text-pink-600 font-bold text-center mb-1 truncate px-1" title={holiday.name}>
                  {holiday.name}
                </div>
              )}

              <div className="space-y-1.5">
                {!isWeekOffDay && !holiday && dayRecords.map(record => {
                  const config = statusConfig[record.status] || statusConfig.present;
                  return (
                    <div key={record.id} className="text-xs">
                      <Badge className={cn("text-[10px] px-2 py-0.5 rounded-full shadow-sm", config.color)}>
                        {config.label}
                      </Badge>
                      {isAdmin && (
                        <div className="text-[9px] text-slate-500 truncate mt-1 font-medium">
                          {record.user_email?.split('@')[0]}
                        </div>
                      )}
                    </div>
                  );
                })}
                {getLeavesForDay(day).map(leave => (
                  <div key={leave.id} className="text-xs">
                    <Badge className="text-[10px] px-2 py-0.5 rounded-full shadow-sm bg-purple-500 text-white">
                      🏖️ Leave
                    </Badge>
                    {isAdmin && (
                      <div className="text-[9px] text-slate-500 truncate mt-1 font-medium">
                        {leave.user_email?.split('@')[0]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}