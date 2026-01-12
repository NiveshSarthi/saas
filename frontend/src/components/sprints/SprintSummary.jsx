import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';

const statusConfig = [
  { id: 'todo', label: 'To Do', icon: Circle, color: 'text-blue-500', bg: 'bg-blue-500' },
  { id: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500' },
  { id: 'review', label: 'Review', icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-500' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500' },
];

export default function SprintSummary({ tasks, sprint }) {
  const getCountByStatus = (statusId) => {
    if (statusId === 'todo') {
      return tasks.filter(t => t.status === 'todo' || t.status === 'backlog').length;
    }
    return tasks.filter(t => t.status === statusId).length;
  };

  const getPointsByStatus = (statusId) => {
    if (statusId === 'todo') {
      return tasks
        .filter(t => t.status === 'todo' || t.status === 'backlog')
        .reduce((sum, t) => sum + (t.story_points || 0), 0);
    }
    return tasks
      .filter(t => t.status === statusId)
      .reduce((sum, t) => sum + (t.story_points || 0), 0);
  };

  const totalTasks = tasks.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Status Breakdown</h3>
      
      <div className="space-y-4">
        {statusConfig.map(status => {
          const count = getCountByStatus(status.id);
          const points = getPointsByStatus(status.id);
          const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
          const Icon = status.icon;

          return (
            <div key={status.id}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn("w-4 h-4", status.color)} />
                  <span className="text-sm font-medium text-slate-700">{status.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{count}</span>
                  {points > 0 && (
                    <span className="text-xs text-slate-400">({points} SP)</span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full transition-all", status.bg)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Blocked Tasks */}
      {tasks.filter(t => t.status === 'blocked').length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {tasks.filter(t => t.status === 'blocked').length} blocked tasks
            </span>
          </div>
        </div>
      )}
    </div>
  );
}