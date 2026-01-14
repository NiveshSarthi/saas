import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'hardware', label: 'Hardware Issue' },
  { value: 'software', label: 'Software Issue' },
  { value: 'network', label: 'Network/Connectivity' },
  { value: 'access', label: 'Access/Permissions' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function CreateTicketDialog({ open, onOpenChange, user }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    asset_id: '',
  });

  const queryClient = useQueryClient();

  const { data: slaConfigs = [] } = useQuery({
    queryKey: ['sla-configs'],
    queryFn: () => base44.entities.ITSLAConfig.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Generate ticket ID
      const ticketCount = await base44.entities.ITTicket.list();
      const ticketId = `IT-${String(ticketCount.length + 1).padStart(5, '0')}`;

      // Get SLA hours
      const slaConfig = slaConfigs.find(c => c.priority === data.priority);
      const slaHours = slaConfig?.sla_hours || 24;
      const slaDueAt = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();

      // Create ticket
      const ticket = await base44.entities.ITTicket.create({
        ...data,
        ticket_id: ticketId,
        created_by_email: user?.email,
        created_by_name: user?.full_name || user?.email,
        department_id: user?.department_id || null,
        status: 'open',
        sla_hours: slaHours,
        sla_due_at: slaDueAt,
        sla_breached: false,
      });

      // Log activity
      await base44.entities.ITTicketActivity.create({
        ticket_id: ticket.id,
        action: 'created',
        new_value: 'Ticket created',
        performed_by: user?.email,
      });

      // Auto-assign ticket based on priority
      try {
        const assignResult = await base44.functions.invoke('autoAssignITTicket', {
          ticket_id: ticket.id,
          priority: data.priority
        });
        console.log('Auto-assignment result:', assignResult.data);
      } catch (error) {
        console.error('Auto-assignment failed:', error);
        // Continue even if auto-assignment fails
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      toast.success('Ticket created successfully');
      onOpenChange(false);
      setFormData({
        title: '',
        description: '',
        category: 'other',
        priority: 'medium',
        asset_id: '',
      });
    },
    onError: (error) => {
      toast.error('Failed to create ticket: ' + error.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input
              placeholder="Brief description of the issue"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority *</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(pri => (
                    <SelectItem key={pri.value} value={pri.value}>
                      {pri.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              placeholder="Detailed description of the issue..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={5}
              required
            />
          </div>

          <div>
            <Label>Asset / Device ID (Optional)</Label>
            <Input
              placeholder="e.g., LAPTOP-001"
              value={formData.asset_id}
              onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}