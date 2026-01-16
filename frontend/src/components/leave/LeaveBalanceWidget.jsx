import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Sparkles, Activity, Clock, Box } from 'lucide-react';

export default function LeaveBalanceWidget({ balances, leaveTypes }) {
  if (balances.length === 0) {
    return (
      <Card className="bg-white/50 border-dashed border-2 border-slate-200">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Box className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-900 font-semibold text-lg">No Leave Balances</p>
          <p className="text-slate-500 text-sm mt-1">Leave types and balances haven't been configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {balances.map((balance, index) => {
        const leaveType = leaveTypes.find(lt => lt.id === balance.leave_type_id);
        const usedPercentage = (balance.used / balance.total_allocated) * 100;
        const availablePercentage = ((balance.total_allocated - balance.used) / balance.total_allocated) * 100;

        // Dynamic colors based on leave type
        const colorMap = {
          'Sick Leave': 'from-rose-500 to-pink-600',
          'Casual Leave': 'from-blue-500 to-indigo-600',
          'Privilege Leave': 'from-amber-500 to-orange-600',
          'Work From Home': 'from-emerald-500 to-teal-600',
          'default': 'from-violet-500 to-purple-600'
        };

        const cardGradient = leaveType && colorMap[leaveType.name] ? colorMap[leaveType.name] : colorMap.default;
        const bgColor = leaveType?.color || '#8B5CF6';

        return (
          <div
            key={balance.id}
            className="group relative overflow-hidden rounded-3xl bg-white shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl border border-slate-100"
          >
            {/* Header Background */}
            <div className={cn("absolute top-0 inset-x-0 h-1 bg-gradient-to-r", cardGradient)} />

            <div className="p-6 relative z-10">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2.5 rounded-xl text-white shadow-lg bg-gradient-to-br", cardGradient)}>
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight">
                      {leaveType?.name || 'Unknown'}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-0.5">
                      {new Date().getFullYear()} Allocation
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Circular Stat */}
              <div className="flex items-end gap-2 mb-6">
                <div className="flex-1">
                  <span
                    className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-slate-800 to-slate-600"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {balance.available}
                  </span>
                  <span className="text-sm font-semibold text-slate-400 ml-1 mb-2 inline-block">Days Available</span>
                </div>
              </div>

              {/* Progress and Mini Stats */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Usage</span>
                    <span>{Math.round(usedPercentage)}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r", cardGradient)}
                      style={{ width: `${usedPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-50">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</p>
                    <p className="font-bold text-slate-700">{balance.total_allocated}</p>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Used</p>
                      <p className="font-bold text-red-500">{balance.used}</p>
                    </div>
                  </div>
                  <div className="text-center border-l border-slate-100">
                    <div className="flex flex-col items-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending</p>
                      <p className="font-bold text-amber-500">{balance.pending}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative Overlay */}
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-gradient-to-br from-slate-50 to-slate-100 rounded-full opacity-50 pointer-events-none group-hover:scale-150 transition-transform duration-700" />
          </div>
        );
      })}
    </div>
  );
}