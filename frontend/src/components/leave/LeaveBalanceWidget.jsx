import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Calendar } from 'lucide-react';

export default function LeaveBalanceWidget({ balances, leaveTypes }) {
  if (balances.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-slate-500 text-center">No leave balances configured yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {balances.map(balance => {
        const leaveType = leaveTypes.find(lt => lt.id === balance.leave_type_id);
        const usedPercentage = (balance.used / balance.total_allocated) * 100;

        return (
          <Card key={balance.id}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: leaveType?.color || '#6366F1' }}
                />
                {leaveType?.name || 'Unknown'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600">Available</span>
                  <span className="font-bold text-slate-900">{balance.available}</span>
                </div>
                <Progress value={((balance.total_allocated - balance.used) / balance.total_allocated) * 100} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-medium">{balance.total_allocated}</p>
                </div>
                <div>
                  <p className="text-slate-500">Used</p>
                  <p className="font-medium">{balance.used}</p>
                </div>
                <div>
                  <p className="text-slate-500">Pending</p>
                  <p className="font-medium">{balance.pending}</p>
                </div>
                {balance.carried_forward > 0 && (
                  <div>
                    <p className="text-slate-500">Carried Fwd</p>
                    <p className="font-medium">{balance.carried_forward}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}