import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';

export default function SalesProjectReport({ activities, projects }) {
  const projectStats = React.useMemo(() => {
    // Map project names if activities have project_id, else try to guess or show 'Unassigned'
    // SalesActivity usually doesn't have project_id, assuming we might need to rely on DailyPerformance or manual mapping
    // But let's assume activities might have project_id or we aggregate from DailyPerformance
    
    // Aggregation
    const stats = {};
    
    // Initialize
    projects.forEach(p => {
      stats[p.id] = { name: p.name, walkIns: 0, closures: 0, meetings: 0 };
    });
    stats['unknown'] = { name: 'General / Unassigned', walkIns: 0, closures: 0, meetings: 0 };

    activities.forEach(a => {
      const pid = a.project_id || 'unknown';
      if (!stats[pid]) stats[pid] = { name: 'Unknown Project', walkIns: 0, closures: 0, meetings: 0 };
      
      if (a.type === 'walk_in' || a.walkins_count) stats[pid].walkIns += (a.walkins_count || 1);
      if (a.type === 'closure' || a.bookings_count) stats[pid].closures += (a.bookings_count || 1);
      if (a.meetings_count) stats[pid].meetings += a.meetings_count;
    });

    return Object.values(stats).filter(s => s.walkIns + s.closures + s.meetings > 0).sort((a, b) => b.closures - a.closures);
  }, [activities, projects]);

  if (projectStats.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-indigo-500" />
          Project-wise Effort Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projectStats.map((stat, i) => (
             <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">{stat.name}</span>
                <div className="flex gap-4 text-sm">
                   <div className="text-center">
                     <span className="block font-bold text-slate-900">{stat.walkIns}</span>
                     <span className="text-xs text-slate-500">Walk-ins</span>
                   </div>
                   <div className="text-center">
                     <span className="block font-bold text-slate-900">{stat.meetings}</span>
                     <span className="text-xs text-slate-500">Meetings</span>
                   </div>
                   <div className="text-center">
                     <span className="block font-bold text-emerald-600">{stat.closures}</span>
                     <span className="text-xs text-slate-500">Closures</span>
                   </div>
                </div>
             </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}