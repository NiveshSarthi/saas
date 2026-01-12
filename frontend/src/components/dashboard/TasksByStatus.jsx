import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-400' },
  todo: { label: 'To Do', color: 'bg-blue-500' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500' },
  review: { label: 'Review', color: 'bg-purple-500' },
  done: { label: 'Done', color: 'bg-emerald-500' },
  blocked: { label: 'Blocked', color: 'bg-red-500' },
};

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-500' },
  high: { label: 'High', color: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'bg-blue-500' },
  low: { label: 'Low', color: 'bg-slate-400' },
};

export default function TasksByStatus({ 
  tasks = [], 
  projects = [], 
  taskGroups = [], 
  departments = [], 
  users = [],
  viewAllLink = 'MyTasks'
}) {
  const [filterType, setFilterType] = useState('status');

  const data = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return [];

    let items = [];

    if (filterType === 'status') {
      items = Object.entries(statusConfig).map(([key, config]) => {
        const count = tasks.filter(t => (t.status || 'backlog') === key).length;
        return {
          key,
          label: config.label,
          color: config.color,
          count,
          percentage: (count / total) * 100
        };
      });
    } else if (filterType === 'priority') {
      items = Object.entries(priorityConfig).map(([key, config]) => {
        const count = tasks.filter(t => (t.priority || 'medium') === key).length;
        return {
          key,
          label: config.label,
          color: config.color,
          count,
          percentage: (count / total) * 100
        };
      });
    } else if (filterType === 'project') {
      items = projects.map(p => {
        const count = tasks.filter(t => t.project_id === p.id).length;
        return {
          key: p.id,
          label: p.name,
          color: 'bg-indigo-500', // Default color or use p.color if it's a tailwind class (it's usually hex)
          hexColor: p.color,
          count,
          percentage: (count / total) * 100
        };
      }).filter(i => i.count > 0).sort((a, b) => b.count - a.count);
      
      // Add "No Project" if any
      const noProjectCount = tasks.filter(t => !t.project_id).length;
      if (noProjectCount > 0) {
        items.push({
          key: 'none',
          label: 'No Project',
          color: 'bg-slate-400',
          count: noProjectCount,
          percentage: (noProjectCount / total) * 100
        });
      }
    } else if (filterType === 'group') {
      items = taskGroups.map(g => {
        const count = tasks.filter(t => t.group_id === g.id).length;
        return {
          key: g.id,
          label: g.name,
          color: 'bg-indigo-500',
          hexColor: g.color,
          count,
          percentage: (count / total) * 100
        };
      }).filter(i => i.count > 0).sort((a, b) => b.count - a.count);

      const noGroupCount = tasks.filter(t => !t.group_id).length;
      if (noGroupCount > 0) {
        items.push({
          key: 'none',
          label: 'Ungrouped',
          color: 'bg-slate-400',
          count: noGroupCount,
          percentage: (noGroupCount / total) * 100
        });
      }
    } else if (filterType === 'department') {
      // Pre-calculate user department map
      const userDeptMap = {};
      users.forEach(u => {
        userDeptMap[u.email] = u.department_id;
      });

      items = departments.map(d => {
        const count = tasks.filter(t => {
          const assigneeEmail = t.assignee_email;
          if (!assigneeEmail) return false;
          return userDeptMap[assigneeEmail] === d.id;
        }).length;
        return {
          key: d.id,
          label: d.name,
          color: 'bg-violet-500',
          count,
          percentage: (count / total) * 100
        };
      }).filter(i => i.count > 0).sort((a, b) => b.count - a.count);

      const noDeptCount = tasks.filter(t => {
        const assigneeEmail = t.assignee_email;
        if (!assigneeEmail) return true; // Unassigned
        return !userDeptMap[assigneeEmail]; // No department
      }).length;

      if (noDeptCount > 0) {
        items.push({
          key: 'none',
          label: 'No Department',
          color: 'bg-slate-400',
          count: noDeptCount,
          percentage: (noDeptCount / total) * 100
        });
      }
    } else if (filterType === 'team') {
      items = users.map(u => {
        const count = tasks.filter(t => t.assignee_email === u.email).length;
        return {
          key: u.email,
          label: u.full_name || u.email.split('@')[0],
          color: 'bg-cyan-500',
          count,
          percentage: (count / total) * 100
        };
      }).filter(i => i.count > 0).sort((a, b) => b.count - a.count);

      const unassignedCount = tasks.filter(t => !t.assignee_email).length;
      if (unassignedCount > 0) {
        items.push({
          key: 'unassigned',
          label: 'Unassigned',
          color: 'bg-slate-400',
          count: unassignedCount,
          percentage: (unassignedCount / total) * 100
        });
      }
    }

    return items;
  }, [tasks, filterType, projects, taskGroups, departments, users]);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-full">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-auto border-none shadow-none p-0 text-sm sm:text-base font-semibold bg-transparent focus:ring-0 hover:bg-transparent text-slate-900 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="status">Tasks by Status</SelectItem>
              <SelectItem value="priority">Tasks by Priority</SelectItem>
              <SelectItem value="project">Tasks by Project</SelectItem>
              <SelectItem value="group">Tasks by Group</SelectItem>
              <SelectItem value="department">Tasks by Department</SelectItem>
              <SelectItem value="team">Tasks by Team</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Link to={createPageUrl(viewAllLink)}>
          <Button variant="ghost" size="sm" className="text-slate-500 hover:text-indigo-600">
            View all
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className={cn("w-2 h-2 rounded-full", !item.hexColor && item.color)} 
                  style={item.hexColor ? { backgroundColor: item.hexColor } : {}}
                />
                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                  {item.label}
                </span>
              </div>
              <span className="text-slate-500 dark:text-slate-400">{item.count}</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-500", !item.hexColor && item.color)}
                style={{ 
                  width: `${item.percentage}%`,
                  backgroundColor: item.hexColor ? item.hexColor : undefined
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
          No tasks yet
        </div>
      )}
    </div>
  );
}