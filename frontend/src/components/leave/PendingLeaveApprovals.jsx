import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, eachDayOfInterval } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, User, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function PendingLeaveApprovals({ requests, leaveTypes, currentUser }) {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewComments, setReviewComments] = useState('');
  const [actionType, setActionType] = useState(null);

  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, status, comments, request }) => {
      // Update request
      await base44.entities.LeaveRequest.update(requestId, {
        status,
        reviewed_by: currentUser.email,
        reviewed_at: new Date().toISOString(),
        review_comments: comments
      });

      // Update balance
      const balances = await base44.entities.LeaveBalance.filter({
        user_email: request.user_email,
        leave_type_id: request.leave_type_id,
        year: new Date().getFullYear()
      });

      if (balances.length > 0) {
        const balance = balances[0];
        if (status === 'approved') {
          await base44.entities.LeaveBalance.update(balance.id, {
            used: balance.used + request.total_days,
            pending: balance.pending - request.total_days
          });

          // SYNC: Create Attendance records for each day of the leave
          try {
            const startDate = new Date(request.start_date);
            const endDate = new Date(request.end_date);
            const days = eachDayOfInterval({ start: startDate, end: endDate });

            // Determine status based on leave type
            const leaveType = leaveTypes.find(lt => lt.id === request.leave_type_id);
            let attendanceStatus = 'leave';
            if (leaveType) {
              const nameLower = leaveType.name.toLowerCase();
              if (nameLower.includes('sick')) attendanceStatus = 'sick_leave';
              else if (nameLower.includes('casual')) attendanceStatus = 'casual_leave';
              else if (nameLower.includes('wfh') || nameLower.includes('work from home')) attendanceStatus = 'work_from_home';
            }

            // Process each day
            for (const day of days) {
              // Skip Sundays (usually weekoff, logic could be more complex but this is a safe default)
              if (day.getDay() === 0) continue;

              const dateStr = format(day, 'yyyy-MM-dd');

              // Check if record exists
              const existing = await base44.entities.Attendance.filter({
                user_email: request.user_email,
                date: dateStr
              });

              if (existing.length > 0) {
                // Update existing
                await base44.entities.Attendance.update(existing[0].id, {
                  status: attendanceStatus,
                  remarks: `Leave Approved: ${leaveType?.name || 'Leave'}`
                });
              } else {
                // Create new
                await base44.entities.Attendance.create({
                  user_email: request.user_email,
                  date: dateStr,
                  status: attendanceStatus,
                  check_in_time: null,
                  check_out_time: null,
                  total_hours: 0,
                  remarks: `Leave Approved: ${leaveType?.name || 'Leave'}`
                });
              }
            }
          } catch (syncError) {
            console.error('Failed to sync attendance:', syncError);
            toast.error('Leave approved but failed to sync attendance records');
          }

        } else {
          // Rejected - return pending to available
          await base44.entities.LeaveBalance.update(balance.id, {
            pending: balance.pending - request.total_days,
            available: balance.available + request.total_days
          });
        }
      }

      // Send notifications
      try {
        await base44.functions.invoke('sendLeaveNotifications', {
          leaveRequestId: requestId,
          action: status,
          reviewerEmail: currentUser.email,
          comments: comments
        });
      } catch (e) {
        console.error('Failed to send notifications:', e);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['pending-leave-requests']);
      queryClient.invalidateQueries(['all-leave-requests']);
      queryClient.invalidateQueries(['approved-leaves']);
      queryClient.invalidateQueries(['attendance']); // Invalidate attendance too
      toast.success(`Leave ${variables.status} successfully`);
      setSelectedRequest(null);
      setReviewComments('');
      setActionType(null);
    },
    onError: (error) => {
      toast.error('Failed to process request: ' + error.message);
    }
  });

  const handleAction = (request, action) => {
    setSelectedRequest(request);
    setActionType(action);
  };

  const handleSubmitReview = () => {
    if (!selectedRequest || !actionType) return;

    reviewMutation.mutate({
      requestId: selectedRequest.id,
      status: actionType,
      comments: reviewComments,
      request: selectedRequest
    });
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          No pending leave requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map(request => {
          const leaveType = leaveTypes.find(lt => lt.id === request.leave_type_id);

          return (
            <Card key={request.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: leaveType?.color || '#6366F1' }}
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900">{request.user_name}</h3>
                      <p className="text-sm text-slate-500">{request.user_email}</p>
                    </div>
                  </div>
                  <Badge>{leaveType?.name}</Badge>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(new Date(request.start_date), 'MMM d')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                    </span>
                    <Badge variant="secondary">{request.total_days} days</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Reason:</p>
                    <p className="text-sm text-slate-600">{request.reason}</p>
                  </div>
                  {request.handover_notes && (
                    <div>
                      <p className="text-sm font-medium text-slate-700">Handover Notes:</p>
                      <p className="text-sm text-slate-600">{request.handover_notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAction(request, 'approved')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleAction(request, 'rejected')}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approved' ? 'Approve' : 'Reject'} Leave Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Employee:</span> {selectedRequest?.user_name}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Duration:</span> {selectedRequest?.total_days} days
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Comments (Optional)</label>
              <Textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                placeholder="Add your comments..."
                className="mt-2"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={reviewMutation.isPending}
                className={actionType === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                variant={actionType === 'rejected' ? 'destructive' : 'default'}
              >
                {reviewMutation.isPending ? 'Processing...' : `Confirm ${actionType === 'approved' ? 'Approval' : 'Rejection'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}