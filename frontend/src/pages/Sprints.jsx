import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Plus,
  Play,
  CheckCircle2,
  Calendar,
  Target,
  MoreHorizontal,
  Edit,
  Trash2,
  Filter,
  X,
  Search,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CreateSprintDialog from '@/components/sprints/CreateSprintDialog';

export default function Sprints() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('project');
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [deletingSprint, setDeletingSprint] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || null);
  const [filterUser, setFilterUser] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterTags, setFilterTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('card');

  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ['all-projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 2000),
    enabled: !!user,
  });

  const project = projectId ? projects.find(p => p.id === projectId) : null;

  // Filter projects based on user permissions
  const visibleProjects = React.useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return projects;

    // Show projects where user is owner or member, OR if it's the Syndicate project (visible to all)
    return projects.filter(p =>
      p.name === 'Syndicate' ||
      p.owner_email === user.email ||
      (p.members && p.members.includes(user.email))
    );
  }, [projects, user]);

  const visibleProjectIds = visibleProjects.map(p => String(p.id || p._id));

  const { data: allSprints = [], isLoading } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => base44.entities.Sprint.list('-created_date', 2000),
    enabled: !!user,
  });

  const debugShowAll = urlParams.get('debugShowAll') === '1';


  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-tasks-for-sprints'],
    queryFn: () => base44.entities.Task.list('-created_date', 2000),
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-for-filter'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list('name'),
    enabled: !!user,
  });

  // Filter sprints to only show those from visible projects OR where ANY user has assigned tasks
  const sprints = React.useMemo(() => {
    // If user or projects not loaded yet, show all sprints to avoid flicker
    if (!user || (projects && projects.length === 0)) {
      return allSprints;
    }
    // Get sprint IDs that have ANY tasks assigned
    const sprintsWithTasks = new Set(
      allTasks
        .filter(t => t.sprint_id && (t.assignee_email || (t.assignees && t.assignees.length > 0)))
        .map(t => String(t.sprint_id))
    );

    let filtered;
    if (user?.role === 'admin') {
      filtered = allSprints;
    } else {
      // Show sprints from visible projects OR that have tasks assigned to anyone
      filtered = allSprints.filter(s =>
        visibleProjectIds.includes(String(s.project_id)) || sprintsWithTasks.has(String(s.id))
      );
    }

    // If projectId is specified in URL, filter to that project only
    if (projectId) {
      filtered = filtered.filter(s => String(s.project_id) === String(projectId));
    }

    // Apply user filter
    if (filterUser !== 'all') {
      filtered = filtered.filter(sprint => {
        const sprintTasks = allTasks.filter(t => String(t.sprint_id) === String(sprint.id));
        return sprintTasks.some(t =>
          t.assignee_email === filterUser ||
          (t.assignees && t.assignees.includes(filterUser))
        );
      });
    }

    // Apply project filter (when not already filtered by URL param)
    if (!projectId && filterProject !== 'all') {
      filtered = filtered.filter(sprint => String(sprint.project_id) === String(filterProject));
    }

    // Apply tags filter
    if (filterTags.length > 0) {
      filtered = filtered.filter(sprint => {
        const sprintTasks = allTasks.filter(t => t.sprint_id === sprint.id);
        return sprintTasks.some(t =>
          t.tags && t.tags.some(tag => filterTags.includes(tag))
        );
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sprint =>
        sprint.name?.toLowerCase().includes(query) ||
        sprint.goal?.toLowerCase().includes(query)
      );
    }

    console.log('Sprints: filtering sprints', {
      allSprintsCount: allSprints.length,
      visibleProjectIds,
      userRole: user?.role,
      isAdmin: user?.role === 'admin',
      allTasksCount: allTasks.length,
      filteredCount: filtered.length,
      projectId,
      filterUser,
      filterProject,
      filterTags,
      searchQuery
    });

    return filtered;
  }, [allSprints, visibleProjectIds, user, allTasks, projectId, filterUser, filterProject, filterTags, searchQuery]);

  // Debugging: log key data for diagnosis after `sprints` is derived
  React.useEffect(() => {
    try {
      const sampleAll = (allSprints || []).slice(0, 6).map(s => ({ id: s.id || s._id, project_id: s.project_id, name: s.name }));
      const sampleFiltered = (sprints || []).slice(0, 6).map(s => ({ id: s.id || s._id, project_id: s.project_id, name: s.name }));
      console.debug('Sprints.debug', {
        user: user ? { email: user.email, role: user.role } : null,
        projectsCount: projects.length,
        visibleProjectIds,
        allSprintsCount: (allSprints || []).length,
        allSprintsSample: sampleAll,
        filteredCount: (sprints || []).length,
        filteredSample: sampleFiltered,
      });
    } catch (e) {
      console.debug('Sprints.debug logging failed', e);
    }
  }, [allSprints, sprints, projects, user, visibleProjectIds]);

  const createSprintMutation = useMutation({
    mutationFn: (data) => base44.entities.Sprint.create(data),
    onSuccess: (created, variables) => {
      try {
        // Normalize created sprint id and project_id to strings for consistent comparisons
        const normalizedSprint = { ...(created || {}) };
        normalizedSprint.id = String(created?.id || created?._id || '');

        // If backend did not return project_id, fall back to the variables passed to mutate
        if (created?.project_id !== undefined && created?.project_id !== null) {
          normalizedSprint.project_id = String(created.project_id);
        } else if (variables?.project_id) {
          normalizedSprint.project_id = String(variables.project_id);
        }

        console.debug('Sprints.create onSuccess - created:', created, 'variables:', variables, 'normalized:', normalizedSprint);

        queryClient.setQueryData(['sprints'], (old = []) => {
          if (!normalizedSprint) return old || [];
          const exists = (old || []).some(s => String(s.id || s._id) === normalizedSprint.id && normalizedSprint.id !== '');
          return exists ? old : [normalizedSprint, ...(old || [])];
        });
        // Debugging: log cache and notify user
        try {
          const cache = queryClient.getQueryData(['sprints']) || [];
          console.debug('Sprints.cache after append', cache.length, cache.slice(0,3));
          toast.success(`Sprint created (${normalized.name || normalized.id || 'unknown'})`);
        } catch (e) {
          console.debug('Failed to read sprints cache', e);
        }
      } catch (e) {
        console.warn('Failed to append created sprint to cache', e);
      }

      // Trigger a refetch but ensure the normalized sprint remains visible
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      // Re-append normalized sprint after refetch completes (safeguard)
      setTimeout(() => {
        try {
          queryClient.setQueryData(['sprints'], (old = []) => {
            if (!normalizedSprint) return old || [];
            const exists = (old || []).some(s => String(s.id || s._id) === normalizedSprint.id && normalizedSprint.id !== '');
            return exists ? old : [normalizedSprint, ...(old || [])];
          });
        } catch (e) {
          console.debug('Failed to re-append normalized sprint after refetch', e);
        }
      }, 800);
      setShowCreateDialog(false);
      setSelectedProjectId(null);
    },
  });

  const updateSprintMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sprint.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      setEditingSprint(null);
    },
  });

  const deleteSprintMutation = useMutation({
    mutationFn: (id) => base44.entities.Sprint.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints'] });
      setDeletingSprint(null);
      toast.success('Sprint deleted');
    },
    onError: (err) => {
      console.error('Failed to delete sprint', err);
      toast.error(err?.message || 'Failed to delete sprint');
      setDeletingSprint(null);
    }
  });

  const getSprintTasks = (sprintId) => allTasks.filter(t => String(t.sprint_id) === String(sprintId));

  const getSprintProgress = (sprintId) => {
    const tasks = getSprintTasks(sprintId);
    if (tasks.length === 0) return 0;
    const done = tasks.filter(t => t.status === 'done').length;
    return Math.round((done / tasks.length) * 100);
  };

  const displayedSprints = debugShowAll ? allSprints : sprints;

  const activeSprints = displayedSprints.filter(s => s.status === 'active');
  const plannedSprints = displayedSprints.filter(s => s.status === 'planned');
  const completedSprints = displayedSprints.filter(s => s.status === 'completed');

  const SprintListView = ({ sprints }) => {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-white/50 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Sprint Name</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Tasks</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Points</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Duration</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Left</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Progress</th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700">Dates</th>
                <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sprints.map((sprint) => {
                const tasks = getSprintTasks(sprint.id);
                const progress = getSprintProgress(sprint.id);
                const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
                const completedPoints = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);
                const daysRemaining = sprint.end_date
                  ? Math.max(0, differenceInDays(parseISO(sprint.end_date), new Date()))
                  : null;
                const totalDays = sprint.start_date && sprint.end_date
                  ? differenceInDays(parseISO(sprint.end_date), parseISO(sprint.start_date))
                  : 0;
                const subtasksCount = allTasks.filter(t =>
                  t.parent_task_id && tasks.some(parentTask => parentTask.id === t.parent_task_id)
                ).length;

                return (
                  <tr key={sprint.id || sprint._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <Link to={createPageUrl(`SprintBoard?id=${sprint.id}`)}>
                        <div className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                          {sprint.name}
                        </div>
                        {sprint.goal && (
                          <div className="text-xs text-slate-500 mt-1 line-clamp-1">{sprint.goal}</div>
                        )}
                      </Link>
                    </td>
                    <td className="p-4">
                      <Badge className={cn(
                        "text-xs font-semibold",
                        sprint.status === 'active' && "bg-emerald-500 text-white",
                        sprint.status === 'planned' && "bg-blue-500 text-white",
                        sprint.status === 'completed' && "bg-violet-500 text-white"
                      )}>
                        {sprint.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-slate-900">{tasks.length}</div>
                      {subtasksCount > 0 && (
                        <div className="text-xs text-slate-500">+{subtasksCount} subtasks</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-indigo-600">
                        {completedPoints}/{totalPoints}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-semibold text-slate-900">{totalDays}d</div>
                    </td>
                    <td className="p-4">
                      <div className={cn(
                        "text-sm font-semibold",
                        sprint.status === 'completed' ? "text-violet-600" :
                          daysRemaining <= 2 ? "text-red-600" : "text-emerald-600"
                      )}>
                        {sprint.status === 'completed'
                          ? sprint.velocity || 0
                          : daysRemaining !== null ? `${daysRemaining}d` : '-'
                        }
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[100px]">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              sprint.status === 'active' && "bg-gradient-to-r from-emerald-500 to-teal-600",
                              sprint.status === 'planned' && "bg-gradient-to-r from-blue-500 to-indigo-600",
                              sprint.status === 'completed' && "bg-gradient-to-r from-violet-500 to-purple-600"
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600 min-w-[35px]">{progress}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-slate-600">
                        {sprint.start_date ? format(parseISO(sprint.start_date), 'MMM d') : 'Not started'}
                        {sprint.end_date && ` - ${format(parseISO(sprint.end_date), 'MMM d, yyyy')}`}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingSprint(sprint)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Sprint
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => setDeletingSprint(sprint)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Sprint
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const SprintCard = ({ sprint, index }) => {
    const tasks = getSprintTasks(sprint.id);
    const progress = getSprintProgress(sprint.id);
    const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completedPoints = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);
    const daysRemaining = sprint.end_date
      ? Math.max(0, differenceInDays(parseISO(sprint.end_date), new Date()))
      : null;
    const totalDays = sprint.start_date && sprint.end_date
      ? differenceInDays(parseISO(sprint.end_date), parseISO(sprint.start_date))
      : 0;

    // Count subtasks
    const subtasksCount = allTasks.filter(t =>
      t.parent_task_id && tasks.some(parentTask => parentTask.id === t.parent_task_id)
    ).length;

    const statusStyles = {
      active: {
        gradient: 'from-emerald-500 to-teal-600',
        bg: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50',
        border: 'border-emerald-200',
        icon: <Play className="w-5 h-5 text-emerald-600" />,
        badge: 'bg-emerald-500 text-white'
      },
      planned: {
        gradient: 'from-blue-500 to-indigo-600',
        bg: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50',
        border: 'border-blue-200',
        icon: <Calendar className="w-5 h-5 text-blue-600" />,
        badge: 'bg-blue-500 text-white'
      },
      completed: {
        gradient: 'from-violet-500 to-purple-600',
        bg: 'bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50',
        border: 'border-violet-200',
        icon: <CheckCircle2 className="w-5 h-5 text-violet-600" />,
        badge: 'bg-violet-500 text-white'
      }
    };

    const style = statusStyles[sprint.status] || statusStyles.planned;

    return (
      <div className={cn(
        "group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
        style.bg,
        style.border
      )}>
        {/* Decorative gradient orb */}
        <div className={cn(
          "absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-20 blur-3xl transition-all group-hover:opacity-30",
          `bg-gradient-to-br ${style.gradient}`
        )} />

        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-start gap-3 flex-1">
              <div className={cn(
                "p-2.5 rounded-xl shadow-lg",
                `bg-gradient-to-br ${style.gradient}`
              )}>
                {style.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Link to={createPageUrl(`SprintBoard?id=${sprint.id}`)}>
                    <h3 className="font-bold text-lg text-slate-900 hover:text-indigo-600 transition-colors line-clamp-1">
                      {sprint.name}
                    </h3>
                  </Link>
                  <Badge className={cn("text-xs font-semibold px-2.5 py-0.5", style.badge)}>
                    {sprint.status.toUpperCase()}
                  </Badge>
                </div>
                {sprint.goal && (
                  <p className="text-sm text-slate-600 line-clamp-2">{sprint.goal}</p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-9 h-9 hover:bg-white/80 backdrop-blur-sm">
                  <MoreHorizontal className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditingSprint(sprint)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Sprint
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => setDeletingSprint(sprint)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Sprint
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">Tasks</div>
              <div className="text-2xl font-bold bg-gradient-to-br from-slate-700 to-slate-900 bg-clip-text text-transparent">
                {tasks.length}
              </div>
              {subtasksCount > 0 && (
                <div className="text-xs text-slate-500 mt-0.5">
                  +{subtasksCount} subtasks
                </div>
              )}
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">Points</div>
              <div className="text-2xl font-bold bg-gradient-to-br from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {completedPoints}/{totalPoints}
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">Duration</div>
              <div className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {totalDays}d
              </div>
            </div>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/50 shadow-sm">
              <div className="text-xs font-medium text-slate-500 mb-1">
                {sprint.status === 'completed' ? 'Velocity' : 'Left'}
              </div>
              <div className={cn(
                "text-2xl font-bold bg-gradient-to-br bg-clip-text text-transparent",
                sprint.status === 'completed' ? "from-violet-600 to-purple-600" :
                  daysRemaining <= 2 ? "from-red-600 to-orange-600" : "from-emerald-600 to-teal-600"
              )}>
                {sprint.status === 'completed'
                  ? sprint.velocity || 0
                  : daysRemaining !== null ? `${daysRemaining}d` : '-'
                }
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600">Progress</span>
              <span className={cn(
                "text-sm font-bold px-2 py-0.5 rounded-full",
                progress === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {progress}%
              </span>
            </div>
            <div className="relative h-3 bg-slate-200/50 rounded-full overflow-hidden">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
                  `bg-gradient-to-r ${style.gradient}`,
                  "shadow-lg"
                )}
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                {sprint.start_date ? format(parseISO(sprint.start_date), 'MMM d') : 'Not started'}
                {sprint.end_date && ` - ${format(parseISO(sprint.end_date), 'MMM d, yyyy')}`}
              </span>
            </div>
            <Link to={createPageUrl(`SprintBoard?id=${sprint.id}`)}>
              <Button
                className={cn(
                  "font-semibold shadow-lg hover:shadow-xl transition-all",
                  `bg-gradient-to-r ${style.gradient} hover:opacity-90`
                )}
              >
                <Target className="w-4 h-4 mr-2" />
                Open Board
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="relative">
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-10 blur-3xl" />

          <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl border-2 border-white/50 shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link to={project ? createPageUrl(`ProjectBoard?id=${project.id}`) : createPageUrl('Projects')}>
                  <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl hover:bg-indigo-100">
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Sprints
                  </h1>
                  {project && (
                    <p className="text-slate-600 font-medium mt-1">{project.name}</p>
                  )}
                </div>
              </div>

              <Button
                onClick={() => setShowCreateDialog(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all"
                disabled={visibleProjects.length === 0}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Sprint
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Filter className="w-4 h-4" />
                Filters:
              </div>

              <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1 ml-auto">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="h-8 px-3"
                >
                  <LayoutGrid className="w-4 h-4 mr-1.5" /> Cards
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 px-3"
                >
                  <ListIcon className="w-4 h-4 mr-1.5" /> List
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 w-20">
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search sprints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {!projectId && (
                <Select value={filterProject} onValueChange={setFilterProject}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {visibleProjects.map(p => (
                      <SelectItem key={String(p.id || p._id)} value={String(p.id || p._id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-48 justify-between">
                    <span className="truncate">
                      {filterTags.length === 0 ? 'All Tags' : `${filterTags.length} tag${filterTags.length > 1 ? 's' : ''}`}
                    </span>
                    <Filter className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {allTags.map(tag => (
                    <DropdownMenuItem
                      key={tag.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        setFilterTags(prev =>
                          prev.includes(tag.name)
                            ? prev.filter(t => t !== tag.name)
                            : [...prev, tag.name]
                        );
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={filterTags.includes(tag.name)}
                        className="mr-2"
                        readOnly
                      />
                      {tag.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {(filterUser !== 'all' || filterProject !== 'all' || filterTags.length > 0 || searchQuery) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterUser('all');
                    setFilterProject('all');
                    setFilterTags([]);
                    setSearchQuery('');
                  }}
                  className="text-slate-600 hover:text-slate-900"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Active Sprints */}
        {activeSprints.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Active Sprint{activeSprints.length > 1 ? 's' : ''}
                </h2>
              </div>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                {activeSprints.length}
              </div>
            </div>
            {viewMode === 'card' ? (
              <div className="grid gap-5">
                {activeSprints.map((sprint, idx) => (
                  <SprintCard key={sprint.id || sprint._id} sprint={sprint} index={idx} />
                ))}
              </div>
            ) : (
              <SprintListView sprints={activeSprints} />
            )}
          </div>
        )}

        {/* Planned Sprints */}
        {plannedSprints.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Planned Sprints
                </h2>
              </div>
              <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                {plannedSprints.length}
              </div>
            </div>
            {viewMode === 'card' ? (
              <div className="grid gap-5">
                {plannedSprints.map((sprint, idx) => (
                  <SprintCard key={sprint.id || sprint._id} sprint={sprint} index={idx} />
                ))}
              </div>
            ) : (
              <SprintListView sprints={plannedSprints} />
            )}
          </div>
        )}

        {/* Completed Sprints */}
        {completedSprints.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Completed Sprints
                </h2>
              </div>
              <div className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-bold">
                {completedSprints.length}
              </div>
            </div>
            {viewMode === 'card' ? (
              <div className="grid gap-5">
                {completedSprints.map((sprint, idx) => (
                  <SprintCard key={sprint.id || sprint._id} sprint={sprint} index={idx} />
                ))}
              </div>
            ) : (
              <SprintListView sprints={completedSprints} />
            )}
          </div>
        )}

        {/* Empty State */}
        {sprints.length === 0 && (
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 rounded-3xl opacity-50 blur-2xl" />
            <div className="relative text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border-2 border-white/50 shadow-xl">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Target className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">No sprints yet</h3>
              <p className="text-slate-600 mb-8 text-lg">Create your first sprint to start planning</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                disabled={visibleProjects.length === 0}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all px-6 py-6 text-base"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Your First Sprint
              </Button>
              {visibleProjects.length === 0 && (
                <p className="text-sm text-slate-500 mt-4 font-medium">
                  {user?.role === 'admin' ? 'Create a project first' : 'No accessible projects'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Create/Edit Dialog */}
        <CreateSprintDialog
          open={showCreateDialog || !!editingSprint}
          onClose={() => {
            setShowCreateDialog(false);
            setEditingSprint(null);
            setSelectedProjectId(projectId || null);
          }}
          sprint={editingSprint}
          projectId={selectedProjectId || projectId}
          projects={visibleProjects}
          onProjectChange={setSelectedProjectId}
          onSave={(data) => {
            if (editingSprint) {
              updateSprintMutation.mutate({ id: editingSprint.id, data });
            } else {
              createSprintMutation.mutate({ ...data, project_id: selectedProjectId || projectId });
            }
          }}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingSprint} onOpenChange={() => setDeletingSprint(null)}>
          <AlertDialogContent className="border-2 border-red-200">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl">Delete Sprint</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                Are you sure you want to delete "{deletingSprint?.name}"? Tasks in this sprint will be moved back to backlog.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const id = deletingSprint?.id || deletingSprint?._id;
                  if (!id) {
                    toast.error('No sprint selected to delete');
                    setDeletingSprint(null);
                    return;
                  }
                  deleteSprintMutation.mutate(id);
                }}
                className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700"
              >
                Delete Sprint
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}