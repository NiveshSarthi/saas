import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import UserMultiSelect from '@/components/common/UserMultiSelect';
import { useQuery } from '@tanstack/react-query';

export default function TaskWatchers({ task, users = [], currentUserEmail }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const watchers = task.watchers || [];
  const isWatching = watchers.includes(currentUserEmail);

  const updateMutation = useMutation({
    mutationFn: (newWatchers) => 
      base44.entities.Task.update(task.id, { watchers: newWatchers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', task.id] });
    },
  });

  const toggleWatch = () => {
    const prev = queryClient.getQueryData(['task', task.id]);
    const newWatchers = isWatching
      ? watchers.filter(w => w !== currentUserEmail)
      : [...watchers, currentUserEmail];

    // Optimistically update cache
    queryClient.setQueryData(['task', task.id], (old) => ({ ...(old || {}), watchers: newWatchers }));
    updateMutation.mutate(newWatchers, {
      onError: () => {
        // rollback
        queryClient.setQueryData(['task', task.id], prev);
      }
    });
  };

  const addWatcher = (email) => {
    if (!watchers.includes(email)) {
      const prev = queryClient.getQueryData(['task', task.id]);
      const newWatchers = [...watchers, email];
      queryClient.setQueryData(['task', task.id], (old) => ({ ...(old || {}), watchers: newWatchers }));
      updateMutation.mutate(newWatchers, {
        onError: () => queryClient.setQueryData(['task', task.id], prev)
      });
    }
    setOpen(false);
  };

  const removeWatcher = (email) => {
    const prev = queryClient.getQueryData(['task', task.id]);
    const newWatchers = watchers.filter(w => w !== email);
    queryClient.setQueryData(['task', task.id], (old) => ({ ...(old || {}), watchers: newWatchers }));
    updateMutation.mutate(newWatchers, {
      onError: () => queryClient.setQueryData(['task', task.id], prev)
    });
  };

  const getInitials = (email) => {
    const user = users.find(u => u.email === email);
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-500">Watchers</label>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleWatch}
          className={isWatching ? 'text-indigo-600' : 'text-slate-500'}
        >
          {isWatching ? (
            <>
              <EyeOff className="w-4 h-4 mr-1" />
              Unwatch
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-1" />
              Watch
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {watchers.map((email) => (
          <div
            key={email}
            className="flex items-center gap-1 bg-slate-100 rounded-full pl-1 pr-2 py-1"
          >
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[8px] bg-indigo-100 text-indigo-600">
                {getInitials(email)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-slate-600">{getUserName(email)}</span>
            <button
              onClick={() => removeWatcher(email)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        <UserMultiSelect
          users={users}
          departments={departments}
          selectedEmails={[]}
          onChange={(selected) => {
            const email = selected[0];
            if (!watchers.includes(email)) {
              const prev = queryClient.getQueryData(['task', task.id]);
              const newWatchers = [...watchers, email];
              queryClient.setQueryData(['task', task.id], (old) => ({ ...(old || {}), watchers: newWatchers }));
              updateMutation.mutate(newWatchers, {
                onError: () => queryClient.setQueryData(['task', task.id], prev)
              });
            }
          }}
          placeholder="Add watchers..."
          className="w-60"
          singleSelect={true}
        />
      </div>
    </div>
  );
}