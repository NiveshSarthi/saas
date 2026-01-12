import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Plus,
  Edit,
  Trash2,
  MessageSquare,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  Paperclip,
  AtSign,
  Activity
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';


const actionConfig = {
  created: { icon: Plus, color: 'bg-emerald-100 text-emerald-600', label: 'created' },
  updated: { icon: Edit, color: 'bg-blue-100 text-blue-600', label: 'updated' },
  deleted: { icon: Trash2, color: 'bg-red-100 text-red-600', label: 'deleted' },
  commented: { icon: MessageSquare, color: 'bg-purple-100 text-purple-600', label: 'commented on' },
  assigned: { icon: UserPlus, color: 'bg-indigo-100 text-indigo-600', label: 'assigned' },
  status_changed: { icon: CheckCircle2, color: 'bg-amber-100 text-amber-600', label: 'changed status of' },
  attached: { icon: Paperclip, color: 'bg-slate-100 text-slate-600', label: 'attached file to' },
  mentioned: { icon: AtSign, color: 'bg-pink-100 text-pink-600', label: 'mentioned you in' },
};

export default function RecentActivities({ activities = [], users = [] }) {
  const getInitials = (email) => {
    if (!email) return '?';
    return email.slice(0, 2).toUpperCase();
  };

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name?.split(' ')[0] || email?.split('@')[0] || 'Someone';
  };

  const getActionDetails = (activity) => {
    const config = actionConfig[activity.action] || actionConfig.updated;
    let description = config.label;

    if (activity.action === 'status_changed' && activity.new_value) {
      description = `changed status to ${activity.new_value.replace('_', ' ')}`;
    } else if (activity.action === 'assigned' && activity.new_value) {
      description = `assigned to ${activity.new_value}`;
    }

    return { ...config, description };
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Recent Activity</h3>
        </div>
        <span className="text-xs text-slate-400">{activities.length} activities</span>
      </div>

      {activities.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 py-8">
          <Activity className="w-10 h-10 mb-2" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="flex-1 max-h-[280px] overflow-y-auto pr-2 space-y-3">
          {activities.map((activity) => {
            const { icon: Icon, color, description } = getActionDetails(activity);

            return (
              <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", color)}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    <span className="font-medium">{getUserName(activity.actor_email)}</span>
                    {' '}{description}
                  </p>
                  {activity.task_id && (
                    <Link
                      to={createPageUrl(`TaskDetail?id=${activity.task_id}`)}
                      className="text-xs text-indigo-600 hover:underline truncate block mt-0.5"
                    >
                      View task →
                    </Link>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {(() => {
                      if (!activity.created_date) return 'Recently';
                      try {
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
      )}
    </div>
  );
}