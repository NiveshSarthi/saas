import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Calendar
} from 'lucide-react';
import { format, differenceInDays, startOfMonth } from 'date-fns';

export default function AttendanceInsights({ records = [], selectedMonth, todayRecord }) {
  const insights = [];

  // Late arrivals insight
  const lateCount = (records || []).filter(r => r.is_late).length;
  if (lateCount > 0) {
    insights.push({
      type: 'warning',
      icon: AlertTriangle,
      title: 'Late Arrivals',
      message: `You were late ${lateCount} time${lateCount > 1 ? 's' : ''} this month`,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    });
  }

  // Early checkout insight
  const earlyCount = records.filter(r => r.is_early_checkout).length;
  if (earlyCount > 0) {
    insights.push({
      type: 'info',
      icon: Clock,
      title: 'Early Checkouts',
      message: `${earlyCount} early checkout${earlyCount > 1 ? 's' : ''} recorded`,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    });
  }

  // Perfect attendance streak
  const perfectDays = records.filter(r =>
    (r.status === 'present' || r.status === 'checked_out') && !r.is_late
  ).length;

  if (perfectDays >= 5) {
    insights.push({
      type: 'success',
      icon: CheckCircle2,
      title: 'Great Attendance',
      message: `${perfectDays} days with on-time attendance!`,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    });
  }

  // Work hours insight
  const avgHours = records
    .filter(r => r.total_hours)
    .reduce((sum, r) => sum + (r.total_hours || 0), 0) / (records.length || 1);

  if (avgHours >= 8) {
    insights.push({
      type: 'success',
      icon: TrendingUp,
      title: 'Excellent Work Hours',
      message: `Averaging ${avgHours.toFixed(1)} hours per day`,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    });
  } else if (avgHours < 6 && records.length > 0) {
    insights.push({
      type: 'info',
      icon: Clock,
      title: 'Work Hours',
      message: `Consider increasing daily hours (avg: ${avgHours.toFixed(1)}h)`,
      color: 'text-slate-600',
      bgColor: 'bg-slate-50'
    });
  }

  // Check if checked in today
  if (!todayRecord || todayRecord.status === 'not_checked_in') {
    insights.push({
      type: 'reminder',
      icon: Calendar,
      title: 'Today\'s Attendance',
      message: 'Don\'t forget to check in!',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'success',
      icon: CheckCircle2,
      title: 'All Good!',
      message: 'Keep up the excellent attendance record',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Insights & Recommendations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${insight.bgColor}`}
              >
                <Icon className={`w-5 h-5 ${insight.color} flex-shrink-0 mt-0.5`} />
                <div>
                  <p className="font-medium text-sm text-slate-900">{insight.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{insight.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}