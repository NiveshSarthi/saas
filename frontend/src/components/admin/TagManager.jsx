import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Plus,
  X,
  Tag as TagIcon,
  Edit,
  Trash2,
  MoreHorizontal,
  Save,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const DEFAULT_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F59E0B', '#10B981', '#06B6D4', '#3B82F6',
  '#64748B', '#6B7280'
];

export default function TagManager() {
  const [editingTag, setEditingTag] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    color: DEFAULT_COLORS[0]
  });

  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list('name'),
  });

  const createTagMutation = useMutation({
    mutationFn: (data) => {
      // Check for duplicate (case-insensitive)
      const duplicate = tags.find(t => 
        t.name.toLowerCase() === data.name.toLowerCase()
      );
      if (duplicate) {
        throw new Error('A tag with this name already exists');
      }
      return base44.entities.Tag.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }) => {
      // Check for duplicate (excluding current tag)
      const duplicate = tags.find(t => 
        t.id !== id && t.name.toLowerCase() === data.name.toLowerCase()
      );
      if (duplicate) {
        throw new Error('A tag with this name already exists');
      }
      return base44.entities.Tag.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error) => {
      alert(error.message);
    }
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id) => base44.entities.Tag.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      color: DEFAULT_COLORS[0]
    });
    setEditingTag(null);
  };

  const handleEdit = (tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color || DEFAULT_COLORS[0]
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const data = {
      name: formData.name.trim(),
      color: formData.color
    };
    
    if (editingTag) {
      updateTagMutation.mutate({ id: editingTag.id, data });
    } else {
      createTagMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Manage Tags</h3>
          <p className="text-sm text-slate-500">
            Create standardized tags to keep your organization consistent
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTag ? 'Edit Tag' : 'Create New Tag'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Tag Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., urgent, bug-fix, design"
                />
                <p className="text-xs text-slate-500">
                  Tag names are case-insensitive. Duplicates will be prevented.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-10 h-10 rounded-lg border-2 transition-all",
                        formData.color === color 
                          ? "border-slate-900 scale-110" 
                          : "border-slate-200 hover:border-slate-300"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <Badge 
                    style={{ 
                      backgroundColor: formData.color,
                      color: 'white'
                    }}
                    className="text-sm"
                  >
                    {formData.name || 'Tag Preview'}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={!formData.name.trim() || createTagMutation.isPending || updateTagMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingTag ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tags List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <TagIcon className="w-4 h-4" />
            <span className="font-medium">{tags.length} standard tags</span>
          </div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-4 p-4 hover:bg-slate-50">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: tag.color || DEFAULT_COLORS[0] }}
              />

              <div className="flex-1 min-w-0">
                <Badge 
                  style={{ 
                    backgroundColor: tag.color || DEFAULT_COLORS[0],
                    color: 'white'
                  }}
                  className="text-sm"
                >
                  {tag.name}
                </Badge>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(tag)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => {
                      if (confirm(`Delete tag "${tag.name}"? This will remove it from all tasks.`)) {
                        deleteTagMutation.mutate(tag.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}

          {tags.length === 0 && (
            <div className="text-center py-12">
              <TagIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="font-medium text-slate-900 mb-2">No tags yet</h3>
              <p className="text-slate-500 text-sm">
                Create standardized tags to keep your organization consistent
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 text-sm flex items-center gap-2">
          <TagIcon className="w-4 h-4" />
          Why standardize tags?
        </h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Prevents duplicates like "urgent", "URGENT", "Urgent"</li>
          <li>• Makes filtering and searching more reliable</li>
          <li>• Keeps your organization consistent</li>
          <li>• Users can only select from approved tags</li>
        </ul>
      </div>
    </div>
  );
}