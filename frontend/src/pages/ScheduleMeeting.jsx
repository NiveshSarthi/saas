import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Clock,
  Users,
  FolderOpen,
  Link as LinkIcon,
  Paperclip,
  Loader2,
  X,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

export default function ScheduleMeeting() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: null,
    start_time: '09:00',
    duration: 60,
    project_id: '',
    task_id: '',
    participants: [],
    attachments: []
  });
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        // Add creator as participant
        setFormData(prev => ({ ...prev, participants: [userData.email] }));
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['project-tasks', formData.project_id],
    queryFn: () => base44.entities.Task.filter({ project_id: formData.project_id }),
    enabled: !!formData.project_id,
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data) => {
      // Create Google Meet link
      let meetData = {};
      try {
        const meetResponse = await base44.functions.invoke('createGoogleMeet', {
          title: data.title,
          description: data.description,
          startDateTime: data.start_date,
          endDateTime: data.end_date,
          attendees: data.participants
        });
        if (meetResponse.data?.success) {
          meetData = {
            join_url: meetResponse.data.meetLink,
            start_url: meetResponse.data.meetLink,
            zoom_meeting_id: meetResponse.data.calendarEventId
          };
        }
      } catch (e) {
        console.error('Failed to create Google Meet:', e);
      }

      const meeting = await base44.entities.Meeting.create({
        ...data,
        ...meetData
      });
      
      // Send notifications to participants
      const notifications = data.participants
        .filter(email => email !== user?.email)
        .map(email => ({
          user_email: email,
          type: 'task_assigned',
          title: 'New Meeting Invitation',
          message: `${user?.full_name || user?.email} invited you to "${data.title}"`,
          actor_email: user?.email,
          link: `MeetingRoom?id=${meeting.id}`
        }));
      
      await Promise.all(notifications.map(notif => 
        base44.entities.Notification.create(notif)
      ));
      
      // Log activity
      await base44.entities.Activity.create({
        project_id: data.project_id,
        actor_email: user?.email,
        action: 'created',
        metadata: { type: 'meeting', title: data.title, meeting_id: meeting.id }
      });
      
      return meeting;
    },
    onSuccess: (meeting) => {
      window.location.href = createPageUrl(`MeetingRoom?id=${meeting.id}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.date) return;
    
    const dateStr = format(formData.date, 'yyyy-MM-dd');
    const startDateTime = new Date(`${dateStr}T${formData.start_time}:00`);
    const endDateTime = addMinutes(startDateTime, formData.duration);

    // Validate not in past
    if (startDateTime < new Date()) {
      alert('Cannot schedule a meeting in the past');
      return;
    }
    
    createMeetingMutation.mutate({
      title: formData.title,
      description: formData.description,
      start_date: startDateTime.toISOString(),
      end_date: endDateTime.toISOString(),
      duration: formData.duration,
      project_id: formData.project_id || null,
      task_id: formData.task_id || null,
      participants: formData.participants,
      attachments: formData.attachments,
      status: 'scheduled',
      reminders_sent: false
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
    if (email === user?.email) return; // Can't remove yourself
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
    !formData.participants.includes(u.email) &&
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl('Meetings')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedule Meeting</h1>
            <p className="text-slate-500 mt-1">Create a new meeting and invite participants</p>
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
                placeholder="e.g., Weekly Team Sync"
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
                placeholder="What will be discussed in this meeting?"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
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
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Start Time <span className="text-red-500">*</span></Label>
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
                <Label>Duration <span className="text-red-500">*</span></Label>
                <Select 
                  value={String(formData.duration)} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
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
                    {email !== user?.email && (
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
                <Label>Related Project (Optional)</Label>
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
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: project.color || '#6366F1' }}
                          />
                          {project.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Related Task (Optional)</Label>
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

            {/* Google Meet Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Video className="w-4 h-4" />
                <span>A Google Meet link will be created automatically for this meeting</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Link to={createPageUrl('Meetings')}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={createMeetingMutation.isPending || !formData.title || !formData.date}
            >
              {createMeetingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}