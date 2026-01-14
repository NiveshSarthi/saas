// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  Plus,
  GripVertical,
  Archive,
  ArrowRight,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Tag,
  Flag,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
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
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { BACKLOG_FILTERS } from '@/components/filters/filterConfigs';

const priorityConfig = {
  critical: { color: 'bg-red-100 text-red-700', icon: 'text-red-500' },
  high: { color: 'bg-orange-100 text-orange-700', icon: 'text-orange-500' },
  medium: { color: 'bg-blue-100 text-blue-700', icon: 'text-blue-500' },
  low: { color: 'bg-slate-100 text-slate-700', icon: 'text-slate-400' },
};

export default function Backlog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [filterTag, setFilterTag] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState({
    priority: [],
    task_type: [],
    has_story_points: '',
    created_by: [],
    age_days: ''
  });
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ['backlog-tasks'],
    queryFn: () => base44.entities.Task.filter({ status: 'backlog' }, 'order'),
  });

  const tasks = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return rawTasks;
    return rawTasks.filter(t =>
      t.reporter_email === user.email ||
      t.assignee_email === user.email ||
      (t.assignees && t.assignees.includes(user.email))
    );
  }, [rawTasks, user]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['active-sprints'],
    queryFn: () => base44.entities.Sprint.filter({ status: 'active' }),
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'backlog'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'backlog' }),
    enabled: !!user,
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlog-tasks'] });
    },
  });

  const applyAdvancedFilters = (task) => {
    // Priority filter
    if (advancedFilters.priority?.length > 0 && !advancedFilters.priority.includes(task.priority)) {
      return false;
    }
    // Task type filter
    if (advancedFilters.task_type?.length > 0 && !advancedFilters.task_type.includes(task.task_type)) {
      return false;
    }
    // Project filter (from advanced)
    if (advancedFilters.project_id && task.project_id !== advancedFilters.project_id) {
      return false;
    }
    // Estimation status
    if (advancedFilters.estimation_status === 'estimated' && !task.story_points && !task.estimated_hours) {
      return false;
    }
    if (advancedFilters.estimation_status === 'unestimated' && (task.story_points || task.estimated_hours)) {
      return false;
    }
    // Created by
    if (advancedFilters.created_by?.length > 0 && !advancedFilters.created_by.includes(task.created_by)) {
      return false;
    }
    // Age filter
    if (advancedFilters.age) {
      const daysSinceCreated = task.created_date
        ? (Date.now() - new Date(task.created_date).getTime()) / (1000 * 60 * 60 * 24)
        : 0;

      switch (advancedFilters.age) {
        case 'new_7':
          if (daysSinceCreated > 7) return false;
          break;
        case 'recent_30':
          if (daysSinceCreated > 30) return false;
          break;
        case 'stale_30':
          if (daysSinceCreated <= 30) return false;
          break;
      }
    }
    return true;
  };

  // Extract all unique tags from tasks
  const allTags = useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const filteredTasks = tasks.filter(task => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(task)) return false;

    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterTag !== 'all') {
      const taskTags = task.tags || [];
      if (!taskTags.includes(filterTag)) {
        return false;
      }
    }
    if (selectedProject !== 'all' && task.project_id !== selectedProject) {
      return false;
    }
    return true;
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedTasks = Array.from(filteredTasks);
    const [removed] = reorderedTasks.splice(result.source.index, 1);
    reorderedTasks.splice(result.destination.index, 0, removed);

    reorderedTasks.forEach((task, index) => {
      if (task.order !== index) {
        updateTaskMutation.mutate({ id: task.id, data: { order: index } });
      }
    });
  };

  const handleBulkMove = (status) => {
    selectedTasks.forEach(taskId => {
      updateTaskMutation.mutate({ id: taskId, data: { status } });
    });
    setSelectedTasks([]);
  };

  const handleMoveToSprint = (sprintId) => {
    selectedTasks.forEach(taskId => {
      updateTaskMutation.mutate({ id: taskId, data: { sprint_id: sprintId, status: 'todo' } });
    });
    setSelectedTasks([]);
  };

  const toggleTaskSelection = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAll = () => {
    if (selectedTasks.length === filteredTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filteredTasks.map(t => t.id));
    }
  };

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: user?.email,
      is_global: user?.role === 'admin'
    });
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
  };

  const handleLoadFilter = (savedFilter) => {
    setAdvancedFilters(savedFilter.filters);
  };

  const handleDeleteFilter = async (filterId) => {
    await base44.entities.SavedFilter.delete(filterId);
    queryClient.invalidateQueries({ queryKey: ['saved-filters'] });
  };

  const handleRemoveFilter = (field) => {
    setAdvancedFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
  };

  const handleClearAllFilters = () => {
    setAdvancedFilters({});
  };

  // Backlog metrics
  const metrics = {
    total: tasks.length,
    highPriority: tasks.filter(t => t.priority === 'critical' || t.priority === 'high').length,
    unestimated: tasks.filter(t => !t.story_points && !t.estimated_hours).length,
    stale: tasks.filter(t => {
      if (!t.updated_date) return false;
      const daysSinceUpdate = (Date.now() - new Date(t.updated_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate > 30;
    }).length
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Backlog</h1>
          <p className="text-slate-500 mt-1">{metrics.total} items · Drag to prioritize</p>
        </div>
        <Link to={createPageUrl('NewTask?status=backlog')}>
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Add to Backlog
          </Button>
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{metrics.total}</p>
          <p className="text-sm text-slate-500">Total Items</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-orange-600">{metrics.highPriority}</p>
          <p className="text-sm text-slate-500">High Priority</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-amber-600">{metrics.unestimated}</p>
          <p className="text-sm text-slate-500">Unestimated</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-400">{metrics.stale}</p>
          <p className="text-sm text-slate-500">Stale (30+ days)</p>
        </div>
      </div>

      {/* Filter Chips */}
      {Object.keys(advancedFilters).length > 0 && (
        <FilterChips
          filters={advancedFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
          moduleConfig={BACKLOG_FILTERS}
        />
      )}

      {/* Filters & Bulk Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search backlog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-[150px]">
            <Tag className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            {allTags.length === 0 ? (
              <SelectItem value="none" disabled>No tags found</SelectItem>
            ) : (
              allTags.map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => setShowAdvancedFilter(true)}>
          <Filter className="w-4 h-4 mr-2" />
          Advanced
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedTasks.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between">
          <span className="font-medium text-indigo-900">
            {selectedTasks.length} item{selectedTasks.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBulkMove('todo')}>
              <ArrowRight className="w-4 h-4 mr-1" />
              Move to To Do
            </Button>
            {sprints.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    Move to Sprint
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {sprints.map(sprint => (
                    <DropdownMenuItem
                      key={sprint.id}
                      onClick={() => handleMoveToSprint(sprint.id)}
                    >
                      {sprint.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button size="sm" variant="outline" onClick={() => handleBulkMove('archived')}>
              <Archive className="w-4 h-4 mr-1" />
              Archive
            </Button>
          </div>
        </div>
      )}

      {/* Backlog List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {/* Select All */}
        <div className="flex items-center gap-4 p-4 border-b border-slate-100">
          <Checkbox
            checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
            onCheckedChange={selectAll}
          />
          <span className="text-sm text-slate-500">
            {selectedTasks.length > 0 ? `${selectedTasks.length} selected` : 'Select all'}
          </span>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="backlog">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {filteredTasks.map((task, index) => (
                  <Draggable key={task.id || task._id} draggableId={task.id || task._id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "flex items-center gap-4 p-4 border-b border-slate-100 hover:bg-slate-50",
                          snapshot.isDragging && "shadow-lg bg-white rounded-lg"
                        )}
                      >
                        <div {...provided.dragHandleProps}>
                          <GripVertical className="w-5 h-5 text-slate-300 cursor-grab" />
                        </div>

                        <Checkbox
                          checked={selectedTasks.includes(task.id)}
                          onCheckedChange={() => toggleTaskSelection(task.id)}
                        />

                        <div className="flex-1 min-w-0">
                          <Link
                            to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
                            className="font-medium text-slate-900 hover:text-indigo-600"
                          >
                            {task.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className={cn("text-xs", priorityConfig[task.priority]?.color)}>
                              {task.priority}
                            </Badge>
                            {task.story_points && (
                              <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded font-medium">
                                {task.story_points} pts
                              </span>
                            )}
                            {(task.tags || []).slice(0, 2).map((tag, i) => (
                              <span key={i} className="text-xs text-slate-500">#{tag}</span>
                            ))}
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateTaskMutation.mutate({
                              id: task.id,
                              data: { status: 'todo' }
                            })}>
                              Move to To Do
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-slate-500">
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Archive className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>No items in backlog</p>
          </div>
        )}
      </div>

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        filters={advancedFilters}
        onApplyFilters={setAdvancedFilters}
        moduleConfig={BACKLOG_FILTERS}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />
    </div>
  );
}