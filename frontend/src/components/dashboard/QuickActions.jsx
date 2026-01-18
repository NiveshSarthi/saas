import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Plus,
  Calendar,
  FileText,
  Users,
  FolderPlus,
  Video,
  Clock,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const actions = [
  {
    label: 'New Task',
    icon: Plus,
    href: 'NewTask',
    color: 'bg-indigo-500 hover:bg-indigo-600',
    description: 'Create a task'
  },
  {
    label: 'Schedule Meeting',
    icon: Video,
    href: 'ScheduleMeeting',
    color: 'bg-green-500 hover:bg-green-600',
    description: 'Set up a call'
  },
  {
    label: 'New Project',
    icon: FolderPlus,
    href: 'NewProject',
    color: 'bg-purple-500 hover:bg-purple-600',
    description: 'Start a project',
    hiddenForSalesExec: true,
    hiddenForSalesManager: true
  },
  {
    label: 'View Calendar',
    icon: Calendar,
    href: 'TaskCalendar',
    color: 'bg-blue-500 hover:bg-blue-600',
    description: 'Check schedule'
  },
];

export default function QuickActions({ isSalesExec, isSalesManager }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <Zap className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Quick Actions</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {actions
          .filter(action => {
            if (action.hiddenForSalesExec && isSalesExec) return false;
            if (action.hiddenForSalesManager && isSalesManager) return false;
            return true;
          })
          .map((action) => (
            <Link key={action.label} to={createPageUrl(action.href)}>
              <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all group cursor-pointer flex items-center gap-2 sm:gap-3">
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${action.color} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105`}>
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-xs sm:text-sm text-slate-900 dark:text-white truncate">{action.label}</p>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}