import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function MarketingCalendar({ tasks, onEditTask }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getTasksForDay = (date) => {
    return tasks.filter(task => 
      task.due_date && isSameDay(new Date(task.due_date), date)
    );
  };

  const STATUS_COLORS = {
    editing: 'bg-slate-100 text-slate-700 border-slate-200',
    review: 'bg-blue-50 text-blue-700 border-blue-200',
    revision: 'bg-orange-50 text-orange-700 border-orange-200',
    compliance: 'bg-purple-50 text-purple-700 border-purple-200',
    approved: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border shadow-sm">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold text-slate-900">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <div className="flex items-center rounded-md border bg-slate-50">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="w-px h-4 bg-slate-200" />
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-[auto_1fr] overflow-hidden">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-xs font-semibold text-slate-500 border-b border-r last:border-r-0 bg-slate-50">
            {day}
          </div>
        ))}

        {/* Days */}
        <div className="contents">
          {days.map((day, dayIdx) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()} 
                className={`min-h-[100px] border-b border-r p-2 flex flex-col gap-1 transition-colors hover:bg-slate-50/50
                  ${(dayIdx + 1) % 7 === 0 ? 'border-r-0' : ''}
                  ${!isCurrentMonth ? 'bg-slate-50/30 text-slate-400' : 'bg-white'}
                `}
              >
                <div className="flex justify-between items-start">
                  <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full 
                    ${isToday(day) ? 'bg-indigo-600 text-white' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[120px]">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className={`text-[10px] p-1.5 rounded border cursor-pointer truncate font-medium transition-all hover:scale-[1.02] ${STATUS_COLORS[task.status] || 'bg-slate-100'}`}
                    >
                      {task.campaign_name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}