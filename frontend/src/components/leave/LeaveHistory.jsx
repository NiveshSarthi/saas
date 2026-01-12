import React from 'react';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export default function LeaveHistory({ requests, leaveTypes }) {
  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center text-slate-500">
        No leave history yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reviewed By</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map(request => {
            const leaveType = leaveTypes.find(lt => lt.id === request.leave_type_id);
            const config = statusConfig[request.status] || statusConfig.approved;
            const StatusIcon = config.icon;

            return (
              <TableRow key={request.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{request.user_name}</p>
                    <p className="text-xs text-slate-500">{request.user_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{leaveType?.name}</Badge>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p>{format(new Date(request.start_date), 'MMM d')}</p>
                    <p className="text-slate-500">{format(new Date(request.end_date), 'MMM d, yyyy')}</p>
                  </div>
                </TableCell>
                <TableCell>{request.total_days}</TableCell>
                <TableCell>
                  <Badge className={cn("flex items-center gap-1 w-fit", config.color)}>
                    <StatusIcon className="w-3 h-3" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {request.reviewed_by || '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}