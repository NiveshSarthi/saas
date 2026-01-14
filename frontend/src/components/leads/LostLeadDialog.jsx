import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, XCircle } from 'lucide-react';

const LOST_REASONS = [
  'Budget constraints',
  'Went with competitor',
  'Not interested anymore',
  'Poor timing',
  'Location not suitable',
  'Better deal elsewhere',
  'Project cancelled',
  'No response',
  'Other',
];

export default function LostLeadDialog({ open, onOpenChange, lead, onSuccess }) {
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const lostMutation = useMutation({
    mutationFn: async () => {
      if (!reason) {
        setError('Please select a reason');
        return;
      }

      await base44.entities.Lead.update(lead.id, {
        status: 'lost',
        lost_reason: reason,
        lost_comment: comment,
        lost_date: new Date().toISOString(),
      });

      // Log activity
      await base44.entities.RELeadActivity.create({
        lead_id: lead.id,
        activity_type: 'status_change',
        notes: `Lead marked as lost: ${reason}${comment ? ` - ${comment}` : ''}`,
        created_by: lead.assigned_to || lead.created_by,
      });

      return { ...lead, status: 'lost', lost_reason: reason, lost_comment: comment };
    },
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      onSuccess?.(updatedLead);
      setReason('');
      setComment('');
      setError('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Close Lead</DialogTitle>
          <DialogDescription>
            Mark this lead as lost. This action can be reversed later if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Lost Reason *</Label>
            <Select value={reason} onValueChange={(val) => {
              setReason(val);
              setError('');
            }}>
              <SelectTrigger className={error ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map(r => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label>Additional Comment (Optional)</Label>
            <Textarea
              placeholder="Add any additional details..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              This lead will be marked as lost and moved out of the active pipeline. You can find it later in the "Lost Leads" filter.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={lostMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => lostMutation.mutate()}
            disabled={lostMutation.isPending}
          >
            {lostMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Marking as Lost...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Mark as Lost
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}