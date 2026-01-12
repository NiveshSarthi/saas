import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Save,
  Calendar as CalendarIcon,
  Palette,
  Code2,
  Building2,
  Layers,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';

const COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#0EA5E9', '#3B82F6'
];

const DOMAIN_OPTIONS = [
  { value: 'it', label: 'IT / Software', icon: Code2, description: 'Bug tracking, sprints, releases' },
  { value: 'real_estate', label: 'Real Estate', icon: Building2, description: 'Property tracking, clients, visits' },
  { value: 'generic', label: 'Generic', icon: Layers, description: 'Flexible task management' },
];

export default function NewProject() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    domain: 'generic',
    status: 'active',
    start_date: '',
    end_date: '',
    color: '#6366F1',
    members: [],
    workflow_states: ['backlog', 'todo', 'in_progress', 'review', 'done'],
  });
  const [memberInput, setMemberInput] = useState('');
  const [user, setUser] = useState(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData(prev => ({
          ...prev,
          owner_email: userData.email,
          members: [userData.email]
        }));
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const filteredUsers = users.filter(u =>
    selectedDepartment === 'all' || u.department_id === selectedDepartment
  );

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: (project) => {
      const projectId = project.id || project._id;
      if (projectId) {
        navigate(createPageUrl(`ProjectBoard?id=${projectId}`));
      } else {
        console.error('Project created but no ID returned', project);
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createProjectMutation.mutate(formData);
  };

  const handleAddMember = () => {
    if (memberInput.trim() && !formData.members.includes(memberInput.trim())) {
      setFormData(prev => ({ ...prev, members: [...prev.members, memberInput.trim()] }));
      setMemberInput('');
    }
  };

  const handleRemoveMember = (member) => {
    if (member === user?.email) return; // Can't remove owner
    setFormData(prev => ({ ...prev, members: prev.members.filter(m => m !== member) }));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl('Projects')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create New Project</h1>
            <p className="text-slate-500 mt-1">Set up a new project workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 space-y-6">
            {/* Project Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">
                Project Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter project name..."
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your project..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Domain Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Domain</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DOMAIN_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = formData.domain === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, domain: option.value }))}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        isSelected
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <Icon className={cn(
                        "w-6 h-6 mb-2",
                        isSelected ? "text-indigo-600" : "text-slate-400"
                      )} />
                      <h4 className={cn(
                        "font-medium",
                        isSelected ? "text-indigo-900" : "text-slate-900"
                      )}>
                        {option.label}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Project Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                    className={cn(
                      "w-10 h-10 rounded-xl transition-all",
                      formData.color === color && "ring-2 ring-offset-2 ring-slate-400"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Start Date</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.start_date && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(new Date(formData.start_date), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.start_date ? new Date(formData.start_date) : undefined}
                      onSelect={(date) => {
                        setFormData(prev => ({
                          ...prev,
                          start_date: date ? format(date, 'yyyy-MM-dd') : ''
                        }));
                        setStartDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">End Date</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.end_date && "text-slate-500"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.end_date ? format(new Date(formData.end_date), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.end_date ? new Date(formData.end_date) : undefined}
                      onSelect={(date) => {
                        setFormData(prev => ({
                          ...prev,
                          end_date: date ? format(date, 'yyyy-MM-dd') : ''
                        }));
                        setEndDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Team Members</Label>
              <div className="flex flex-col md:flex-row gap-2">
                <div className="w-full md:w-1/3">
                  <Select
                    value={selectedDepartment}
                    onValueChange={setSelectedDepartment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !formData.members.includes(value)) {
                        setFormData(prev => ({ ...prev, members: [...prev.members, value] }));
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Add team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers
                        .filter(u => !formData.members.includes(u.email))
                        .map(u => (
                          <SelectItem key={u.email} value={u.email}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.members.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.members.map((member, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 py-1.5 px-3">
                      {member}
                      {member === user?.email ? (
                        <span className="text-xs text-slate-400">(Owner)</span>
                      ) : (
                        <X
                          className="w-3 h-3 cursor-pointer ml-1"
                          onClick={() => handleRemoveMember(member)}
                        />
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <Link to={createPageUrl('Projects')}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={createProjectMutation.isPending || !formData.name}
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}