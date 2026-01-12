import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO, isPast, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Video,
  Edit,
  Trash2,
  Copy,
  Check,
  FolderOpen,
  FileText,
  Paperclip,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import MeetingComments from '@/components/meetings/MeetingComments';
import { usePermissions } from '@/components/rbac/PermissionsContext';

export default function MeetingRoom() {
  const [user, setUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const urlParams = new URLSearchParams(window.location.search);
  const meetingId = urlParams.get('id');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', meetingId],
    queryFn: async () => {
      const meetings = await base44.entities.Meeting.filter({ id: meetingId });
      return meetings[0];
    },
    enabled: !!meetingId,
  });

  const { data: project } = useQuery({
    queryKey: ['meeting-project', meeting?.project_id],
    queryFn: async () => {
      if (!meeting?.project_id) return null;
      const projects = await base44.entities.Project.filter({ id: meeting.project_id });
      return projects[0];
    },
    enabled: !!meeting?.project_id,
  });

  const { data: task } = useQuery({
    queryKey: ['meeting-task', meeting?.task_id],
    queryFn: async () => {
      if (!meeting?.task_id) return null;
      const tasks = await base44.entities.Task.filter({ id: meeting.task_id });
      return tasks[0];
    },
    enabled: !!meeting?.task_id,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['meeting-comments', meetingId],
    queryFn: () => base44.entities.MeetingComment.filter({ meeting_id: meetingId }, 'created_date'),
    enabled: !!meetingId,
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: () => base44.entities.Meeting.delete(meetingId),
    onSuccess: () => {
      window.location.href = createPageUrl('Meetings');
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: (data) => base44.entities.Meeting.update(meetingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });

  const canEdit = meeting?.created_by === user?.email || can('calendar', 'update');
  const isParticipant = meeting?.participants?.includes(user?.email);

  const copyMeetingLink = () => {
    const link = `${window.location.origin}${createPageUrl(`MeetingRoom?id=${meetingId}`)}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInitials = (email) => {
    const u = users.find(usr => usr.email === email);
    if (u?.full_name) return u.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  const getUserName = (email) => {
    const u = users.find(usr => usr.email === email);
    return u?.full_name || email;
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Meeting not found</h2>
        <Link to={createPageUrl('Meetings')}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meetings
          </Button>
        </Link>
      </div>
    );
  }

  if (!isParticipant && meeting.created_by !== user?.email) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">You are not a participant of this meeting.</p>
        <Link to={createPageUrl('Meetings')}>
          <Button className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meetings
          </Button>
        </Link>
      </div>
    );
  }

  const startDate = parseISO(meeting.start_date);
  const endDate = parseISO(meeting.end_date);
  const now = new Date();
  const isUpcoming = startDate > now;
  const isOngoing = startDate <= now && endDate >= now;
  const isPastMeeting = isPast(endDate);
  const minutesUntilStart = differenceInMinutes(startDate, now);
  const isHost = meeting.created_by === user?.email;

  const statusConfig = {
    scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700' },
    in_progress: { label: 'In Progress', color: 'bg-green-100 text-green-700' },
    completed: { label: 'Completed', color: 'bg-slate-100 text-slate-700' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Link to={createPageUrl('Meetings')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={statusConfig[meeting.status]?.color}>
                {statusConfig[meeting.status]?.label}
              </Badge>
              {isOngoing && (
                <Badge className="bg-green-500 text-white animate-pulse">
                  <Video className="w-3 h-3 mr-1" />
                  Live Now
                </Badge>
              )}
              {isUpcoming && minutesUntilStart <= 10 && minutesUntilStart > 0 && (
                <Badge className="bg-amber-100 text-amber-700">
                  Starting in {minutesUntilStart} min
                </Badge>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{meeting.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Join/Start Meeting Buttons */}
          {!isPastMeeting && meeting.status !== 'cancelled' && (
            <>
              {isHost && meeting.start_url ? (
                <a href={meeting.start_url} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Video className="w-4 h-4 mr-2" />
                    Start Meeting
                  </Button>
                </a>
              ) : meeting.join_url ? (
                <a href={meeting.join_url} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Video className="w-4 h-4 mr-2" />
                    Join Meeting
                  </Button>
                </a>
              ) : null}
            </>
          )}

          <Button variant="outline" onClick={copyMeetingLink}>
            {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>

          {canEdit && (
            <>
              <Link to={createPageUrl(`EditMeeting?id=${meetingId}`)}>
                <Button variant="outline" size="icon">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this meeting? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMeetingMutation.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agenda */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Agenda</h3>
            {meeting.description ? (
              <p className="text-slate-600 whitespace-pre-wrap">{meeting.description}</p>
            ) : (
              <p className="text-slate-400 italic">No agenda provided</p>
            )}
          </div>

          {/* Attachments */}
          {meeting.attachments?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                Attachments ({meeting.attachments.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {meeting.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                  >
                    <Paperclip className="w-4 h-4 text-slate-400" />
                    <span className="text-sm truncate">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">
              Discussion ({comments.length})
            </h3>
            <MeetingComments
              meetingId={meetingId}
              comments={comments}
              users={users}
              currentUser={user}
              participants={meeting.participants || []}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Date & Time */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">{format(startDate, 'EEEE, MMMM d, yyyy')}</p>
                <p className="text-sm text-slate-500">
                  {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                </p>
              </div>
            </div>
            {meeting.duration && (
              <div className="flex items-center gap-2 text-sm text-slate-500 pt-2 border-t border-slate-100">
                <Clock className="w-4 h-4" />
                <span>Duration: {meeting.duration} minutes</span>
              </div>
            )}
          </div>

          {/* Participants */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">
              Participants ({(meeting.participants || []).length})
            </h3>
            <div className="space-y-3">
              {(meeting.participants || []).map((email) => (
                <div key={email} className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                      {getInitials(email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {getUserName(email)}
                    </p>
                    {email === meeting.created_by && (
                      <p className="text-xs text-slate-500">Organizer</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Related Project/Task */}
          {(project || task) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              {project && (
                <Link
                  to={createPageUrl(`ProjectBoard?id=${project.id}`)}
                  className="flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 py-2 rounded-lg"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${project.color || '#6366F1'}20` }}
                  >
                    <FolderOpen className="w-4 h-4" style={{ color: project.color || '#6366F1' }} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Project</p>
                    <p className="text-sm font-medium text-slate-900">{project.name}</p>
                  </div>
                </Link>
              )}

              {task && (
                <Link
                  to={createPageUrl(`TaskDetail?id=${activeTask.id || activeTask._id}`)}
                  className="flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 py-2 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Task</p>
                    <p className="text-sm font-medium text-slate-900">{task.title}</p>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Organizer */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-500 mb-2">Created by</p>
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs bg-slate-100 text-slate-600">
                  {getInitials(meeting.created_by)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{getUserName(meeting.created_by)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}