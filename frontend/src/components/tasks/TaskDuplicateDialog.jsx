import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function TaskDuplicateDialog({ task, open, onOpenChange }) {
  const [newTitle, setNewTitle] = useState(`Copy of ${task?.title || ''}`);
  const [options, setOptions] = useState({
    includeDescription: true,
    includeAssignee: false,
    includeDates: false,
    includeTags: true,
    includeAttachments: false,
  });

  const queryClient = useQueryClient();

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const newTask = {
        title: newTitle,
        project_id: task.project_id,
        task_type: task.task_type,
        priority: task.priority,
        status: 'backlog',
        story_points: task.story_points,
      };

      if (options.includeDescription) {
        newTask.description = task.description;
      }
      if (options.includeAssignee) {
        newTask.assignee_email = task.assignee_email;
      }
      if (options.includeDates) {
        newTask.start_date = task.start_date;
        newTask.due_date = task.due_date;
        newTask.estimated_hours = task.estimated_hours;
      }
      if (options.includeTags) {
        newTask.tags = task.tags;
      }
      if (options.includeAttachments) {
        newTask.attachments = task.attachments;
      }

      return base44.entities.Task.create(newTask);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      onOpenChange(false);
    },
  });

  const toggleOption = (key) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Duplicate Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>New Task Title</Label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="space-y-3">
            <Label>Include in duplicate:</Label>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="includeDescription"
                checked={options.includeDescription}
                onCheckedChange={() => toggleOption('includeDescription')}
              />
              <label htmlFor="includeDescription" className="text-sm">Description</label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeAssignee"
                checked={options.includeAssignee}
                onCheckedChange={() => toggleOption('includeAssignee')}
              />
              <label htmlFor="includeAssignee" className="text-sm">Assignee</label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeDates"
                checked={options.includeDates}
                onCheckedChange={() => toggleOption('includeDates')}
              />
              <label htmlFor="includeDates" className="text-sm">Dates & Time Estimates</label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeTags"
                checked={options.includeTags}
                onCheckedChange={() => toggleOption('includeTags')}
              />
              <label htmlFor="includeTags" className="text-sm">Tags</label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeAttachments"
                checked={options.includeAttachments}
                onCheckedChange={() => toggleOption('includeAttachments')}
              />
              <label htmlFor="includeAttachments" className="text-sm">Attachments</label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending || !newTitle.trim()}
          >
            {duplicateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Duplicating...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}