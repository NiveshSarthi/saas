import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Send, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  waiting_for_user: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-slate-100 text-slate-800',
  reopened: 'bg-red-100 text-red-800',
  assigned: 'bg-blue-100 text-blue-800',
  approved: 'bg-emerald-100 text-emerald-800',
  pending_approval: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function TicketDetailDialog({ ticket, open, onOpenChange, user, isITMember, isITHead, itUsers = [] }) {
  const [comment, setComment] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['ticket-comments', ticket?.id],
    queryFn: () => base44.entities.ITTicketComment.filter({ ticket_id: ticket.id }, '-created_at'),
    enabled: !!ticket?.id,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['ticket-activities', ticket?.id],
    queryFn: () => base44.entities.ITTicketActivity.filter({ ticket_id: ticket.id }, '-created_at'),
    enabled: !!ticket?.id,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (commentData) => {
      await base44.entities.ITTicketComment.create(commentData);
      await base44.entities.ITTicketActivity.create({
        ticket_id: ticket.id,
        action: 'commented',
        new_value: 'Added comment',
        performed_by: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-comments', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket-activities', ticket.id] });
      setComment('');
      toast.success('Comment added');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, resolution }) => {
      const updateData = { status };
      if (status === 'resolved') {
        updateData.resolved_date = new Date().toISOString();
        updateData.resolution_summary = resolution;
      }
      if (status === 'closed') {
        updateData.closed_date = new Date().toISOString();
      }

      await base44.entities.ITTicket.update(ticket.id, updateData);
      await base44.entities.ITTicketActivity.create({
        ticket_id: ticket.id,
        action: 'status_changed',
        old_value: ticket.status,
        new_value: status,
        performed_by: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      toast.success('Status updated');
      if (updateStatusMutation.variables.status === 'closed') {
        onOpenChange(false);
      }
    },
  });

  const reviewMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('reviewITTicket', {
      ...data,
      ticket_id: ticket.id,
      reviewer_email: user?.email,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
      toast.success('Ticket reviewed successfully');
      setIsReviewing(false);
      onOpenChange(false);
    },
  });

  const handleAddComment = () => {
    if (!comment.trim()) return;
    addCommentMutation.mutate({
      ticket_id: ticket.id,
      author_email: user?.email,
      author_role: isITMember ? 'it_member' : 'employee',
      comment: comment.trim(),
      is_internal: false,
    });
  };

  const handleResolve = () => {
    if (!resolutionSummary.trim()) {
      toast.error('Please provide a resolution summary');
      return;
    }
    updateStatusMutation.mutate({ status: 'resolved', resolution: resolutionSummary });
  };

  const canResolve = isITMember && ['open', 'assigned', 'in_progress'].includes(ticket.status) && ticket.assigned_to;
  const canClose = ticket.status === 'resolved';
  const canReopen = ticket.status === 'closed' && !isITMember;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{ticket.ticket_id}</DialogTitle>
              <p className="text-sm text-slate-600 mt-1">{ticket.title}</p>
            </div>
            <Badge className={STATUS_COLORS[ticket.status]}>
              {ticket.status.replace('_', ' ')}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6 overflow-hidden flex-1">
          {/* Left - Details */}
          <div className="col-span-2 space-y-4 overflow-y-auto pr-2">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-slate-700">{ticket.description}</p>
            </div>

            {ticket.resolution_summary && (
              <div>
                <h3 className="font-semibold mb-2 text-green-700">Resolution</h3>
                <p className="text-sm text-slate-700 bg-green-50 p-3 rounded-lg">
                  {ticket.resolution_summary}
                </p>
              </div>
            )}

            <Separator />

            {/* Comments */}
            <div>
              <h3 className="font-semibold mb-3">Comments</h3>
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{c.author_email}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{c.comment}</p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-slate-500">No comments yet</p>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                />
                <Button onClick={handleAddComment} disabled={addCommentMutation.isPending}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right - Metadata & Actions */}
          <div className="space-y-4 border-l pl-4 overflow-y-auto">
            <div>
              <h3 className="font-semibold mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-600">Priority:</span>
                  <Badge className="ml-2">{ticket.priority}</Badge>
                </div>
                <div>
                  <span className="text-slate-600">Category:</span>
                  <span className="ml-2">{ticket.category}</span>
                </div>
                <div>
                  <span className="text-slate-600">Created by:</span>
                  <span className="ml-2">{ticket.created_by_name}</span>
                </div>
                <div>
                  <span className="text-slate-600">Assigned to:</span>
                  <span className="ml-2">{ticket.assigned_to_name || 'Unassigned'}</span>
                </div>
                {ticket.sla_due_at && (
                  <div>
                    <span className="text-slate-600">SLA Due:</span>
                    <span className="ml-2 text-xs">
                      {new Date(ticket.sla_due_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {isITMember && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">IT Actions</h3>
                  <div className="space-y-3">
                    {ticket.status === 'open' && (
                      <Select
                        onValueChange={(val) => {
                          const selectedUser = itUsers.find(u => u.email === val);
                          // Using a generic update for simple reassignment when already open
                          base44.entities.ITTicket.update(ticket.id, {
                            assigned_to: val,
                          }).then(() => {
                            queryClient.invalidateQueries({ queryKey: ['it-tickets'] });
                            toast.success('Ticket reassigned');
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Assign to..." />
                        </SelectTrigger>
                        <SelectContent>
                          {itUsers.map(u => (
                            <SelectItem key={u.email} value={u.email}>
                              {u.full_name || u.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {isITHead && ticket.status === 'pending_approval' && (
                      <div className="space-y-3 p-3 bg-indigo-50 rounded-lg">
                        <p className="text-xs font-semibold text-indigo-700">IT Head Review</p>
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            className="flex-1 h-8 text-xs"
                            onClick={() => reviewMutation.mutate({ action: 'approve' })}
                            disabled={reviewMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            className="flex-1 h-8 text-xs"
                            onClick={() => setIsReviewing('reject')}
                          >
                            Reject
                          </Button>
                        </div>
                        <Select
                          onValueChange={(val) => reviewMutation.mutate({ action: 'approve', new_assignee: val })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Approve & Reassign..." />
                          </SelectTrigger>
                          <SelectContent>
                            {itUsers.map(u => (
                              <SelectItem key={u.email} value={u.email}>
                                {u.full_name || u.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {isReviewing === 'reject' && (
                          <div className="space-y-2 mt-2">
                            <Label className="text-xs">Reason for Rejection</Label>
                            <Textarea
                              className="text-xs"
                              rows={2}
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-[10px]"
                                onClick={() => setIsReviewing(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1 h-7 text-[10px]"
                                onClick={() => reviewMutation.mutate({ action: 'reject', rejection_reason: rejectionReason })}
                                disabled={!rejectionReason || reviewMutation.isPending}
                              >
                                {reviewMutation.isPending ? 'Working...' : 'Confirm Reject'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {['open', 'assigned'].includes(ticket.status) && ticket.assigned_to === user?.email && (
                      <Button
                        className="w-full"
                        onClick={() => updateStatusMutation.mutate({ status: 'in_progress' })}
                      >
                        Start Working
                      </Button>
                    )}

                    {canResolve && (
                      <div className="space-y-2">
                        <Label>Resolution Summary</Label>
                        <Textarea
                          placeholder="Describe how the issue was resolved..."
                          value={resolutionSummary}
                          onChange={(e) => setResolutionSummary(e.target.value)}
                          rows={3}
                        />
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={handleResolve}
                          disabled={updateStatusMutation.isPending}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Mark Resolved
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {canClose && (
              <>
                <Separator />
                <Button
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate({ status: 'closed' })}
                >
                  Close Ticket
                </Button>
              </>
            )}

            {canReopen && (
              <>
                <Separator />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => updateStatusMutation.mutate({ status: 'reopened' })}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reopen Ticket
                </Button>
              </>
            )}

            <Separator />

            {/* Activity Log */}
            <div>
              <h3 className="font-semibold mb-3">Activity</h3>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {activities.map(activity => (
                    <div key={activity.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        <span className="font-medium">{activity.action.replace('_', ' ')}</span>
                      </div>
                      <div className="ml-4 text-slate-600">
                        {activity.new_value}
                      </div>
                      <div className="ml-4 text-slate-400">
                        {new Date(activity.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}