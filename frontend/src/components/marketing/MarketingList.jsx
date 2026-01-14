import React from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { MoreHorizontal, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const STATUS_COLORS = {
  editing: 'bg-slate-100 text-slate-700',
  review: 'bg-blue-100 text-blue-700',
  revision: 'bg-orange-100 text-orange-700',
  compliance: 'bg-purple-100 text-purple-700',
  compliance_revision: 'bg-red-100 text-red-700',
  approved: 'bg-yellow-100 text-yellow-800',
  published: 'bg-emerald-100 text-emerald-700',
  tracking: 'bg-cyan-100 text-cyan-700',
  closed: 'bg-slate-200 text-slate-800'
};

export default function MarketingList({ tasks, onEditTask, selectedTasks = [], onSelectTask }) {
  return (
    <div className="rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {onSelectTask && <TableHead className="w-12"></TableHead>}
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Metrics</TableHead>
            <TableHead>Platforms</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onEditTask(task)}>
              {onSelectTask && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={() => onSelectTask(task.id)}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {task.campaign_name}
                        <Badge variant="outline" className="text-[10px]">V{task.version}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 capitalize">
                         {task.task_type || 'video'}
                      </span>
                      {task.task_type === 'video' && task.video_subcategory && (
                        <Badge variant="secondary" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                          {task.video_subcategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      )}
                    </div>
                    {task.description && (
                      <div 
                        className="text-xs text-slate-500 line-clamp-1 mt-1" 
                        dangerouslySetInnerHTML={{ __html: task.description }} 
                      />
                    )}
                </div>
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[task.status] || 'bg-slate-100'}>
                   {task.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell>{task.assignee_email?.split('@')[0]}</TableCell>
              <TableCell>
                {(task.metrics?.views > 0 || task.metrics?.likes > 0) ? (
                  <div className="flex flex-col text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{task.metrics.views?.toLocaleString()} views</span>
                    <span>{task.metrics.likes?.toLocaleString()} likes • {task.metrics.ctr}% CTR</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-xs">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {task.platforms?.slice(0, 3).map(p => (
                    <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                  ))}
                  {task.platforms?.length > 3 && <span className="text-xs text-slate-400">+{task.platforms.length - 3}</span>}
                </div>
              </TableCell>
              <TableCell>
                {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {tasks.length === 0 && (
            <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No marketing tasks found
                </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}