import React, { useMemo } from 'react';
import { format, parseISO, eachDayOfInterval, differenceInDays, isBefore, isAfter } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

export default function BurndownChart({ sprint, tasks }) {
  const chartData = useMemo(() => {
    if (!sprint.start_date || !sprint.end_date) return [];

    const startDate = parseISO(sprint.start_date);
    const endDate = parseISO(sprint.end_date);
    const today = new Date();

    const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const totalDays = days.length - 1;

    // Ideal burndown (linear)
    const data = days.map((day, index) => {
      const idealRemaining = totalPoints - (totalPoints / totalDays) * index;
      
      // Actual remaining (only for past/current days)
      let actualRemaining = null;
      if (isBefore(day, today) || format(day, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
        // Calculate remaining points based on tasks completed by this date
        const completedByDate = tasks.filter(t => {
          if (t.status !== 'done') return false;
          // Use updated_date as completion date approximation
          if (!t.updated_date) return false;
          return isBefore(parseISO(t.updated_date.split('T')[0]), day) || 
                 format(parseISO(t.updated_date.split('T')[0]), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
        });
        const completedPoints = completedByDate.reduce((sum, t) => sum + (t.story_points || 0), 0);
        actualRemaining = totalPoints - completedPoints;
      }

      return {
        date: format(day, 'MMM d'),
        ideal: Math.max(0, Math.round(idealRemaining * 10) / 10),
        actual: actualRemaining !== null ? Math.max(0, actualRemaining) : null,
      };
    });

    return data;
  }, [sprint, tasks]);

  if (!sprint.start_date || !sprint.end_date) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Burndown Chart</h3>
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          Set sprint dates to view burndown
        </div>
      </div>
    );
  }

  const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);

  if (totalPoints === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-4">Burndown Chart</h3>
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          Add story points to tasks to view burndown
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Burndown Chart</h3>
      
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="ideal" 
              stroke="#cbd5e1" 
              strokeDasharray="5 5"
              dot={false}
              name="Ideal"
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#6366f1" 
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 3 }}
              name="Actual"
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-slate-300" style={{ borderTop: '2px dashed #cbd5e1' }} />
          <span className="text-slate-500">Ideal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-indigo-500" />
          <span className="text-slate-500">Actual</span>
        </div>
      </div>
    </div>
  );
}