import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth } from 'date-fns';

export default function WorkHoursBreakdown({ records, selectedMonth }) {
  // Group by week
  const weeks = eachWeekOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth)
  });

  const weeklyData = weeks.map((weekStart, index) => {
    const weekEnd = endOfWeek(weekStart);
    const weekRecords = records.filter(r => {
      const recordDate = new Date(r.date);
      return recordDate >= weekStart && recordDate <= weekEnd;
    });

    const totalHours = weekRecords.reduce((sum, r) => sum + (r.total_hours || 0), 0);
    const avgHours = weekRecords.length > 0 ? totalHours / weekRecords.length : 0;
    
    return {
      week: `Week ${index + 1}`,
      hours: parseFloat(totalHours.toFixed(1)),
      days: weekRecords.length,
      avgHours: parseFloat(avgHours.toFixed(1))
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="font-semibold text-slate-900">{data.week}</p>
          <p className="text-sm text-slate-600">Total: {data.hours} hours</p>
          <p className="text-sm text-slate-600">Days: {data.days}</p>
          <p className="text-sm text-slate-600">Avg: {data.avgHours} hrs/day</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Weekly Work Hours
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={weeklyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="week" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
              {weeklyData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.hours >= 40 ? '#10b981' : entry.hours >= 30 ? '#3b82f6' : '#f59e0b'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}