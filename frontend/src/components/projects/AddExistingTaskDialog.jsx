import React, { useState } from 'react';
import { format } from 'date-fns';
import { Search, Plus, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export default function AddExistingTaskDialog({ open, onClose, tasks = [], date, onAssign, projectId }) {
  const [search, setSearch] = useState('');

  const filteredTasks = tasks.filter(task => {
    if (search && !task.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleAssign = (task) => {
    onAssign(task.id, { due_date: format(date, 'yyyy-MM-dd') });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Task to {date ? format(date, 'MMM d') : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search existing tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button 
                onClick={() => window.location.href = createPageUrl(`NewTask?project=${projectId}&due_date=${date ? format(date, 'yyyy-MM-dd') : ''}`)}
            >
                <Plus className="w-4 h-4 mr-2" />
                Create New
            </Button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredTasks.map(task => (
              <div 
                key={task.id}
                className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-slate-50 cursor-pointer transition-all"
                onClick={() => handleAssign(task)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <CheckSquare className={cn("w-4 h-4 flex-shrink-0", task.status === 'done' ? 'text-emerald-500' : 'text-slate-400')} />
                  <span className="truncate font-medium text-slate-700">{task.title}</span>
                </div>
                {task.due_date && (
                    <span className="text-xs text-slate-400 flex-shrink-0">
                        {format(new Date(task.due_date), 'MMM d')}
                    </span>
                )}
              </div>
            ))}
            {filteredTasks.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                    No matching tasks found
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}