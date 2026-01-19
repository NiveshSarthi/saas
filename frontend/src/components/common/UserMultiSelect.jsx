// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function UserMultiSelect({
  users = [],
  departments = [],
  selectedEmails = [],
  onChange,
  placeholder = "Select members...",
  className,
  singleSelect = false
}) {
  const [open, setOpen] = useState(false);

  // Ensure selectedEmails is always an array
  const safeSelectedEmails = Array.isArray(selectedEmails) ? selectedEmails : [];

  // Filter to only active users
  const activeUsers = users.filter(u => u.status !== 'inactive' && u.is_active !== false);

  // Group users by department
  const usersByDepartment = React.useMemo(() => {
    const groups = {};

    activeUsers.forEach(user => {
      const deptId = user.department_id || user.department?.id || user.department || 'no-department';
      const deptName = deptId === 'no-department' ? 'No Department' : (departments.find(d => String(d.id) === String(deptId))?.name || 'Unknown Department');

      if (!groups[deptId]) {
        groups[deptId] = {
          name: deptName,
          users: []
        };
      }
      groups[deptId].users.push(user);
    });

    // Sort departments by name
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [activeUsers, departments]);

  const toggleSelection = (email) => {
    if (singleSelect) {
      onChange([email]);
      setOpen(false);
    } else {
      const newSelection = safeSelectedEmails.includes(email)
        ? safeSelectedEmails.filter(e => e !== email)
        : [...safeSelectedEmails, email];
      onChange(newSelection);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between min-h-[40px] h-auto py-2"
          >
            <div className="flex flex-wrap gap-1 items-center">
              {safeSelectedEmails.length === 0 && <span className="text-slate-500 font-normal">{placeholder}</span>}
              {safeSelectedEmails.map((email) => {
                const user = activeUsers.find(u => u.email === email);
                return (
                  <Badge key={email} variant="secondary" className="mr-1 mb-1">
                    {user?.full_name || email}
                    <div
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          toggleSelection(email);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSelection(email);
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </div>
                  </Badge>
                );
              })}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search team members..." />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup>
                {usersByDepartment.map((dept) => (
                  <React.Fragment key={dept.name}>
                    <div className="px-2 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide border-b border-slate-100 mb-1">
                      {dept.name}
                    </div>
                    {dept.users.map((user, idx) => {
                      const isSelected = safeSelectedEmails.includes(user.email);
                      return (
                        <CommandItem
                          key={user.email || user.id || `user-${idx}`}
                          onSelect={() => toggleSelection(user.email)}
                          value={`${user.full_name} ${user.email}`}
                          className={cn(
                            "flex items-center px-2 py-2 cursor-pointer rounded-md hover:bg-slate-100 transition-colors",
                            isSelected && "bg-indigo-50 hover:bg-indigo-100"
                          )}
                        >
                          <div className={cn(
                            "mr-3 flex h-5 w-5 items-center justify-center rounded border-2",
                            isSelected
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-slate-300"
                          )}>
                            {isSelected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                          </div>
                          <Avatar className="h-9 w-9 mr-3">
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-semibold">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col flex-1">
                            <span className="font-medium text-sm text-slate-900">{user.full_name || user.email.split('@')[0]}</span>
                            {user.full_name && <span className="text-xs text-slate-500">{user.email}</span>}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </React.Fragment>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}