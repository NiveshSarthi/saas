import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProjectTemplates from '@/components/projects/ProjectTemplates';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  FolderKanban,
  Users,
  Calendar,
  MoreHorizontal,
  Settings,
  Archive,
  Trash2,
  LayoutGrid,
  List,
  Code2,
  Building2,
  Layers,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { PROJECT_FILTERS } from '@/components/filters/filterConfigs';

const domainIcons = {
  it: Code2,
  real_estate: Building2,
  generic: Layers
};

const statusColors = {
  active: 'bg-emerald-100 text-emerald-700',
  on_hold: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-slate-100 text-slate-700'
};

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showTemplates, setShowTemplates] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user-projects'],
    queryFn: () => base44.auth.me(),
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'projects'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'projects' }),
    enabled: !!currentUser,
  });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 1000),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['all-tasks'],
    queryFn: () => base44.entities.Task.list('-updated_date', 2000),
  });

  const applyAdvancedFilters = (project) => {
    // Status filter
    if (advancedFilters.status?.length > 0 && !advancedFilters.status.includes(project.status)) {
      return false;
    }
    // Domain filter
    if (advancedFilters.domain?.length > 0 && !advancedFilters.domain.includes(project.domain)) {
      return false;
    }
    // Owner filter
    if (advancedFilters.owner_email && project.owner_email !== advancedFilters.owner_email) {
      return false;
    }
    return true;
  };

  const filteredProjects = projects.filter(project => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(project)) return false;

    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (!project.name.toLowerCase().includes(searchLower) &&
        !(project.description || '').toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && project.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: currentUser?.email,
      is_global: currentUser?.role === 'admin'
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

  const getProjectStats = (projectId) => {
    let projectTasks = tasks.filter(t => t.project_id === projectId);

    const today = format(new Date(), 'yyyy-MM-dd');

    // Filter out master recurring tasks and future recurring instances (same as ProjectBoard)
    projectTasks = projectTasks.filter(task => {
      if (task.is_recurring && !task.is_recurring_instance) return false;

      if (task.is_recurring_instance) {
        if (task.status === 'done') return false;
        if (!task.instance_date) return true;
        return task.instance_date <= today;
      }

      return true;
    });

    // Filter tasks based on user permissions
    if (currentUser && currentUser.role !== 'admin') {
      projectTasks = projectTasks.filter(t =>
        t.reporter_email === currentUser.email ||
        t.assignee_email === currentUser.email ||
        (t.assignees && t.assignees.includes(currentUser.email))
      );
    }

    const done = projectTasks.filter(t => t.status === 'done').length;
    const total = projectTasks.length;
    return {
      total,
      done,
      progress: total > 0 ? Math.round((done / total) * 100) : 0
    };
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden w-full">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl sm:rounded-3xl opacity-10 blur-3xl" />
          <div className="relative bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border-2 border-white/50 shadow-xl p-4 sm:p-5 md:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Projects
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">{projects.length} total projects</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setShowAdvancedFilter(true)} className="border-indigo-200 hover:bg-indigo-50">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
                <Button variant="outline" onClick={() => setShowTemplates(true)} className="border-purple-200 hover:bg-purple-50">
                  Use Template
                </Button>
                <Link to={createPageUrl('NewProject')}>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        {Object.keys(advancedFilters).length > 0 && (
          <FilterChips
            filters={advancedFilters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
            moduleConfig={{
              title: 'Project Filters',
              filters: Object.entries(PROJECT_FILTERS).map(([field, config]) => ({
                field,
                ...config
              }))
            }}
          />
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-lg">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-slate-200 focus:border-indigo-300"
            />
          </div>

          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="bg-white border-2 border-slate-200/50">
              <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">All</TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white">Active</TabsTrigger>
              <TabsTrigger value="on_hold" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white">On Hold</TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white">Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2 ml-auto">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : ''}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
              className={viewMode === 'list' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg' : ''}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 rounded-3xl opacity-50 blur-2xl" />
            <div className="relative text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border-2 border-white/50 shadow-xl">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <FolderKanban className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">No projects found</h3>
              <p className="text-slate-600 mb-8 text-lg">Create your first project to get started</p>
              <Link to={createPageUrl('NewProject')}>
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all px-6 py-6 text-base">
                  <Plus className="w-5 h-5 mr-2" />
                  Create Project
                </Button>
              </Link>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const DomainIcon = domainIcons[project.domain] || Layers;
              const stats = getProjectStats(project.id);

              return (
                <Link
                  key={project.id || project._id}
                  to={createPageUrl(`ProjectBoard?id=${project.id || project._id}`)}
                  className="block group"
                >
                  <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200/50 p-6 hover:shadow-2xl hover:border-indigo-300 hover:-translate-y-1 transition-all">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${project.color || '#6366F1'}20` }}
                        >
                          <DomainIcon className="w-6 h-6" style={{ color: project.color || '#6366F1' }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {project.name}
                          </h3>
                          <Badge className={cn("text-xs mt-1", statusColors[project.status])}>
                            {project.status?.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Description */}
                    {project.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                        {project.description}
                      </p>
                    )}

                    {/* Progress */}
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{stats.total} tasks</span>
                        <span className="font-medium text-slate-700">{stats.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${stats.progress}%`,
                            backgroundColor: project.color || '#6366F1'
                          }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      {/* Team */}
                      <div className="flex -space-x-2">
                        {(project.members || []).slice(0, 3).map((email, i) => (
                          <Avatar key={i} className="w-7 h-7 border-2 border-white">
                            <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                              {email.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {(project.members || []).length > 3 && (
                          <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-600">
                            +{project.members.length - 3}
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      {project.end_date && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(project.end_date), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {filteredProjects.map((project) => {
              const DomainIcon = domainIcons[project.domain] || Layers;
              const stats = getProjectStats(project.id);

              return (
                <Link
                  key={project.id || project._id}
                  to={createPageUrl(`ProjectBoard?id=${project.id || project._id}`)}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${project.color || '#6366F1'}20` }}
                  >
                    <DomainIcon className="w-5 h-5" style={{ color: project.color || '#6366F1' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900">{project.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{project.description}</p>
                  </div>

                  <Badge className={cn("text-xs", statusColors[project.status])}>
                    {project.status?.replace('_', ' ')}
                  </Badge>

                  <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
                    <span>{stats.total} tasks</span>
                    <span>·</span>
                    <span>{stats.progress}% complete</span>
                  </div>

                  <div className="hidden sm:flex -space-x-2">
                    {(project.members || []).slice(0, 3).map((email, i) => (
                      <Avatar key={i} className="w-6 h-6 border-2 border-white">
                        <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-600">
                          {email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <ProjectTemplates open={showTemplates} onOpenChange={setShowTemplates} />

        {/* Advanced Filter Panel */}
        <AdvancedFilterPanel
          isOpen={showAdvancedFilter}
          onClose={() => setShowAdvancedFilter(false)}
          filters={advancedFilters}
          onApplyFilters={setAdvancedFilters}
          moduleConfig={{
            status: {
              label: 'Status',
              type: 'multi-select',
              options: [
                { value: 'active', label: 'Active' },
                { value: 'on_hold', label: 'On Hold' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' }
              ]
            },
            domain: {
              label: 'Domain',
              type: 'multi-select',
              options: [
                { value: 'it', label: 'IT' },
                { value: 'real_estate', label: 'Real Estate' },
                { value: 'generic', label: 'Generic' }
              ]
            },
            owner_email: {
              label: 'Project Owner',
              type: 'user-select'
            }
          }}
          savedFilters={savedFilters}
          onSaveFilter={handleSaveFilter}
          onLoadFilter={handleLoadFilter}
          onDeleteFilter={handleDeleteFilter}
        />
      </div>
    </div>
  );
}