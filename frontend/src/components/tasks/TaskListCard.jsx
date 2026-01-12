import React from 'react';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Flag,
  FolderKanban,
  User
} from 'lucide-react';

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-700', icon: Clock },
  todo: { label: 'To Do', color: 'bg-blue-100 text-blue-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700', icon: AlertCircle },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700', icon: AlertCircle },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  medium: { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
};

export default function TaskListCard({ task, projects, users, onClick }) {
  const status = statusConfig[task.status] || statusConfig.todo;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const StatusIcon = status.icon;
  const project = projects.find(p => p.id === task.project_id);
  const assignee = users.find(u => u.email === task.assignee_email);

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'done' && !isToday(new Date(task.due_date));
  const isDueToday = task.due_date && isToday(new Date(task.due_date)) && task.status !== 'done';

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl p-4 border-2 cursor-pointer transition-all duration-200 hover:shadow-xl group",
        priority.borderColor,
        isOverdue && "border-red-400 bg-red-50/50",
        isDueToday && "border-amber-400 bg-amber-50/50"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <Badge className={cn("text-xs", status.color)}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {status.label}
        </Badge>
        
        {task.priority && (
          <div className={cn("px-2 py-0.5 rounded-full flex items-center gap-1", priority.bgColor)}>
            <Flag className={cn("w-3 h-3", priority.color)} />
            <span className={cn("text-xs font-medium", priority.color)}>
              {priority.label}
            </span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className={cn(
        "font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:text-indigo-600 transition-colors",
        task.status === 'done' && "line-through text-slate-500"
      )}>
        {task.title}
      </h3>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Progress Bar */}
      {task.progress > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Progress</span>
            <span className="text-xs font-medium text-slate-700">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1.5" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {project && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg truncate"
              style={{
                backgroundColor: `${project.color}20`,
                color: project.color
              }}
            >
              <FolderKanban className="w-3 h-3 flex-shrink-0" />
              <span className="font-medium truncate">{project.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {task.due_date && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg",
              isOverdue ? "bg-red-100 text-red-700" :
              isDueToday ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-700"
            )}>
              <Clock className="w-3 h-3" />
              <span className="font-medium">
                {isToday(new Date(task.due_date)) ? 'Today' : format(new Date(task.due_date), 'MMM d')}
              </span>
            </div>
          )}

          {assignee && (
            <Avatar className="w-6 h-6 border-2 border-white">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                {assignee.full_name?.charAt(0) || assignee.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </motion.div>
  );
}