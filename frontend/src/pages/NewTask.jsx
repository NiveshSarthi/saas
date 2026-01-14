// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Save,
  X,
  Calendar as CalendarIcon,
  User,
  Flag,
  Tag,
  Paperclip,
  Plus,
  Loader2,
  Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import FileUpload from '@/components/common/FileUpload';
import CustomFieldsForm from '@/components/tasks/CustomFieldsForm';
import RecurringTaskForm from '@/components/tasks/RecurringTaskForm';
import StandardTagSelect from '@/components/tasks/StandardTagSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import UserMultiSelect from '@/components/common/UserMultiSelect';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { notifyMultipleAssignees, MODULES } from '@/components/utils/notificationService';
import AIAssigneeSuggestions from '@/components/tasks/AIAssigneeSuggestions';
import AICompletionPredictor from '@/components/tasks/AICompletionPredictor';
import AITaskSuggestions from '@/components/tasks/AITaskSuggestions';

const MARKETING_TEMPLATES = {
  samarpan: {
    title: 'Samarpan Video',
    description: 'Samarpan spiritual content video production',
    tags: ['video', 'samarpan', 'spiritual'],
    campaign_name: 'Samarpan Videos'
  },
  egc: {
    title: 'EGC Video',
    description: 'Employee Generated Content video',
    tags: ['video', 'egc', 'employee-content'],
    campaign_name: 'EGC Videos'
  },
  campaign: {
    title: 'Campaign Video',
    description: 'Marketing campaign video production',
    tags: ['video', 'campaign', 'marketing'],
    campaign_name: 'Campaign Videos'
  },
  awareness: {
    title: 'Awareness Video',
    description: 'Brand awareness video content',
    tags: ['video', 'awareness', 'branding'],
    campaign_name: 'Awareness Videos'
  }
};

