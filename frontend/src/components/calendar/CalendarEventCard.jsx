import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Video, Clock, Flag, CheckCircle2, Circle, AlertCircle } from 'lucide-react';

const priorityColors = {
  critical: 'border-l-red-500 bg-red-50 dark:bg-red-900/20',
  high: 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20',
  medium: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20',
  low: 'border-l-slate-400 bg-slate-50 dark:bg-slate-700/50',
};

const statusIcons = {
  backlog: Circle,
  todo: Circle,
  in_progress: Clock,
  review: Clock,
  done: CheckCircle2,
  blocked: AlertCircle,
};

export default function CalendarEventCard({ event, type = 'task' }) {
  if (type === 'meeting') {
    return (
      <Link
        to={createPageUrl(`MeetingRoom?id=${event.id}`)}
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border-l-4 border-l-purple-500 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group">
          <Video className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-purple-900 dark:text-purple-100 truncate group-hover:text-purple-700">
              {event.title}
            </p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">
              {format(parseISO(event.start_date), 'HH:mm')} - {format(parseISO(event.end_date), 'HH:mm')}
            </p>
          </div>
        </div>
      </Link>
    );
  }

  const StatusIcon = statusIcons[event.status] || Circle;

  return (
    <Link
      to={createPageUrl(`TaskDetail?id=${event.id || event._id}`)}
      onClick={(e) => e.stopPropagation()}
      className="block"
    >
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg border-l-4 hover:shadow-sm transition-all group",
        priorityColors[event.priority] || priorityColors.medium,
        event.status === 'done' && "opacity-60"
      )}>
        <StatusIcon className={cn(
          "w-3.5 h-3.5 flex-shrink-0",
          event.status === 'done' ? "text-emerald-500" :
            event.status === 'blocked' ? "text-red-500" : "text-slate-400 dark:text-slate-500"
        )} />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs font-medium text-slate-800 dark:text-slate-200 truncate",
            event.status === 'done' && "line-through text-slate-500"
          )}>
            {event.title}
          </p>
        </div>
        <Flag className={cn(
          "w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
          event.priority === 'critical' && "text-red-500",
          event.priority === 'high' && "text-orange-500",
          event.priority === 'medium' && "text-blue-500",
          event.priority === 'low' && "text-slate-400"
        )} />
      </div>
    </Link>
  );
}