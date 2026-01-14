import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Calendar,
  User,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function TimesheetApproval() {
  const [user, setUser] = useState(null);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null); // 'approve' or 'reject'
  const [reviewComments, setReviewComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [freelancerFilter, setFreelancerFilter] = useState('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  // Get all timesheets for approval
  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['timesheets-approval', statusFilter, freelancerFilter],
    queryFn: async () => {
      let filter = {};
      if (statusFilter !== 'all') {
        filter.status = statusFilter;
      }
      if (freelancerFilter !== 'all') {
        filter.freelancer_email = freelancerFilter;
      }

      return await base44.entities.Timesheet.filter(filter, '-submitted_at');
    },
    enabled: !!user?.role === 'admin',
  });

  // Get freelancers for filter
  const { data: freelancers = [] } = useQuery({
    queryKey: ['freelancers-for-filter'],
    queryFn: () => base44.entities.User.filter({ role: 'freelancer' }),
    enabled: !!user?.role === 'admin',
  });

  const approveTimesheetMutation = useMutation({
    mutationFn: async ({ timesheetId, comments }) => {
      return await base44.entities.Timesheet.update(timesheetId, {
        status: 'approved',
        approved_at: new Date(),
        approved_by: user.email,
        comments: comments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets-approval'] });
      setReviewDialogOpen(false);
      setSelectedTimesheet(null);
      setReviewComments('');
      toast.success('Timesheet approved successfully');
    },
  });

  const rejectTimesheetMutation = useMutation({
    mutationFn: async ({ timesheetId, reason, comments }) => {
      return await base44.entities.Timesheet.update(timesheetId, {
        status: 'rejected',
        rejected_at: new Date(),
        rejected_by: user.email,
        rejection_reason: reason,
        comments: comments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets-approval'] });
      setReviewDialogOpen(false);
      setSelectedTimesheet(null);
      setReviewComments('');
      setRejectionReason('');
      toast.success('Timesheet rejected');
    },
  });

  const handleApprove = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setReviewAction('approve');
    setReviewDialogOpen(true);
    setReviewComments('');
  };

  const handleReject = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setReviewAction('reject');
    setReviewDialogOpen(true);
    setReviewComments('');
    setRejectionReason('');
  };

  const handleConfirmReview = () => {
    if (reviewAction === 'approve') {
      approveTimesheetMutation.mutate({
        timesheetId: selectedTimesheet.id,
        comments: reviewComments
      });
    } else if (reviewAction === 'reject') {
      if (!rejectionReason.trim()) {
        toast.error('Please provide a reason for rejection');
        return;
      }
      rejectTimesheetMutation.mutate({
        timesheetId: selectedTimesheet.id,
        reason: rejectionReason,
        comments: reviewComments
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
      submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700', icon: Clock },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
    };
    const config = statusConfig[status] || statusConfig.draft;
    const IconComponent = config.icon;

    return (
      <Badge className={cn("flex items-center gap-1", config.color)}>
        <IconComponent className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const formatWeekRange = (weekStart) => {
    const start = new Date(weekStart);
    const end = addDays(start, 6);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Please log in to access timesheet approval.</p>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only administrators can access timesheet approval.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Timesheet Approval</h1>
        <p className="text-slate-600 mt-1">Review and approve freelancer timesheets</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-sm">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="freelancer-filter" className="text-sm">Freelancer</Label>
            <Select value={freelancerFilter} onValueChange={setFreelancerFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Freelancers</SelectItem>
                {freelancers.map(freelancer => (
                  <SelectItem key={freelancer.email} value={freelancer.email}>
                    {freelancer.full_name || freelancer.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Timesheets Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Timesheets ({timesheets.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-slate-500 mt-4">Loading timesheets...</p>
          </div>
        ) : timesheets.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Freelancer</TableHead>
                <TableHead>Week</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets.map((timesheet) => (
                <TableRow key={timesheet.id}>
                  <TableCell className="font-medium">
                    {timesheet.freelancer_name}
                    <div className="text-xs text-slate-500">{timesheet.freelancer_email}</div>
                  </TableCell>
                  <TableCell>{formatWeekRange(timesheet.week_start_date)}</TableCell>
                  <TableCell>
                    {format(new Date(timesheet.period_start), 'MMM d')} - {format(new Date(timesheet.period_end), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-medium">{timesheet.total_hours}h</TableCell>
                  <TableCell>{getStatusBadge(timesheet.status)}</TableCell>
                  <TableCell>
                    {timesheet.submitted_at ? format(new Date(timesheet.submitted_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTimesheet(timesheet)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>

                      {timesheet.status === 'submitted' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(timesheet)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(timesheet)}
                            className="border-red-500 text-red-600 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No timesheets found</h3>
            <p className="text-slate-500">No timesheets match the current filters</p>
          </div>
        )}
      </div>

      {/* Timesheet Details Dialog */}
      <Dialog open={!!selectedTimesheet && !reviewDialogOpen} onOpenChange={() => setSelectedTimesheet(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {selectedTimesheet?.freelancer_name} - Timesheet Details
            </DialogTitle>
            <DialogDescription>
              Week of {selectedTimesheet ? formatWeekRange(selectedTimesheet.week_start_date) : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedTimesheet && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Status</p>
                    {getStatusBadge(selectedTimesheet.status)}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Hours</p>
                    <p className="text-2xl font-bold text-indigo-600">{selectedTimesheet.total_hours}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Submitted</p>
                    <p className="text-sm">{selectedTimesheet.submitted_at ? format(new Date(selectedTimesheet.submitted_at), 'MMM d, yyyy HH:mm') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Entries</p>
                    <p className="text-lg font-semibold">{selectedTimesheet.entries?.length || 0}</p>
                  </div>
                </div>
              </div>

              {/* Time Entries */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-4">Time Entries</h4>
                {selectedTimesheet.entries?.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTimesheet.entries.map((entry, index) => (
                      <div key={index} className="bg-white border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-2">
                              <span className="font-medium text-slate-900">{entry.task_title}</span>
                              <Badge variant="outline">{entry.project_name}</Badge>
                              <span className="text-sm text-slate-500">{entry.hours}h</span>
                            </div>
                            <p className="text-sm text-slate-600 mb-2">{entry.description}</p>
                            <p className="text-xs text-slate-400">
                              {format(new Date(entry.date), 'EEEE, MMMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-500 text-center py-8">No time entries found</p>
                )}
              </div>

              {/* Approval/Rejection Info */}
              {selectedTimesheet.status !== 'submitted' && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-slate-900 mb-3">
                    {selectedTimesheet.status === 'approved' ? 'Approval' : 'Rejection'} Details
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">By:</span>
                      <span className="text-sm">{selectedTimesheet.approved_by || selectedTimesheet.rejected_by}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">Date:</span>
                      <span className="text-sm">
                        {selectedTimesheet.approved_at ?
                          format(new Date(selectedTimesheet.approved_at), 'MMM d, yyyy HH:mm') :
                          selectedTimesheet.rejected_at ?
                          format(new Date(selectedTimesheet.rejected_at), 'MMM d, yyyy HH:mm') : '-'
                        }
                      </span>
                    </div>
                    {selectedTimesheet.rejection_reason && (
                      <div>
                        <span className="text-sm text-slate-500">Reason:</span>
                        <p className="text-sm text-red-600 mt-1">{selectedTimesheet.rejection_reason}</p>
                      </div>
                    )}
                    {selectedTimesheet.comments && (
                      <div>
                        <span className="text-sm text-slate-500">Comments:</span>
                        <p className="text-sm mt-1">{selectedTimesheet.comments}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className={cn(
              "flex items-center gap-2",
              reviewAction === 'approve' ? "text-green-600" : "text-red-600"
            )}>
              {reviewAction === 'approve' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Timesheet
            </DialogTitle>
            <DialogDescription>
              {selectedTimesheet && (
                <span>
                  {selectedTimesheet.freelancer_name}'s timesheet for {formatWeekRange(selectedTimesheet.week_start_date)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {reviewAction === 'reject' && (
              <div>
                <Label htmlFor="rejection-reason" className="text-red-600">
                  Reason for Rejection <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Please provide a reason for rejecting this timesheet..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label htmlFor="review-comments">Comments (Optional)</Label>
              <Textarea
                id="review-comments"
                placeholder="Add any additional comments..."
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmReview}
              disabled={
                approveTimesheetMutation.isPending ||
                rejectTimesheetMutation.isPending ||
                (reviewAction === 'reject' && !rejectionReason.trim())
              }
              className={cn(
                reviewAction === 'approve'
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              )}
            >
              {approveTimesheetMutation.isPending || rejectTimesheetMutation.isPending ? (
                'Processing...'
              ) : (
                <>
                  {reviewAction === 'approve' ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {reviewAction === 'approve' ? 'Approve' : 'Reject'} Timesheet
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}