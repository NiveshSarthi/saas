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
import { Trash2, RotateCcw, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SoftDeleteManager({ open, onOpenChange, user }) {
  const queryClient = useQueryClient();

  const { data: deletedRecords = [] } = useQuery({
    queryKey: ['deleted-master-data'],
    queryFn: () => base44.entities.MasterData.filter({ is_deleted: true }, '-deleted_at'),
    enabled: open,
  });

  const restoreMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.MasterData.update(id, {
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        status: 'new',
      });

      await base44.entities.MasterDataAuditLog.create({
        master_data_id: id,
        action: 'restored',
        actor_email: user?.email,
        actor_name: user?.full_name,
        source: 'admin_update',
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-master-data'] });
      queryClient.invalidateQueries({ queryKey: ['master-data'] });
      toast.success('Record restored successfully');
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MasterData.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-master-data'] });
      toast.success('Record permanently deleted');
    },
  });

  const handleRestore = (id) => {
    if (confirm('Restore this record?')) {
      restoreMutation.mutate(id);
    }
  };

  const handleHardDelete = (id) => {
    if (confirm('Permanently delete this record? This cannot be undone!')) {
      hardDeleteMutation.mutate(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Deleted Records ({deletedRecords.length})
          </DialogTitle>
          <DialogDescription>
            Restore or permanently delete records
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {deletedRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No deleted records found
            </div>
          ) : (
            deletedRecords.map((record) => (
              <div key={record.id} className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{record.name}</div>
                    <div className="text-sm text-slate-600 mt-1">
                      {record.phone} • {record.email} • {record.city}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Deleted by {record.deleted_by} on {format(new Date(record.deleted_at), 'MMM d, yyyy h:mm a')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRestore(record.id)}
                      disabled={restoreMutation.isPending}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleHardDelete(record.id)}
                      disabled={hardDeleteMutation.isPending}
                    >
                      <Trash className="w-4 h-4 mr-1" />
                      Delete Forever
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}