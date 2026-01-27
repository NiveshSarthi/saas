import React, { useState, useEffect } from 'react';
import { MODULES, ACTIONS } from './PermissionsContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FolderKanban,
  CheckSquare,
  ListTree,
  Zap,
  Calendar,
  LayoutDashboard,
  MessageSquare,
  GanttChart,
  Clock,
  FileText,
  Layers,
  BarChart3,
  Paperclip,
  Users,
  UsersRound,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  CreditCard,
  BadgeDollarSign
} from 'lucide-react';

const MODULE_CONFIG = {
  project: { label: 'Projects', icon: FolderKanban },
  tasks: { label: 'Tasks', icon: CheckSquare },
  subtasks: { label: 'Subtasks', icon: ListTree },
  sprints: { label: 'Sprints', icon: Zap },
  calendar: { label: 'Calendar', icon: Calendar },
  dashboard: { label: 'Dashboard', icon: LayoutDashboard },
  comments: { label: 'Comments', icon: MessageSquare },
  gantt: { label: 'Gantt Chart', icon: GanttChart },
  time_tracking: { label: 'Time Tracking', icon: Clock },
  worklog: { label: 'Worklog', icon: FileText },
  backlog: { label: 'Backlog', icon: Layers },
  reports: { label: 'Reports', icon: BarChart3 },
  files: { label: 'Files & Attachments', icon: Paperclip },
  users: { label: 'Users', icon: Users },
  groups: { label: 'Groups', icon: UsersRound },
  finance_dashboard: { label: 'Finance Dashboard', icon: Wallet },
  receivables: { label: 'Receivables', icon: TrendingUp },
  payables: { label: 'Payables', icon: TrendingDown },
  cash_flow: { label: 'Cash Flow Forecast', icon: DollarSign },
  financial_reports: { label: 'Financial Reports', icon: PieChart },
  marketing_expenses: { label: 'Marketing Expenses', icon: CreditCard },
  salary_management: { label: 'Salary Management', icon: BadgeDollarSign },
  leads: { label: 'Leads', icon: Trophy }
};

const ACTION_CONFIG = {
  create: { label: 'Create', color: 'bg-emerald-100 text-emerald-700' },
  read: { label: 'Read', color: 'bg-blue-100 text-blue-700' },
  update: { label: 'Update', color: 'bg-amber-100 text-amber-700' },
  delete: { label: 'Delete', color: 'bg-red-100 text-red-700' },
  assign: { label: 'Assign', color: 'bg-purple-100 text-purple-700' },
  manage_password: { label: 'Manage Password', color: 'bg-rose-100 text-rose-700' }
};

export default function RolePermissionsEditor({ permissions, onChange, readonly = false }) {
  const [localPermissions, setLocalPermissions] = useState(permissions || {});

  useEffect(() => {
    setLocalPermissions(permissions || {});
  }, [permissions]);

  const handlePermissionChange = (module, action, checked) => {
    const updated = {
      ...localPermissions,
      [module]: {
        ...localPermissions[module],
        [action]: checked
      }
    };
    setLocalPermissions(updated);
    onChange?.(updated);
  };

  const handleModuleToggle = (module, checked) => {
    const updated = {
      ...localPermissions,
      [module]: ACTIONS.reduce((acc, action) => {
        acc[action] = checked;
        return acc;
      }, {})
    };
    setLocalPermissions(updated);
    onChange?.(updated);
  };

  const isModuleFullyEnabled = (module) => {
    return ACTIONS.every(action => localPermissions[module]?.[action] === true);
  };

  const isModulePartiallyEnabled = (module) => {
    const enabled = ACTIONS.filter(action => localPermissions[module]?.[action] === true);
    return enabled.length > 0 && enabled.length < ACTIONS.length;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[240px_repeat(6,1fr)] gap-0 bg-slate-50 border-b border-slate-200">
        <div className="px-4 py-3 font-semibold text-slate-700 text-sm">Module</div>
        {ACTIONS.map(action => (
          <div key={action} className="px-3 py-3 text-center">
            <Badge className={cn("text-xs", ACTION_CONFIG[action].color)}>
              {ACTION_CONFIG[action].label}
            </Badge>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {MODULES.map(module => {
          const config = MODULE_CONFIG[module];
          const Icon = config?.icon;
          const isFullyEnabled = isModuleFullyEnabled(module);
          const isPartiallyEnabled = isModulePartiallyEnabled(module);

          return (
            <div
              key={module}
              className={cn(
                "grid grid-cols-[240px_repeat(6,1fr)] gap-0 hover:bg-slate-50 transition-colors",
                isFullyEnabled && "bg-emerald-50/30"
              )}
            >
              <div className="px-4 py-3 flex items-center gap-3">
                <Checkbox
                  checked={isFullyEnabled}
                  ref={(el) => {
                    if (el && isPartiallyEnabled) {
                      el.dataset.state = 'indeterminate';
                    }
                  }}
                  onCheckedChange={(checked) => handleModuleToggle(module, checked)}
                  disabled={readonly}
                />
                {Icon && <Icon className="w-4 h-4 text-slate-500" />}
                <span className="text-sm font-medium text-slate-700">{config?.label || module}</span>
              </div>
              {ACTIONS.map(action => (
                <div key={action} className="px-3 py-3 flex items-center justify-center">
                  <Checkbox
                    checked={localPermissions[module]?.[action] === true}
                    onCheckedChange={(checked) => handlePermissionChange(module, action, checked)}
                    disabled={readonly}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}