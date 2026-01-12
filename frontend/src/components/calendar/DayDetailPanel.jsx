import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Video,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Plus,
  Calendar as CalendarIcon,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-400' },
};

const statusConfig = {
  backlog: { icon: Circle, color: 'text-slate-400' },
  todo: { icon: Circle, color: 'text-blue-500' },
  in_progress: { icon: Clock, color: 'text-amber-500' },
  review: { icon: Clock, color: 'text-purple-500' },
  done: { icon: CheckCircle2, color: 'text-emerald-500' },
  blocked: { icon: AlertCircle, color: 'text-red-500' },
};

export default function DayDetailPanel({
  date,
  tasks = [],
  meetings = [],
  onClose,
  onScheduleMeeting
}) {
  if (!date) return null;

  const isTodayDate = isToday(date);
  const totalItems = tasks.length + meetings.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {format(date, 'EEEE')}
              </h3>
              {isTodayDate && (
                <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px]">
                  Today
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {format(date, 'MMMM d, yyyy')}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        {totalItems === 0 ? (
          <div className="text-center py-8">
            <CalendarIcon className="w-10 h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Nothing scheduled</p>
            <div className="flex flex-col gap-2">
              <Link to={createPageUrl(`NewTask?due_date=${format(date, 'yyyy-MM-dd')}`)}>
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={onScheduleMeeting}>
                <Video className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meetings */}
            {meetings.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Video className="w-3 h-3" />
                  Meetings
                </h4>
                <div className="space-y-2">
                  {meetings.map((meeting) => (
                    <Link
                      key={meeting.id}
                      to={createPageUrl(`MeetingRoom?id=${meeting.id}`)}
                      className="block"
                    >
                      <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center flex-shrink-0">
                            <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                              {meeting.title}
                            </p>
                            <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                              {format(parseISO(meeting.start_date), 'HH:mm')} - {format(parseISO(meeting.end_date), 'HH:mm')}
                            </p>
                            {meeting.participants?.length > 0 && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {meeting.participants.length} participant{meeting.participants.length !== 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            {tasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Tasks
                </h4>
                <div className="space-y-2">
                  {tasks.map((task) => {
                    const StatusIcon = statusConfig[task.status]?.icon || Circle;
                    return (
                      <Link
                        key={task.id}
                        to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
                        className="block"
                      >
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                          <div className="flex items-start gap-3">
                            <StatusIcon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", statusConfig[task.status]?.color)} />
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium text-sm text-slate-900 dark:text-white",
                                task.status === 'done' && "line-through text-slate-500"
                              )}>
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge className={cn("text-[10px]", priorityConfig[task.priority]?.color)}>
                                  {priorityConfig[task.priority]?.label}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {task.status.replace('_', ' ')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer Actions */}
      {totalItems > 0 && (
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex gap-2">
            <Link to={createPageUrl(`NewTask?due_date=${format(date, 'yyyy-MM-dd')}`)} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-1" />
                Task
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="flex-1" onClick={onScheduleMeeting}>
              <Video className="w-4 h-4 mr-1" />
              Meeting
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}