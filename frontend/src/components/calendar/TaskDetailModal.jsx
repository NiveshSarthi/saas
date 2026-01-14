import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  X,
  Calendar,
  Flag,
  User,
  ExternalLink,
  Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700', icon: 'text-red-500' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700', icon: 'text-orange-500' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700', icon: 'text-blue-500' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700', icon: 'text-slate-400' },
};

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-600' },
  todo: { label: 'To Do', color: 'bg-blue-100 text-blue-600' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-600' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-600' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-600' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-600' },
};

const taskTypeConfig = {
  epic: { label: 'Epic', color: 'bg-purple-100 text-purple-700' },
  story: { label: 'Story', color: 'bg-green-100 text-green-700' },
  task: { label: 'Task', color: 'bg-blue-100 text-blue-700' },
  bug: { label: 'Bug', color: 'bg-red-100 text-red-700' },
  feature: { label: 'Feature', color: 'bg-indigo-100 text-indigo-700' },
  improvement: { label: 'Improvement', color: 'bg-amber-100 text-amber-700' },
  subtask: { label: 'Subtask', color: 'bg-slate-100 text-slate-700' },
};

export default function TaskDetailModal({ task, project, onClose }) {
  if (!task) return null;

  const getInitials = (email) => {
    if (!email) return '?';
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={cn("text-xs", taskTypeConfig[task.task_type]?.color)}>
                  {task.task_type}
                </Badge>
                {project && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${project.color || '#6366F1'}20`,
                      color: project.color || '#6366F1'
                    }}
                  >
                    {project.name}
                  </span>
                )}
              </div>
              <DialogTitle className={cn(
                "text-lg",
                task.status === 'done' && "line-through text-slate-500"
              )}>
                {task.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Status & Priority */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-slate-500 block mb-1">Status</span>
              <Badge className={cn("text-xs", statusConfig[task.status]?.color)}>
                {statusConfig[task.status]?.label}
              </Badge>
            </div>
            <div>
              <span className="text-xs text-slate-500 block mb-1">Priority</span>
              <Badge className={cn("text-xs", priorityConfig[task.priority]?.color)}>
                <Flag className={cn("w-3 h-3 mr-1", priorityConfig[task.priority]?.icon)} />
                {priorityConfig[task.priority]?.label}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <span className="text-xs text-slate-500 block mb-1">Description</span>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-6">
            {task.start_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-500 block">Start</span>
                  <span className="text-sm">{format(new Date(task.start_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-500 block">Due</span>
                  <span className="text-sm">{format(new Date(task.due_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Assignee */}
          <div>
            <span className="text-xs text-slate-500 block mb-1">Assignee</span>
            {task.assignee_email ? (
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                    {getInitials(task.assignee_email)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{task.assignee_email}</span>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Unassigned</span>
            )}
          </div>

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div>
              <span className="text-xs text-slate-500 block mb-1">Tags</span>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)} className="flex-1">
              <Button variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Details
              </Button>
            </Link>
            <Link to={createPageUrl(`EditTask?id=${task.id}`)} className="flex-1">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                <Edit className="w-4 h-4 mr-2" />
                Edit Task
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}