import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowDownRight } from 'lucide-react';

export default function SalesUnderperformers({ userStats }) {
  const underperformers = userStats.filter(stat => 
      (stat.targets.walkInTarget > 0 && stat.walkInCompliance < 50) || 
      (stat.targets.closureTarget > 0 && stat.closureCompliance < 50)
    );

  if (underperformers.length === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Underperformance Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {underperformers.map((stat, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-xs">
                  {stat.user.full_name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{stat.user.full_name}</p>
                  <div className="flex gap-2 text-xs text-slate-500">
                    {stat.walkInCompliance < 50 && (
                      <span className="text-red-600 flex items-center gap-1">
                         Walk-ins: {stat.walkInCompliance}% 
                         <span className="text-slate-400 font-normal">({stat.walkInsCount}/{stat.targets.walkInTarget})</span>
                      </span>
                    )}
                    {stat.closureCompliance < 50 && (
                      <span className="text-red-600 flex items-center gap-1">
                         Closures: {stat.closureCompliance}%
                         <span className="text-slate-400 font-normal">({stat.closuresCount}/{stat.targets.closureTarget})</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
                  <ArrowDownRight className="w-3 h-3" />
                  Attention Needed
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}