export default function NewTask() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const presetProjectId = urlParams.get('project');
  const presetStatus = urlParams.get('status');

  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [taskCategory, setTaskCategory] = useState('normal');
  const [marketingTemplate, setMarketingTemplate] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: presetProjectId || '',
    group_id: '',
    status: presetStatus || 'backlog',
    priority: 'medium',
    task_type: 'task',
    assignee_email: '',
    assignees: [],
    assigned_group_id: '',
    start_date: '',
    due_date: '',
    estimated_hours: '',
    story_points: '',
    tags: [],
    attachments: [],
    custom_fields: {},
    is_recurring: false,
    recurrence_type: null,
    recurrence_day_of_week: null,
    recurrence_day_of_month: null,
    marketing_task_id: null,
  });
  const [tagInput, setTagInput] = useState('');
  const [user, setUser] = useState(null);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [marketingDepartment, setMarketingDepartment] = useState(null);
  const [marketingProject, setMarketingProject] = useState(null);
  const [marketingGroup, setMarketingGroup] = useState(null);
  const [marketingMembers, setMarketingMembers] = useState([]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date'),
  });

  const queryClient = useQueryClient();

  // Query client setup
  React.useEffect(() => {
    // Removed window.__REACT_QUERY_CLIENT__ assignment for compatibility
  }, [queryClient]);

  const { data: projectTasks = [] } = useQuery({
    queryKey: ['project-tasks-for-ai', formData.project_id],
    queryFn: () => base44.entities.Task.filter({ project_id: formData.project_id }, '-created_date', 20),
    enabled: !!formData.project_id,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-users'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });

  // `['dashboard-users']` cache may hold either an object { users, invitations }
  // or a flattened array (other pages sometimes return a flattened array).
  let usersFromEntity = [];
  let invitations = [];
  // Unwrap one layer if functions.invoke returned { data: { users, invitations } }
  const rawDashboard = dashboardData?.data || dashboardData;
  if (Array.isArray(rawDashboard)) {
    usersFromEntity = rawDashboard;
    invitations = [];
  } else {
    usersFromEntity = rawDashboard?.users || [];
    invitations = rawDashboard?.invitations || [];
  }

  // Normalize user shape so downstream code can rely on `id`, `email`, `department_id`
  usersFromEntity = (usersFromEntity || []).map(u => ({
    ...u,
    id: u.id || u._id || (u.email && String(u.email).toLowerCase()),
    email: u.email || u.email_address || u.username || null,
    department_id: u.department_id || (u.department && (u.department.id || u.department._id)) || null,
  }));

  invitations = (invitations || []).map(inv => ({
    ...inv,
    id: inv.id || inv._id || (inv.email && String(inv.email).toLowerCase()),
    email: inv.email || inv.email_address || null,
  }));

  

  const users = React.useMemo(() => [
    ...usersFromEntity,
    ...invitations
      .filter(inv => inv.status === 'accepted')
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
        role_id: inv.role_id,
      }))
  ], [usersFromEntity, invitations]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
        setFormData(prev => ({ ...prev, reporter_email: userData.email }));

        // Fetch Marketing department
        const depts = await base44.entities.Department.filter({ name: 'Marketing' });
        if (depts.length > 0) {
          setMarketingDepartment(depts[0]);
        }

        // Fetch Marketing_Collateral project
        const projs = await base44.entities.Project.filter({ name: 'Marketing_Collateral' });
        if (projs.length > 0) {
          setMarketingProject(projs[0]);
        }

        // Fetch Digital Marketing group
        const groups = await base44.entities.Group.filter({ name: 'Digital Marketing' });
        if (groups.length > 0) {
          setMarketingGroup(groups[0]);
        }
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  // Manual debug fetch in case the react-query hook isn't running in your environment
  React.useEffect(() => {
    const debugFetch = async () => {
      try {
        const res = await base44.functions.invoke('getDashboardUsers');
        console.debug('debugFetch getDashboardUsers', res);
      } catch (err) {
        console.error('debugFetch failed', err);
      }
    };
    debugFetch();
  }, []);

  // Set marketing project, group, and assignees when marketing category is selected
  React.useEffect(() => {
    if (taskCategory === 'marketing' && marketingProject && marketingGroup && marketingDepartment && users.length > 0) {
      // Get all active marketing department members
      const marketingMemberEmails = users
        .filter(u => String(u.department_id) === String(marketingDepartment.id) && u.status !== 'inactive' && u.is_active !== false)
        .map(u => u.email);

      setFormData(prev => ({
        ...prev,
        project_id: marketingProject.id,
        assigned_group_id: marketingGroup.id,
        assignees: marketingMemberEmails
      }));
    }
  }, [taskCategory, marketingProject, marketingGroup, marketingDepartment, users]);

  // Apply marketing template when selected
  React.useEffect(() => {
    if (taskCategory === 'marketing' && marketingTemplate && marketingProject && marketingDepartment && users.length > 0) {
      const template = MARKETING_TEMPLATES[marketingTemplate];

      // Get all active marketing department members
      const marketingMemberEmails = users
        .filter(u => String(u.department_id) === String(marketingDepartment.id) && u.status !== 'inactive' && u.is_active !== false)
        .map(u => u.email);

      if (template) {
        setFormData(prev => ({
          ...prev,
          title: template.title,
          description: template.description,
          tags: template.tags,
          project_id: marketingProject.id,
          assigned_group_id: marketingGroup?.id || '',
          assignees: marketingMemberEmails,
          task_type: 'feature'
        }));
      }
    }
  }, [taskCategory, marketingTemplate, marketingProject, marketingDepartment, marketingGroup, users]);

  const { data: customFields = [] } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => base44.entities.CustomField.list('order'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: userGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: taskGroups = [] } = useQuery({
    queryKey: ['task-groups', formData.project_id],
    queryFn: async () => {
      if (!formData.project_id) return [];
      const groups = await base44.entities.TaskGroup.filter({ project_id: formData.project_id });
      return groups;
    },
    enabled: !!formData.project_id,
  });

  const selectedProject = projects.find(p => p.id === formData.project_id);
  const projectDomain = selectedProject?.domain || 'generic';
  const relevantCustomFields = customFields.filter(f =>
    f.domain === 'all' || f.domain === projectDomain
  );

  const filteredUsers = users.filter(u => {
    const isActive = u.status !== 'inactive' && u.is_active !== false;
    const matchesDepartment = selectedDepartment === 'all' || String(u.department_id) === String(selectedDepartment);
    const selectedGroup = userGroups.find(g => g.id === formData.assigned_group_id);
    const matchesGroup = !formData.assigned_group_id || (selectedGroup?.members?.includes(u.email));
    return isActive && matchesDepartment && matchesGroup;
  });

  // Debugging: log dashboard users shape and filtered users to diagnose missing members
  React.useEffect(() => {
    try {
      console.debug('NewTask.dashboardData', { dashboardData });
      console.debug('NewTask.usersFromEntity_sample', (usersFromEntity || []).slice(0,6));
      console.debug('NewTask.invitations_sample', (invitations || []).slice(0,6));
      console.debug('NewTask.users_combined_sample', (users || []).slice(0,6));
      console.debug('NewTask.filteredUsers_count', filteredUsers.length, filteredUsers.slice(0,6));
    } catch (e) {
      console.debug('NewTask.debug failed', e);
    }
  }, [dashboardData, usersFromEntity, invitations, users, filteredUsers]);

  const createTaskMutation = useMutation({
    mutationFn: async (data) => {
      const task = await base44.entities.Task.create(data);

      // If marketing collateral task, create MarketingTask
      if (taskCategory === 'marketing' && marketingTemplate) {
        const template = MARKETING_TEMPLATES[marketingTemplate];
        const marketingTask = await base44.entities.MarketingTask.create({
          campaign_name: data.title,
          related_task_id: task.id,
          task_type: 'video',
          description: data.description || template.description,
          status: 'editing',
          assignee_email: data.assignees?.[0] || user?.email,
          shoot_date: data.start_date || null,
          due_date: data.due_date || null,
          platforms: [],
          tags: template.tags
        });

        // Update task with marketing_task_id
        await base44.entities.Task.update(task.id, {
          marketing_task_id: marketingTask.id
        });
      }

      // Log activity
      await base44.entities.Activity.create({
        task_id: task.id,
        project_id: data.project_id,
        actor_email: user?.email,
        action: 'created',
        metadata: { title: data.title }
      });

      // Send assignment notifications to all assignees
      if (data.assignees && data.assignees.length > 0) {
        await notifyMultipleAssignees({
          assignees: data.assignees,
          assignedBy: user?.email,
          assignedByName: user?.full_name || user?.email,
          module: MODULES.TASK,
          itemName: data.title,
          itemId: task.id,
          link: `/TaskDetail?id=${task.id || task._id}`
        });
      }

      return task;
    },
    onSuccess: () => {
      if (formData.project_id) {
        navigate(createPageUrl(`ProjectBoard?id=${formData.project_id}`));
      } else {
        navigate(createPageUrl('MyTasks'));
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = {
      ...formData,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      story_points: formData.story_points ? parseInt(formData.story_points) : null,
      reporter_email: user?.email,
      created_by: user?.email, // Ensure created_by is set for filtering
      assignee_email: formData.assignees.length > 0 ? formData.assignees[0] : null,
    };
    createTaskMutation.mutate(dataToSubmit);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" className="mb-4 hover:bg-white/50" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Plus className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Create New Task
              </h1>
              <p className="text-slate-600 mt-1">Build something amazing, one task at a time</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Category Selection */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-violet-500 to-fuchsia-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Task Category</h2>
              <p className="text-violet-100 text-sm">Choose the type of task you're creating</p>
            </div>
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setTaskCategory('normal');
                    setMarketingTemplate('');
                  }}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-left",
                    taskCategory === 'normal'
                      ? "border-indigo-500 bg-indigo-50 shadow-lg"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      taskCategory === 'normal' ? "bg-indigo-500" : "bg-slate-200"
                    )}>
                      <Flag className={cn("w-6 h-6", taskCategory === 'normal' ? "text-white" : "text-slate-600")} />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">Normal Task</div>
                      <div className="text-sm text-slate-600">Standard project task</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskCategory('marketing')}
                  className={cn(
                    "p-6 rounded-2xl border-2 transition-all text-left",
                    taskCategory === 'marketing'
                      ? "border-fuchsia-500 bg-fuchsia-50 shadow-lg"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      taskCategory === 'marketing' ? "bg-fuchsia-500" : "bg-slate-200"
                    )}>
                      <Video className={cn("w-6 h-6", taskCategory === 'marketing' ? "text-white" : "text-slate-600")} />
                    </div>
                    <div>
                      <div className="font-semibold text-lg">Marketing Collateral</div>
                      <div className="text-sm text-slate-600">Video & content production</div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Marketing Template Selection */}
              {taskCategory === 'marketing' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-4">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-fuchsia-500 to-violet-600 rounded-full"></div>
                    Video Template
                  </Label>
                  <Select value={marketingTemplate} onValueChange={setMarketingTemplate}>
                    <SelectTrigger className="border-2 border-slate-200 focus:border-fuchsia-500 rounded-xl h-12 transition-all">
                      <SelectValue placeholder="Choose a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="samarpan">🙏 Samarpan Videos</SelectItem>
                      <SelectItem value="egc">👥 EGC Videos (Employee Content)</SelectItem>
                      <SelectItem value="campaign">📢 Campaign Videos</SelectItem>
                      <SelectItem value="awareness">✨ Awareness Videos</SelectItem>
                    </SelectContent>
                  </Select>
                  {marketingTemplate && (
                    <div className="mt-3 p-4 bg-fuchsia-50 border border-fuchsia-200 rounded-xl">
                      <p className="text-sm text-fuchsia-900 font-medium mb-1">Template Applied ✓</p>
                      <p className="text-xs text-fuchsia-700">
                        Project: "Marketing_Collateral" • Group: "Digital Marketing" • All marketing members assigned • Marketing workflow will be auto-created
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Main Form Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Task Details</h2>
              <p className="text-indigo-100 text-sm">Essential information about your task</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Title */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                  <Label htmlFor="title" className="text-base font-semibold text-slate-900">
                    Task Title <span className="text-red-500">*</span>
                  </Label>
                </div>
                <Input
                  id="title"
                  placeholder="What needs to be done?"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="text-lg border-2 border-slate-200 focus:border-indigo-500 rounded-xl h-12 px-4 transition-all"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                  <Label htmlFor="description" className="text-base font-semibold text-slate-900">Description</Label>
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe the task in detail..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="border-2 border-slate-200 focus:border-indigo-500 rounded-xl px-4 py-3 transition-all resize-none"
                />
              </div>

              {/* AI Task Suggestions */}
              {formData.project_id && user?.role === 'admin' && (
                <AITaskSuggestions
                  projectData={projects.find(p => p.id === formData.project_id)}
                  currentTitle={formData.title}
                  currentDescription={formData.description}
                  currentTags={formData.tags}
                  onApplyTitle={(title) => setFormData(prev => ({ ...prev, title }))}
                  onApplyDescription={(desc) => setFormData(prev => ({ ...prev, description: desc }))}
                  onApplyTag={(tag) => setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))}
                  existingTasks={projectTasks}
                />
              )}
            </div>
          </div>

          {/* Project & Classification Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Project & Classification</h2>
              <p className="text-blue-100 text-sm">Organize and categorize your task</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Row: Project & Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
                    Project
                  </Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, group_id: '' }))}
                  >
                    <SelectTrigger className="border-2 border-slate-200 focus:border-blue-500 rounded-xl h-12 transition-all">
                      <SelectValue placeholder="Choose a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id || project._id} value={project.id || project._id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shadow-sm"
                              style={{ backgroundColor: project.color || '#6366F1' }}
                            />
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
                    Group (Optional)
                  </Label>
                  <Select
                    value={formData.assigned_group_id || "none"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_group_id: value === "none" ? '' : value }))}
                  >
                    <SelectTrigger className="border-2 border-slate-200 focus:border-blue-500 rounded-xl h-12 transition-all">
                      <SelectValue placeholder="Choose a group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Group</SelectItem>
                      {userGroups.map(group => (
                        <SelectItem key={group.id || group._id} value={group.id || group._id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shadow-sm"
                              style={{ backgroundColor: group.color || '#6366F1' }}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Task Type */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
                  Task Type
                </Label>
                <Select
                  value={formData.task_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, task_type: value }))}
                >
                  <SelectTrigger className="border-2 border-slate-200 focus:border-blue-500 rounded-xl h-12 transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="epic">🎯 Epic</SelectItem>
                    <SelectItem value="story">📖 Story</SelectItem>
                    <SelectItem value="task">✅ Task</SelectItem>
                    <SelectItem value="bug">🐛 Bug</SelectItem>
                    <SelectItem value="feature">⭐ Feature</SelectItem>
                    <SelectItem value="improvement">🚀 Improvement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
                    Status
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="border-2 border-slate-200 focus:border-blue-500 rounded-xl h-12 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">📋 Backlog</SelectItem>
                      <SelectItem value="todo">📝 To Do</SelectItem>
                      <SelectItem value="in_progress">🚧 In Progress</SelectItem>
                      <SelectItem value="review">👀 Review</SelectItem>
                      <SelectItem value="done">✅ Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full"></div>
                    Priority
                  </Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger className="border-2 border-slate-200 focus:border-blue-500 rounded-xl h-12 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-red-500" />
                          Critical
                        </div>
                      </SelectItem>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-orange-500" />
                          High
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-blue-500" />
                          Medium
                        </div>
                      </SelectItem>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <Flag className="w-4 h-4 text-slate-400" />
                          Low
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Team & Assignment Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Team & Assignment</h2>
              <p className="text-emerald-100 text-sm">Who will work on this task</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Assignees */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-teal-600 rounded-full"></div>
                  Assignees
                </Label>
                <UserMultiSelect
                  users={users}
                  departments={departments}
                  selectedEmails={formData.assignees}
                  onChange={(newAssignees) => setFormData(prev => ({ ...prev, assignees: newAssignees }))}
                  placeholder="Select team members..."
                  className=""
                />

                {/* Debug panel: shows counts and a manual fetch button */}
                <div className="mt-2 text-sm text-slate-500">
                  <div>debug: usersFromEntity={usersFromEntity?.length || 0}, combined users={users?.length || 0}, filtered={filteredUsers?.length || 0}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      // Try base44.functions.invoke first
                      try {
                        const r = await base44.functions.invoke('getDashboardUsers');
                        console.debug('manual debug fetch via base44.functions.invoke', r);
                      } catch (e) {
                        console.error('manual debug fetch via base44.functions.invoke failed', e);
                      }

                      // Try relative fetch to functions endpoint
                      try {
                        const res = await fetch('/functions/v1/invoke/getDashboardUsers', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                        const text = await res.text();
                        console.debug('manual debug fetch via /functions path', { ok: res.ok, status: res.status, body: text });
                      } catch (e) {
                        console.error('manual debug fetch via /functions path failed', e);
                      }

                      // Try direct backend host (fallback)
                      try {
                        const res2 = await fetch('http://localhost:3000/functions/v1/invoke/getDashboardUsers', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                        const text2 = await res2.text();
                        console.debug('manual debug fetch via http://localhost:3000', { ok: res2.ok, status: res2.status, body: text2 });
                      } catch (e) {
                        console.error('manual debug fetch via http://localhost:3000 failed', e);
                      }

                      alert('Manual debug fetch attempts logged to console');
                    }}
                    className="mt-2 text-xs text-indigo-600 underline"
                  >
                    Debug: fetch dashboard users
                  </button>
                </div>
              </div>

              {/* AI Assignee Suggestions */}
              {user?.role === 'admin' && (
                <AIAssigneeSuggestions
                  taskData={{
                    ...formData,
                    project_name: projects.find(p => p.id === formData.project_id)?.name
                  }}
                  teamMembers={users}
                  tasks={[]}
                  onSelectAssignee={(email) => {
                    if (!formData.assignees.includes(email)) {
                      setFormData(prev => ({ ...prev, assignees: [...prev.assignees, email] }));
                    }
                  }}
                  selectedAssignees={formData.assignees}
                />
              )}
            </div>
          </div>

          {/* Timeline & Estimation Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Timeline & Estimation</h2>
              <p className="text-amber-100 text-sm">Schedule and time estimates</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Row: Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></div>
                    Start Date
                  </Label>
                  <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-2 border-slate-200 hover:border-amber-500 rounded-xl h-12 transition-all",
                          !formData.start_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-5 w-5" />
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
                        className=""
                        classNames={{}}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></div>
                    Due Date
                  </Label>
                  <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal border-2 border-slate-200 hover:border-amber-500 rounded-xl h-12 transition-all",
                          !formData.due_date && "text-slate-500"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-5 w-5" />
                        {formData.due_date ? format(new Date(formData.due_date), 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.due_date ? new Date(formData.due_date) : undefined}
                        onSelect={(date) => {
                          setFormData(prev => ({
                            ...prev,
                            due_date: date ? format(date, 'yyyy-MM-dd') : ''
                          }));
                          setDueDateOpen(false);
                        }}
                        className=""
                        classNames={{}}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Row: Estimates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="estimated_hours" className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></div>
                    Estimated Hours
                  </Label>
                  <Input
                    id="estimated_hours"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g., 4"
                    value={formData.estimated_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                    className="border-2 border-slate-200 focus:border-amber-500 rounded-xl h-12 px-4 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="story_points" className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-600 rounded-full"></div>
                    Story Points
                  </Label>
                  <Input
                    id="story_points"
                    type="number"
                    min="0"
                    placeholder="e.g., 3"
                    value={formData.story_points}
                    onChange={(e) => setFormData(prev => ({ ...prev, story_points: e.target.value }))}
                    className="border-2 border-slate-200 focus:border-amber-500 rounded-xl h-12 px-4 transition-all"
                  />
                </div>
              </div>

              {/* AI Completion Time Prediction */}
              {user?.role === 'admin' && (
                <AICompletionPredictor
                  taskData={formData}
                  tasks={[]}
                />
              )}
            </div>
          </div>

          {/* Additional Details Section */}
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-slate-200/50 overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-6 sm:p-8">
              <h2 className="text-xl font-bold text-white mb-2">Additional Details</h2>
              <p className="text-rose-100 text-sm">Tags, attachments, and custom fields</p>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              {/* Tags */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full"></div>
                  Tags
                </Label>
                <StandardTagSelect
                  selectedTags={formData.tags}
                  onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                />
              </div>

              {/* Attachments */}
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full"></div>
                  Attachments
                </Label>
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

              {/* Custom Fields */}
              {relevantCustomFields.length > 0 && (
                <CustomFieldsForm
                  fields={relevantCustomFields}
                  values={formData.custom_fields}
                  onChange={(values) => setFormData(prev => ({ ...prev, custom_fields: values }))}
                  taskStatus={formData.status}
                />
              )}

              {/* Recurring Task Options */}
              <RecurringTaskForm formData={formData} setFormData={setFormData} />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            <Button type="button" variant="outline" className="w-full sm:w-auto border-2 rounded-xl h-12" onClick={() => navigate(-1)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all rounded-xl h-12 px-8"
              disabled={createTaskMutation.isPending || !formData.title}
            >
              {createTaskMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Task...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}