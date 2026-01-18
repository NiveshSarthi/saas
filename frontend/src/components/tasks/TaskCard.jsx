import React from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Calendar,
  AlertCircle,
  Paperclip,
  MessageSquare,
  CheckCircle2,
  Clock,
  Flag,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import RecurringTaskBadge from '@/components/tasks/RecurringTaskBadge';

const priorityConfig = {
  critical: { color: 'border-l-red-500', badge: 'bg-red-100 text-red-700', icon: 'text-red-500' },
  high: { color: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700', icon: 'text-orange-500' },
  medium: { color: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700', icon: 'text-blue-500' },
  low: { color: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-700', icon: 'text-slate-400' },
};

const taskTypeConfig = {
  epic: { color: 'bg-purple-100 text-purple-700' },
  story: { color: 'bg-green-100 text-green-700' },
  task: { color: 'bg-blue-100 text-blue-700' },
  bug: { color: 'bg-red-100 text-red-700' },
  feature: { color: 'bg-indigo-100 text-indigo-700' },
  improvement: { color: 'bg-amber-100 text-amber-700' },
  subtask: { color: 'bg-slate-100 text-slate-700' },
};

export default function TaskCard({ task, isDragging = false, onStatusChange, returnPath }) {
  const getInitials = (email) => {
    if (!email) return '?';
    return email.slice(0, 2).toUpperCase();
  };

  const getDueDateInfo = () => {
    if (!task.due_date) return null;
    const date = new Date(task.due_date);
    const isOverdue = isPast(date) && !isToday(date) && task.status !== 'done';

    let label;
    if (isToday(date)) label = 'Today';
    else if (isTomorrow(date)) label = 'Tomorrow';
    else label = format(date, 'MMM d');

    return { label, isOverdue };
  };

  const dueInfo = getDueDateInfo();
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const taskType = taskTypeConfig[task.task_type] || taskTypeConfig.task;

  const { data: sprint } = useQuery({
    queryKey: ['sprint', task.sprint_id],
    queryFn: async () => {
      if (!task.sprint_id) return null;
      const sprints = await base44.entities.Sprint.filter({ id: task.sprint_id });
      return sprints[0];
    },
    enabled: !!task.sprint_id,
    staleTime: 1000 * 60 * 5
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
    staleTime: 1000 * 60 * 5
  });

  const taskAssignees = task.assignees && task.assignees.length > 0
    ? task.assignees
    : task.assignee_email ? [task.assignee_email] : [];

  const assigneeUser = users.find(u => u.email === taskAssignees[0]);
  const assigneeName = assigneeUser?.full_name || taskAssignees[0];

  return (
    <Link
      to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
      state={returnPath ? { returnPath } : undefined}
      className="block"
    >
      <div className={cn(
        "bg-white rounded-md border border-slate-200 border-l-2 p-2.5 hover:shadow-sm transition-all cursor-pointer group",
        priority.color,
        isDragging && "shadow-lg ring-2 ring-indigo-500",
        task.status === 'blocked' && "bg-red-50 border-red-200"
      )}>
        {/* Header with type and priority */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex gap-1">
            <Badge className={cn("text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0", taskType.color)}>
              {task.task_type || 'task'}
            </Badge>
            {sprint && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-200 text-slate-500">
                <Zap className="w-2 h-2 mr-0.5" />
                {sprint.name}
              </Badge>
            )}
            <RecurringTaskBadge task={task} className="text-[9px] px-1.5 py-0" />
          </div>
          <Flag className={cn("w-3 h-3", priority.icon)} />
        </div>

        {/* Title */}
        <h4 className={cn(
          "font-medium text-slate-900 text-xs leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2",
          task.status === 'done' && "line-through text-slate-500"
        )}>
          {task.title}
        </h4>

        {/* Tags - show only 2 */}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1.5">
            {task.tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="text-[9px] px-1 py-0 bg-slate-100 text-slate-600 rounded"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[9px] text-slate-400">+{task.tags.length - 2}</span>
            )}
          </div>
        )}

        {/* Progress bar */}
        {task.progress > 0 && task.progress < 100 && (
          <div className="mt-2">
            <div className="h-0.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            {/* Due date */}
            {dueInfo && (
              <span className={cn(
                "flex items-center gap-0.5",
                dueInfo.isOverdue && "text-red-600 font-medium"
              )}>
                {dueInfo.isOverdue ? (
                  <AlertCircle className="w-2.5 h-2.5" />
                ) : (
                  <Calendar className="w-2.5 h-2.5" />
                )}
                {dueInfo.label}
              </span>
            )}

            {/* Story points */}
            {task.story_points && (
              <span className="w-3.5 h-3.5 bg-indigo-100 text-indigo-600 rounded text-[9px] font-bold flex items-center justify-center">
                {task.story_points}
              </span>
            )}

            {/* Attachments */}
            {task.attachments && task.attachments.length > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip className="w-2.5 h-2.5" />
                {task.attachments.length}
              </span>
            )}
          </div>

          {/* Assignee */}
          {taskAssignees.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-0.5">
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-600 font-medium">
                        {assigneeUser ? getInitials(assigneeUser.full_name || taskAssignees[0]) : getInitials(taskAssignees[0])}
                      </AvatarFallback>
                    </Avatar>
                    {taskAssignees.length > 1 && (
                      <span className="text-[9px] text-indigo-600 font-bold">+{taskAssignees.length - 1}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-1">
                    {taskAssignees.map((email, idx) => {
                      const user = users.find(u => u.email === email);
                      return (
                        <p key={idx} className="text-xs">
                          {user?.full_name || email}
                        </p>
                      );
                    })}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Blocked indicator */}
        {task.status === 'blocked' && task.blocked_reason && (
          <div className="mt-1.5 p-1.5 bg-red-100 rounded text-[10px] text-red-700 flex items-start gap-1">
            <AlertCircle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">{task.blocked_reason}</span>
          </div>
        )}
      </div>
    </Link>
  );
}