import React from 'react';
import { cn } from '@/lib/utils';
import { Folder, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function GroupStats({ groups = [], tasks = [], onSelectGroup }) {
  const getGroupStats = (groupId) => {
    const groupTasks = tasks.filter(t => t.group_id === groupId);
    const total = groupTasks.length;
    const done = groupTasks.filter(t => t.status === 'done').length;
    const inProgress = groupTasks.filter(t => t.status === 'in_progress').length;
    const blocked = groupTasks.filter(t => t.status === 'blocked').length;
    return { total, done, inProgress, blocked, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  const ungroupedTasks = tasks.filter(t => !t.group_id);
  const ungroupedStats = {
    total: ungroupedTasks.length,
    done: ungroupedTasks.filter(t => t.status === 'done').length,
    inProgress: ungroupedTasks.filter(t => t.status === 'in_progress').length,
    blocked: ungroupedTasks.filter(t => t.status === 'blocked').length,
  };
  ungroupedStats.progress = ungroupedStats.total > 0 ? Math.round((ungroupedStats.done / ungroupedStats.total) * 100) : 0;

  const allGroups = [
    { id: null, name: 'Ungrouped', color: '#94A3B8', stats: ungroupedStats },
    ...groups.map(g => ({ ...g, stats: getGroupStats(g.id) }))
  ].filter(g => g.stats.total > 0);

  if (allGroups.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-4">Tasks by Group</h3>
        <p className="text-slate-400 dark:text-slate-500 text-xs sm:text-sm text-center py-4">No groups with tasks yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-4">Tasks by Group</h3>
      <div className="space-y-4">
        {allGroups.map((group) => (
          <button
            key={group.id || 'ungrouped'}
            onClick={() => onSelectGroup?.(group.id)}
            className="w-full text-left group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: group.color }}
              />
              <span className="flex-1 font-medium text-sm text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">
                {group.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {group.stats.done}/{group.stats.total}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
            </div>
            <div className="flex items-center gap-2">
              <Progress value={group.stats.progress} className="flex-1 h-2" />
              <span className="text-xs text-slate-400 dark:text-slate-500 w-8">{group.stats.progress}%</span>
            </div>
            {group.stats.blocked > 0 && (
              <div className="text-xs text-red-500 mt-1">
                {group.stats.blocked} blocked
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}