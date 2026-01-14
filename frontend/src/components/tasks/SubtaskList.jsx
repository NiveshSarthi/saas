// @ts-nocheck
import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  Plus,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Trash2,
  Edit,
  GripVertical,
  Calendar,
  Clock,
  Play,
  Pause,
  ExternalLink,
  Copy,
  MessageSquare,
  Zap,
  AlertCircle,
  CheckSquare,
  FileText,
  Upload,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import FileUpload from '@/components/common/FileUpload';
import UserMultiSelect from '@/components/common/UserMultiSelect';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { handleParentTaskAutomation } from '@/components/utils/subtaskAutomation';
import { usePermissions } from '@/components/rbac/PermissionsContext';

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700' },
};

const statusConfig = {
  todo: { label: 'Not Started', color: 'bg-slate-100 text-slate-700', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Play },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

export default function SubtaskList({ parentTaskId, projectId, subtasks = [], users = [], parentSprintId = null }) {
  const { can } = usePermissions();
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newAssignees, setNewAssignees] = useState([]);
  const [newAttachments, setNewAttachments] = useState([]);
  const [newStartDate, setNewStartDate] = useState(null);
  const [newEndDate, setNewEndDate] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [selectedSubtasks, setSelectedSubtasks] = useState([]);
  const [commentingId, setCommentingId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [trackingId, setTrackingId] = useState(null);
  const [trackingStart, setTrackingStart] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const timerInterval = useRef(null);
  const queryClient = useQueryClient();

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['subtask-templates'],
    queryFn: async () => {
      // Some deployments may not have SubtaskTemplate entity. Guard against 404s.
      if (!base44?.entities?.SubtaskTemplate || typeof base44.entities.SubtaskTemplate.list !== 'function') {
        return [];
      }

      try {
        return await base44.entities.SubtaskTemplate.list('-created_date');
      } catch (err) {
        // Swallow not found errors and return empty list to avoid noisy logs
        if (err && /Not Found|404/.test(err.message || '')) {
          return [];
        }
        console.warn('Failed to load subtask templates', err);
        return [];
      }
    },
  });

  const createSubtaskMutation = useMutation({
    mutationFn: async (data) => {
      // Create the subtask
      try {
        const subtask = await base44.entities.Task.create(data);

        // Check if parent task is in 'done' status and reopen it
        let parentTask = null;
        try {
          parentTask = await base44.entities.Task.get(parentTaskId);
        } catch (err) {
          // Fallback: try filter by id (older API usage)
          try {
            const parents = await base44.entities.Task.filter({ id: parentTaskId });
            parentTask = parents && parents[0];
          } catch (e) {
            parentTask = null;
          }
        }

        if (parentTask && parentTask.status === 'done') {
          await base44.entities.Task.update(parentTaskId, {
            status: 'in_progress'
          });

          // Log activity
          await base44.entities.Activity.create({
            task_id: parentTaskId,
            project_id: parentTask.project_id,
            actor_email: 'system',
            action: 'status_changed',
            field_changed: 'status',
            old_value: 'done',
            new_value: 'in_progress',
            metadata: {
              reason: 'Parent task reopened because a new subtask was added',
              automated: true
            }
          });
        }

        return subtask;
      } catch (error) {
        // Re-throw so react-query's onError receives it
        throw error;
      }
    },
    onSuccess: (created) => {
      try {
        // Optimistically append to cached subtasks list so UI updates immediately
        queryClient.setQueryData(['subtasks', parentTaskId], (old = []) => {
          // Ensure we don't duplicate
          if (!created) return old;
          const exists = old.some(t => t.id === created.id || t._id === created._id);
          return exists ? old : [...old, created];
        });
      } catch (e) {
        console.warn('Failed to set cache for subtasks', e);
      }

      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['task', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks-admin'] });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('medium');
      setNewAssignees([]);
      setNewAttachments([]);
      setNewStartDate(null);
      setNewEndDate(null);
      setIsAdding(false);
      toast.success('Subtask created');
    },
    onError: (error) => {
      console.error('Failed to create subtask', error);
      const msg = (error && error.message) ? error.message : 'Failed to create subtask';
      toast.error(msg);
    },
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => base44.entities.Sprint.list(),
  });

  const updateSubtaskMutation = useMutation({
    mutationFn: async ({ id, data, logSprint = false, userEmail = null }) => {
      // Log sprint change if needed
      if (logSprint && data.sprint_id !== undefined) {
        const subtask = subtasks.find(s => (s.id || s._id) === id);
        if (subtask && subtask.sprint_id !== data.sprint_id) {
          const oldSprint = sprints.find(s => String(s.id) === String(subtask.sprint_id));
          const newSprint = sprints.find(s => String(s.id) === String(data.sprint_id));

          if (base44?.entities?.SprintChangeLog && typeof base44.entities.SprintChangeLog.create === 'function') {
            try {
              await base44.entities.SprintChangeLog.create({
                task_id: id,
                task_title: subtask.title,
                old_sprint_id: subtask.sprint_id || null,
                new_sprint_id: data.sprint_id || null,
                old_sprint_name: oldSprint?.name || 'No Sprint',
                new_sprint_name: newSprint?.name || 'No Sprint',
                changed_by: userEmail,
                project_id: projectId,
                is_subtask: true
              });
            } catch (err) {
              console.warn('SprintChangeLog.create failed', err);
            }
          }
        }
      }

      return base44.entities.Task.update(id, data);
    },
    onSuccess: async (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['task', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks-admin'] });

      // Trigger parent automation if status changed
      if (variables.data.status) {
        await handleParentTaskAutomation(variables.id, variables.data.status, parentTaskId);
      }
    },
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['task', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-tasks-admin'] });
      toast.success('Subtask deleted');

      // Check parent status after deletion
      await handleParentTaskAutomation(null, null, parentTaskId);
    },
  });

  const convertToTaskMutation = useMutation({
    mutationFn: async (subtask) => {
      await base44.entities.Task.update(subtask.id, {
        parent_task_id: null,
        task_type: 'task',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      toast.success('Converted to standalone task');
    },
  });

  const duplicateSubtaskMutation = useMutation({
    mutationFn: async (subtask) => {
      const { id, created_date, updated_date, created_by, ...data } = subtask;
      await base44.entities.Task.create({
        ...data,
        title: `${data.title} (Copy)`,
        status: 'todo',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      toast.success('Subtask duplicated');
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (templateName) => {
      const subtaskData = subtasks.map((st, idx) => ({
        title: st.title,
        priority: st.priority,
        estimated_hours: st.estimated_hours,
        dependencies: st.blocked_by_task_ids?.map(id =>
          subtasks.findIndex(s => s.id === id)
        ).filter(i => i !== -1) || []
      }));

      if (!base44?.entities?.SubtaskTemplate || typeof base44.entities.SubtaskTemplate.create !== 'function') {
        throw new Error('Subtask templates are not supported in this environment');
      }

      await base44.entities.SubtaskTemplate.create({
        name: templateName,
        subtasks: subtaskData,
        category: 'custom',
        is_public: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtask-templates'] });
      toast.success('Template saved');
    },
    onError: (err) => {
      console.error('Failed to save template', err);
      toast.error(err?.message || 'Failed to save template');
    },
  });

  const applyTemplateMutation = useMutation({
    mutationFn: async (template) => {
      const createdSubtasks = [];
      for (const subtaskData of template.subtasks) {
        const created = await base44.entities.Task.create({
          title: subtaskData.title,
          parent_task_id: parentTaskId,
          project_id: projectId,
          task_type: 'subtask',
          status: 'todo',
          priority: subtaskData.priority || 'medium',
          estimated_hours: subtaskData.estimated_hours,
          order: createdSubtasks.length,
          sprint_id: parentSprintId || null,
        });
        createdSubtasks.push(created);
      }

      // Apply dependencies
      for (let i = 0; i < template.subtasks.length; i++) {
        const deps = template.subtasks[i].dependencies || [];
        if (deps.length > 0) {
          const blockedByIds = deps.map(depIdx => createdSubtasks[depIdx]?.id).filter(Boolean);
          if (blockedByIds.length > 0) {
            await base44.entities.Task.update(createdSubtasks[i].id, {
              blocked_by_task_ids: blockedByIds,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      toast.success('Template applied');
      setShowTemplates(false);
    },
  });

  const handleAddSubtask = () => {
    if (!newTitle.trim()) return;
    const payload = {
      title: newTitle.trim(),
      description: newDescription.trim(),
      parent_task_id: parentTaskId,
      project_id: projectId,
      task_type: 'subtask',
      status: 'todo',
      priority: newPriority,
      assignee_email: newAssignees[0] || null,
      assignees: newAssignees,
      attachments: newAttachments,
      start_date: newStartDate ? format(newStartDate, 'yyyy-MM-dd') : null,
      due_date: newEndDate ? format(newEndDate, 'yyyy-MM-dd') : null,
      order: subtasks.length,
      sprint_id: parentSprintId || null,
    };

    console.debug('Subtask create payload:', payload);
    createSubtaskMutation.mutate(payload);
  };

  const handleToggleStatus = (subtask) => {
    const currentStatus = subtask.status || 'todo';
    const statusOrder = ['todo', 'in_progress', 'done'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];
    updateSubtaskMutation.mutate({ id: subtask.id, data: { status: nextStatus } });
  };

  const handleInlineEdit = (subtask) => {
    setEditingId(subtask.id);
    setEditTitle(subtask.title);
  };

  const handleSaveInlineEdit = (id) => {
    if (editTitle.trim()) {
      updateSubtaskMutation.mutate({ id, data: { title: editTitle.trim() } });
    }
    setEditingId(null);
  };

  const handleSelectAll = () => {
    if (selectedSubtasks.length === subtasks.length) {
      setSelectedSubtasks([]);
    } else {
      setSelectedSubtasks(subtasks.map(s => s.id || s._id));
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedSubtasks.length} subtasks?`)) {
      selectedSubtasks.forEach(id => deleteSubtaskMutation.mutate(id));
      setSelectedSubtasks([]);
    }
  };

  const handleBulkAssign = (assignees) => {
    selectedSubtasks.forEach(id =>
      updateSubtaskMutation.mutate({ id, data: { assignees } })
    );
    setSelectedSubtasks([]);
    toast.success('Bulk assigned');
  };

  const handleAddComment = (subtask) => {
    if (!commentText.trim()) return;

    const comments = subtask.subtask_comments || [];
    comments.push({
      text: commentText,
      author: users.find(u => u.email)?.email || 'unknown',
      timestamp: new Date().toISOString(),
    });

    updateSubtaskMutation.mutate({
      id: subtask.id,
      data: { subtask_comments: comments }
    });

    setCommentText('');
    setCommentingId(null);
  };

  const handleStartTimer = (id) => {
    setTrackingId(id);
    setTrackingStart(Date.now());

    timerInterval.current = setInterval(() => {
      // Force re-render to update timer display
      setTrackingStart(prev => prev);
    }, 1000);
  };

  const handleStopTimer = (subtask) => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
    }

    const elapsed = Math.floor((Date.now() - trackingStart) / 1000 / 60); // minutes
    const totalTracked = (subtask.subtask_time_tracked || 0) + elapsed;

    updateSubtaskMutation.mutate({
      id: subtask.id,
      data: { subtask_time_tracked: totalTracked },
    });

    setTrackingId(null);
    setTrackingStart(null);
    toast.success(`Tracked ${elapsed} minutes`);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(subtasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order for all affected subtasks
    items.forEach((item, index) => {
      if (item.order !== index) {
        const iid = item.id || item._id;
        updateSubtaskMutation.mutate({ id: iid, data: { order: index } });
      }
    });
  };

  const completedCount = subtasks.filter(s => s.status === 'done').length;
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const sortedSubtasks = [...subtasks].sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {subtasks.length > 0 && (
            <>
              <Progress value={progress} className="flex-1 h-2" />
              <span className="text-sm text-slate-500 whitespace-nowrap">
                {completedCount}/{subtasks.length} done
              </span>
            </>
          )}
        </div>

        <div className="flex gap-2 ml-4">
          {selectedSubtasks.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={handleBulkDelete}>
                <Trash2 className="w-3 h-3 mr-1" />
                Delete ({selectedSubtasks.length})
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Bulk Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setSelectedSubtasks([])}>
                    Clear Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <FileText className="w-3 h-3 mr-1" />
                Templates
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Subtask Templates</DialogTitle>
                <DialogDescription>Apply or save subtask templates</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {templates.map(template => (
                  <div key={template.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-slate-500">{template.subtasks?.length || 0} subtasks</div>
                    </div>
                    <Button size="sm" onClick={() => applyTemplateMutation.mutate(template)}>
                      Apply
                    </Button>
                  </div>
                ))}
                {subtasks.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const name = prompt('Template name:');
                      if (name) saveTemplateMutation.mutate(name);
                    }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Current as Template
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Select */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selectedSubtasks.length === subtasks.length}
            onCheckedChange={handleSelectAll}
          />
          <span className="text-slate-600">Select All</span>
        </div>
      )}

      {/* Subtask List - Drag & Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="subtasks">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {sortedSubtasks.map((subtask, index) => (
                // normalize id shape: some backends return `_id` instead of `id`
                (() => {
                  const sid = subtask.id || subtask._id;
                  return (
                    <Draggable key={sid} draggableId={sid} index={index}>
                      {(provided, snapshot) => (
                        <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border bg-white group transition-shadow",
                        snapshot.isDragging && "shadow-lg",
                        subtask.status === 'done' && "bg-slate-50",
                        subtask.status === 'blocked' && "border-red-200 bg-red-50"
                      )}
                    >
                      {/* Bulk Select Checkbox */}
                      <Checkbox
                        checked={selectedSubtasks.includes(sid)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSubtasks([...selectedSubtasks, sid]);
                          } else {
                            setSelectedSubtasks(selectedSubtasks.filter(id => id !== sid));
                          }
                        }}
                      />

                      {/* Drag Handle */}
                      <div {...provided.dragHandleProps}>
                        <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-500 cursor-grab" />
                      </div>

                      {/* Status Toggle */}
                      <button onClick={() => handleToggleStatus({ ...subtask, id: sid })} className="flex-shrink-0">
                        {(() => {
                          const StatusIcon = statusConfig[subtask.status]?.icon || Circle;
                          const color = subtask.status === 'done'
                            ? 'text-emerald-500'
                            : subtask.status === 'blocked'
                              ? 'text-red-500'
                              : subtask.status === 'in_progress'
                                ? 'text-blue-500'
                                : 'text-slate-300';
                          return <StatusIcon className={cn('w-5 h-5', color)} />;
                        })()}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {editingId === sid ? (
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleSaveInlineEdit(sid)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineEdit(sid);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="h-7 text-sm"
                          />
                        ) : (
                          <div
                            className={cn(
                              "text-sm font-medium cursor-pointer hover:text-indigo-600",
                              subtask.status === 'done' && "line-through text-slate-500"
                            )}
                            onClick={() => handleInlineEdit({ ...subtask, id: sid })}
                          >
                            {subtask.title}
                          </div>
                        )}

                        {subtask.description && (
                          <div className="text-xs text-slate-500 line-clamp-2 mt-1">
                            {subtask.description}
                          </div>
                        )}

                        {/* Metadata Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("text-xs", statusConfig[subtask.status]?.color || 'bg-slate-100')}>
                            {statusConfig[subtask.status]?.label || 'Todo'}
                          </Badge>
                          <Badge className={cn("text-xs", priorityConfig[subtask.priority]?.color)}>
                            {subtask.priority || 'medium'}
                          </Badge>

                          {/* Start Date */}
                          {subtask.start_date && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              Start: {format(new Date(subtask.start_date), 'MMM d')}
                            </Badge>
                          )}

                          {/* Due Date */}
                          {subtask.due_date && (
                            <Badge variant="outline" className="text-xs">
                              <Calendar className="w-3 h-3 mr-1" />
                              Due: {format(new Date(subtask.due_date), 'MMM d')}
                            </Badge>
                          )}

                          {/* Time Estimate */}
                          {subtask.estimated_hours && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {subtask.estimated_hours}h
                            </Badge>
                          )}

                          {/* Effort Points */}
                          {subtask.subtask_effort_points && (
                            <Badge variant="outline" className="text-xs">
                              <Zap className="w-3 h-3 mr-1" />
                              {subtask.subtask_effort_points} pts
                            </Badge>
                          )}

                          {/* Dependencies */}
                          {subtask.blocked_by_task_ids && subtask.blocked_by_task_ids.length > 0 && (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              Depends on {subtask.blocked_by_task_ids.length}
                            </Badge>
                          )}

                          {/* Comments Count */}
                          {subtask.subtask_comments && subtask.subtask_comments.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setCommentingId(commentingId === subtask.id ? null : subtask.id)}
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              {subtask.subtask_comments.length}
                            </Button>
                          )}

                          {/* Time Tracked */}
                          {subtask.subtask_time_tracked > 0 && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              <Clock className="w-3 h-3 mr-1" />
                              {Math.floor(subtask.subtask_time_tracked / 60)}h {subtask.subtask_time_tracked % 60}m
                            </Badge>
                          )}
                        </div>

                        {/* Comments Section */}
                        {commentingId === subtask.id && (
                          <div className="space-y-2 mt-2 p-2 bg-slate-50 rounded">
                            {subtask.subtask_comments?.map((comment, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{comment.author}:</span> {comment.text}
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Input
                                placeholder="Add comment..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="h-7 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddComment({ ...subtask, id: sid });
                                }}
                              />
                              <Button size="sm" onClick={() => handleAddComment({ ...subtask, id: sid })}>
                                Add
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Assignees */}
                      <div className="flex items-center gap-2">
                        {subtask.assignees && subtask.assignees.length > 0 && (
                          <div className="flex -space-x-2">
                            {subtask.assignees.slice(0, 3).map((email, idx) => {
                              const user = users.find(u => u.email === email);
                              const initials = user?.full_name
                                ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)
                                : email.slice(0, 2);
                              return (
                                <Avatar key={idx} className="w-7 h-7 border-2 border-white">
                                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                                    {initials.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {subtask.assignees.length > 3 && (
                              <Avatar className="w-7 h-7 border-2 border-white">
                                <AvatarFallback className="bg-slate-100 text-slate-600 text-[9px]">
                                  +{subtask.assignees.length - 3}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}

                        {/* Timer */}
                        {trackingId === sid ? (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => handleStopTimer({ ...subtask, id: sid })}
                          >
                            <Pause className="w-3 h-3 text-red-600" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => handleStartTimer(sid)}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        )}

                        {/* Actions Menu */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-7 h-7 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={createPageUrl(`EditTask?id=${sid}`)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => duplicateSubtaskMutation.mutate({ ...subtask, id: sid })}>
                              <Copy className="w-4 h-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => convertToTaskMutation.mutate({ ...subtask, id: sid })}>
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Convert to Task
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCommentingId(sid)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Add Comment
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteSubtaskMutation.mutate(sid)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                    </Draggable>
                  );
                })()
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Subtask Form */}
      {can('subtasks', 'create') && isAdding ? (
        <div className="p-3 border border-slate-200 rounded-lg space-y-3 bg-slate-50">
          <Input
            placeholder="Subtask title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) handleAddSubtask();
              if (e.key === 'Escape') setIsAdding(false);
            }}
          />
          <Textarea
            placeholder="Description (optional)..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1">
              <UserMultiSelect
                users={users}
                departments={departments}
                selectedEmails={newAssignees}
                onChange={setNewAssignees}
                placeholder="Assignees..."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Calendar className="w-3 h-3 mr-1" />
                  {newStartDate ? format(newStartDate, 'MMM d') : 'Start Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarUI
                  mode="single"
                  selected={newStartDate}
                  onSelect={(date) => {
                    setNewStartDate(date);
                    setStartDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Calendar className="w-3 h-3 mr-1" />
                  {newEndDate ? format(newEndDate, 'MMM d') : 'End Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarUI
                  mode="single"
                  selected={newEndDate}
                  onSelect={(date) => {
                    setNewEndDate(date);
                    setEndDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <FileUpload
            files={newAttachments}
            onUpload={(file) => setNewAttachments(prev => [...prev, file])}
            onRemove={(i) => setNewAttachments(prev => prev.filter((_, idx) => idx !== i))}
            compact
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAddSubtask} disabled={!newTitle.trim() || createSubtaskMutation.isLoading}>
              {createSubtaskMutation.isLoading ? 'Adding...' : 'Add Subtask'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : can('subtasks', 'create') ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Subtask
        </Button>
      ) : null}
    </div>
  );
}