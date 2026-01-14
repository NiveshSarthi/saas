import React, { useState } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-700' },
  todo: { label: 'To Do', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
};

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700' },
};

export default function TaskListTable({ tasks, projects, users, onTaskClick, onReorder }) {
  const [visibleColumns, setVisibleColumns] = useState({
    task: true,
    status: true,
    priority: true,
    type: true,
    assignee: true,
    dueDate: true,
    progress: true,
  });

  const handleDragEnd = (result) => {
    if (!result.destination || !onReorder) return;
    if (result.source.index === result.destination.index) return;

    const reorderedTasks = Array.from(tasks);
    const [movedTask] = reorderedTasks.splice(result.source.index, 1);
    reorderedTasks.splice(result.destination.index, 0, movedTask);

    onReorder(reorderedTasks);
  };

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg">
      {/* Column Visibility Toggle */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-700">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="w-4 h-4 mr-2" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={visibleColumns.task}
              onCheckedChange={() => toggleColumn('task')}
              disabled
            >
              Task
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.status}
              onCheckedChange={() => toggleColumn('status')}
            >
              Status
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.priority}
              onCheckedChange={() => toggleColumn('priority')}
            >
              Priority
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.type}
              onCheckedChange={() => toggleColumn('type')}
            >
              Type
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.assignee}
              onCheckedChange={() => toggleColumn('assignee')}
            >
              Assignee
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.dueDate}
              onCheckedChange={() => toggleColumn('dueDate')}
            >
              Due Date
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={visibleColumns.progress}
              onCheckedChange={() => toggleColumn('progress')}
            >
              Progress
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <tr>
              <th className="px-2 py-3 w-8"></th>
              {visibleColumns.task && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Task
                </th>
              )}
              {visibleColumns.status && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
              )}
              {visibleColumns.priority && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Priority
                </th>
              )}
              {visibleColumns.type && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Type
                </th>
              )}
              {visibleColumns.assignee && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Assignee
                </th>
              )}
              {visibleColumns.dueDate && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Due Date
                </th>
              )}
              {visibleColumns.progress && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Progress
                </th>
              )}
            </tr>
          </thead>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="task-table">
              {(provided) => (
                <tbody
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="divide-y divide-slate-100"
                >
                  {tasks.map((task, index) => {
                    const project = projects.find(p => p.id === task.project_id);
                    const assignee = users.find(u => u.email === task.assignee_email);
                    const status = statusConfig[task.status] || statusConfig.todo;
                    const priority = priorityConfig[task.priority] || priorityConfig.medium;

                    return (
                      <Draggable key={task.id || task._id} draggableId={task.id || task._id} index={index}>
                        {(provided, snapshot) => (
                          <tr
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onClick={() => onTaskClick(task)}
                            className={cn(
                              "hover:bg-indigo-50/50 cursor-pointer transition-colors group",
                              snapshot.isDragging && "shadow-2xl bg-white"
                            )}
                          >
                            <td
                              {...provided.dragHandleProps}
                              className="px-2 py-3 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600">
                                <GripVertical className="w-4 h-4" />
                              </div>
                            </td>
                            {visibleColumns.task && (
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className={cn(
                                    "font-medium text-slate-900 group-hover:text-indigo-600 transition-colors",
                                    task.status === 'done' && "line-through text-slate-500"
                                  )}>
                                    {task.title}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {project && (
                                      <span className="text-xs text-indigo-600 font-medium">
                                        {project.name}
                                      </span>
                                    )}
                                    {task.parent_task_id && (
                                      <Badge variant="outline" className="text-xs">
                                        Subtask
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                            )}
                            {visibleColumns.status && (
                              <td className="px-4 py-3">
                                <Badge className={cn("text-xs", status.color)}>
                                  {status.label}
                                </Badge>
                              </td>
                            )}
                            {visibleColumns.priority && (
                              <td className="px-4 py-3">
                                <Badge className={cn("text-xs", priority.color)}>
                                  {priority.label}
                                </Badge>
                              </td>
                            )}
                            {visibleColumns.type && (
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {task.task_type || 'task'}
                                </Badge>
                              </td>
                            )}
                            {visibleColumns.assignee && (
                              <td className="px-4 py-3">
                                {(() => {
                                  const taskAssignees = task.assignees && task.assignees.length > 0
                                    ? task.assignees
                                    : task.assignee_email ? [task.assignee_email] : [];

                                  if (taskAssignees.length === 0) return <span className="text-sm text-slate-600">-</span>;

                                  const primaryAssignee = users.find(u => u.email === taskAssignees[0]);
                                  const primaryName = primaryAssignee?.full_name || taskAssignees[0].split('@')[0];

                                  if (taskAssignees.length === 1) {
                                    return <span className="text-sm text-slate-600">{primaryName}</span>;
                                  }

                                  const allAssigneeNames = taskAssignees.map(email => {
                                    const user = users.find(u => u.email === email);
                                    return user?.full_name || email.split('@')[0];
                                  }).join(', ');

                                  return (
                                    <div className="group relative inline-block">
                                      <span className="text-sm text-slate-600 cursor-help">
                                        {primaryName} <span className="text-indigo-600">+{taskAssignees.length - 1}</span>
                                      </span>
                                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded px-3 py-2 whitespace-nowrap z-10 shadow-lg">
                                        {allAssigneeNames}
                                        <div className="absolute left-4 top-full w-2 h-2 bg-slate-900 transform rotate-45 -mt-1" />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </td>
                            )}
                            {visibleColumns.dueDate && (
                              <td className="px-4 py-3">
                                <span className="text-sm text-slate-600">
                                  {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                                </span>
                              </td>
                            )}
                            {visibleColumns.progress && (
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Progress value={task.progress || 0} className="w-20 h-2" />
                                  <span className="text-xs text-slate-500 w-10 text-right">
                                    {task.progress || 0}%
                                  </span>
                                </div>
                              </td>
                            )}
                          </tr>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </tbody>
              )}
            </Droppable>
          </DragDropContext>
        </table>

        {tasks.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No tasks found
          </div>
        )}
      </div>
    </div>
  );
}