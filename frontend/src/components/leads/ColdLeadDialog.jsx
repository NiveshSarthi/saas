import React from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Snowflake } from 'lucide-react';

export default function ColdLeadDialog({ open, onOpenChange, lead, onSuccess }) {
  const queryClient = useQueryClient();

  const coldMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Lead.update(lead.id, {
        is_cold: true,
        cold_date: new Date().toISOString(),
      });

      // Log activity
      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: 'Stage Change',
        description: 'Lead marked as cold - no response after multiple attempts',
        actor_email: lead.assigned_to || lead.created_by,
      });

      return { ...lead, is_cold: true };
    },
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      onSuccess?.(updatedLead);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Cold Lead</DialogTitle>
          <DialogDescription>
            This lead hasn't responded after multiple attempts
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Snowflake className="w-8 h-8 text-blue-500 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">What happens next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Lead remains in the system</li>
                <li>• Marked with a "Cold" badge</li>
                <li>• Can be reactivated anytime</li>
                <li>• Visible in "Cold Leads" filter</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={coldMutation.isPending}>
            Keep Trying
          </Button>
          <Button
            onClick={() => coldMutation.mutate()}
            disabled={coldMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {coldMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Marking...
              </>
            ) : (
              <>
                <Snowflake className="w-4 h-4 mr-2" />
                Mark Cold
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}