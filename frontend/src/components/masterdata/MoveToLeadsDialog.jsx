import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRight, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function MoveToLeadsDialog({
  open,
  onOpenChange,
  selectedRows,
  masterData,
  onSuccess,
  user
}) {
  const selectedRecords = masterData.filter(d => selectedRows.includes(d.id));

  const moveToLeadsMutation = useMutation({
    mutationFn: async () => {
      const timestamp = new Date().toISOString();
      const movedCount = selectedRecords.length;

      for (const record of selectedRecords) {
        // Create Lead from MasterData
        await base44.entities.Lead.create({
          lead_name: record.name,
          phone: record.phone,
          alternate_phone: record.alternate_phone,
          email: record.email,
          company: record.domain,
          address: record.address,
          city: record.city,
          state: record.state,
          pincode: record.pincode,
          country: record.country,
          website: record.website,
          category: record.category,
          rating: record.rating,
          lead_status: 'new',
          priority: record.priority || 'medium',
          assigned_to: record.assigned_to,
          assigned_by: user?.email,
          assigned_date: timestamp,
          lead_source: 'Inventory Bucket',
          notes: record.notes || '',
          facebook: record.facebook,
          instagram: record.instagram,
          linkedin: record.linkedin,
          twitter: record.twitter,
          youtube: record.youtube
        });

        // Log the action in MasterData audit
        await base44.entities.MasterDataAuditLog.create({
          master_data_id: record.id,
          action: 'status_changed',
          actor_email: user?.email,
          actor_name: user?.full_name,
          field_changed: 'moved_to_leads',
          after_value: 'true',
          source: 'sales_update',
          timestamp: timestamp,
          metadata: {
            moved_by: user?.email,
            moved_to: 'Leads'
          }
        });

        // Update MasterData status to indicate it's been moved
        await base44.entities.MasterData.update(record.id, {
          status: 'converted',
          notes: `${record.notes || ''}\n\nMoved to Leads on ${new Date().toLocaleDateString()} by ${user?.full_name || user?.email}`
        });
      }

      return movedCount;
    },
    onSuccess: (count) => {
      toast.success(`Successfully moved ${count} record${count !== 1 ? 's' : ''} to Leads`);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to move records to Leads');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-indigo-600" />
            Move to Leads
          </DialogTitle>
          <DialogDescription>
            Convert {selectedRows.length} record{selectedRows.length !== 1 ? 's' : ''} from Inventory Bucket to Leads
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-900">
              <strong>{selectedRows.length}</strong> record{selectedRows.length !== 1 ? 's' : ''} will be moved to the Leads page
            </div>
            <div className="text-xs text-blue-700 mt-2">
              • Records will be created as new leads with status "New"
              <br />
              • Original records will be marked as "Converted"
              <br />
              • All data will be synchronized
            </div>
          </div>

          {selectedRecords.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {selectedRecords.slice(0, 5).map(record => (
                <div key={record.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-sm">
                  <Users className="w-4 h-4 text-slate-400" />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{record.name}</div>
                    <div className="text-xs text-slate-500">{record.phone} • {record.city || 'No city'}</div>
                  </div>
                </div>
              ))}
              {selectedRecords.length > 5 && (
                <div className="text-xs text-slate-500 text-center py-2">
                  + {selectedRecords.length - 5} more records
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={moveToLeadsMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => moveToLeadsMutation.mutate()} disabled={moveToLeadsMutation.isPending}>
            {moveToLeadsMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                Move to Leads
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}