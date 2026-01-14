import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserCheck, UserX, Clock, TrendingUp } from 'lucide-react';
import { startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

export default function AttendanceStats({ records, selectedMonth, isAdmin, allUsers, selectedUser, approvedLeaves = [] }) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Count leave days from approved leave requests
  let leaveDaysCount = 0;
  approvedLeaves.forEach(leave => {
    const leaveStart = new Date(leave.start_date);
    const leaveEnd = new Date(leave.end_date);
    
    allDaysInMonth.forEach(day => {
      if (day >= leaveStart && day <= leaveEnd) {
        leaveDaysCount++;
      }
    });
  });
  
  const presentDays = records.filter(r => 
    r.status === 'present' || 
    r.status === 'checked_out' || 
    r.status === 'checked_in' ||
    r.status === 'work_from_home'
  ).length;
  const absentDays = records.filter(r => r.status === 'absent').length;
  const leaveDays = leaveDaysCount;
  
  const totalDays = presentDays + absentDays + leaveDays;
  const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;

  const stats = [
    {
      title: 'Present',
      value: presentDays,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Absent',
      value: absentDays,
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      title: 'Leave',
      value: leaveDays,
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Attendance Rate',
      value: `${attendanceRate}%`,
      icon: TrendingUp,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {stat.title}
              </CardTitle>
              <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}