import React from 'react';
import { cn } from '@/lib/utils';
import { Flag } from 'lucide-react';

const priorityConfig = {
  critical: { color: 'text-red-500' },
  high: { color: 'text-orange-500' },
  medium: { color: 'text-blue-500' },
  low: { color: 'text-slate-400' },
};

const statusColors = {
  backlog: 'bg-slate-400',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  blocked: 'bg-red-500',
};

export default function CalendarTaskCard({ 
  task, 
  projectShortName, 
  projectColor,
  onClick, 
  onDragStart 
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer",
        "bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all",
        task.status === 'done' && "opacity-60"
      )}
    >
      {/* Status indicator */}
      <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColors[task.status])} />
      
      {/* Title */}
      <span className={cn(
        "flex-1 truncate font-medium text-slate-700",
        task.status === 'done' && "line-through text-slate-500"
      )}>
        {task.title}
      </span>

      {/* Priority */}
      <Flag className={cn("w-3 h-3 flex-shrink-0", priorityConfig[task.priority]?.color)} />

      {/* Project short name */}
      {projectShortName && (
        <span 
          className="text-[10px] font-bold px-1 rounded"
          style={{ 
            backgroundColor: `${projectColor}20`,
            color: projectColor
          }}
        >
          {projectShortName}
        </span>
      )}
    </div>
  );
}