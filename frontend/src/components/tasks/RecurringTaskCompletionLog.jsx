import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecurringTaskCompletionLog({ recurringTaskId, users = [] }) {
  const { data: completions = [], isLoading } = useQuery({
    queryKey: ['recurring-completions', recurringTaskId],
    queryFn: () => base44.entities.RecurringTaskCompletion.filter(
      { recurring_task_id: recurringTaskId },
      '-completion_date',
      50
    ),
    enabled: !!recurringTaskId,
  });

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  if (!recurringTaskId) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        <h4 className="font-semibold text-slate-900">Completion History</h4>
        <Badge variant="outline" className="ml-auto">
          {completions.length} completed
        </Badge>
      </div>

      {completions.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-4">
          No completions yet
        </p>
      ) : (
        <ScrollArea className="h-48 pr-4">
          <div className="space-y-2">
            {completions.map(completion => (
              <div
                key={completion.id}
                className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-900">
                      {format(new Date(completion.completion_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-700">
                  <User className="w-3 h-3" />
                  <span>{getUserName(completion.completed_by)}</span>
                </div>
                {completion.notes && (
                  <p className="text-xs text-slate-600 mt-2 italic">
                    {completion.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}