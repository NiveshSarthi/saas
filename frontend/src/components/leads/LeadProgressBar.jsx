import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const STAGE_PROGRESS = {
  new: 0,
  contacted: 10,
  screening: 25,
  qualified: 40,
  proposal: 55,
  negotiation: 70,
  site_visit: 80,
  agreement: 90,
  payment: 95,
  closed_won: 100,
  lost: 0,
};

export default function LeadProgressBar({ status, compact = false }) {
  const progress = STAGE_PROGRESS[status] || 0;
  
  return (
    <div className="space-y-1">
      <Progress 
        value={progress} 
        className={cn(
          compact ? "h-1" : "h-2",
          progress === 100 && "[&>div]:bg-green-500"
        )} 
      />
      {!compact && (
        <div className="flex justify-between text-xs text-slate-500">
          <span>{progress}% Complete</span>
          {progress === 100 && <span className="text-green-600 font-medium">✓ Won</span>}
        </div>
      )}
    </div>
  );
}