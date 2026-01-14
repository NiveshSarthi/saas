import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { Flag, MoreHorizontal, X, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const columns = [
  { id: 'todo', title: 'To Do', color: 'bg-blue-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-amber-500' },
  { id: 'review', title: 'Review', color: 'bg-purple-500' },
  { id: 'done', title: 'Done', color: 'bg-emerald-500' },
];

const priorityConfig = {
  critical: { color: 'text-red-500' },
  high: { color: 'text-orange-500' },
  medium: { color: 'text-blue-500' },
  low: { color: 'text-slate-400' },
};

export default function SprintKanban({ tasks, onTaskMove, onRemoveTask }) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  const getTasksByStatus = (status) => {
    if (status === 'todo') {
      return tasks.filter(t => t.status === 'todo' || t.status === 'backlog');
    }
    return tasks.filter(t => t.status === status);
  };

  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== columnId) {
      onTaskMove(draggedTask.id, columnId);
    }
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const getInitials = (email) => {
    if (!email) return '?';
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 items-start">
      {columns.map(column => {
        const columnTasks = getTasksByStatus(column.id);
        const totalPoints = columnTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

        return (
          <div
            key={column.id}
            className={cn(
              "flex-1 min-w-[280px] max-w-[350px] flex flex-col bg-slate-50 rounded-xl",
              dragOverColumn === column.id && "ring-2 ring-indigo-400 bg-indigo-50"
            )}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className="p-3 flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", column.color)} />
              <h3 className="font-medium text-slate-700">{column.title}</h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {columnTasks.length}
              </Badge>
              {totalPoints > 0 && (
                <span className="text-xs text-slate-500">{totalPoints} pts</span>
              )}
            </div>

            {/* Tasks */}
            <div className="p-2 space-y-2">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  className={cn(
                    "bg-white rounded-lg border border-slate-200 p-3 cursor-grab active:cursor-grabbing",
                    "hover:shadow-md transition-shadow group",
                    draggedTask?.id === task.id && "opacity-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link
                      to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
                      className="font-medium text-sm text-slate-900 hover:text-indigo-600 flex-1"
                    >
                      {task.title}
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => onRemoveTask(task.id)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove from Sprint
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2">
                    <Flag className={cn("w-3 h-3", priorityConfig[task.priority]?.color)} />
                    {task.story_points && (
                      <Badge variant="outline" className="text-xs px-1.5">
                        {task.story_points} SP
                      </Badge>
                    )}
                    <div className="flex-1" />
                    {task.assignee_email && (
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                          {getInitials(task.assignee_email)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-400">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}