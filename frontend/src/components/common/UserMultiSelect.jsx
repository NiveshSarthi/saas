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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function UserMultiSelect({ 
  users = [], 
  departments = [], 
  selectedEmails = [], 
  onChange,
  placeholder = "Select members...",
  className
}) {
  const [open, setOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Ensure selectedEmails is always an array
  const safeSelectedEmails = Array.isArray(selectedEmails) ? selectedEmails : [];

  let filteredUsers = users.filter(u => {
    if (selectedDepartment !== 'all') {
      const userDept = u.department_id || u.department?.id || u.department;
      if (userDept !== selectedDepartment) return false;
    }
    return true;
  });

  // Always ensure teamsocialscrapers@gmail.com is in the list if it exists in users
  const specialUser = users.find(u => u.email === 'teamsocialscrapers@gmail.com');
  if (specialUser && !filteredUsers.some(u => u.email === 'teamsocialscrapers@gmail.com')) {
    filteredUsers = [specialUser, ...filteredUsers];
  }

  const toggleSelection = (email) => {
    const newSelection = safeSelectedEmails.includes(email)
      ? safeSelectedEmails.filter(e => e !== email)
      : [...safeSelectedEmails, email];
    onChange(newSelection);
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
                const user = users.find(u => u.email === email);
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
          <div className="p-2 border-b border-slate-100">
             <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Filter by Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Command>
            <CommandInput placeholder="Search team members..." />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              <CommandGroup>
                {filteredUsers.map((user) => {
                  const isSelected = safeSelectedEmails.includes(user.email);
                  return (
                    <div
                      key={user.email}
                      onClick={() => toggleSelection(user.email)}
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
                    </div>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}