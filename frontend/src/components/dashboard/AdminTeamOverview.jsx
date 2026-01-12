import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  TrendingUp,
  TrendingDown,
  BarChart3
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusConfig = {
  backlog: { label: 'Backlog', icon: Circle, color: 'text-slate-400', bg: 'bg-slate-100' },
  todo: { label: 'To Do', icon: Circle, color: 'text-blue-500', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', icon: ArrowUpCircle, color: 'text-amber-500', bg: 'bg-amber-100' },
  review: { label: 'Review', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-100' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100' },
  blocked: { label: 'Blocked', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100' },
};

const priorityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700' },
};

export default function AdminTeamOverview({ users = [], tasks = [], activities = [] }) {
  const [expandedUser, setExpandedUser] = useState(null);
  const [sortBy, setSortBy] = useState('tasks'); // 'tasks' | 'overdue' | 'name'

  const getInitials = (user) => {
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user?.email?.slice(0, 2).toUpperCase() || '??';
  };

  const getMemberStats = (email) => {
    const memberTasks = tasks.filter(t => t.assignee_email === email);
    const today = new Date();

    return {
      total: memberTasks.length,
      done: memberTasks.filter(t => t.status === 'done').length,
      inProgress: memberTasks.filter(t => t.status === 'in_progress').length,
      blocked: memberTasks.filter(t => t.status === 'blocked').length,
      overdue: memberTasks.filter(t => {
        if (!t.due_date || t.status === 'done') return false;
        return new Date(t.due_date) < today;
      }).length,
      tasks: memberTasks
    };
  };

  const getRecentActivity = (email) => {
    return activities
      .filter(a => a.actor_email === email)
      .slice(0, 3);
  };

  // Sort users by criteria
  const sortedUsers = [...users].sort((a, b) => {
    const statsA = getMemberStats(a.email);
    const statsB = getMemberStats(b.email);

    if (sortBy === 'tasks') return statsB.total - statsA.total;
    if (sortBy === 'overdue') return statsB.overdue - statsA.overdue;
    return (a.full_name || a.email).localeCompare(b.full_name || b.email);
  });

  const totalStats = {
    totalTasks: tasks.length,
    done: tasks.filter(t => t.status === 'done').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Team Overview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {users.length} members · {totalStats.totalTasks} total tasks
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tasks">Most Tasks</SelectItem>
                <SelectItem value="overdue">Most Overdue</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
            <p className="text-lg font-bold text-slate-900 dark:text-white">{totalStats.totalTasks}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Total</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-lg font-bold text-emerald-600">{totalStats.done}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Done</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-lg font-bold text-amber-600">{totalStats.inProgress}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">In Progress</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-lg font-bold text-red-600">{totalStats.blocked}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Blocked</p>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
        {sortedUsers.map((member) => {
          const stats = getMemberStats(member.email);
          const recentActivity = getRecentActivity(member.email);
          const isExpanded = expandedUser === member.id;
          const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

          return (
            <Collapsible
              key={member.id}
              open={isExpanded}
              onOpenChange={() => setExpandedUser(isExpanded ? null : member.id)}
            >
              <CollapsibleTrigger className="w-full">
                <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarFallback className={cn(
                        "text-sm font-medium",
                        stats.overdue > 0
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                      )}>
                        {getInitials(member)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                          {member.full_name || member.email}
                        </p>
                        {member.role === 'admin' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Admin</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{member.email}</p>
                    </div>

                    {/* Quick Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="font-semibold text-slate-900 dark:text-white">{stats.total}</p>
                        <p className="text-slate-400">Tasks</p>
                      </div>
                      <div className="text-center">
                        <p className={cn("font-semibold", stats.inProgress > 0 ? "text-amber-600" : "text-slate-400")}>
                          {stats.inProgress}
                        </p>
                        <p className="text-slate-400">Active</p>
                      </div>
                      {stats.overdue > 0 && (
                        <div className="text-center">
                          <p className="font-semibold text-red-600">{stats.overdue}</p>
                          <p className="text-slate-400">Overdue</p>
                        </div>
                      )}
                      {stats.blocked > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          {stats.blocked} blocked
                        </Badge>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="hidden md:block w-24">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-400">Done</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">{completionRate}%</span>
                      </div>
                      <Progress value={completionRate} className="h-1.5" />
                    </div>

                    {/* Expand Icon */}
                    <div className="text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 bg-slate-50 dark:bg-slate-700/30">
                  {/* Task Status Breakdown */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                    {Object.entries(statusConfig).map(([key, config]) => {
                      const count = stats.tasks.filter(t => t.status === key).length;
                      const Icon = config.icon;
                      return (
                        <div
                          key={key}
                          className={cn(
                            "p-2 rounded-lg text-center",
                            config.bg,
                            "dark:bg-opacity-20"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 mx-auto mb-1", config.color)} />
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{count}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{config.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recent Tasks */}
                  {stats.tasks.length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Recent Tasks</h5>
                      <div className="space-y-1">
                        {stats.tasks.slice(0, 5).map((task) => {
                          const StatusIcon = statusConfig[task.status]?.icon || Circle;
                          return (
                            <Link
                              key={task.id}
                              to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
                              className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                            >
                              <StatusIcon className={cn("w-3.5 h-3.5", statusConfig[task.status]?.color)} />
                              <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {task.title}
                              </span>
                              <Badge className={cn("text-[10px]", priorityConfig[task.priority]?.color)}>
                                {task.priority}
                              </Badge>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recent Activity */}
                  {recentActivity.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Recent Activity</h5>
                      <div className="space-y-1">
                        {recentActivity.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400"
                          >
                            <span className="capitalize">{activity.action.replace('_', ' ')}</span>
                            <span className="text-slate-400">·</span>
                            <span>{formatDistanceToNow(new Date(activity.created_date), { addSuffix: true })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {stats.tasks.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">No tasks assigned</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}