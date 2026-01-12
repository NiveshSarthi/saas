import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, AlertTriangle, Filter, ChevronDown, Coffee } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { isToday, isThisWeek, isThisMonth } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function TeamWorkload({ tasks = [], users = [], taskGroups = [], departments = [], userGroups = [] }) {
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active'); // active (not done), all, done
  const [groupFilter, setGroupFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  // Filter tasks first
  const filteredTasks = tasks.filter(task => {
    // Date Filter (using due_date or updated_date if due_date is missing)
    if (dateFilter !== 'all') {
      const dateToCheck = task.due_date ? new Date(task.due_date) : new Date(task.updated_date);
      if (dateFilter === 'today' && !isToday(dateToCheck)) return false;
      if (dateFilter === 'week' && !isThisWeek(dateToCheck)) return false;
      if (dateFilter === 'month' && !isThisMonth(dateToCheck)) return false;
    }

    // Status Filter
    if (statusFilter === 'active' && task.status === 'done') return false;
    if (statusFilter === 'done' && task.status !== 'done') return false;
    
    // Group Filter
    if (groupFilter !== 'all') {
      if (groupFilter === 'ungrouped' && task.group_id) return false;
      if (groupFilter !== 'ungrouped' && task.group_id !== groupFilter) return false;
    }

    return true;
  });

  // Filter users based on Department and Team
  const filteredUsers = users.filter(user => {
    if (deptFilter !== 'all' && user.department_id !== deptFilter) return false;
    
    if (teamFilter !== 'all') {
      const group = userGroups.find(g => g.id === teamFilter);
      if (!group || !group.members?.includes(user.email)) return false;
    }
    return true;
  });

  // Calculate workload per team member
  const teamWorkload = filteredUsers.map(user => {
    // Use case-insensitive email matching
    const userEmail = user.email?.toLowerCase();
    const userTasks = filteredTasks.filter(t => t.assignee_email?.toLowerCase() === userEmail);
    
    const inProgress = userTasks.filter(t => t.status === 'in_progress').length;
    const overdue = userTasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date) < new Date();
    }).length;
    const totalHours = userTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);

    return {
      ...user,
      taskCount: userTasks.length,
      inProgress,
      overdue,
      totalHours
    };
  });

  const activeMembers = teamWorkload.filter(u => u.taskCount > 0).sort((a, b) => b.taskCount - a.taskCount);
  // Exclude admins from "No Tasks Assigned" list
  // Ensure we check for 'admin' role case-insensitively and handle missing roles safely
  const inactiveMembers = teamWorkload.filter(u => 
    u.taskCount === 0 && 
    (u.role?.toLowerCase() !== 'admin')
  );

  const maxTasks = Math.max(...activeMembers.map(u => u.taskCount), 1);

  const getInitials = (user) => {
    if (user.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email?.slice(0, 2).toUpperCase() || '?';
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Team Workload</h3>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="done">Completed</SelectItem>
              <SelectItem value="all">All Status</SelectItem>
            </SelectContent>
          </Select>

          {taskGroups.length > 0 && (
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Task Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Task Groups</SelectItem>
                <SelectItem value="ungrouped">Ungrouped</SelectItem>
                {taskGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {userGroups.length > 0 && (
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {userGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Active Members */}
        <div className="space-y-4">
          {activeMembers.map((member) => {
            const loadPercentage = (member.taskCount / maxTasks) * 100;
            const isOverloaded = member.taskCount > 10;

            return (
              <div key={member.email} className="flex items-center gap-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className={cn(
                    "text-xs",
                    isOverloaded ? "bg-red-100 text-red-600" : "bg-indigo-100 text-indigo-600"
                  )}>
                    {getInitials(member)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {member.full_name || member.email?.split('@')[0]}
                    </span>
                    <div className="flex items-center gap-2">
                      {member.overdue > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <AlertTriangle className="w-3 h-3" />
                          {member.overdue}
                        </span>
                      )}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {member.taskCount} tasks
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={loadPercentage} 
                    className={cn("h-1.5", isOverloaded && "[&>div]:bg-red-500")}
                  />
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 dark:text-slate-500">
                    <span>{member.inProgress} in progress</span>
                    {member.totalHours > 0 && (
                      <span>• {member.totalHours}h estimated</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {activeMembers.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              No members with active tasks matching filters
            </div>
          )}
        </div>

        {/* Inactive Members */}
        {inactiveMembers.length > 0 && (
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <Coffee className="w-3.5 h-3.5 text-slate-400" />
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">No Tasks Assigned</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {inactiveMembers.map(member => (
                <div 
                  key={member.email}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-full bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600"
                >
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-slate-200 text-slate-600">
                      {getInitials(member)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {member.full_name?.split(' ')[0] || member.email?.split('@')[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}