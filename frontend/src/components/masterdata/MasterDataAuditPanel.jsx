import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { History, Download, UserCheck, Edit, Upload } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const actionIcons = {
  imported: Upload,
  updated: Edit,
  assigned: UserCheck,
  self_picked: UserCheck,
  downloaded: Download,
  created: Upload
};

const actionColors = {
  imported: 'bg-blue-100 text-blue-700',
  updated: 'bg-amber-100 text-amber-700',
  assigned: 'bg-purple-100 text-purple-700',
  self_picked: 'bg-emerald-100 text-emerald-700',
  downloaded: 'bg-indigo-100 text-indigo-700',
  created: 'bg-green-100 text-green-700'
};

export default function MasterDataAuditPanel({ open, onOpenChange }) {
  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ['master-data-audit'],
    queryFn: () => base44.entities.MasterDataAuditLog.list('-created_date', 200),
    enabled: open
  });

  const { data: downloadLogs = [] } = useQuery({
    queryKey: ['master-data-downloads'],
    queryFn: () => base44.entities.MasterDataDownloadLog.list('-created_date', 100),
    enabled: open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Master Data Audit Log
          </DialogTitle>
          <DialogDescription>
            Complete activity history and download tracking
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Recent Activity */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Recent Activity</h3>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.slice(0, 20).map((log) => {
                  const ActionIcon = actionIcons[log.action] || Edit;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-3 bg-white border rounded-lg hover:bg-slate-50">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${actionColors[log.action] || 'bg-slate-100'}`}>
                        <ActionIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900">{log.actor_name || log.actor_email}</span>
                          <Badge className={actionColors[log.action]}>{log.action}</Badge>
                        </div>
                        {log.field_changed && (
                          <div className="text-sm text-slate-600">
                            Changed <strong>{log.field_changed}</strong> to <strong>{log.after_value}</strong>
                          </div>
                        )}
                        {log.metadata && (
                          <div className="text-xs text-slate-500 mt-1">
                            {Object.entries(log.metadata).map(([key, value]) => (
                              <span key={key} className="mr-3">
                                {key}: {JSON.stringify(value)}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="text-xs text-slate-400 mt-1">
                          {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Download History */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Download History</h3>
            <div className="space-y-2">
              {downloadLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-white border rounded-lg hover:bg-slate-50">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100 text-indigo-700">
                    <Download className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900">{log.user_name || log.user_email}</span>
                      <Badge className="bg-indigo-100 text-indigo-700">{log.download_type}</Badge>
                    </div>
                    <div className="text-sm text-slate-600">
                      Downloaded <strong>{log.row_count}</strong> records in <strong>{log.format}</strong> format
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}
                      {log.ip_address && <span className="ml-2">• IP: {log.ip_address}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}