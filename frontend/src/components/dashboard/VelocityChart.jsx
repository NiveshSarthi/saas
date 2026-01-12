import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, subWeeks, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function VelocityChart({ tasks = [], sprints = [] }) {
  // Calculate velocity per week for the last 6 weeks
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const weekStart = startOfWeek(subWeeks(new Date(), 5 - i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    
    const completedTasks = tasks.filter(task => {
      if (task.status !== 'done' || !task.updated_date) return false;
      const completedDate = new Date(task.updated_date);
      return isWithinInterval(completedDate, { start: weekStart, end: weekEnd });
    });

    const storyPoints = completedTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const taskCount = completedTasks.length;

    return {
      week: format(weekStart, 'MMM d'),
      points: storyPoints,
      tasks: taskCount,
      isCurrentWeek: i === 5
    };
  });

  const totalPoints = weeks.reduce((sum, w) => sum + w.points, 0);
  const avgVelocity = Math.round(totalPoints / 6);
  const currentWeekPoints = weeks[5]?.points || 0;
  const lastWeekPoints = weeks[4]?.points || 0;
  const velocityChange = lastWeekPoints > 0 
    ? Math.round(((currentWeekPoints - lastWeekPoints) / lastWeekPoints) * 100) 
    : 0;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">Velocity Trend</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Avg: {avgVelocity} pts/week
          </Badge>
          {velocityChange !== 0 && (
            <Badge 
              className={velocityChange > 0 
                ? "bg-green-100 text-green-700" 
                : "bg-red-100 text-red-700"
              }
            >
              {velocityChange > 0 ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
              {Math.abs(velocityChange)}%
            </Badge>
          )}
        </div>
      </div>

      <div className="h-36 sm:h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="week" 
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs">
                      <p className="font-medium">{data.week}</p>
                      <p>{data.points} story points</p>
                      <p>{data.tasks} tasks completed</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="points" radius={[4, 4, 0, 0]}>
              {weeks.map((entry, index) => (
                <Cell 
                  key={index} 
                  fill={entry.isCurrentWeek ? '#6366F1' : '#C7D2FE'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-700">
        <div className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{currentWeekPoints}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">This Week</p>
        </div>
        <div className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{avgVelocity}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Avg Velocity</p>
        </div>
        <div className="text-center">
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{totalPoints}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Total Points</p>
        </div>
      </div>
    </div>
  );
}