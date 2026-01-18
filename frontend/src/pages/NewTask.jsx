// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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
  Video,
  Sparkles,
  Layers,
  Users
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
  const location = useLocation();
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

  let usersFromEntity = [];
  let invitations = [];
  const rawDashboard = dashboardData?.data || dashboardData;
  if (Array.isArray(rawDashboard)) {
    usersFromEntity = rawDashboard;
    invitations = [];
  } else {
    usersFromEntity = rawDashboard?.users || [];
    invitations = rawDashboard?.invitations || [];
  }

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

        const depts = await base44.entities.Department.filter({ name: 'Marketing' });
        if (depts.length > 0) {
          setMarketingDepartment(depts[0]);
        }

        const projs = await base44.entities.Project.filter({ name: 'Marketing_Collateral' });
        if (projs.length > 0) {
          setMarketingProject(projs[0]);
        }

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

  React.useEffect(() => {
    if (taskCategory === 'marketing' && marketingProject && marketingGroup && marketingDepartment && users.length > 0) {
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

  React.useEffect(() => {
    if (taskCategory === 'marketing' && marketingTemplate && marketingProject && marketingDepartment && users.length > 0) {
      const template = MARKETING_TEMPLATES[marketingTemplate];
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

  const createTaskMutation = useMutation({
    mutationFn: async (data) => {
      const task = await base44.entities.Task.create(data);

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

        await base44.entities.Task.update(task.id, {
          marketing_task_id: marketingTask.id
        });
      }

      await base44.entities.Activity.create({
        task_id: task.id,
        project_id: data.project_id,
        actor_email: user?.email,
        action: 'created',
        metadata: { title: data.title }
      });

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
      if (location.state?.returnPath) {
        navigate(createPageUrl(location.state.returnPath));
      } else if (formData.project_id) {
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
      created_by: user?.email,
      assignee_email: formData.assignees.length > 0 ? (formData.assignees[0] || '').toLowerCase() : null,
      assignees: formData.assignees.map(e => (e || '').toLowerCase()),
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-indigo-950/30 dark:to-slate-900 pb-20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header Section */}
        <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <Button
            variant="ghost"
            className="mb-6 hover:bg-white/50 dark:hover:bg-slate-800/50 backdrop-blur-sm -ml-2 text-slate-600 hover:text-indigo-600 transition-all"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <div className="relative p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-indigo-100 dark:border-slate-700">
                  <Plus className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400 tracking-tight">
                  New Task
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Create and assign tasks to your team</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(-1)}
                className="border-slate-200 hover:bg-white/50 hover:border-slate-300 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createTaskMutation.isPending || !formData.title}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200/50 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {createTaskMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Task...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Left Column: Task Details & Category */}
            <div className="xl:col-span-2 space-y-8">

              {/* Task Category Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                <div className="bg-gradient-to-br from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 sm:p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg text-pink-600 dark:text-pink-400">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Category & Type</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setTaskCategory('normal');
                        setMarketingTemplate('');
                      }}
                      className={cn(
                        "group relative p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                        taskCategory === 'normal'
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 dark:border-indigo-400 shadow-md transform scale-[1.01]"
                          : "border-slate-200 hover:border-indigo-300 bg-white/50 dark:bg-slate-800/50 dark:border-slate-700"
                      )}
                    >
                      {taskCategory === 'normal' && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none" />}
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                          taskCategory === 'normal' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-200" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                        )}>
                          <Flag className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-lg text-slate-900 dark:text-slate-100">Standard Task</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Regular project activity</div>
                        </div>
                        {taskCategory === 'normal' && (
                          <div className="absolute top-4 right-4 w-3 h-3 bg-indigo-500 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800"></div>
                        )}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTaskCategory('marketing')}
                      className={cn(
                        "group relative p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                        taskCategory === 'marketing'
                          ? "border-fuchsia-500 bg-fuchsia-50/50 dark:bg-fuchsia-900/20 dark:border-fuchsia-400 shadow-md transform scale-[1.01]"
                          : "border-slate-200 hover:border-fuchsia-300 bg-white/50 dark:bg-slate-800/50 dark:border-slate-700"
                      )}
                    >
                      {taskCategory === 'marketing' && <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/5 to-pink-500/5 pointer-events-none" />}
                      <div className="flex items-center gap-4 relative z-10">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                          taskCategory === 'marketing' ? "bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-200" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                        )}>
                          <Video className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="font-bold text-lg text-slate-900 dark:text-slate-100">Marketing Content</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">Video & creative assets</div>
                        </div>
                        {taskCategory === 'marketing' && (
                          <div className="absolute top-4 right-4 w-3 h-3 bg-fuchsia-500 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-800"></div>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Marketing Template Selection */}
                  {taskCategory === 'marketing' && (
                    <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 block">
                        Video Template
                      </Label>
                      <Select value={marketingTemplate} onValueChange={setMarketingTemplate}>
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl focus:ring-fuchsia-500/20">
                          <SelectValue placeholder="Select a template..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="samarpan">🙏 Samarpan Videos</SelectItem>
                          <SelectItem value="egc">👥 EGC Videos (Employee Content)</SelectItem>
                          <SelectItem value="campaign">📢 Campaign Videos</SelectItem>
                          <SelectItem value="awareness">✨ Awareness Videos</SelectItem>
                        </SelectContent>
                      </Select>

                      {marketingTemplate && (
                        <div className="mt-4 p-4 bg-fuchsia-50/80 dark:bg-fuchsia-900/20 border border-fuchsia-100 dark:border-fuchsia-800 rounded-xl flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="p-2 bg-fuchsia-100 dark:bg-fuchsia-800 rounded-lg shrink-0">
                            <Sparkles className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-300" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-fuchsia-900 dark:text-fuchsia-300">Template Active</p>
                            <p className="text-xs text-fuchsia-700 dark:text-fuchsia-400 mt-0.5">
                              Auto-assigning to "Digital Marketing" group and setting up workflow.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Task Details Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="bg-gradient-to-b from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 sm:p-8 space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                      <Tag className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Task Information</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title <span className="text-red-500">*</span></Label>
                      <Input
                        id="title"
                        placeholder="Enter a descriptive title..."
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="text-lg bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-12 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Add details, acceptance criteria, or context..."
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={6}
                        className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none p-4"
                      />
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Attachments</Label>
                      <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-2 border border-slate-100 dark:border-slate-700">
                        <FileUpload
                          files={formData.attachments}
                          onFilesChange={(files) => setFormData(prev => ({ ...prev, attachments: files }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Task Suggestions */}
                  {formData.project_id && user?.role === 'admin' && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
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
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Settings & Assignment */}
            <div className="space-y-8">

              {/* Classification Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
                <div className="bg-gradient-to-b from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400">
                      <Flag className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Settings</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Project</Label>
                      <Select
                        value={formData.project_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value, group_id: '' }))}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                          <SelectValue placeholder="Select Project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(project => (
                            <SelectItem key={project.id || project._id} value={project.id || project._id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-full ring-2 ring-white/50 dark:ring-slate-800/50"
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
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Group</Label>
                      <Select
                        value={formData.assigned_group_id || "none"}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_group_id: value === "none" ? '' : value }))}
                      >
                        <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                          <SelectValue placeholder="No Group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Group</SelectItem>
                          {userGroups.map(group => (
                            <SelectItem key={group.id || group._id} value={group.id || group._id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</Label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                        >
                          <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="backlog">Backlog</SelectItem>
                            <SelectItem value="todo">To Do</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Priority</Label>
                        <Select
                          value={formData.priority}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                        >
                          <SelectTrigger className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</Label>
                      <StandardTagSelect
                        selectedTags={formData.tags}
                        onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignment Card */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-3xl p-1 shadow-2xl shadow-indigo-100/50 dark:shadow-none border border-white/50 dark:border-slate-800 ring-1 ring-white/50 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
                <div className="bg-gradient-to-b from-white/50 to-white/10 dark:from-slate-800/50 dark:to-slate-900/10 rounded-[1.4rem] p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Assignment</h2>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Assignees</Label>
                      <UserMultiSelect
                        users={users}
                        departments={departments}
                        selectedEmails={formData.assignees}
                        onChange={(newAssignees) => setFormData(prev => ({ ...prev, assignees: newAssignees }))}
                        placeholder="Select team members..."
                        className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-auto min-h-[44px] rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Start Date</Label>
                        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl",
                                !formData.start_date && "text-slate-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.start_date ? format(new Date(formData.start_date), 'PPP') : 'Select'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
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
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Due Date</Label>
                        <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl",
                                !formData.due_date && "text-slate-500"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {formData.due_date ? format(new Date(formData.due_date), 'PPP') : 'Select'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
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
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Est. Hours</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="0"
                          value={formData.estimated_hours}
                          onChange={(e) => setFormData(prev => ({ ...prev, estimated_hours: e.target.value }))}
                          className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Points</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formData.story_points}
                          onChange={(e) => setFormData(prev => ({ ...prev, story_points: e.target.value }))}
                          className="bg-white/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}