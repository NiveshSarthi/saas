import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, isToday, isTomorrow, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Video,
  Calendar,
  Clock,
  Users,
  ArrowRight,
  Plus,
  ExternalLink,
  Play,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function UpcomingMeetings({ meetings = [], users = [], currentUserEmail }) {
  const [copiedId, setCopiedId] = React.useState(null);

  const getInitials = (email) => {
    const u = users.find(usr => usr.email === email);
    if (u?.full_name) return u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const getUserName = (email) => {
    const u = users.find(usr => usr.email === email);
    return u?.full_name || email?.split('@')[0] || 'Unknown';
  };

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  const getMeetingStatus = (meeting) => {
    const now = new Date();
    const start = parseISO(meeting.start_date);
    const end = parseISO(meeting.end_date);
    const minsUntilStart = differenceInMinutes(start, now);

    if (meeting.status === 'in_progress' || (now >= start && now <= end)) {
      return { label: 'Live Now', color: 'bg-green-500', pulse: true };
    }
    if (minsUntilStart <= 15 && minsUntilStart > 0) {
      return { label: `In ${minsUntilStart}m`, color: 'bg-amber-500', pulse: true };
    }
    if (minsUntilStart <= 60 && minsUntilStart > 15) {
      return { label: 'Soon', color: 'bg-blue-500', pulse: false };
    }
    return null;
  };

  const copyMeetingLink = (e, meeting) => {
    e.preventDefault();
    e.stopPropagation();
    if (meeting.join_url) {
      navigator.clipboard.writeText(meeting.join_url);
      setCopiedId(meeting.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const joinMeeting = (e, meeting) => {
    e.preventDefault();
    e.stopPropagation();
    const url = meeting.created_by === currentUserEmail ? meeting.start_url : meeting.join_url;
    if (url) window.open(url, '_blank');
  };

  if (meetings.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-indigo-600" />
            Upcoming Meetings
          </h3>
          <Link to={createPageUrl('ScheduleMeeting')}>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              New
            </Button>
          </Link>
        </div>
        <div className="text-center py-6 sm:py-8">
          <Video className="w-8 h-8 sm:w-10 sm:h-10 text-slate-200 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-3">No upcoming meetings</p>
          <Link to={createPageUrl('ScheduleMeeting')}>
            <Button size="sm" variant="outline">
              <Plus className="w-3 h-3 mr-1" />
              Schedule Meeting
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-indigo-600" />
            Upcoming Meetings
            <Badge variant="secondary" className="text-[10px] ml-1">{meetings.length}</Badge>
          </h3>
          <div className="flex items-center gap-1">
            <Link to={createPageUrl('ScheduleMeeting')}>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Plus className="w-4 h-4" />
              </Button>
            </Link>
            <Link to={createPageUrl('Meetings')}>
              <Button variant="ghost" size="sm" className="text-indigo-600 h-7 text-xs">
                All
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {meetings.slice(0, 8).map((meeting) => {
            const startDate = parseISO(meeting.start_date);
            const isHost = meeting.created_by === currentUserEmail;
            const status = getMeetingStatus(meeting);
            const hasJoinUrl = meeting.join_url || meeting.start_url;

            return (
              <Link 
                key={meeting.id}
                to={createPageUrl(`MeetingRoom?id=${meeting.id}`)}
                className={cn(
                  "block p-3 rounded-lg transition-all group",
                  status?.label === 'Live Now' 
                    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" 
                    : "bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 dark:text-white truncate text-sm">
                        {meeting.title}
                      </span>
                      {status && (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[10px] text-white px-1.5 py-0.5 rounded-full",
                          status.color
                        )}>
                          {status.pulse && <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                          {status.label}
                        </span>
                      )}
                      {isHost && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 border-indigo-200 text-indigo-600">Host</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {getDateLabel(meeting.start_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(startDate, 'HH:mm')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {(meeting.participants || []).length}
                      </span>
                    </div>

                    {/* Participants preview */}
                    <div className="flex items-center gap-1 mt-2">
                      <div className="flex -space-x-1.5">
                        {(meeting.participants || []).slice(0, 4).map((email, i) => (
                          <Tooltip key={i}>
                            <TooltipTrigger asChild>
                              <Avatar className="w-5 h-5 border border-white dark:border-slate-700">
                                <AvatarFallback className="text-[8px] bg-indigo-100 text-indigo-600">
                                  {getInitials(email)}
                                </AvatarFallback>
                              </Avatar>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {getUserName(email)}
                            </TooltipContent>
                          </Tooltip>
                        ))}
                        {(meeting.participants || []).length > 4 && (
                          <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 border border-white dark:border-slate-700 flex items-center justify-center text-[8px] text-slate-600 dark:text-slate-300">
                            +{meeting.participants.length - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {hasJoinUrl && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            className={cn(
                              "h-6 w-6 p-0",
                              status?.label === 'Live Now' 
                                ? "bg-green-600 hover:bg-green-700" 
                                : "bg-indigo-600 hover:bg-indigo-700"
                            )}
                            onClick={(e) => joinMeeting(e, meeting)}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Join Meeting</TooltipContent>
                      </Tooltip>
                    )}
                    {meeting.join_url && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={(e) => copyMeetingLink(e, meeting)}
                          >
                            {copiedId === meeting.id ? (
                              <Check className="w-3 h-3 text-green-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copiedId === meeting.id ? 'Copied!' : 'Copy Link'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}