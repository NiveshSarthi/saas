import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, Plus, Flag, Zap, Target, Layers, UserPlus, Filter, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

const priorityConfig = {
  critical: { color: 'text-red-600', bg: 'bg-red-50', label: 'Critical' },
  high: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'High' },
  medium: { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Medium' },
  low: { color: 'text-slate-600', bg: 'bg-slate-50', label: 'Low' },
};

const typeConfig = {
  epic: { icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
  story: { icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
  task: { icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  bug: { icon: Flag, color: 'text-red-600', bg: 'bg-red-50' },
  feature: { icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  improvement: { icon: Target, color: 'text-amber-600', bg: 'bg-amber-50' },
};

export default function AddTaskToSprintDialog({ open, onClose, backlogTasks, onAssign, users = [], departments = [] }) {
  const [search, setSearch] = useState('');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState(null);

  const filteredUsers = users.filter(u => 
    selectedDepartment === 'all' || u.department_id === selectedDepartment
  );

  const filteredTasks = backlogTasks.filter(task => {
    if (!task.sprint_id && search) {
      return task.title.toLowerCase().includes(search.toLowerCase());
    }
    return !task.sprint_id;
  });

  const toggleTask = (taskId) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAdd = () => {
    selectedTasks.forEach(taskId => {
      onAssign(taskId, selectedAssignee);
    });
    handleClose();
  };

  const handleClose = () => {
    setSelectedTasks([]);
    setSearch('');
    setSelectedDepartment('all');
    setSelectedAssignee(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-6 py-8">
          <div className="absolute inset-0 bg-grid-white/10" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold text-white">Add Tasks to Sprint</DialogTitle>
            </div>
            <p className="text-indigo-100 text-sm">
              Select tasks from backlog and optionally assign them to team members
            </p>
            
            {selectedTasks.length > 0 && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-sm font-semibold text-white">
                  {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 rounded-xl border border-slate-200/60 shadow-sm">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                Filter Department
              </Label>
              <Select 
                value={selectedDepartment} 
                onValueChange={(value) => {
                  setSelectedDepartment(value);
                  if (value !== 'all') {
                    const assignee = users.find(u => u.email === selectedAssignee);
                    if (assignee && assignee.department_id !== value) {
                      setSelectedAssignee(null);
                    }
                  }
                }}
              >
                <SelectTrigger className="h-10 bg-white shadow-sm border-slate-300 hover:border-indigo-400 transition-colors">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
                Assign To (Optional)
              </Label>
              <Select 
                value={selectedAssignee || ''} 
                onValueChange={(value) => setSelectedAssignee(value || null)}
              >
                <SelectTrigger className="h-10 bg-white shadow-sm border-slate-300 hover:border-indigo-400 transition-colors">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {filteredUsers.map(u => (
                    <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search backlog tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-white border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          {/* Task List */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mb-4">
                      <Target className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium mb-1">No tasks in backlog</p>
                    <p className="text-slate-400 text-sm">Create tasks to add them to this sprint</p>
                  </div>
                ) : (
                  filteredTasks.map(task => {
                    const TypeIcon = typeConfig[task.task_type]?.icon || Zap;
                    const isSelected = selectedTasks.includes(task.id);
                    
                    return (
                      <div 
                        key={task.id}
                        className={cn(
                          "group relative flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                          isSelected 
                            ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-purple-50 shadow-md scale-[1.02]"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm hover:scale-[1.01]"
                        )}
                        onClick={() => toggleTask(task.id)}
                      >
                        <div className="mt-1">
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleTask(task.id)}
                            className={cn(
                              "w-5 h-5",
                              isSelected && "data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                            )}
                          />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <p className={cn(
                              "font-semibold text-sm leading-snug",
                              isSelected ? "text-indigo-900" : "text-slate-900 group-hover:text-indigo-700"
                            )}>
                              {task.title}
                            </p>
                          </div>
                          
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Type Badge */}
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                              typeConfig[task.task_type]?.bg,
                              typeConfig[task.task_type]?.color
                            )}>
                              <TypeIcon className="w-3 h-3" />
                              {task.task_type}
                            </div>
                            
                            {/* Priority Badge */}
                            <div className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                              priorityConfig[task.priority]?.bg,
                              priorityConfig[task.priority]?.color
                            )}>
                              <Flag className="w-3 h-3" />
                              {priorityConfig[task.priority]?.label}
                            </div>
                            
                            {/* Story Points */}
                            {task.story_points && (
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
                                <Target className="w-3 h-3" />
                                {task.story_points} SP
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Selected indicator */}
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                              <Plus className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-t border-slate-200">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="text-sm text-slate-600">
              {filteredTasks.length > 0 && (
                <span className="font-medium">
                  {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="border-slate-300 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAdd}
                disabled={selectedTasks.length === 0}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Sprint {selectedTasks.length > 0 && `(${selectedTasks.length})`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}