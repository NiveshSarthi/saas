import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Edit } from 'lucide-react';
import EditAttendanceDialog from '@/components/attendance/EditAttendanceDialog';

const statusConfig = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700' },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700' },
  half_day: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700' },
  leave: { label: 'Leave', color: 'bg-purple-100 text-purple-700' },
  work_from_home: { label: 'WFH', color: 'bg-blue-100 text-blue-700' },
  sick_leave: { label: 'Sick Leave', color: 'bg-orange-100 text-orange-700' },
  casual_leave: { label: 'Casual Leave', color: 'bg-indigo-100 text-indigo-700' },
  checked_in: { label: 'Checked In', color: 'bg-cyan-100 text-cyan-700' },
  checked_out: { label: 'Checked Out', color: 'bg-teal-100 text-teal-700' },
  weekoff: { label: 'Week Off', color: 'bg-orange-100 text-orange-700' },
  holiday: { label: 'Holiday', color: 'bg-pink-100 text-pink-700' }
};

export default function AttendanceTable({ records, users, isAdmin, currentUserEmail, isHR }) {
  const [editingRecord, setEditingRecord] = useState(null);
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (isNaN(dateA) || isNaN(dateB)) return 0;
    return dateB.getTime() - dateA.getTime();
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email?.split('@')[0] || 'Unknown';
  };

  const formatDuration = (hours) => {
    if (!hours) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0 && m === 0) return '0h';
    return `${h}h ${m}m`;
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {isAdmin && <TableHead>User</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Total Hours</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Notes</TableHead>
              {isHR && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isHR ? 9 : (isAdmin ? 8 : 7)} className="text-center text-slate-500 py-8">
                  No attendance records found
                </TableCell>
              </TableRow>
            ) : (
              sortedRecords.map((record) => {
                const config = statusConfig[record.status] || statusConfig.present;
                return (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">
                      {record.date && !isNaN(new Date(record.date))
                        ? format(parseISO(record.date), 'MMM dd, yyyy')
                        : record.date || '-'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>{getUserName(record.user_email)}</TableCell>
                    )}
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className={cn("text-xs w-fit", config.color)}>
                          {config.label}
                        </Badge>
                        <div className="flex flex-wrap gap-1">
                          {record.is_late && (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200 bg-red-50">Late</Badge>
                          )}
                          {record.is_early_checkout && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">Early Out</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.check_in ? (
                        (record.check_in.includes('T') || record.check_in.includes('Z'))
                          ? format(new Date(record.check_in), 'hh:mm a')
                          : record.check_in
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {record.check_out ? (
                        (record.check_out.includes('T') || record.check_out.includes('Z'))
                          ? format(new Date(record.check_out), 'hh:mm a')
                          : record.check_out
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-indigo-600">
                        {formatDuration(record.total_hours)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {record.location ? (
                        typeof record.location === 'string' ? (
                          <span>{record.location}</span>
                        ) : (
                          <span className="flex items-center gap-1" title={`Accuracy: ${record.location.accuracy || '?'}m`}>
                            📍 {record.location.latitude ? record.location.latitude.toFixed(4) : '?'}, {record.location.longitude ? record.location.longitude.toFixed(4) : '?'}
                          </span>
                        )
                      ) : '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {record.notes || '-'}
                    </TableCell>
                    {isHR && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingRecord(record)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <EditAttendanceDialog
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        record={editingRecord}
        allUsers={users}
      />
    </>
  );
}