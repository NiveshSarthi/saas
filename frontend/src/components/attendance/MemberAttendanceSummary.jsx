import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  Award,
  Target,
  Zap
} from 'lucide-react';
import { format, differenceInDays, startOfMonth, endOfMonth } from 'date-fns';

export default function MemberAttendanceSummary({ records, selectedMonth }) {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  
  // Calculate statistics
  const presentDays = records.filter(r => 
    r.status === 'present' || 
    r.status === 'checked_out' || 
    r.status === 'checked_in' ||
    r.status === 'work_from_home'
  ).length;
  
  const totalWorkingDays = Math.min(
    differenceInDays(monthEnd, monthStart) + 1,
    differenceInDays(new Date(), monthStart) + 1
  );
  
  const avgWorkHours = records
    .filter(r => r.total_hours)
    .reduce((sum, r) => sum + (r.total_hours || 0), 0) / (presentDays || 1);
  
  const totalWorkHours = records
    .filter(r => r.total_hours)
    .reduce((sum, r) => sum + (r.total_hours || 0), 0);
  
  // Calculate streak
  const sortedRecords = [...records]
    .filter(r => 
      r.status === 'present' || 
      r.status === 'checked_out' || 
      r.status === 'checked_in' ||
      r.status === 'work_from_home'
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let currentStreak = 0;
  let lastDate = new Date();
  
  for (const record of sortedRecords) {
    const recordDate = new Date(record.date);
    const daysDiff = differenceInDays(lastDate, recordDate);
    
    if (daysDiff <= 1) {
      currentStreak++;
      lastDate = recordDate;
    } else {
      break;
    }
  }
  
  const onTimeCheckIns = records.filter(r => !r.is_late).length;
  const punctualityRate = presentDays > 0 ? (onTimeCheckIns / presentDays * 100).toFixed(1) : 0;
  
  const stats = [
    {
      title: 'Days Present',
      value: presentDays,
      subtitle: `out of ${totalWorkingDays} days`,
      icon: Calendar,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Hours',
      value: totalWorkHours.toFixed(1),
      subtitle: 'hours this month',
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Avg. Hours/Day',
      value: avgWorkHours.toFixed(1),
      subtitle: 'hours per day',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Current Streak',
      value: currentStreak,
      subtitle: 'consecutive days',
      icon: Zap,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Punctuality',
      value: `${punctualityRate}%`,
      subtitle: 'on-time check-ins',
      icon: Target,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Performance',
      value: presentDays >= totalWorkingDays * 0.95 ? 'Excellent' : presentDays >= totalWorkingDays * 0.85 ? 'Good' : 'Average',
      subtitle: 'attendance rating',
      icon: Award,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{stat.subtitle}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}