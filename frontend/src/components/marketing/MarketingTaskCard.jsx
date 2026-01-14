import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Paperclip, MessageSquare, Youtube, Instagram, Facebook, Linkedin, Twitter, Clock, PlayCircle,
  Film, FileImage, Share2, FileText, File, AlertTriangle, Trash2
} from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';

const PLATFORM_ICONS = {
  'YouTube': <Youtube className="w-3 h-3" />,
  'Instagram': <Instagram className="w-3 h-3" />,
  'Facebook': <Facebook className="w-3 h-3" />,
  'LinkedIn': <Linkedin className="w-3 h-3" />,
  'Twitter': <Twitter className="w-3 h-3" />,
  'TikTok': <PlayCircle className="w-3 h-3" />
};

const TYPE_ICONS = {
  video: <Film className="w-3 h-3" />,
  flyer: <FileImage className="w-3 h-3" />,
  poster: <FileImage className="w-3 h-3" />,
  social_post: <Share2 className="w-3 h-3" />,
  article: <FileText className="w-3 h-3" />,
  other: <File className="w-3 h-3" />
};

const PROGRESS_MAP = {
  editing: 10,
  review: 30,
  revision: 25,
  compliance: 50,
  compliance_revision: 45,
  approved: 75,
  published: 90,
  tracking: 95,
  closed: 100
};

export default function MarketingTaskCard({ task, onClick, onDelete }) {
  const getInitials = (email) => email?.split('@')[0].slice(0, 2).toUpperCase() || '??';
  
  // Progress Calculation
  const progress = PROGRESS_MAP[task.status] || 0;
  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const isDueToday = task.due_date && isToday(new Date(task.due_date));
  const isPending = task.status !== 'closed' && (isOverdue || isDueToday);
  
  // Restrict delete for teamsocialscrapers@gmail.com
  const canDelete = task.created_by !== 'teamsocialscrapers@gmail.com';

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className={isPending ? 'ring-2 ring-offset-2 rounded-lg' : ''}
      style={{
        ringColor: isOverdue ? '#dc2626' : '#f59e0b'
      }}
    >
      <Card 
        className={`hover:shadow-lg transition-all cursor-pointer border-l-4 group relative overflow-hidden ${
          isPending ? (isOverdue ? 'bg-red-50/50 border-red-500' : 'bg-amber-50/50 border-amber-500') : ''
        }`}
        style={{ 
          borderLeftColor: isPending 
            ? (isOverdue ? '#dc2626' : '#f59e0b')
            : task.status.includes('revision') ? '#f97316' 
            : task.status === 'approved' ? '#eab308'
            : task.status === 'published' ? '#10b981' 
            : '#6366f1'
        }}
        onClick={onClick}
      >
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {isPending && (
            <div className={`px-2 py-0.5 text-[10px] font-bold text-white flex items-center gap-1 ${
              isOverdue ? 'bg-red-600' : 'bg-amber-600'
            } rounded-md`}>
              <AlertTriangle className="w-3 h-3 animate-pulse" />
              {isOverdue ? 'OVERDUE' : 'DUE TODAY'}
            </div>
          )}
          {onDelete && canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm"
              title="Delete task"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
        <CardContent className="p-3 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1 flex-1">
               <div className="flex items-center gap-1.5 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  {TYPE_ICONS[task.task_type || 'video']}
                  {task.task_type || 'Video'}
               </div>
               {task.task_type === 'video' && task.video_subcategory && (
                 <Badge variant="secondary" className="text-[10px] h-5 bg-indigo-50 text-indigo-700 border-indigo-200">
                   {task.video_subcategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                 </Badge>
               )}
               <h4 className="font-medium text-sm text-slate-900 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">
                  {task.campaign_name || 'Untitled Campaign'}
               </h4>
            </div>
            <Badge variant="outline" className="text-[10px] h-5 px-1 shrink-0 bg-slate-50">
              V{task.version}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1">
            {task.platforms?.map(p => (
              <div key={p} className="bg-slate-100 p-1 rounded text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                {PLATFORM_ICONS[p] || <span className="text-[10px]">{p}</span>}
              </div>
            ))}
          </div>

          {/* Description Snippet */}
          {task.description && (
            <div className="text-xs text-slate-500 line-clamp-2">
              {task.description.replace(/<[^>]*>/g, '').substring(0, 100)}
              {task.description.replace(/<[^>]*>/g, '').length > 100 ? '...' : ''}
            </div>
          )}

          {/* Metrics Display for Tracked Tasks */}
          {task.metrics && (task.metrics.views > 0 || task.metrics.likes > 0) && (
            <div className="grid grid-cols-3 gap-1 py-1">
              <div className="bg-slate-50 rounded px-1.5 py-1 flex flex-col items-center justify-center border border-slate-100">
                <span className="text-[8px] text-slate-400 uppercase font-bold">Views</span>
                <span className="text-[10px] font-semibold text-slate-700">{task.metrics.views?.toLocaleString() || 0}</span>
              </div>
              <div className="bg-slate-50 rounded px-1.5 py-1 flex flex-col items-center justify-center border border-slate-100">
                <span className="text-[8px] text-slate-400 uppercase font-bold">Likes</span>
                <span className="text-[10px] font-semibold text-slate-700">{task.metrics.likes?.toLocaleString() || 0}</span>
              </div>
              <div className="bg-slate-50 rounded px-1.5 py-1 flex flex-col items-center justify-center border border-slate-100">
                <span className="text-[8px] text-slate-400 uppercase font-bold">CTR</span>
                <span className="text-[10px] font-semibold text-slate-700">{task.metrics.ctr || 0}%</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 text-slate-400">
              {task.files && Object.values(task.files).some(f => f) && (
                <Paperclip className="w-3 h-3" />
              )}
            </div>

            <div className="flex items-center gap-2">
               {task.due_date && (
                  <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}`}>
                     {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                     {format(new Date(task.due_date), 'MMM d')}
                  </div>
               )}
               <Avatar className="w-6 h-6 text-[10px] border-2 border-white shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700">
                    {getInitials(task.assignee_email)}
                  </AvatarFallback>
               </Avatar>
            </div>
          </div>
          
          {/* Mini Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
            <div 
              className="h-full transition-all duration-500 ease-out"
              style={{ 
                width: `${progress}%`,
                backgroundColor: 
                  task.status.includes('revision') ? '#f97316' : 
                  task.status === 'approved' ? '#eab308' :
                  task.status === 'published' ? '#10b981' : 
                  '#6366f1'
              }}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}