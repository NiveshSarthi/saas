import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  TrendingUp,
  AlertTriangle,
  LogOut,
  Activity
} from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';

export default function AttendanceDashboard({ todayRecords = [], allUsers = [] }) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const stats = React.useMemo(() => {
    const totalEmployees = allUsers.length;
    const presentToday = todayRecords.filter(r => 
      ['checked_in', 'checked_out', 'present'].includes(r.status)
    ).length;
    const absentToday = totalEmployees - presentToday;
    const lateCheckIns = todayRecords.filter(r => r.is_late).length;
    const earlyCheckOuts = todayRecords.filter(r => r.is_early_checkout).length;

    const workedHours = todayRecords
      .filter(r => r.total_hours)
      .map(r => r.total_hours);
    const avgWorkingHours = workedHours.length > 0
      ? (workedHours.reduce((a, b) => a + b, 0) / workedHours.length).toFixed(1)
      : 0;

    const attendanceRate = totalEmployees > 0
      ? ((presentToday / totalEmployees) * 100).toFixed(1)
      : 0;

    return {
      totalEmployees,
      presentToday,
      absentToday,
      lateCheckIns,
      earlyCheckOuts,
      avgWorkingHours,
      attendanceRate
    };
  }, [todayRecords, allUsers]);

  const cards = [
    {
      title: 'Total Employees',
      value: stats.totalEmployees,
      icon: Users,
      color: 'text-slate-600',
      bgColor: 'bg-slate-100'
    },
    {
      title: 'Present Today',
      value: stats.presentToday,
      icon: UserCheck,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      badge: `${stats.attendanceRate}%`
    },
    {
      title: 'Absent Today',
      value: stats.absentToday,
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      title: 'Late Check-Ins',
      value: stats.lateCheckIns,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      title: 'Early Check-Outs',
      value: stats.earlyCheckOuts,
      icon: LogOut,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      title: 'Avg Working Hours',
      value: stats.avgWorkingHours + 'h',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-12 h-12 rounded-full ${card.bgColor} flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              {card.badge && (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  {card.badge}
                </Badge>
              )}
            </div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="text-sm text-slate-500 mt-1">{card.title}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}