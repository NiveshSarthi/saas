import React from 'react';
import { TrendingUp, Clock, Target, Trophy, Zap, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LeadMetricsDashboard({ leads }) {
  const totalLeads = leads.length;
  const wonLeads = leads.filter(l => l.status === 'closed_won').length;
  const inProgress = leads.filter(l => l.status !== 'lost' && l.status !== 'closed_won' && !l.is_cold).length;
  const todayFollowups = leads.filter(l => {
    if (!l.next_follow_up) return false;
    const followUpDate = new Date(l.next_follow_up).toDateString();
    const today = new Date().toDateString();
    return followUpDate === today;
  }).length;
  
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;
  
  const avgResponseTime = leads
    .filter(l => l.last_contact_date && l.created_date)
    .reduce((sum, l) => {
      const diff = new Date(l.last_contact_date) - new Date(l.created_date);
      return sum + diff / (1000 * 60 * 60); // hours
    }, 0) / leads.length || 0;

  const thisMonthWon = leads.filter(l => {
    if (l.status !== 'closed_won' || !l.updated_date) return false;
    const updated = new Date(l.updated_date);
    const now = new Date();
    return updated.getMonth() === now.getMonth() && updated.getFullYear() === now.getFullYear();
  }).length;

  const metrics = [
    {
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      trend: '+2.3%'
    },
    {
      label: "Today's Follow-ups",
      value: todayFollowups,
      icon: Clock,
      color: 'bg-amber-500',
      highlight: todayFollowups > 0
    },
    {
      label: 'Active Pipeline',
      value: inProgress,
      icon: Target,
      color: 'bg-blue-500',
    },
    {
      label: 'Won This Month',
      value: thisMonthWon,
      icon: Trophy,
      color: 'bg-purple-500',
      celebrate: thisMonthWon > 0
    },
    {
      label: 'Avg Response Time',
      value: avgResponseTime > 0 ? `${avgResponseTime.toFixed(1)}h` : '-',
      icon: Zap,
      color: 'bg-indigo-500',
    },
    {
      label: 'Total Leads',
      value: totalLeads,
      icon: DollarSign,
      color: 'bg-slate-500',
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <div
            key={idx}
            className={cn(
              "bg-white rounded-xl p-4 border transition-all hover:shadow-md",
              metric.highlight && "ring-2 ring-amber-400 animate-pulse"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", metric.color)}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-2xl font-bold text-slate-900">
                  {metric.value}
                  {metric.celebrate && " 🎉"}
                </div>
                <div className="text-xs text-slate-500 truncate">{metric.label}</div>
                {metric.trend && (
                  <div className="text-xs text-emerald-600 font-medium">{metric.trend}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}