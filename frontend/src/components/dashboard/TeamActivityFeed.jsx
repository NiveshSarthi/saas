import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Activity,
  Plus,
  Edit,
  Trash2,
  MessageSquare,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const actionConfig = {
  created: { icon: Plus, color: 'bg-green-100 text-green-600', label: 'created' },
  updated: { icon: Edit, color: 'bg-blue-100 text-blue-600', label: 'updated' },
  deleted: { icon: Trash2, color: 'bg-red-100 text-red-600', label: 'deleted' },
  commented: { icon: MessageSquare, color: 'bg-purple-100 text-purple-600', label: 'commented on' },
  assigned: { icon: UserPlus, color: 'bg-amber-100 text-amber-600', label: 'assigned' },
  status_changed: { icon: CheckCircle2, color: 'bg-indigo-100 text-indigo-600', label: 'changed status of' },
  attached: { icon: FileText, color: 'bg-slate-100 text-slate-600', label: 'attached file to' },
  mentioned: { icon: AlertCircle, color: 'bg-pink-100 text-pink-600', label: 'mentioned in' },
};

export default function TeamActivityFeed({ activities = [], users = [], tasks = [] }) {
  const getUser = (email) => users.find(u => u.email === email);

  const getInitials = (email) => {
    const user = getUser(email);
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const getUserName = (email) => {
    const user = getUser(email);
    return user?.full_name || email?.split('@')[0] || 'Unknown';
  };

  const getTask = (taskId) => tasks.find(t => t.id === taskId);

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Team Activity</h3>
        </div>
        <div className="text-center py-6 sm:py-8">
          <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">No recent activity</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Team Activity</h3>
        </div>
      </div>

      <div className="space-y-4 max-h-80 overflow-y-auto">
        {activities.slice(0, 15).map((activity) => {
          const config = actionConfig[activity.action] || actionConfig.updated;
          const IconComponent = config.icon;
          const task = getTask(activity.task_id);

          return (
            <div key={activity.id} className="flex gap-3 items-start">
              <div className="relative">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                    {getInitials(activity.actor_email)}
                  </AvatarFallback>
                </Avatar>
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                  config.color
                )}>
                  <IconComponent className="w-2.5 h-2.5" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {getUserName(activity.actor_email)}
                  </span>
                  {' '}{config.label}{' '}
                  {task ? (
                    <Link
                      to={createPageUrl(`TaskDetail?id=${task.id || task._id}`)}
                      className="font-medium text-indigo-600 hover:underline"
                    >
                      {task.title}
                    </Link>
                  ) : (
                    <span className="text-slate-500">a task</span>
                  )}
                </p>

                {activity.field_changed && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {activity.field_changed}: {activity.old_value} → {activity.new_value}
                  </p>
                )}

                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {(() => {
                    if (!activity.created_date) return 'Recently';
                    try {
                      if (!activity.created_date) return 'Recently';
                      const dateStr = activity.created_date.includes('Z') || activity.created_date.includes('+')
                        ? activity.created_date
                        : activity.created_date + 'Z';
                      return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
                    } catch (e) { return 'Recently'; }
                  })()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}