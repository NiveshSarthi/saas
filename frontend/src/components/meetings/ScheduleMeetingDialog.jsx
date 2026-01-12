import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format, addMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  Video,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { notifyMeetingScheduled } from '@/components/utils/notificationHelper';

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

export default function ScheduleMeetingDialog({ 
  open, 
  onOpenChange, 
  taskId, 
  taskTitle,
  projectId,
  defaultDate 
}) {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: taskTitle || '',
    description: '',
    date: defaultDate || null,
    start_time: '09:00',
    duration: 30,
    participants: []
  });
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData(prev => ({ 
          ...prev, 
          participants: prev.participants.includes(userData.email) ? prev.participants : [userData.email],
          title: taskTitle || prev.title
        }));
      } catch (e) {}
    };
    fetchUser();
  }, [taskTitle]);

  useEffect(() => {
    if (open && taskTitle) {
      setFormData(prev => ({ ...prev, title: taskTitle }));
    }
    if (open && defaultDate) {
      setFormData(prev => ({ ...prev, date: defaultDate }));
    }
  }, [open, taskTitle, defaultDate]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const createMeetingMutation = useMutation({
    mutationFn: async (data) => {
      const meeting = await base44.entities.Meeting.create(data);
      
      // Notify participants
      await notifyMeetingScheduled({
        meeting,
        participants: data.participants,
        actorEmail: user?.email,
        actorName: user?.full_name || user?.email
      });
      
      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['task-meetings'] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: null,
      start_time: '09:00',
      duration: 30,
      participants: user ? [user.email] : []
    });
  };

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
      project_id: projectId || null,
      task_id: taskId || null,
      participants: formData.participants,
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
    if (email === user?.email) return;
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
    (selectedDepartment === 'all' || u.department_id === selectedDepartment) &&
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-600" />
            Schedule Meeting
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Meeting Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Sprint Planning"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date <span className="text-red-500">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.date && "text-slate-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(formData.date, 'MMM d, yyyy') : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => setFormData(prev => ({ ...prev, date }))}
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
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration <span className="text-red-500">*</span></Label>
            <Select 
              value={String(formData.duration)} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agenda */}
          <div className="space-y-2">
            <Label htmlFor="description">Agenda (Optional)</Label>
            <Textarea
              id="description"
              placeholder="What will be discussed?"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Participants */}
          <div className="space-y-2">
            <Label>Participants</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.participants.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1.5 py-1 px-2">
                  <Avatar className="w-5 h-5">
                    <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                      {getInitials(email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{getUserName(email)}</span>
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
                <Button variant="outline" type="button" size="sm" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Add Participants
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="start">
                <div className="mb-2">
                  <Select 
                    value={selectedDepartment} 
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Command className="rounded-lg border shadow-md">
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

          {/* Note about Zoom */}
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700 flex items-start gap-2">
            <Video className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Meeting link will be generated automatically upon creation.</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={createMeetingMutation.isPending || !formData.title || !formData.date}
            >
              {createMeetingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 mr-2" />
                  Schedule Meeting
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}