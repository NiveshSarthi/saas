import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VersionHistoryDialog({ open, onOpenChange, recordId, user }) {
  const queryClient = useQueryClient();

  const { data: versions = [] } = useQuery({
    queryKey: ['master-data-versions', recordId],
    queryFn: () => base44.entities.MasterDataVersion.filter(
      { master_data_id: recordId },
      '-version_number'
    ),
    enabled: open && !!recordId,
  });

  const rollbackMutation = useMutation({
    mutationFn: async (version) => {
      // Get current data
      const currentData = await base44.entities.MasterData.list();
      const currentRecord = currentData.find(r => r.id === recordId);
      
      // Update to the version snapshot
      await base44.entities.MasterData.update(recordId, version.full_snapshot);

      // Create audit log
      await base44.entities.MasterDataAuditLog.create({
        master_data_id: recordId,
        action: 'rollback',
        actor_email: user?.email,
        actor_name: user?.full_name,
        source: 'admin_update',
        timestamp: new Date().toISOString(),
        metadata: {
          rollback_to_version: version.version_number,
          rollback_from_version: versions[0]?.version_number || 0,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-data'] });
      queryClient.invalidateQueries({ queryKey: ['master-data-versions', recordId] });
      toast.success('Successfully rolled back to previous version');
    },
  });

  const handleRollback = (version) => {
    if (confirm(`Roll back to version ${version.version_number}? Current changes will be saved in history.`)) {
      rollbackMutation.mutate(version);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            View and restore previous versions of this record
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {versions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No version history available
            </div>
          ) : (
            versions.map((version, index) => (
              <div key={version.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        Version {version.version_number}
                      </Badge>
                      {index === 0 && <Badge variant="outline">Current</Badge>}
                    </div>
                    <div className="text-sm text-slate-600 mb-2">
                      Changed by {version.changed_by} on {format(new Date(version.changed_at), 'MMM d, yyyy h:mm a')}
                    </div>
                    
                    {version.changes && Object.keys(version.changes).length > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="text-xs font-medium text-slate-700">Changes:</div>
                        {Object.entries(version.changes).map(([field, change]) => (
                          <div key={field} className="text-xs text-slate-600 pl-3">
                            <span className="font-medium">{field}:</span>{' '}
                            <span className="text-red-600 line-through">{change.before || '(empty)'}</span>
                            {' → '}
                            <span className="text-green-600">{change.after || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {index !== 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRollback(version)}
                      disabled={rollbackMutation.isPending}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}