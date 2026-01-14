import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Repeat } from 'lucide-react';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RecurringTaskBadge({ task, className = '' }) {
  if (!task.is_recurring && !task.parent_recurring_task_id) return null;

  const getRecurrenceLabel = () => {
    if (task.parent_recurring_task_id) {
      // This is an instance
      return 'Recurring Instance';
    }

    if (task.recurrence_type === 'daily') {
      return 'Daily';
    }
    if (task.recurrence_type === 'weekly') {
      const dayName = DAYS_OF_WEEK[task.recurrence_day_of_week] || 'Monday';
      return `Weekly (${dayName})`;
    }
    if (task.recurrence_type === 'monthly') {
      const day = task.recurrence_day_of_month || 1;
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
      return `Monthly (${day}${suffix})`;
    }
    return 'Recurring';
  };

  return (
    <Badge 
      variant="outline" 
      className={`bg-indigo-50 text-indigo-700 border-indigo-300 ${className}`}
    >
      <Repeat className="w-3 h-3 mr-1" />
      {getRecurrenceLabel()}
    </Badge>
  );
}