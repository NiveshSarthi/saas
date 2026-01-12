import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-600' },
  todo: { label: 'To Do', color: 'bg-blue-100 text-blue-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-600' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-600' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-600' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-600' },
};

export default function RecentTasks({ tasks = [], users = [], title = "Recent Tasks", viewAllLink = "MyTasks", extraControls }) {
  const getFirstName = (email) => {
    if (!email) return '';
    const user = users.find(u => u.email === email);
    if (user && user.full_name) {
      return user.full_name.split(' ')[0];
    }
    return email.split('@')[0]; // Fallback to part of email if user not found
  };

  const getDueDateLabel = (dateStr) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isPast(date)) return 'Overdue';
    return format(date, 'MMM d');
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">{title}</h3>
          {extraControls}
        </div>
        <Link to={createPageUrl(viewAllLink)}>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-indigo-600">
            View all
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="space-y-3 flex-1">
        {tasks.slice(0, 5).map((task) => {
          const dueLabel = getDueDateLabel(task.due_date);
          const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done';

          return (
            <Link
              key={task.id}
              to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
              className="block"
            >
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all group">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                    task.status === 'done'
                      ? 'border-emerald-500 bg-emerald-500'
                      : task.status === 'blocked'
                        ? 'border-red-500'
                        : 'border-slate-300'
                  )}>
                    {task.status === 'done' && (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={cn(
                        "font-medium text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors",
                        task.status === 'done' && 'line-through text-slate-500 dark:text-slate-400'
                      )}>
                        {task.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn("text-xs flex-shrink-0", priorityConfig[task.priority]?.color)}
                      >
                        {task.priority}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <Badge className={cn("text-xs", statusConfig[task.status]?.color)}>
                        {statusConfig[task.status]?.label}
                      </Badge>

                      {dueLabel && (
                        <span className={cn(
                          "flex items-center gap-1",
                          isOverdue && "text-red-600 font-medium"
                        )}>
                          {isOverdue ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <Calendar className="w-3 h-3" />
                          )}
                          {dueLabel}
                        </span>
                      )}

                      {task.assignee_email && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md">
                            {getFirstName(task.assignee_email)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
          No tasks to display
        </div>
      )}
    </div>
  );
}