import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import FileUpload from '@/components/common/FileUpload';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export default function EditMeeting() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingId = urlParams.get('id');

  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState(null);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: meeting, isLoading: meetingLoading } = useQuery({
    queryKey: ['edit-meeting', meetingId],
    queryFn: async () => {
      const meetings = await base44.entities.Meeting.filter({ id: meetingId });
      return meetings[0];
    },
    enabled: !!meetingId,
  });

  useEffect(() => {
    if (meeting) {
      const startDate = parseISO(meeting.start_date);
      const endDate = parseISO(meeting.end_date);
      
      setFormData({
        title: meeting.title || '',
        description: meeting.description || '',
        date: startDate,
        start_time: format(startDate, 'HH:mm'),
        end_time: format(endDate, 'HH:mm'),
        project_id: meeting.project_id || '',
        task_id: meeting.task_id || '',
        participants: meeting.participants || [],
        attachments: meeting.attachments || [],
        status: meeting.status || 'scheduled'
      });
    }
  }, [meeting]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', formData?.project_id],
    queryFn: () => base44.entities.Task.filter({ project_id: formData.project_id }),
    enabled: !!formData?.project_id,
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Meeting.update(meetingId, data);
      
      // Notify new participants
      const originalParticipants = meeting.participants || [];
      const newParticipants = data.participants.filter(
        email => !originalParticipants.includes(email)
      );
      
      for (const email of newParticipants) {
        await base44.entities.Notification.create({
          user_email: email,
          type: 'task_assigned',
          title: 'New Meeting Invitation',
          message: `${user?.full_name || user?.email} invited you to "${data.title}"`,
          actor_email: user?.email,
          link: `MeetingRoom?id=${meetingId}`
        });
      }
    },
    onSuccess: () => {
      window.location.href = createPageUrl(`MeetingRoom?id=${meetingId}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.date) return;
    
    const dateStr = format(formData.date, 'yyyy-MM-dd');
    const startDateTime = new Date(`${dateStr}T${formData.start_time}:00`);
    const endDateTime = new Date(`${dateStr}T${formData.end_time}:00`);
    
    updateMeetingMutation.mutate({
      title: formData.title,
      description: formData.description,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      project_id: formData.project_id || null,
      task_id: formData.task_id || null,
      participants: formData.participants,
      attachments: formData.attachments,
      status: formData.status
    });
  };

  const addParticipant = (email) => {
    if (!formData.participants.includes(email)) {
      setFormData(prev => ({ ...prev, participants: [...prev.participants, email] }));
    }
    setShowParticipantPicker(false);
    setParticipantSearch('');
  };

  const removeParticipant = (email) => {
    if (email === meeting?.created_by) return;
    setFormData(prev => ({ 
      ...prev, 
      participants: prev.participants.filter(e => e !== email) 
    }));
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

  const filteredUsers = users.filter(u => 
    !formData?.participants.includes(u.email) &&
    (u.full_name?.toLowerCase().includes(participantSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(participantSearch.toLowerCase()))
  );

  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      timeOptions.push(time);
    }
  }

  if (meetingLoading || !formData) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-[600px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Meeting not found</h2>
        <Link to={createPageUrl('Meetings')}>
          <Button className="mt-4">Back to Meetings</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl(`MeetingRoom?id=${meetingId}`)}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Meeting</h1>
            <p className="text-slate-500 mt-1">Update meeting details</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Meeting Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Agenda / Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) => {
                        setFormData(prev => ({ ...prev, date }));
                        setDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Start Time</Label>
                <Select 
                  value={formData.start_time} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, start_time: value }))}
                >
                  <SelectTrigger>
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>End Time</Label>
                <Select 
                  value={formData.end_time} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, end_time: value }))}
                >
                  <SelectTrigger>
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time}>{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <Label>Participants</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.participants.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-2 py-1 px-2">
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                        {getInitials(email)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{getUserName(email)}</span>
                    {email !== meeting.created_by && (
                      <X 
                        className="w-3 h-3 cursor-pointer hover:text-red-600" 
                        onClick={() => removeParticipant(email)}
                      />
                    )}
                  </Badge>
                ))}
              </div>
              <Popover open={showParticipantPicker} onOpenChange={setShowParticipantPicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="w-full justify-start">
                    <Users className="w-4 h-4 mr-2" />
                    Add Participants
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search users..." 
                      value={participantSearch}
                      onValueChange={setParticipantSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {filteredUsers.map(u => (
                          <CommandItem 
                            key={u.email} 
                            onSelect={() => addParticipant(u.email)}
                            className="cursor-pointer"
                          >
                            <Avatar className="w-6 h-6 mr-2">
                              <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                                {getInitials(u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{u.full_name || u.email}</p>
                              {u.full_name && <p className="text-xs text-slate-500">{u.email}</p>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Project & Task */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Related Project</Label>
                <Select 
                  value={formData.project_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, task_id: '' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No project</SelectItem>
                    {projects.map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Related Task</Label>
                <Select 
                  value={formData.task_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, task_id: value }))}
                  disabled={!formData.project_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>No task</SelectItem>
                    {tasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label>Attachments</Label>
              <FileUpload
                files={formData.attachments}
                onUpload={(file) => setFormData(prev => ({
                  ...prev,
                  attachments: [...prev.attachments, file]
                }))}
                onRemove={(i) => setFormData(prev => ({
                  ...prev,
                  attachments: prev.attachments.filter((_, idx) => idx !== i)
                }))}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Link to={createPageUrl(`MeetingRoom?id=${meetingId}`)}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={updateMeetingMutation.isPending || !formData.title || !formData.date}
            >
              {updateMeetingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}