import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-700', icon: AlertCircle }
};

export default function MyLeaveRequests({ requests, leaveTypes }) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-slate-500">
          No leave requests yet. Click "Request Leave" to submit your first request.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map(request => {
        const leaveType = leaveTypes.find(lt => lt.id === request.leave_type_id);
        const config = statusConfig[request.status] || statusConfig.pending;
        const StatusIcon = config.icon;

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
                    <h3 className="font-semibold text-slate-900">{leaveType?.name}</h3>
                    <p className="text-sm text-slate-500">
                      {format(new Date(request.start_date), 'MMM d, yyyy')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <Badge className={cn("flex items-center gap-1", config.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {config.label}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>{request.total_days} day(s)</span>
                </div>
                <p className="text-slate-700">
                  <span className="font-medium">Reason:</span> {request.reason}
                </p>
                {request.review_comments && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs font-medium text-slate-500">Review Comments:</p>
                    <p className="text-sm text-slate-700">{request.review_comments}</p>
                    {request.reviewed_by && (
                      <p className="text-xs text-slate-500 mt-1">
                        by {request.reviewed_by} • {format(new Date(request.reviewed_at), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}