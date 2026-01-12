import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  History, FileText, Edit, ArrowRight, User, 
  MessageSquare, Paperclip, CheckCircle, Download, Filter
} from 'lucide-react';
import { jsPDF } from 'jspdf';

const ACTION_ICONS = {
  created: <div className="bg-green-100 p-1.5 rounded-full text-green-600"><CheckCircle className="w-3 h-3" /></div>,
  status_changed: <div className="bg-blue-100 p-1.5 rounded-full text-blue-600"><ArrowRight className="w-3 h-3" /></div>,
  updated: <div className="bg-orange-100 p-1.5 rounded-full text-orange-600"><Edit className="w-3 h-3" /></div>,
  commented: <div className="bg-purple-100 p-1.5 rounded-full text-purple-600"><MessageSquare className="w-3 h-3" /></div>,
  attached: <div className="bg-indigo-100 p-1.5 rounded-full text-indigo-600"><Paperclip className="w-3 h-3" /></div>,
  assigned: <div className="bg-pink-100 p-1.5 rounded-full text-pink-600"><User className="w-3 h-3" /></div>,
};

const ACTION_LABELS = {
  created: 'Created Task',
  status_changed: 'Changed Status',
  updated: 'Edited Task',
  commented: 'Added Comment',
  attached: 'Uploaded File',
  assigned: 'Reassigned Task',
};

export default function ActivityLog({ taskId, user }) {
  const [filterType, setFilterType] = useState('all');
  const isAdmin = user?.role === 'admin';

  const { data: activities = [] } = useQuery({
    queryKey: ['task-activities', taskId],
    queryFn: () => base44.entities.Activity.filter({ task_id: taskId }, '-created_date', 100),
    enabled: !!taskId,
    refetchInterval: 5000 // Poll for updates
  });

  const filteredActivities = activities.filter(a => {
    if (filterType === 'all') return true;
    if (filterType === 'status') return a.action === 'status_changed';
    if (filterType === 'files') return a.action === 'attached';
    if (filterType === 'comments') return a.action === 'commented';
    if (filterType === 'edits') return ['updated', 'assigned'].includes(a.action);
    return true;
  });

  const handleExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Activity Log Report', 20, 20);
    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 20, 30);
    
    let y = 40;
    filteredActivities.forEach((act) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        const time = format(new Date(act.created_date), 'PPpp');
        const actor = act.metadata?.actorName || act.actor_email;
        const action = ACTION_LABELS[act.action] || act.action;
        const details = act.field_changed 
            ? `${act.field_changed}: ${act.old_value || '-'} -> ${act.new_value || '-'}`
            : '';
            
        doc.setFont("helvetica", "bold");
        doc.text(`${time} - ${actor}`, 20, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.text(`${action} ${details}`, 20, y);
        y += 10;
    });
    
    doc.save(`activity_log_${taskId}.pdf`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 border-b bg-white flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Filter by..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="status">Status Changes</SelectItem>
                    <SelectItem value="files">Files</SelectItem>
                    <SelectItem value="comments">Comments</SelectItem>
                    <SelectItem value="edits">Edits & Assign</SelectItem>
                </SelectContent>
            </Select>
        </div>
        {isAdmin && (
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={handleExport}>
                <Download className="w-3 h-3" /> Export
            </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-10">
          {filteredActivities.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8 italic pl-4">
                  No activity recorded yet.
              </div>
          )}
          
          {filteredActivities.map((activity) => (
            <div key={activity.id} className="relative pl-6 group">
              <div className="absolute -left-[9px] top-0 bg-white border border-slate-200 rounded-full p-0.5">
                 {ACTION_ICONS[activity.action] || <div className="w-2 h-2 bg-slate-400 rounded-full m-1.5"/>}
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-900">
                    {activity.metadata?.actorName || activity.actor_email?.split('@')[0] || 'System'}
                  </span>
                  {activity.metadata?.actorRole && (
                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                        {activity.metadata.actorRole}
                    </span>
                  )}
                  <span>•</span>
                  <span className="flex items-center gap-1">
                     <History className="w-3 h-3" />
                     {format(new Date(activity.created_date), 'MMM d, h:mm a')}
                  </span>
                </div>
                
                <div className="text-sm font-medium text-slate-800">
                   {ACTION_LABELS[activity.action] || activity.action}
                </div>
                
                {/* Diff View */}
                {(activity.old_value || activity.new_value) && (
                    <div className="bg-white border rounded-md p-2 mt-1 text-xs space-y-1 shadow-sm">
                        {activity.field_changed && (
                            <div className="font-medium text-slate-500 uppercase tracking-wider text-[10px] mb-1">
                                {activity.field_changed.replace('_', ' ')}
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="line-through text-red-400 bg-red-50 px-1 rounded">
                                {activity.old_value || '(empty)'}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-green-600 bg-green-50 px-1 rounded font-medium">
                                {activity.new_value || '(empty)'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Comment Content if available (sometimes stored in new_value or metadata for commented action) */}
                {activity.action === 'commented' && (
                     <div className="bg-slate-50 border border-slate-100 text-slate-600 italic p-2 rounded-md text-xs mt-1">
                        "{activity.new_value || 'Comment added'}"
                     </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}