import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Search,
  Filter,
  Shield,
  User,
  FolderKanban,
  Key,
  ChevronDown,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import ProtectedRoute from '@/components/rbac/ProtectedRoute';

const ACTION_CONFIG = {
  role_created: { label: 'Role Created', color: 'bg-emerald-100 text-emerald-700', icon: Shield },
  role_updated: { label: 'Role Updated', color: 'bg-blue-100 text-blue-700', icon: Shield },
  role_deleted: { label: 'Role Deleted', color: 'bg-red-100 text-red-700', icon: Shield },
  role_duplicated: { label: 'Role Duplicated', color: 'bg-purple-100 text-purple-700', icon: Shield },
  permission_changed: { label: 'Permission Changed', color: 'bg-amber-100 text-amber-700', icon: Key },
  user_role_changed: { label: 'User Role Changed', color: 'bg-indigo-100 text-indigo-700', icon: User },
  user_invited: { label: 'User Invited', color: 'bg-teal-100 text-teal-700', icon: User },
  user_removed: { label: 'User Removed', color: 'bg-red-100 text-red-700', icon: User },
  project_member_added: { label: 'Member Added', color: 'bg-emerald-100 text-emerald-700', icon: FolderKanban },
  project_member_removed: { label: 'Member Removed', color: 'bg-red-100 text-red-700', icon: FolderKanban },
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedLog, setExpandedLog] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 200),
  });

  const filteredLogs = logs.filter(log => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!log.user_email?.toLowerCase().includes(searchLower) &&
          !log.target_name?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <ProtectedRoute module="users" action="read">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1>
            <p className="text-slate-500">Track all permission and role changes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by user or target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Logs List */}
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>No audit logs found</p>
            </div>
          ) : (
            filteredLogs.map(log => {
              const config = ACTION_CONFIG[log.action] || { 
                label: log.action, 
                color: 'bg-slate-100 text-slate-700',
                icon: History
              };
              const Icon = config.icon;
              const isExpanded = expandedLog === log.id;

              return (
                <Collapsible key={log.id} open={isExpanded} onOpenChange={() => setExpandedLog(isExpanded ? null : log.id)}>
                  <CollapsibleTrigger asChild>
                    <div className="p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.color.split(' ')[0])}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-xs", config.color)}>
                              {config.label}
                            </Badge>
                            <span className="text-sm text-slate-500">by</span>
                            <span className="font-medium text-slate-900">{log.user_email}</span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {log.target_type && <span className="capitalize">{log.target_type}: </span>}
                            <span className="font-medium">{log.target_name || log.target_id}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-slate-500">
                            {format(new Date(log.created_date), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-slate-400">
                            {format(new Date(log.created_date), 'HH:mm:ss')}
                          </p>
                        </div>
                        <ChevronDown className={cn(
                          "w-4 h-4 text-slate-400 transition-transform",
                          isExpanded && "rotate-180"
                        )} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0">
                      <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {log.old_value && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Previous Value</p>
                            <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-48">
                              {JSON.stringify(log.old_value, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.new_value && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">New Value</p>
                            <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-48">
                              {JSON.stringify(log.new_value, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata && (
                          <div className="md:col-span-2">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Additional Info</p>
                            <pre className="text-xs bg-white p-3 rounded border border-slate-200 overflow-auto max-h-48">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}