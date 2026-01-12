import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const statusConfig = {
  present: { label: 'Present', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  checked_out: { label: 'Checked Out', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700', icon: XCircle },
  half_day: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  leave: { label: 'Leave', color: 'bg-purple-100 text-purple-700', icon: Clock },
  work_from_home: { label: 'WFH', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  sick_leave: { label: 'Sick Leave', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  casual_leave: { label: 'Casual Leave', color: 'bg-indigo-100 text-indigo-700', icon: Clock }
};

export default function RecentAttendanceHistory({ records }) {
  const recentRecords = [...records]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentRecords.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No recent attendance records</p>
          ) : (
            recentRecords.map((record) => {
              const config = statusConfig[record.status] || statusConfig.present;
              const StatusIcon = config.icon;
              
              return (
                <div 
                  key={record.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                      <StatusIcon className={`w-5 h-5 ${config.color.includes('green') ? 'text-green-600' : config.color.includes('red') ? 'text-red-600' : 'text-slate-600'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900">
                        {record.date && !isNaN(new Date(record.date)) 
                          ? format(new Date(record.date), 'EEEE, MMM dd')
                          : record.date}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {record.check_in_time && (
                          <span className="text-xs text-slate-500">
                            In: {record.check_in_time && !isNaN(new Date(record.check_in_time))
                              ? format(new Date(record.check_in_time), 'hh:mm a')
                              : '-'}
                          </span>
                        )}
                        {record.check_out_time && (
                          <span className="text-xs text-slate-500">
                            Out: {record.check_out_time && !isNaN(new Date(record.check_out_time))
                              ? format(new Date(record.check_out_time), 'hh:mm a')
                              : '-'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={config.color}>
                      {config.label}
                    </Badge>
                    {record.total_hours && (
                      <span className="text-xs font-medium text-slate-600">
                        {record.total_hours.toFixed(1)}h
                      </span>
                    )}
                    {record.is_late && (
                      <Badge variant="destructive" className="text-[10px]">Late</Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}