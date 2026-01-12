import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  MoreHorizontal,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TaskTemplates({ onUseTemplate, projectId }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    task_type: 'task',
    priority: 'medium',
    estimated_hours: 0,
    checklist: []
  });
  const [checklistItem, setChecklistItem] = useState('');

  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['task-templates'],
    queryFn: () => base44.entities.TaskTemplate.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TaskTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      setCreateOpen(false);
      setNewTemplate({
        name: '',
        description: '',
        task_type: 'task',
        priority: 'medium',
        estimated_hours: 0,
        checklist: []
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
    },
  });

  const addChecklistItem = () => {
    if (checklistItem.trim()) {
      setNewTemplate(prev => ({
        ...prev,
        checklist: [...prev.checklist, checklistItem.trim()]
      }));
      setChecklistItem('');
    }
  };

  const removeChecklistItem = (index) => {
    setNewTemplate(prev => ({
      ...prev,
      checklist: prev.checklist.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Task Templates</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Template
        </Button>
      </div>

      <div className="grid gap-3">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-medium text-slate-900">{template.name}</h4>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2">{template.description}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">{template.task_type}</Badge>
                  <Badge variant="outline" className="text-xs">{template.priority}</Badge>
                  {template.estimated_hours > 0 && (
                    <Badge variant="outline" className="text-xs">{template.estimated_hours}h</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onUseTemplate(template)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => deleteMutation.mutate(template.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No templates yet</p>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Task Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Template Name</label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Bug Fix Template"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newTemplate.description}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Default task description..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Task Type</label>
                <Select
                  value={newTemplate.task_type}
                  onValueChange={(v) => setNewTemplate(prev => ({ ...prev, task_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={newTemplate.priority}
                  onValueChange={(v) => setNewTemplate(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Estimated Hours</label>
              <Input
                type="number"
                value={newTemplate.estimated_hours}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, estimated_hours: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Checklist Items</label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={checklistItem}
                  onChange={(e) => setChecklistItem(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                />
                <Button type="button" onClick={addChecklistItem}>Add</Button>
              </div>
              {newTemplate.checklist.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {newTemplate.checklist.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{item}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeChecklistItem(i)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(newTemplate)}>
              <Save className="w-4 h-4 mr-2" />
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}