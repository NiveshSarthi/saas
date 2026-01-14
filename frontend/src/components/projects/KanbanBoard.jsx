import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { Plus, MoreHorizontal, ChevronDown, User, Flag, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TaskCard from '@/components/tasks/TaskCard';

const defaultColumns = [
  { id: 'backlog', title: 'Backlog', color: 'bg-slate-400' },
  { id: 'todo', title: 'To Do', color: 'bg-blue-500' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-amber-500' },
  { id: 'review', title: 'Review', color: 'bg-purple-500' },
  { id: 'done', title: 'Done', color: 'bg-emerald-500' },
];

const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export default function KanbanBoard({
  tasks = [],
  columns = defaultColumns,
  onTaskMove,
  onAddTask,
  users = [],
  wipLimits = {},
  className
}) {
  const [swimlaneBy, setSwimlaneBy] = useState('none');

  const getTasksByStatus = (status, swimlaneValue = null) => {
    let filtered = tasks.filter(task => task.status === status);

    if (swimlaneBy !== 'none' && swimlaneValue !== null) {
      if (swimlaneBy === 'assignee') {
        filtered = filtered.filter(t => (t.assignee_email || 'unassigned') === swimlaneValue);
      } else if (swimlaneBy === 'priority') {
        filtered = filtered.filter(t => (t.priority || 'medium') === swimlaneValue);
      }
    }

    return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const getSwimlanes = () => {
    if (swimlaneBy === 'assignee') {
      const assignees = [...new Set(tasks.map(t => t.assignee_email || 'unassigned'))];
      return assignees.sort((a, b) => {
        if (a === 'unassigned') return 1;
        if (b === 'unassigned') return -1;
        return a.localeCompare(b);
      });
    } else if (swimlaneBy === 'priority') {
      return ['critical', 'high', 'medium', 'low'];
    }
    return [null];
  };

  const getSwimlaneLabel = (value) => {
    if (swimlaneBy === 'assignee') {
      if (value === 'unassigned') return 'Unassigned';
      const user = users.find(u => u.email === value);
      return user?.full_name || value;
    } else if (swimlaneBy === 'priority') {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return '';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-blue-500',
      low: 'bg-slate-400'
    };
    return colors[priority] || 'bg-slate-400';
  };

  const swimlanes = getSwimlanes();

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, source, destination } = result;

    // Extract status from droppableId (format: "status" or "status-swimlaneValue")
    const destStatus = destination.droppableId.split('-')[0];

    if (source.droppableId === destination.droppableId &&
      source.index === destination.index) {
      return;
    }

    onTaskMove?.(draggableId, {
      status: destStatus,
      order: destination.index
    });
  };

  const isSwimlanesActive = swimlaneBy !== 'none';

  return (
    <div className={cn("flex flex-col h-full space-y-4", className)}>
      {/* Swimlane Controls */}
      <div className="flex-shrink-0 flex items-center gap-4 bg-white rounded-lg p-3 border border-slate-200">
        <span className="text-sm text-slate-600">Group by:</span>
        <Select value={swimlaneBy} onValueChange={setSwimlaneBy}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="assignee">Assignee</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className={cn(
          "flex-1 min-h-0",
          isSwimlanesActive ? "overflow-y-auto pr-2 space-y-6" : "h-full"
        )}>
          {swimlanes.map((swimlaneValue, swimlaneIndex) => (
            <div
              key={swimlaneValue || 'default'}
              className={cn(
                !isSwimlanesActive && "h-full flex flex-col"
              )}
            >
              {/* Swimlane Header */}
              {isSwimlanesActive && (
                <div className="flex items-center gap-2 mb-3 px-2 sticky left-0">
                  {swimlaneBy === 'assignee' && (
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                        {swimlaneValue === 'unassigned' ? '?' : swimlaneValue.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {swimlaneBy === 'priority' && (
                    <div className={cn("w-3 h-3 rounded-full", getPriorityColor(swimlaneValue))} />
                  )}
                  <h3 className="font-semibold text-slate-800">{getSwimlaneLabel(swimlaneValue)}</h3>
                  <span className="text-xs text-slate-400">
                    ({tasks.filter(t => {
                      if (swimlaneBy === 'assignee') return (t.assignee_email || 'unassigned') === swimlaneValue;
                      if (swimlaneBy === 'priority') return (t.priority || 'medium') === swimlaneValue;
                      return true;
                    }).length} tasks)
                  </span>
                </div>
              )}

              {/* Columns */}
              <div className={cn(
                "flex gap-4 overflow-x-auto pb-4",
                !isSwimlanesActive ? "h-full" : "min-h-[200px]"
              )}>
                {columns.map((column) => {
                  const columnTasks = getTasksByStatus(column.id, swimlaneValue);
                  const wipLimit = wipLimits[column.id];
                  const isOverLimit = wipLimit && columnTasks.length > wipLimit;
                  const droppableId = isSwimlanesActive ? `${column.id}-${swimlaneValue}` : column.id;

                  return (
                    <div
                      key={droppableId}
                      className={cn(
                        "flex-shrink-0 w-80 bg-slate-50 rounded-xl border border-slate-100",
                        !isSwimlanesActive && "flex flex-col max-h-full",
                        isOverLimit && "ring-2 ring-red-300"
                      )}
                    >
                      {/* Column Header */}
                      <div className={cn(
                        "p-4 bg-slate-50 rounded-t-xl z-10",
                        !isSwimlanesActive && "flex-shrink-0"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-3 h-3 rounded-full", column.color)} />
                            <h3 className="font-semibold text-slate-900">{column.title}</h3>
                            <span className={cn(
                              "text-sm px-2 py-0.5 rounded-full",
                              isOverLimit
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-200 text-slate-500"
                            )}>
                              {columnTasks.length}{wipLimit ? `/${wipLimit}` : ''}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8"
                            onClick={() => onAddTask?.(column.id)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                        {isOverLimit && (
                          <p className="text-xs text-red-600 mt-1">WIP limit exceeded!</p>
                        )}
                      </div>

                      {/* Task List */}
                      <Droppable droppableId={droppableId}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "p-2 space-y-3 transition-colors",
                              !isSwimlanesActive ? "flex-1 overflow-y-auto min-h-0" : "min-h-[150px]",
                              snapshot.isDraggingOver && "bg-indigo-50"
                            )}
                          >
                            {columnTasks.map((task, index) => (
                              <Draggable
                                key={task.id || task._id}
                                draggableId={task.id || task._id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                  >
                                    <TaskCard
                                      task={task}
                                      isDragging={snapshot.isDragging}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}

                            {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                              <div className="text-center py-8 text-slate-400 text-sm">
                                No tasks
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}