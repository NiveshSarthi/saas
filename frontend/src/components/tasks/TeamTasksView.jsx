import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isPast, addDays, isWithinInterval, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { Search, Calendar, AlertCircle, ArrowUpCircle, CheckCircle2, Circle, Clock, Flame, TrendingUp, Users as UsersIcon, Target, Download, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Filter, Play } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { jsPDF } from 'jspdf';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { TEAM_TASKS_FILTERS } from '@/components/filters/filterConfigs';

const statusConfig = {
  backlog: { label: 'Backlog', color: 'text-slate-400', bg: 'bg-slate-100' },
  todo: { label: 'To Do', color: 'text-blue-500', bg: 'bg-blue-50' },
  in_progress: { label: 'In Progress', color: 'text-amber-500', bg: 'bg-amber-50' },
  review: { label: 'Review', color: 'text-purple-500', bg: 'bg-purple-50' },
  done: { label: 'Done', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  blocked: { label: 'Blocked', color: 'text-red-500', bg: 'bg-red-50' },
};

const priorityConfig = {
  critical: { label: 'Critical', color: 'text-red-600 bg-red-100' },
  high: { label: 'High', color: 'text-orange-600 bg-orange-100' },
  medium: { label: 'Medium', color: 'text-blue-600 bg-blue-100' },
  low: { label: 'Low', color: 'text-slate-600 bg-slate-100' },
};

export default function TeamTasksView() {
  const [filters, setFilters] = useState({
    view: 'all', // 'all' or 'my_tasks'
    member: 'all',
    department: 'all',
    status: 'all',
    timeline: 'all',
    sprint: 'all',
    search: ''
  });
  const [exportDept, setExportDept] = useState('all');
  const [exportMember, setExportMember] = useState('all');
  const [exportSprint, setExportSprint] = useState('all');
  const [collapsedParents, setCollapsedParents] = useState(new Set());
  const [sortField, setSortField] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch current user
  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  // Fetch Users & Invitations
  const { data: teamData } = useQuery({
    queryKey: ['team-data-admin'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });

  const usersFromEntity = teamData?.users || [];
  const invitations = teamData?.invitations || [];

  const users = useMemo(() => [
    ...usersFromEntity,
    ...invitations
      .filter(inv => inv.status === 'accepted')
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
        role_id: inv.role_id,
      }))
  ], [usersFromEntity, invitations]);

  // Fetch Departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  // Fetch Tasks
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['all-tasks-admin'],
    queryFn: async () => {
      // Generate recurring instances
      await base44.functions.invoke('generateRecurringTaskInstances', {});

      const allTasks = await base44.entities.Task.list('-updated_date', 1000);

      const today = format(new Date(), 'yyyy-MM-dd');

      // Filter out master recurring tasks and future recurring instances
      return allTasks.filter(task => {
        if (task.is_recurring && !task.is_recurring_instance) return false;

        // For recurring instances, only show today's or overdue incomplete ones
        if (task.is_recurring_instance) {
          if (task.status === 'done') return false;
          if (!task.instance_date) return true;
          return task.instance_date <= today;
        }

        return true;
      });
    },
  });

  // Fetch Sprints
  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints'],
    queryFn: () => base44.entities.Sprint.list(),
  });

  // Fetch Projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-team'],
    queryFn: () => base44.entities.Project.list('-updated_date', 500)
  });

  // Get active sprints only for the logged-in user
  const activeSprints = useMemo(() => {
    if (!user) return [];

    const userTasks = tasks.filter(t =>
      t.assignee_email === user.email ||
      (t.assignees && t.assignees.includes(user.email))
    );

    const userSprintIds = new Set(userTasks.map(t => t.sprint_id).filter(Boolean));

    return sprints.filter(s => s.status === 'active' && s.status !== 'completed' && userSprintIds.has(s.id));
  }, [sprints, tasks, user]);

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'tasks'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'tasks' }),
    enabled: !!user,
  });

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Build task hierarchy - recursive
  const taskHierarchy = useMemo(() => {
    // Normalize keys: tasks may come with `id` or `_id` depending on source.
    // Index each task node by both `id` and `_id` (when present) to avoid
    // collisions where many tasks have `undefined` id and overwrite each other.
    const taskMap = new Map();

    tasks.forEach(t => {
      const node = JSON.parse(JSON.stringify({ ...t, subtasks: [] }));

      // Ensure a canonical `id` exists on the node for UI operations
      if (!node.id && node._id) node.id = node._id;

      if (node.id) taskMap.set(node.id, node);
      if (node._id && node._id !== node.id) taskMap.set(node._id, node);
    });

    const rootTasks = [];

    tasks.forEach(task => {
      const key = task.id || task._id;
      const taskNode = taskMap.get(key);
      if (!taskNode) return;

      const parentKey = task.parent_task_id;
      if (parentKey && taskMap.has(parentKey)) {
        taskMap.get(parentKey).subtasks.push(taskNode);
      } else if (!parentKey) {
        rootTasks.push(taskNode);
      }
    });

    return rootTasks;
  }, [tasks]);

  // Flatten hierarchy for display - recursive
  const flattenedTasks = useMemo(() => {
    const result = [];

    const flatten = (task, level = 0) => {
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const newTask = JSON.parse(JSON.stringify({ ...task, level, hasSubtasks, isSubtask: level > 0 }));
      result.push(newTask);

      if (!collapsedParents.has(task.id) && hasSubtasks) {
        task.subtasks.forEach(subtask => flatten(subtask, level + 1));
      }
    };

    taskHierarchy.forEach(task => flatten(task));
    return result;
  }, [taskHierarchy, collapsedParents]);

  const toggleParentCollapse = (taskId) => {
    setCollapsedParents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const applyAdvancedFilters = (task) => {
    // Status filter
    if (advancedFilters.status?.length > 0 && !advancedFilters.status.includes(task.status)) {
      return false;
    }
    // Priority filter
    if (advancedFilters.priority?.length > 0 && !advancedFilters.priority.includes(task.priority)) {
      return false;
    }
    // Task type filter
    if (advancedFilters.task_type?.length > 0 && !advancedFilters.task_type.includes(task.task_type)) {
      return false;
    }
    // Assignees filter
    if (advancedFilters.assignees?.length > 0) {
      const taskAssignees = task.assignees || (task.assignee_email ? [task.assignee_email] : []);
      if (!advancedFilters.assignees.some(email => taskAssignees.includes(email))) {
        return false;
      }
    }
    // Created by filter
    if (advancedFilters.created_by?.length > 0 && !advancedFilters.created_by.includes(task.created_by)) {
      return false;
    }
    // Project filter
    if (advancedFilters.project_id && task.project_id !== advancedFilters.project_id) {
      return false;
    }
    // Recurring filter
    if (advancedFilters.is_recurring === 'true' && !task.is_recurring) {
      return false;
    }
    if (advancedFilters.is_recurring === 'false' && task.is_recurring) {
      return false;
    }
    return true;
  };

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: user?.email,
      is_global: user?.role === 'admin'
    });
  };

  const handleLoadFilter = (savedFilter) => {
    setAdvancedFilters(savedFilter.filters);
  };

  const handleDeleteFilter = async (filterId) => {
    await base44.entities.SavedFilter.delete(filterId);
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

  const filteredTasks = useMemo(() => {
    let result = flattenedTasks.filter(task => {
      // Apply advanced filters first
      if (!applyAdvancedFilters(task)) return false;

      // Role-based filtering: Non-admins only see their own tasks
      if (user && user.role !== 'admin') {
        const isMyTask = task.assignee_email === user.email ||
          (task.assignees && task.assignees.includes(user.email)) ||
          (task.created_by === user.email && !task.assignee_email && (!task.assignees || task.assignees.length === 0));
        if (!isMyTask) return false;
      }

      // View filter - My Tasks (for admins)
      if (filters.view === 'my_tasks' && user && user.role === 'admin') {
        const isMyTask = task.assignee_email === user.email ||
          (task.assignees && task.assignees.includes(user.email)) ||
          (task.created_by === user.email && !task.assignee_email && (!task.assignees || task.assignees.length === 0));
        if (!isMyTask) return false;
      }

      // Search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(searchLower);
        const assignee = users.find(u => u.email === task.assignee_email);
        const matchesAssignee = assignee?.full_name?.toLowerCase().includes(searchLower) ||
          task.assignee_email?.toLowerCase().includes(searchLower);

        if (!matchesTitle && !matchesAssignee) return false;
      }

      // Member Filter
      if (filters.member !== 'all') {
        const taskAssignees = task.assignees && task.assignees.length > 0
          ? task.assignees
          : task.assignee_email ? [task.assignee_email] : [];

        if (filters.member === 'unassigned' && taskAssignees.length > 0) return false;
        if (filters.member !== 'unassigned' && !taskAssignees.includes(filters.member)) return false;
      }

      // Department Filter
      if (filters.department !== 'all') {
        const assignee = users.find(u => u.email === task.assignee_email);
        if (!assignee || assignee.department_id !== filters.department) return false;
      }

      // Status Filter
      if (filters.status !== 'all') {
        if (filters.status === 'completed' && task.status !== 'done') return false;
        if (filters.status === 'in_progress' && task.status !== 'in_progress') return false;
        if (filters.status === 'todo' && !['backlog', 'todo'].includes(task.status)) return false;
      }

      // Timeline Filter
      if (filters.timeline !== 'all') {
        if (!task.due_date) return false;
        const dueDate = parseISO(task.due_date);
        const today = new Date();

        if (filters.timeline === 'today' && !isToday(dueDate)) return false;
        if (filters.timeline === 'this_week') {
          const start = startOfWeek(today);
          const end = endOfWeek(today);
          if (!isWithinInterval(dueDate, { start, end })) return false;
        }
        if (filters.timeline === 'overdue') {
          if (task.status === 'done' || !isPast(dueDate) || isToday(dueDate)) return false;
        }
      }

      // Sprint Filter
      if (filters.sprint !== 'all') {
        if (filters.sprint === 'no_sprint' && task.sprint_id) return false;
        if (filters.sprint !== 'no_sprint' && task.sprint_id !== filters.sprint) return false;
      }

      return true;
    });

    // Apply sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
          case 'title':
            aValue = (a.title || '').toLowerCase();
            bValue = (b.title || '').toLowerCase();
            break;
          case 'assignee':
            const aAssignee = users.find(u => u.email === a.assignee_email);
            const bAssignee = users.find(u => u.email === b.assignee_email);
            aValue = aAssignee?.full_name?.toLowerCase() || '';
            bValue = bAssignee?.full_name?.toLowerCase() || '';
            break;
          case 'status':
            const statusOrder = { backlog: 0, todo: 1, in_progress: 2, review: 3, done: 4, blocked: 5 };
            aValue = statusOrder[a.status] ?? 999;
            bValue = statusOrder[b.status] ?? 999;
            break;
          case 'priority':
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            aValue = priorityOrder[a.priority] ?? 999;
            bValue = priorityOrder[b.priority] ?? 999;
            break;
          case 'due_date':
            aValue = a.due_date ? new Date(a.due_date).getTime() : 9999999999999;
            bValue = b.due_date ? new Date(b.due_date).getTime() : 9999999999999;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [flattenedTasks, filters, users, sortField, sortDirection, advancedFilters, user]);

  // Calculate statistics based on view and role
  const viewTasks = useMemo(() => {
    // Non-admins always see only their tasks
    if (user && user.role !== 'admin') {
      return tasks.filter(t => {
        const isMyTask = t.assignee_email === user.email ||
          (t.assignees && t.assignees.includes(user.email)) ||
          (t.created_by === user.email && !t.assignee_email && (!t.assignees || t.assignees.length === 0));
        return isMyTask;
      });
    }

    // Admins can toggle between "All Tasks" and "My Tasks"
    if (filters.view === 'my_tasks' && user) {
      return tasks.filter(t => {
        const isMyTask = t.assignee_email === user.email ||
          (t.assignees && t.assignees.includes(user.email)) ||
          (t.created_by === user.email && !t.assignee_email && (!t.assignees || t.assignees.length === 0));
        return isMyTask;
      });
    }
    return tasks;
  }, [tasks, filters.view, user]);

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter(t => t.status === 'done').length;
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress').length;
  const overdueTasks = filteredTasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false;
    try {
      const date = new Date(t.due_date);
      return !isNaN(date.getTime()) && isPast(date) && !isToday(date);
    } catch (e) { return false; }
  }).length;

  const todayTasks = filteredTasks.filter(t => {
    if (!t.due_date) return false;
    try {
      const date = new Date(t.due_date);
      return !isNaN(date.getTime()) && isToday(date);
    } catch (e) { return false; }
  }).length;

  // Calculate assigned tasks from filtered tasks
  const assignedTasks = useMemo(() => {
    return filteredTasks.filter(t => {
      const taskAssignees = t.assignees && t.assignees.length > 0
        ? t.assignees
        : t.assignee_email ? [t.assignee_email] : [];
      return taskAssignees.length > 0;
    }).length;
  }, [filteredTasks]);

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Use the current filtered tasks from the view instead of re-filtering
    // This ensures PDF matches what user sees on screen
    const tasksToExport = filteredTasks;

    // Build hierarchy from filtered tasks
    const taskMap = new Map(tasksToExport.map(t => [t.id, JSON.parse(JSON.stringify({ ...t, subtasks: [] }))]));
    const parentTasks = [];

    tasksToExport.forEach(task => {
      if (!task.parent_task_id) {
        const taskNode = taskMap.get(task.id);
        // Collect subtasks for this parent from filtered tasks
        taskNode.subtasks = tasksToExport.filter(t => t.parent_task_id === task.id).map(st => JSON.parse(JSON.stringify({
          ...st,
          subtasks: tasksToExport.filter(sst => sst.parent_task_id === st.id).map(sst => JSON.parse(JSON.stringify(sst)))
        })));
        parentTasks.push(taskNode);
      }
    });

    // Count all tasks including subtasks for stats
    const countTasksRecursive = (task) => {
      let count = 1;
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(sub => {
          count += countTasksRecursive(sub);
        });
      }
      return count;
    };

    const allFilteredTasks = [];
    const collectTasks = (task) => {
      allFilteredTasks.push(task);
      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach(sub => collectTasks(sub));
      }
    };
    parentTasks.forEach(task => collectTasks(task));

    const filteredByDept = allFilteredTasks;

    // Generate report title based on current filters
    let reportTitle = filters.view === 'my_tasks' ? 'My Tasks' : 'All Tasks';
    if (filters.member !== 'all') {
      const member = users.find(u => u.email === filters.member);
      reportTitle = member?.full_name || filters.member;
    } else if (filters.sprint !== 'all') {
      const sprint = sprints.find(s => String(s.id) === String(filters.sprint));
      reportTitle = filters.sprint === 'no_sprint' ? 'Tasks without Sprint' : (sprint?.name || 'Selected Sprint');
    } else if (filters.department !== 'all') {
      const dept = departments.find(d => d.id === filters.department);
      reportTitle = dept?.name || 'Unknown Department';
    }
    const deptName = reportTitle;

    // Calculate stats
    const totalExport = filteredByDept.length;
    const completedExport = filteredByDept.filter(t => t.status === 'done').length;
    const inProgressExport = filteredByDept.filter(t => t.status === 'in_progress').length;
    const overdueExport = filteredByDept.filter(t => t.due_date && t.status !== 'done' && isPast(new Date(t.due_date))).length;
    const completionRateExport = totalExport > 0 ? Math.round((completedExport / totalExport) * 100) : 0;

    let y = 20;

    // Header with gradient effect (simulated with rectangles)
    doc.setFillColor(79, 70, 229); // indigo-600
    doc.rect(0, 0, 210, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('Team Tasks Report', 14, 16);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(deptName, 14, 24);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 30);

    y = 45;

    // Stats Section with colored boxes
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Overview', 14, y);
    y += 8;

    // Stats boxes
    const statsBoxWidth = 45;
    const statsBoxHeight = 20;
    const spacing = 2;

    // Total Tasks / Subtasks
    const totalParentTasks = filteredByDept.filter(t => !t.parent_task_id).length;
    const totalSubtasks = filteredByDept.filter(t => t.parent_task_id).length;
    doc.setFillColor(99, 102, 241); // indigo
    doc.roundedRect(14, y, statsBoxWidth, statsBoxHeight, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`${totalSubtasks} / ${totalParentTasks}`, 20, y + 10);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Subtasks / Tasks', 20, y + 16);

    // In Progress - Subtasks / Tasks
    const inProgressSubtasks = filteredByDept.filter(t => t.parent_task_id && t.status === 'in_progress').length;
    const inProgressParentTasks = filteredByDept.filter(t => !t.parent_task_id && t.status === 'in_progress').length;
    doc.setFillColor(245, 158, 11); // amber
    doc.roundedRect(14 + statsBoxWidth + spacing, y, statsBoxWidth, statsBoxHeight, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`${inProgressSubtasks} / ${inProgressParentTasks}`, 20 + statsBoxWidth + spacing, y + 10);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Subtasks / Tasks', 20 + statsBoxWidth + spacing, y + 15.5);
    doc.text('In Progress', 20 + statsBoxWidth + spacing, y + 17.5);

    // Completed Subtasks / Tasks
    const completedParentTasks = filteredByDept.filter(t => !t.parent_task_id && t.status === 'done').length;
    const completedSubtasks = filteredByDept.filter(t => t.parent_task_id && t.status === 'done').length;
    doc.setFillColor(16, 185, 129); // emerald
    doc.roundedRect(14 + (statsBoxWidth + spacing) * 2, y, statsBoxWidth, statsBoxHeight, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`${completedSubtasks} / ${completedParentTasks}`, 20 + (statsBoxWidth + spacing) * 2, y + 10);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Subtasks / Tasks', 20 + (statsBoxWidth + spacing) * 2, y + 15.5);
    doc.text('Done', 20 + (statsBoxWidth + spacing) * 2, y + 17.5);

    // Overdue - Subtasks / Tasks
    const overdueSubtasks = filteredByDept.filter(t => t.parent_task_id && t.due_date && t.status !== 'done' && isPast(new Date(t.due_date))).length;
    const overdueParentTasks = filteredByDept.filter(t => !t.parent_task_id && t.due_date && t.status !== 'done' && isPast(new Date(t.due_date))).length;
    doc.setFillColor(239, 68, 68); // red
    doc.roundedRect(14 + (statsBoxWidth + spacing) * 3, y, statsBoxWidth, statsBoxHeight, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`${overdueSubtasks} / ${overdueParentTasks}`, 20 + (statsBoxWidth + spacing) * 3, y + 10);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Subtasks / Tasks', 20 + (statsBoxWidth + spacing) * 3, y + 15.5);
    doc.text('Overdue', 20 + (statsBoxWidth + spacing) * 3, y + 17.5);

    y += 30;

    // Tasks Table Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Tasks & Subtasks', 14, y);
    y += 7;

    // Table header
    doc.setFillColor(248, 250, 252); // slate-50
    doc.rect(14, y - 4, 182, 8, 'F');
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.rect(14, y - 4, 182, 8, 'S');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.text('S.No', 16, y);
    doc.text('Task / Subtask', 28, y);
    doc.text('Assignee', 95, y);
    doc.text('Status', 130, y);
    doc.text('Priority', 155, y);
    doc.text('Due Date', 175, y);
    y += 8;

    // Helper function to render a task row
    const renderTask = (task, indent = 0, serialNo = '') => {
      if (y > 275) {
        doc.addPage();
        y = 20;

        // Repeat header on new page
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, 182, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, y - 4, 182, 8, 'S');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('S.No', 16, y);
        doc.text('Task / Subtask', 28, y);
        doc.text('Assignee(s)', 95, y);
        doc.text('Status', 130, y);
        doc.text('Priority', 155, y);
        doc.text('Due Date', 175, y);
        y += 8;
      }

      const taskAssignees = task.assignees && task.assignees.length > 0
        ? task.assignees
        : task.assignee_email ? [task.assignee_email] : [];
      const assignee = users.find(u => u.email === taskAssignees[0]);
      const isSubtask = indent > 0;

      // Row border
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(14, y + 3, 196, y + 3);

      // Serial Number - positioned according to indent level
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      const serialLeftMargin = 16 + (indent * 2);
      doc.text(serialNo, serialLeftMargin, y);

      // Task title with indent for subtasks
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
      doc.setFont(undefined, indent === 0 ? 'bold' : 'normal');
      const leftMargin = 28 + (indent * 5);
      const assigneeColumnStart = 95; // Where assignee column starts
      const totalAvailableWidth = assigneeColumnStart - leftMargin - 2; // 2mm safety margin

      let taskTitle = task.title || 'Untitled Task';

      // If parent task has subtasks, reserve space for counter
      if (indent === 0 && task.subtasks && task.subtasks.length > 0) {
        const completedSubtasks = task.subtasks.filter(st => st.status === 'done').length;
        const totalSubtasks = task.subtasks.length;
        const counterText = ` (${completedSubtasks}/${totalSubtasks})`;

        // Calculate counter width in the smaller font
        doc.setFontSize(7);
        const counterWidth = doc.getTextWidth(counterText);
        doc.setFontSize(8);

        // Maximum width for title = total available - counter width - spacing
        const maxTitleWidth = totalAvailableWidth - counterWidth - 3;

        // Truncate title to fit
        taskTitle = task.title || 'Untitled Task';
        let currentWidth = doc.getTextWidth(taskTitle);

        while (currentWidth > maxTitleWidth && taskTitle.length > 0) {
          taskTitle = taskTitle.substring(0, taskTitle.length - 1);
          currentWidth = doc.getTextWidth(taskTitle);
        }

        // Add ellipsis if truncated
        if (task.title && taskTitle.length < task.title.length) {
          if (taskTitle.length > 3) {
            taskTitle = taskTitle.substring(0, taskTitle.length - 3).trim() + '...';
          }
        }

        // Render title
        doc.text(taskTitle, leftMargin, y);

        // Render counter
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(7);
        doc.text(counterText, leftMargin + doc.getTextWidth(taskTitle) + 3, y);
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
      } else {
        // For subtasks and tasks without subtasks
        taskTitle = task.title || 'Untitled Task';
        let currentWidth = doc.getTextWidth(taskTitle);

        while (currentWidth > totalAvailableWidth && taskTitle.length > 0) {
          taskTitle = taskTitle.substring(0, taskTitle.length - 1);
          currentWidth = doc.getTextWidth(taskTitle);
        }

        // Add ellipsis if truncated
        if (task.title && taskTitle.length < task.title.length) {
          if (taskTitle.length > 3) {
            taskTitle = taskTitle.substring(0, taskTitle.length - 3).trim() + '...';
          }
        }

        // Render indent arrow for subtasks
        if (indent > 0) {
          doc.setTextColor(100, 100, 100);
          const indentStr = Array(indent).fill('>').join('');
          doc.text(indentStr, leftMargin - (indent * 3), y);
          doc.setTextColor(0, 0, 0);
        }

        doc.text(taskTitle, leftMargin, y);
      }

      // Assignee
      doc.setFont(undefined, 'normal');
      let assigneeText = 'Unassigned';
      if (taskAssignees.length > 0) {
        const primaryAssignee = users.find(u => u.email === taskAssignees[0]);
        const primaryName = primaryAssignee?.full_name || taskAssignees[0].split('@')[0];
        assigneeText = taskAssignees.length > 1
          ? `${primaryName} +${taskAssignees.length - 1}`
          : primaryName;
      }
      const assigneeShort = assigneeText.length > 20 ? assigneeText.substring(0, 17) + '...' : assigneeText;
      doc.text(assigneeShort, 95, y);

      // Status
      const statusLabel = statusConfig[task.status]?.label || task.status;
      doc.text(statusLabel, 130, y);

      // Priority
      const priorityLabel = priorityConfig[task.priority]?.label || task.priority;
      doc.text(priorityLabel, 155, y);

      // Due date
      if (task.due_date) {
        doc.text(format(new Date(task.due_date), 'MMM d, yyyy'), 175, y);
      } else {
        doc.text('-', 175, y);
      }

      y += 7;
    };

    // Render all tasks recursively with serial numbers
    let taskCounter = 0;
    const renderTaskRecursive = (task, level = 0, subtaskCounter = 0, parentSerialNo = '') => {
      let serialNo = '';

      if (level === 0) {
        taskCounter++;
        serialNo = taskCounter.toString();
      } else {
        // Convert subtask number to letters: 0->a, 1->b, 2->c, etc.
        const letter = String.fromCharCode(97 + subtaskCounter);
        serialNo = `${parentSerialNo}${letter}`;
      }

      renderTask(task, level, serialNo);

      if (task.subtasks && task.subtasks.length > 0) {
        task.subtasks.forEach((subtask, idx) => renderTaskRecursive(subtask, level + 1, idx, serialNo));
      }
    };

    parentTasks.forEach(parent => renderTaskRecursive(parent, 0));

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont(undefined, 'normal');
      doc.text(`Page ${i} of ${pageCount}`, 14, 287);
      doc.text('Generated by Team Tasks System', 105, 287, { align: 'center' });
    }

    // Save PDF
    doc.save(`team-tasks-${deptName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-indigo-600 border-0 shadow-lg hover:shadow-xl transition-all group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-indigo-100 text-[10px] font-medium leading-tight">Total Subtasks / Tasks</span>
              <Target className="w-4 h-4 text-indigo-200" />
            </div>
            <p className="text-2xl font-bold text-white">
              {filteredTasks.filter(t => t.parent_task_id).length} / {filteredTasks.filter(t => !t.parent_task_id).length}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-lg hover:shadow-xl transition-all group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-orange-100 text-[10px] font-medium leading-tight">Subtasks In Progress / Tasks In Progress</span>
              <ArrowUpCircle className="w-4 h-4 text-orange-200" />
            </div>
            <p className="text-2xl font-bold text-white">
              {filteredTasks.filter(t => t.parent_task_id && t.status === 'in_progress').length} / {filteredTasks.filter(t => !t.parent_task_id && t.status === 'in_progress').length}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-600 border-0 shadow-lg hover:shadow-xl transition-all group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-100 text-[10px] font-medium leading-tight">Subtasks Completed / Tasks Completed</span>
              <CheckCircle2 className="w-4 h-4 text-green-200" />
            </div>
            <p className="text-2xl font-bold text-white">
              {filteredTasks.filter(t => t.parent_task_id && t.status === 'done').length} / {filteredTasks.filter(t => !t.parent_task_id && t.status === 'done').length}
            </p>
            <p className="text-xs text-green-100 mt-0.5">{completionRate}%</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-red-500 to-rose-600 border-0 shadow-lg hover:shadow-xl transition-all group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-red-100 text-[10px] font-medium leading-tight">Subtasks Overdue / Tasks Overdue</span>
              <Flame className="w-4 h-4 text-red-200" />
            </div>
            <p className="text-2xl font-bold text-white">
              {filteredTasks.filter(t => t.parent_task_id && t.due_date && t.status !== 'done' && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length} / {filteredTasks.filter(t => !t.parent_task_id && t.due_date && t.status !== 'done' && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500 to-cyan-600 border-0 shadow-lg hover:shadow-xl transition-all group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-cyan-100 text-xs font-medium">Due Today</span>
              <Calendar className="w-4 h-4 text-cyan-200" />
            </div>
            <p className="text-2xl font-bold text-white">{todayTasks}</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 border-0 shadow-lg hover:shadow-xl transition-all group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-10 -mt-10 group-hover:scale-110 transition-transform" />
          <CardContent className="p-4 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-pink-100 text-xs font-medium">Assigned</span>
              <UsersIcon className="w-4 h-4 text-pink-200" />
            </div>
            <p className="text-2xl font-bold text-white">{assignedTasks}</p>
          </CardContent>
        </Card>
      </div>

      {/* Export Section */}
      <div className="flex flex-col sm:flex-row gap-3 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border-2 border-emerald-200 shadow-lg">
        <div className="flex items-center gap-2 flex-1">
          <Download className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-emerald-900">Export Current View to PDF</span>
          <span className="text-xs text-emerald-600">({filteredTasks.length} tasks)</span>
        </div>
        <Button
          onClick={handleExportPDF}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all"
        >
          <Download className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Filter Chips */}
      {Object.keys(advancedFilters).length > 0 && (
        <FilterChips
          filters={advancedFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
          moduleConfig={TEAM_TASKS_FILTERS}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 p-5 bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200/50 shadow-lg">
        {user?.role === 'admin' && (
          <Select value={filters.view} onValueChange={(v) => setFilters(prev => ({ ...prev, view: v }))}>
            <SelectTrigger className="w-full lg:w-48 bg-white border-2 border-indigo-200">
              <SelectValue placeholder="View" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="my_tasks">My Tasks</SelectItem>
            </SelectContent>
          </Select>
        )}

        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search tasks or members..."
            className="pl-9 bg-white"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <Button variant="outline" onClick={() => setShowAdvancedFilter(true)} className="whitespace-nowrap">
          <Filter className="w-4 h-4 mr-2" />
          Advanced Filters
        </Button>

        <Select value={filters.member} onValueChange={(v) => setFilters(prev => ({ ...prev, member: v }))}>
          <SelectTrigger className="w-full lg:w-48 bg-white">
            <SelectValue placeholder="Member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Members</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map(u => (
              <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.department} onValueChange={(v) => setFilters(prev => ({ ...prev, department: v }))}>
          <SelectTrigger className="w-full lg:w-48 bg-white">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.status} onValueChange={(v) => setFilters(prev => ({ ...prev, status: v }))}>
          <SelectTrigger className="w-full lg:w-48 bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.timeline} onValueChange={(v) => setFilters(prev => ({ ...prev, timeline: v }))}>
          <SelectTrigger className="w-full lg:w-48 bg-white">
            <SelectValue placeholder="Timeline" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="this_week">This Week</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sprint} onValueChange={(v) => setFilters(prev => ({ ...prev, sprint: v }))}>
          <SelectTrigger className="w-full lg:w-48 bg-white">
            <SelectValue placeholder="Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sprints</SelectItem>
            <SelectItem value="no_sprint">No Sprint</SelectItem>
            {sprints.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Sprints Section */}
      {activeSprints.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            Active Sprints ({activeSprints.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSprints.map(sprint => {
              const sprintTasks = tasks.filter(t => t.sprint_id === sprint.id);
              const userSprintTasks = sprintTasks.filter(t =>
                t.assignee_email === user?.email ||
                (t.assignees && t.assignees.includes(user?.email))
              );
              const sprintProject = projects.find(p => p.id === sprint.project_id);
              const completedTasks = userSprintTasks.filter(t => t.status === 'done').length;
              const progress = userSprintTasks.length > 0 ? Math.round((completedTasks / userSprintTasks.length) * 100) : 0;
              const totalPoints = userSprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
              const completedPoints = userSprintTasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);

              return (
                <Link key={sprint.id} to={createPageUrl(`SprintBoard?id=${sprint.id}`)}>
                  <div className="bg-white rounded-xl border border-indigo-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Play className="w-4 h-4 text-emerald-500" />
                          <h3 className="font-semibold text-slate-900 line-clamp-1">{sprint.name}</h3>
                        </div>
                        {sprintProject && (
                          <p className="text-xs text-slate-500">{sprintProject.name}</p>
                        )}
                      </div>
                    </div>

                    {sprint.goal && (
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">{sprint.goal}</p>
                    )}

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-slate-500">My Tasks</div>
                        <div className="text-lg font-bold text-slate-900">{userSprintTasks.length}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Points</div>
                        <div className="text-lg font-bold text-indigo-600">{completedPoints}/{totalPoints}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Done</div>
                        <div className="text-lg font-bold text-emerald-600">{progress}%</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {sprint.end_date && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          <span>Due: {format(new Date(sprint.end_date), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Task Table */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl border-2 border-slate-200/50 shadow-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-slate-50 to-indigo-50/50 border-b-2">
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-[300px]">
                <button
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-2 font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  Task
                  {sortField === 'title' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('assignee')}
                  className="flex items-center gap-2 font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  Assignee
                  {sortField === 'assignee' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-2 font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  Status
                  {sortField === 'status' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-2 font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  Priority
                  {sortField === 'priority' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </button>
              </TableHead>
              <TableHead className="font-bold text-slate-700">Sprint</TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('due_date')}
                  className="flex items-center gap-2 font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                >
                  Due Date
                  {sortField === 'due_date' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                  ) : (
                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                  )}
                </button>
              </TableHead>
              <TableHead className="text-right font-bold text-slate-700">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500">
                  No tasks found matching the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredTasks.map(task => {
                const assignee = users.find(u => u.email === task.assignee_email);
                const sprint = sprints.find(s => String(s.id) === String(task.sprint_id));
                const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date)) && task.status !== 'done';

                return (
                  <TableRow key={task.id} className="hover:bg-gradient-to-r hover:from-indigo-50/30 hover:to-purple-50/30 transition-all border-b border-slate-100">
                    <TableCell className="w-8">
                      {task.hasSubtasks && (
                        <button
                          onClick={() => toggleParentCollapse(task.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {collapsedParents.has(task.id) ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex flex-col"
                        style={{ paddingLeft: `${task.level * 20}px` }}
                      >
                        <div className="flex items-center gap-2">
                          {task.level > 0 && (
                            <div className="flex items-center gap-1">
                              {Array(task.level).fill(0).map((_, i) => (
                                <div key={i} className="w-2 h-px bg-slate-300"></div>
                              ))}
                            </div>
                          )}
                          <span className={cn(
                            "font-semibold text-slate-900 truncate max-w-[280px] group-hover:text-indigo-600 transition-colors",
                            task.level > 0 && "text-slate-700",
                            task.level === 1 && "text-sm",
                            task.level > 1 && "text-xs"
                          )} title={task.title || 'Untitled'}>
                            {task.title || 'Untitled Task'}
                          </span>
                          {task.hasSubtasks && (
                            <Badge variant="outline" className="text-xs">
                              {task.subtasks.filter(st => st.status === 'done').length}/{task.subtasks.length}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          Updated {(task.updated_date || task.created_date) ? format(new Date(task.updated_date || task.created_date), 'MMM d') : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const taskAssignees = task.assignees && task.assignees.length > 0
                          ? task.assignees
                          : task.assignee_email ? [task.assignee_email] : [];

                        if (taskAssignees.length === 0) {
                          return <span className="text-sm text-slate-400 italic font-medium">Unassigned</span>;
                        }

                        const primaryAssignee = users.find(u => u.email === taskAssignees[0]);

                        if (taskAssignees.length === 1) {
                          return (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7 border-2 border-white shadow-sm">
                                <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold">
                                  {getInitials(primaryAssignee?.full_name || taskAssignees[0])}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]" title={primaryAssignee?.full_name || taskAssignees[0]}>
                                {primaryAssignee?.full_name || taskAssignees[0].split('@')[0]}
                              </span>
                            </div>
                          );
                        }

                        const allAssigneeNames = taskAssignees.map(email => {
                          const user = users.find(u => u.email === email);
                          return user?.full_name || email.split('@')[0];
                        });

                        return (
                          <div className="group relative">
                            <div className="flex items-center gap-2 cursor-help">
                              <Avatar className="w-7 h-7 border-2 border-white shadow-sm">
                                <AvatarFallback className="text-xs bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-semibold">
                                  {getInitials(primaryAssignee?.full_name || taskAssignees[0])}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium text-slate-700">
                                {primaryAssignee?.full_name || taskAssignees[0].split('@')[0]} <span className="text-indigo-600">+{taskAssignees.length - 1}</span>
                              </span>
                            </div>
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-slate-900 text-white text-xs rounded-lg px-3 py-2 z-10 shadow-xl min-w-max">
                              <div className="space-y-1">
                                {allAssigneeNames.map((name, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                    {name}
                                  </div>
                                ))}
                              </div>
                              <div className="absolute left-4 top-full w-2 h-2 bg-slate-900 transform rotate-45 -mt-1" />
                            </div>
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-semibold shadow-sm",
                          task.status === 'done' && "bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-700 border border-emerald-200",
                          task.status === 'in_progress' && "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200",
                          task.status === 'todo' && "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200",
                          task.status === 'review' && "bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200",
                          task.status === 'blocked' && "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200"
                        )}
                      >
                        {statusConfig[task.status]?.label || task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-semibold shadow-sm border-0",
                          task.priority === 'critical' && "bg-gradient-to-r from-red-100 to-rose-100 text-red-700",
                          task.priority === 'high' && "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700",
                          task.priority === 'medium' && "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700",
                          task.priority === 'low' && "bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700"
                        )}
                      >
                        {priorityConfig[task.priority]?.label || task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {sprint ? (
                        <Badge variant="outline" className="font-medium text-purple-700 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-sm">
                          {sprint.name}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-sm font-medium">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className={cn(
                          "flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-lg w-fit",
                          isOverdue ? "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 border border-red-200" :
                            isToday(new Date(task.due_date)) ? "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border border-blue-200" :
                              "bg-slate-100 text-slate-600 border border-slate-200"
                        )}>
                          {isOverdue ? <Flame className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm font-medium">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}>
                        <Button variant="ghost" size="sm" className="h-8 px-3 font-medium text-slate-600 hover:text-white hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:shadow-lg transition-all">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        filters={advancedFilters}
        onApplyFilters={setAdvancedFilters}
        moduleConfig={TEAM_TASKS_FILTERS}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />
    </div>
  );
}