import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Plus,
  Folder,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#0EA5E9', '#3B82F6'
];

export default function TaskGroupManager({ projectId, groups = [], tasks = [], onSelectGroup }) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groupColor, setGroupColor] = useState('#6366F1');
  const [expandedGroups, setExpandedGroups] = useState({});
  const queryClient = useQueryClient();

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskGroup.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      setIsCreating(false);
      setGroupName('');
      setGroupColor('#6366F1');
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaskGroup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
      setEditingGroup(null);
      setGroupName('');
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskGroup.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-groups', projectId] });
    },
  });

  const handleCreate = () => {
    if (!groupName.trim()) return;
    createGroupMutation.mutate({
      name: groupName.trim(),
      project_id: projectId,
      color: groupColor,
    });
  };

  const handleUpdate = () => {
    if (!groupName.trim() || !editingGroup) return;
    updateGroupMutation.mutate({
      id: editingGroup.id,
      data: { name: groupName.trim(), color: groupColor }
    });
  };

  const toggleExpand = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const getGroupTaskCount = (groupId) => {
    return tasks.filter(t => t.group_id === groupId).length;
  };

  return (
    <div className="space-y-2">
      {/* All Tasks (ungrouped) */}
      <button
        onClick={() => onSelectGroup?.(null)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 text-left"
      >
        <Folder className="w-4 h-4 text-slate-400" />
        <span className="flex-1 font-medium text-sm">All Tasks</span>
        <Badge variant="secondary" className="text-xs">
          {tasks.length}
        </Badge>
      </button>

      {/* Groups */}
      {groups.map((group) => {
        const taskCount = getGroupTaskCount(group.id);
        const isExpanded = expandedGroups[group.id];

        return (
          <div key={group.id}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 group"
            >
              <button 
                onClick={() => toggleExpand(group.id)}
                className="p-0.5"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>
              
              <button
                onClick={() => onSelectGroup?.(group.id)}
                className="flex-1 flex items-center gap-2"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <span className="font-medium text-sm">{group.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {taskCount}
                </Badge>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-7 h-7 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setEditingGroup(group);
                    setGroupName(group.name);
                    setGroupColor(group.color);
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => deleteGroupMutation.mutate(group.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {/* Add Category Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => setIsCreating(true)}
        className="w-full justify-start text-slate-500"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Category
      </Button>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreating || !!editingGroup} onOpenChange={(open) => {
        if (!open) {
          setIsCreating(false);
          setEditingGroup(null);
          setGroupName('');
          setGroupColor('#6366F1');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Category' : 'Create Category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., Frontend, Backend, Design..."
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setGroupColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-lg transition-all",
                      groupColor === color && "ring-2 ring-offset-2 ring-slate-400"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreating(false);
              setEditingGroup(null);
            }}>
              Cancel
            </Button>
            <Button onClick={editingGroup ? handleUpdate : handleCreate}>
              {editingGroup ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}