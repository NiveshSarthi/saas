import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Video,
  Calendar,
  Clock,
  Users,
  ExternalLink,
  Plus,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ScheduleMeetingDialog from './ScheduleMeetingDialog';

export default function TaskMeetingSection({ taskId, taskTitle, projectId, currentUserEmail }) {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['task-meetings', taskId],
    queryFn: () => base44.entities.Meeting.filter({ task_id: taskId }, '-start_date'),
    enabled: !!taskId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const getInitials = (email) => {
    const u = users.find(usr => usr.email === email);
    if (u?.full_name) return u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const getUserName = (email) => {
    const u = users.find(usr => usr.email === email);
    return u?.full_name || email;
  };

  const upcomingMeetings = meetings.filter(m => m.end_date && !isPast(parseISO(m.end_date)) && m.status !== 'cancelled');
  const pastMeetings = meetings.filter(m => m.end_date && (isPast(parseISO(m.end_date)) || m.status === 'completed'));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Video className="w-4 h-4 text-indigo-600" />
          Meetings ({meetings.length})
        </h3>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => setShowScheduleDialog(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          Schedule
        </Button>
      </div>

      {meetings.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-lg">
          <Video className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500 mb-3">No meetings scheduled</p>
          <Button size="sm" onClick={() => setShowScheduleDialog(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Schedule Meeting
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingMeetings.map((meeting) => {
            const startDate = parseISO(meeting.start_date);
            const isHost = meeting.created_by === currentUserEmail;
            const isParticipant = meeting.participants?.includes(currentUserEmail);

            return (
              <div 
                key={meeting.id} 
                className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link 
                      to={createPageUrl(`MeetingRoom?id=${meeting.id}`)}
                      className="font-medium text-slate-900 hover:text-indigo-600 block truncate"
                    >
                      {meeting.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(startDate, 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(startDate, 'HH:mm')} ({meeting.duration} min)
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {meeting.participants?.length || 0}
                      </span>
                    </div>
                    {meeting.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                        {meeting.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isHost && meeting.start_url ? (
                      <a href={meeting.start_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700">
                          <Play className="w-3 h-3 mr-1" />
                          Start
                        </Button>
                      </a>
                    ) : meeting.join_url ? (
                      <a href={meeting.join_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Join
                        </Button>
                      </a>
                    ) : (
                      <Link to={createPageUrl(`MeetingRoom?id=${meeting.id}`)}>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Host indicator */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-400">Host:</span>
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                      {getInitials(meeting.created_by)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-slate-600">{getUserName(meeting.created_by)}</span>
                  {isHost && <Badge variant="secondary" className="text-[10px] py-0">You</Badge>}
                </div>
              </div>
            );
          })}

          {pastMeetings.length > 0 && (
            <div className="pt-2">
              <p className="text-xs text-slate-400 mb-2">Past Meetings</p>
              {pastMeetings.slice(0, 3).map((meeting) => (
                <Link 
                  key={meeting.id}
                  to={createPageUrl(`MeetingRoom?id=${meeting.id}`)}
                  className="block text-sm text-slate-500 hover:text-slate-700 py-1"
                >
                  {meeting.title} • {format(parseISO(meeting.start_date), 'MMM d')}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <ScheduleMeetingDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        taskId={taskId}
        taskTitle={taskTitle}
        projectId={projectId}
      />
    </div>
  );
}