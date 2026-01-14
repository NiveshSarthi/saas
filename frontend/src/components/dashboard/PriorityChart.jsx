import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = {
  critical: '#EF4444',
  high: '#F97316', 
  medium: '#3B82F6',
  low: '#94A3B8'
};

const LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export default function PriorityChart({ tasks = [] }) {
  const priorityCounts = tasks.reduce((acc, task) => {
    const priority = task.priority || 'medium';
    acc[priority] = (acc[priority] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(priorityCounts).map(([key, value]) => ({
    name: LABELS[key],
    value,
    color: COLORS[key]
  }));

  if (tasks.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-full">
        <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-4 sm:mb-6">Tasks by Priority</h3>
        <div className="h-[150px] sm:h-[200px] flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
          No tasks yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-full">
      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white mb-4">Tasks by Priority</h3>
      
      <div className="h-[150px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              formatter={(value) => [value, 'Tasks']}
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value) => <span className="text-sm text-slate-600 dark:text-slate-300">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}