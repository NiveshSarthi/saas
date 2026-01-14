import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Upload, FileText, Film, Image as ImageIcon, Music,
  History, CheckCircle, AlertCircle, Send, User, Activity,
  Link as LinkIcon, Paperclip, X, Tag as TagIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { MarketingLogger } from '@/components/utils/marketingLogger';
import ActivityLog from './ActivityLog';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import MentionInput from '@/components/common/MentionInput';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  editing: { label: 'Editing', next: 'review', color: 'bg-slate-100 text-slate-700' },
  review: { label: 'Internal Review', next: 'compliance', reject: 'revision', color: 'bg-blue-100 text-blue-700' },
  revision: { label: 'Revision Required', next: 'review', color: 'bg-orange-100 text-orange-700' },
  compliance: { label: 'Compliance Review', next: 'approved', reject: 'compliance_revision', color: 'bg-purple-100 text-purple-700' },
  compliance_revision: { label: 'Legal Fix Required', next: 'compliance', color: 'bg-red-100 text-red-700' },
  approved: { label: 'Publishing Queue', next: 'published', color: 'bg-yellow-100 text-yellow-800' },
  published: { label: 'Analytics Tracking', next: 'tracking', color: 'bg-emerald-100 text-emerald-700' },
  tracking: { label: 'Analytics Tracking', next: 'closed', color: 'bg-cyan-100 text-cyan-700' },
  closed: { label: 'Completed', color: 'bg-slate-200 text-slate-800' },
  trash: { label: 'Trash', color: 'bg-gray-200 text-gray-800' }
};

const PLATFORMS = ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'Twitter'];

export default function MarketingTaskModal({ isOpen, onClose, task, user }) {
  const queryClient = useQueryClient();
  const isEdit = !!task;

  const [formData, setFormData] = useState({
    campaign_name: '',
    task_type: 'video',
    description: '',
    status: 'editing',
    platforms: [],
    tags: [],
    assignee_email: user?.email,
    reviewer_email: '',
    compliance_email: '',
    publisher_email: '',
    analytics_email: '',
    cameraman_email: '',
    version: 1,
    shoot_date: '',
    due_date: '',
    files: { video: '', thumbnail: '', script: '', license: '' },
    metrics: { views: 0, likes: 0, ctr: 0 }
  });

  const [comment, setComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const fileInputRef = React.useRef(null);
  const commentInputRef = React.useRef(null);

  // Fetch Users for assignment
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const { data: teamData } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });

  const usersFromEntity = teamData?.users || [];
  const invitations = teamData?.invitations || [];

  const users = [
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
        role: inv.role || 'user',
        active: true,
        status: 'active'
      }))
  ];

  // Memoize filtered users to ensure proper computation after both queries load
  const filteredUsers = React.useMemo(() => {
    console.log('=== FILTERING USERS ===');
    console.log('Total users:', users.length);
    console.log('Total departments:', departments.length);

    // Wait for departments to load
    if (departments.length === 0) {
      console.log('Departments not loaded yet, returning empty array');
      return [];
    }

    const targetDeptIds = departments
      .filter(d => d.name?.toLowerCase().includes('marketing') || d.name?.toLowerCase().includes('it'))
      .map(d => d.id);

    console.log('Target department IDs (Marketing + IT):', targetDeptIds);

    const filtered = users.filter(u => {
      // Always include teamsocialscrapers@gmail.com
      if (u.email === 'teamsocialscrapers@gmail.com') {
        console.log('✅ teamsocialscrapers@gmail.com included (exception)');
        return true;
      }

      // Filter out inactive/revoked users
      if (u.active === false || u.status === 'revoked' || u.status === 'inactive') {
        console.log('❌ User excluded (inactive):', u.email);
        return false;
      }

      // Always include admins
      if (u.role === 'admin') {
        console.log('✅ Admin included:', u.email);
        return true;
      }

      // Include users in marketing or IT departments
      if (u.department_id && targetDeptIds.includes(u.department_id)) {
        const dept = departments.find(d => d.id === u.department_id);
        console.log('✅ Member included:', u.email, 'dept:', dept?.name);
        return true;
      }

      console.log('❌ User excluded:', u.email, 'dept_id:', u.department_id);
      return false;
    });

    console.log('=== FILTER RESULT: ', filtered.length, 'users ===');
    return filtered;
  }, [users, departments]);

  // Get task-related users for mentions
  const taskRelatedUsers = [
    formData.assignee_email,
    formData.reviewer_email,
    formData.compliance_email,
    formData.publisher_email,
    formData.analytics_email
  ].filter(Boolean);

  const mentionableUsers = filteredUsers.filter(u =>
    taskRelatedUsers.includes(u.email) || u.role === 'admin'
  );

  // Fetch Comments
  const { data: comments = [] } = useQuery({
    queryKey: ['comments', task?.id],
    queryFn: () => task ? base44.entities.Comment.filter({ task_id: task.id }, '-created_date') : [],
    enabled: !!task
  });

  // Fetch Related Task
  const { data: relatedTask } = useQuery({
    queryKey: ['related-project-task', task?.related_task_id],
    queryFn: async () => {
      if (!task?.related_task_id) return null;
      const res = await base44.entities.Task.filter({ id: task.related_task_id });
      return res[0];
    },
    enabled: !!task?.related_task_id
  });

  // Fetch existing tags from all marketing tasks
  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-marketing-tasks-tags'],
    queryFn: () => base44.entities.MarketingTask.list('-created_date', 1000),
  });

  // Fetch Tag entity to check/create tags
  const { data: tagEntities = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list('name'),
  });

  const existingTags = React.useMemo(() => {
    const tagSet = new Set();
    allTasks.forEach(t => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet);
  }, [allTasks]);

  const filteredTagSuggestions = React.useMemo(() => {
    if (!tagInput.trim()) return [];
    return existingTags.filter(tag =>
      tag.toLowerCase().includes(tagInput.toLowerCase()) &&
      !formData.tags.includes(tag)
    );
  }, [tagInput, existingTags, formData.tags]);

  useEffect(() => {
    if (task) {
      // Handle both flattened and nested data structures
      const taskData = task.data || task;
      setFormData({
        ...taskData,
        platforms: taskData.platforms || [],
        tags: taskData.tags || [],
        files: taskData.files || { video: '', thumbnail: '', script: '', license: '' },
        metrics: taskData.metrics || { views: 0, likes: 0, ctr: 0 }
      });
    } else if (isOpen && !task) {
      // Reset form for new task creation
      setFormData({
        campaign_name: '',
        task_type: 'video',
        description: '',
        status: 'editing',
        platforms: [],
        tags: [],
        assignee_email: user?.email,
        reviewer_email: '',
        compliance_email: '',
        publisher_email: '',
        analytics_email: '',
        cameraman_email: '',
        version: 1,
        shoot_date: '',
        due_date: '',
        files: { video: '', thumbnail: '', script: '', license: '' },
        metrics: { views: 0, likes: 0, ctr: 0 }
      });
    }
  }, [task, isOpen, user]);

  const createMutation = useMutation({
    mutationFn: (data) => {
      // Ensure campaign_name is never empty
      const taskData = {
        ...data,
        campaign_name: data.campaign_name?.trim() || 'Untitled Campaign'
      };
      return base44.entities.MarketingTask.create(taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marketing-tasks']);
      toast.success('Task created successfully');
      onClose();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.MarketingTask.update(task.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['marketing-tasks']);
      toast.success('Task updated successfully');
      if (!comment) onClose(); // Keep open if commenting
    }
  });

  const commentMutation = useMutation({
    mutationFn: ({ content, attachments, mentions }) => base44.entities.Comment.create({
      task_id: task.id,
      content,
      author_email: user.email,
      mentions: mentions || [],
      attachments: attachments || []
    }),
    onSuccess: async (newComment, variables) => {
      queryClient.invalidateQueries(['comments', task.id]);

      // Send notifications to mentioned users
      const mentionedUsers = newComment.mentions || [];
      for (const mentionedEmail of mentionedUsers) {
        await base44.entities.Notification.create({
          user_email: mentionedEmail,
          type: 'mentioned',
          title: 'You were mentioned',
          message: `${user.full_name || user.email} mentioned you in Marketing Task: ${task.campaign_name}`,
          task_id: task.id,
          actor_email: user.email,
          link: `/marketing?taskId=${task.id}`
        });
      }

      // Log comment activity
      await MarketingLogger.log(task.id, 'commented', user, {
        newValue: variables.content,
        mentions: mentionedUsers
      });

      // Log attachment uploads
      if (variables.attachments && variables.attachments.length > 0) {
        await MarketingLogger.log(task.id, 'file_uploaded', user, {
          newValue: `${variables.attachments.length} file(s) attached`
        });
      }

      setComment('');
      setAttachments([]);
      toast.success('Comment added');
    }
  });

  const handleSave = async () => {
    if (isEdit) {
      // Calculate changes before mutating
      const changes = MarketingLogger.calculateChanges(task, formData, user);
      if (changes.length > 0) {
        await MarketingLogger.logChanges(task.id, changes, user);
      }
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
      // Create log will happen after ID is known ideally, but for create we can just rely on system default or handle in onSuccess if we had the ID return.
      // Simple creation doesn't need heavy logging in the modal context as the task doesn't exist yet.
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: Images, PDF, Docs');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Max 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const newAttachment = {
        name: file.name,
        url: file_url,
        type: file.type,
        size: file.size
      };

      setAttachments(prev => [...prev, newAttachment]);
      toast.success('File uploaded');
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (blob) {
          await handleFileUpload(blob);
        }
      }
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        await handleFileUpload(files[i]);
      }
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const extractMentions = (text) => {
    const mentionRegex = /@([\w\s]+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1].trim();
      const user = filteredUsers.find(u =>
        (u.full_name || u.email).toLowerCase() === mentionedName.toLowerCase()
      );
      if (user) {
        mentions.push(user.email);
      }
    }

    return [...new Set(mentions)];
  };

  const handleSendComment = async () => {
    if (!comment.trim() && attachments.length === 0) return;

    const mentions = extractMentions(comment);

    await commentMutation.mutateAsync({
      content: comment,
      attachments: attachments,
      mentions: mentions
    });
  };

  const handleRevisionRequest = (newStatus, actionType) => {
    setPendingStatusChange({ newStatus, actionType });
    setRevisionDialogOpen(true);
  };

  const confirmRevision = async () => {
    if (!revisionComment.trim()) {
      toast.error('Please add a comment explaining the revision');
      return;
    }

    const { newStatus, actionType } = pendingStatusChange;
    let updates = { ...formData, status: newStatus };

    // Version bump on revision
    if (newStatus.includes('revision') && !formData.status.includes('revision')) {
      updates.version = (formData.version || 1) + 1;
      toast.info(`Task returned for revision (Version bumped to V${updates.version})`);
    }

    // Log Status Change
    await MarketingLogger.log(task.id, 'status_changed', user, {
      field: 'status',
      oldValue: formData.status,
      newValue: newStatus
    });

    // Log Comment
    await commentMutation.mutateAsync({
      content: revisionComment,
      attachments: [],
      mentions: []
    });
    await MarketingLogger.log(task.id, 'commented', user, {
      newValue: revisionComment
    });

    // Update local state before mutation
    setFormData(updates);
    updateMutation.mutate(updates);

    // Reset and close
    setRevisionDialogOpen(false);
    setRevisionComment('');
    setPendingStatusChange(null);

    if (actionType !== 'update') {
      onClose();
    }
  };

  const handleStatusChange = async (newStatus, actionType = 'update') => {
    let updates = { ...formData, status: newStatus };

    // Log Status Change
    await MarketingLogger.log(task.id, 'status_changed', user, {
      field: 'status',
      oldValue: formData.status,
      newValue: newStatus
    });

    // Log Comment if present
    if (comment) {
      await commentMutation.mutateAsync({
        content: comment,
        attachments: [],
        mentions: extractMentions(comment)
      });
      await MarketingLogger.log(task.id, 'commented', user, {
        newValue: comment
      });
    }

    // Update local state before mutation
    setFormData(updates);
    updateMutation.mutate(updates);
    if (actionType !== 'update') {
      onClose();
    }
  };

  const handleFileChange = (type, url) => {
    setFormData(prev => ({
      ...prev,
      files: { ...prev.files, [type]: url }
    }));
  };

  // Permission Helpers - STRICT ROLE BASED LOCK
  const getActiveOwner = (currentStatus) => {
    switch (currentStatus) {
      case 'editing': return formData.assignee_email; // Editor
      case 'revision': return formData.assignee_email; // Editor
      case 'compliance_revision': return formData.assignee_email; // Editor
      case 'review': return formData.reviewer_email; // Lead
      case 'compliance': return formData.compliance_email; // Legal
      case 'approved': return formData.publisher_email; // Publisher
      case 'published': return formData.analytics_email; // Analyst
      case 'tracking': return formData.analytics_email; // Analyst
      default: return null;
    }
  };

  const activeOwner = getActiveOwner(formData.status);
  const isOwner = user.email === activeOwner;
  const isAdmin = user.role === 'admin';
  const isCreator = task && user.email === task.created_by;
  const canAction = isOwner || isAdmin || isCreator || !isEdit;

  // Render Actions based on Status & Role
  const renderActions = () => {
    // Allow task creation freely
    if (!isEdit) return <Button onClick={handleSave}>Create Task</Button>;

    const status = formData.status;

    // Read-Only View for non-owners
    if (!canAction) {
      return (
        <div className="flex items-center gap-2 text-sm text-slate-500 italic">
          <User className="w-4 h-4" />
          <span>Waiting for {activeOwner ? activeOwner.split('@')[0] : 'assignment'}...</span>
        </div>
      );
    }

    // Actions for Active Owner / Admin
    if (status === 'editing' || status === 'revision' || status === 'compliance_revision') {
      return (
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave}>Save Draft</Button>
          <Button onClick={() => handleStatusChange(status === 'compliance_revision' ? 'compliance' : 'review', 'submit')} className="bg-blue-600">
            Submit for {status === 'compliance_revision' ? 'Compliance' : 'Review'}
          </Button>
        </div>
      );
    }

    if (status === 'review') {
      return (
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => handleRevisionRequest('revision', 'reject')}>Request Revision</Button>
          <Button className="bg-green-600" onClick={() => handleStatusChange('compliance', 'approve')}>Approve & Send to Compliance</Button>
        </div>
      );
    }

    if (status === 'compliance') {
      return (
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => handleRevisionRequest('compliance_revision', 'reject')}>Reject (Legal)</Button>
          <Button className="bg-green-600" onClick={() => handleStatusChange('approved', 'approve')}>Approve (Legal)</Button>
        </div>
      );
    }

    if (status === 'approved') {
      return <Button className="bg-emerald-600" onClick={() => handleStatusChange('published', 'approve')}>Publish Content</Button>;
    }

    if (status === 'published') {
      return <Button variant="outline" onClick={() => handleStatusChange('tracking', 'update')}>Start Tracking</Button>;
    }

    if (status === 'tracking') {
      return <Button variant="default" onClick={() => handleStatusChange('closed', 'update')}>Close Campaign</Button>;
    }

    return <Button variant="outline" disabled>Completed</Button>;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 pb-4">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative z-10">
              <DialogTitle className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Film className="w-6 h-6 text-white" />
                </div>
                {isEdit ? (formData.campaign_name || 'Marketing Campaign') : 'New Marketing Campaign'}
              </DialogTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/95 backdrop-blur-sm shadow-lg">
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    formData.status === 'editing' && "bg-slate-500",
                    formData.status === 'review' && "bg-blue-500",
                    formData.status === 'revision' && "bg-orange-500",
                    formData.status === 'compliance' && "bg-purple-500",
                    formData.status === 'compliance_revision' && "bg-red-500",
                    formData.status === 'approved' && "bg-yellow-500",
                    formData.status === 'published' && "bg-emerald-500",
                    formData.status === 'tracking' && "bg-cyan-500",
                    formData.status === 'closed' && "bg-slate-400"
                  )}></div>
                  <span className="text-sm font-semibold text-slate-900">
                    {STATUS_CONFIG[formData.status]?.label || formData.status}
                  </span>
                </div>

                {isEdit && (
                  <div className="px-3 py-1.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30">
                    <span className="text-xs font-bold text-white">VERSION {formData.version}</span>
                  </div>
                )}

                {relatedTask && (
                  <Link
                    to={createPageUrl(`TaskDetail?id=${relatedTask.id || relatedTask._id}`)}
                    target="_blank"
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-xs font-medium text-white transition-all border border-white/30 hover:border-white/50"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    Parent: {relatedTask.title}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row" style={{ minHeight: 0 }}>
            {/* LEFT PANEL: FORM */}
            <ScrollArea className="flex-1 p-6 pt-4 bg-slate-50/50" style={{ height: '100%' }}>
              <div className="space-y-6">
                {/* Campaign Info Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <Film className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Campaign Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Campaign Name</Label>
                          <Input
                            value={formData.campaign_name}
                            onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                            placeholder="e.g. Summer Product Launch Campaign"
                            disabled={!canAction}
                            className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600">Content Type</Label>
                          <Select
                            value={formData.task_type}
                            onValueChange={(v) => setFormData({ ...formData, task_type: v })}
                            disabled={!canAction}
                          >
                            <SelectTrigger className="border-slate-300"><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="video">🎥 Video</SelectItem>
                              <SelectItem value="flyer">📄 Flyer</SelectItem>
                              <SelectItem value="poster">🖼️ Poster</SelectItem>
                              <SelectItem value="social_post">📱 Social Post</SelectItem>
                              <SelectItem value="article">📝 Article</SelectItem>
                              <SelectItem value="other">✨ Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {formData.task_type === 'video' && (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-600">Video Category</Label>
                            <Select
                              value={formData.video_subcategory || undefined}
                              onValueChange={(v) => {
                                const updatedData = { ...formData, video_subcategory: v };
                                setFormData(updatedData);
                                // Auto-save when video category changes
                                if (isEdit) {
                                  updateMutation.mutate({ video_subcategory: v });
                                }
                              }}
                              disabled={!canAction}
                            >
                              <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select video category" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="egc_videos">EGC Videos</SelectItem>
                                <SelectItem value="campaign_video">Campaign Video</SelectItem>
                                <SelectItem value="awareness_video">Awareness Video</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-slate-600">Level of Editing</Label>
                            <Select
                              value={formData.level_of_editing || undefined}
                              onValueChange={(v) => {
                                const updatedData = { ...formData, level_of_editing: v };
                                setFormData(updatedData);
                                if (isEdit) {
                                  updateMutation.mutate({ level_of_editing: v });
                                }
                              }}
                              disabled={!canAction}
                            >
                              <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select editing level" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="A+">A+ – Highest Level</SelectItem>
                                <SelectItem value="A">A – Mid-Level</SelectItem>
                                <SelectItem value="B">B – Basic Level</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">📅 Shoot Date</Label>
                        <Input
                          type="date"
                          value={formData.shoot_date || ''}
                          onChange={(e) => setFormData({ ...formData, shoot_date: e.target.value })}
                          disabled={!canAction}
                          className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">🎯 Due Date</Label>
                        <Input
                          type="date"
                          value={formData.due_date || ''}
                          onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                          disabled={!canAction}
                          className="border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Assignment Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Team & Workflow</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        ✏️ Assignee (Editor)
                      </Label>
                      <Select
                        value={formData.assignee_email}
                        onValueChange={(v) => setFormData({ ...formData, assignee_email: v })}
                        disabled={!canAction}
                      >
                        <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Editor" /></SelectTrigger>
                        <SelectContent>
                          {filteredUsers.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-slate-500">No marketing users found</div>
                          ) : (
                            filteredUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        👀 Reviewer (Lead)
                      </Label>
                      <Select
                        value={formData.reviewer_email}
                        onValueChange={(v) => setFormData({ ...formData, reviewer_email: v })}
                        disabled={!canAction}
                      >
                        <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Reviewer" /></SelectTrigger>
                        <SelectContent>
                          {filteredUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        ⚖️ Compliance (Legal)
                      </Label>
                      <Select
                        value={formData.compliance_email}
                        onValueChange={(v) => setFormData({ ...formData, compliance_email: v })}
                        disabled={!canAction}
                      >
                        <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Compliance" /></SelectTrigger>
                        <SelectContent>
                          {filteredUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        🚀 Publisher (Publishing)
                      </Label>
                      <Select
                        value={formData.publisher_email}
                        onValueChange={(v) => setFormData({ ...formData, publisher_email: v })}
                        disabled={!canAction}
                      >
                        <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Publisher" /></SelectTrigger>
                        <SelectContent>
                          {filteredUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        📊 Analytics (Performance)
                      </Label>
                      <Select
                        value={formData.analytics_email}
                        onValueChange={(v) => setFormData({ ...formData, analytics_email: v })}
                        disabled={!canAction}
                      >
                        <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Analyst" /></SelectTrigger>
                        <SelectContent>
                          {filteredUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        🎥 Camera Man
                      </Label>
                      <Select
                        value={formData.cameraman_email}
                        onValueChange={(v) => setFormData({ ...formData, cameraman_email: v })}
                        disabled={!canAction}
                      >
                        <SelectTrigger className="border-slate-300"><SelectValue placeholder="Select Camera Man" /></SelectTrigger>
                        <SelectContent>
                          {filteredUsers.map(u => <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Platforms Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Publishing Platforms</h3>
                  </div>
                  <div className={`flex flex-wrap gap-2.5 ${!canAction ? 'opacity-50' : ''}`}>
                    {PLATFORMS.map(p => {
                      const isSelected = formData.platforms.includes(p);
                      const platformEmojis = {
                        'YouTube': '🎥',
                        'Instagram': '📸',
                        'TikTok': '🎵',
                        'Facebook': '👥',
                        'LinkedIn': '💼',
                        'Twitter': '🐦'
                      };
                      return (
                        <button
                          key={p}
                          onClick={() => {
                            if (!canAction) return;
                            const newPlatforms = isSelected
                              ? formData.platforms.filter(plat => plat !== p)
                              : [...formData.platforms, p];
                            setFormData({ ...formData, platforms: newPlatforms });
                          }}
                          disabled={!canAction}
                          className={cn(
                            "px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200",
                            "border-2 flex items-center gap-2",
                            isSelected
                              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent shadow-lg shadow-indigo-200 scale-105"
                              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:shadow-md",
                            !canAction && "cursor-not-allowed"
                          )}
                        >
                          <span>{platformEmojis[p]}</span>
                          <span>{p}</span>
                          {isSelected && <CheckCircle className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tags Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <TagIcon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Campaign Tags</h3>
                  </div>

                  {/* Selected Tags */}
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {formData.tags.map((tag, idx) => (
                        <Badge key={idx} className="bg-emerald-100 text-emerald-700 border-emerald-200 px-3 py-1 text-sm flex items-center gap-1.5">
                          {tag}
                          {canAction && (
                            <button
                              onClick={() => {
                                const newTags = formData.tags.filter((_, i) => i !== idx);
                                setFormData({ ...formData, tags: newTags });
                              }}
                              className="hover:text-red-600 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Tag Input */}
                  {canAction && (
                    <div className="relative">
                      <Input
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value);
                          setShowTagSuggestions(true);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && tagInput.trim()) {
                            e.preventDefault();
                            const newTag = tagInput.trim();
                            if (!formData.tags.includes(newTag)) {
                              // Add to Tag entity if it doesn't exist
                              const tagExists = tagEntities.some(t => t.name.toLowerCase() === newTag.toLowerCase());
                              if (!tagExists) {
                                try {
                                  await base44.entities.Tag.create({
                                    name: newTag,
                                    color: '#10B981' // Emerald for marketing
                                  });
                                } catch (error) {
                                  // Ignore duplicate errors
                                }
                              }
                              setFormData({ ...formData, tags: [...formData.tags, newTag] });
                            }
                            setTagInput('');
                            setShowTagSuggestions(false);
                          }
                        }}
                        placeholder="Type tag and press Enter..."
                        className="border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />

                      {/* Tag Suggestions */}
                      {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {filteredTagSuggestions.map((tag, idx) => (
                            <button
                              key={idx}
                              onClick={async () => {
                                if (!formData.tags.includes(tag)) {
                                  // Add to Tag entity if it doesn't exist
                                  const tagExists = tagEntities.some(t => t.name.toLowerCase() === tag.toLowerCase());
                                  if (!tagExists) {
                                    try {
                                      await base44.entities.Tag.create({
                                        name: tag,
                                        color: '#10B981'
                                      });
                                    } catch (error) {
                                      // Ignore duplicate errors
                                    }
                                  }
                                  setFormData({ ...formData, tags: [...formData.tags, tag] });
                                }
                                setTagInput('');
                                setShowTagSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors text-sm flex items-center gap-2"
                            >
                              <TagIcon className="w-3 h-3 text-emerald-600" />
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Project Assets Card */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-5 border-2 border-dashed border-slate-300">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Project Assets</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="group relative bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-indigo-300 transition-all hover:shadow-md">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-100 to-pink-100 flex items-center justify-center">
                          <Film className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-900">
                            {formData.task_type === 'video' ? 'Video File' : 'Main Asset'}
                          </p>
                          <p className="text-[10px] text-slate-500">Primary content</p>
                        </div>
                      </div>
                      <Input
                        placeholder={formData.task_type === 'video' ? 'Paste video URL or ID' : 'Main file URL'}
                        value={formData.files.video || ''}
                        onChange={(e) => handleFileChange('video', e.target.value)}
                        disabled={!canAction}
                        className="text-sm border-slate-300"
                      />
                    </div>

                    <div className="group relative bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-indigo-300 transition-all hover:shadow-md">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-900">
                            {formData.task_type === 'video' ? 'Thumbnail' : 'Preview'}
                          </p>
                          <p className="text-[10px] text-slate-500">Visual preview</p>
                        </div>
                      </div>
                      <Input
                        placeholder="Image URL"
                        value={formData.files.thumbnail || ''}
                        onChange={(e) => handleFileChange('thumbnail', e.target.value)}
                        disabled={!canAction}
                        className="text-sm border-slate-300"
                      />
                    </div>

                    <div className="group relative bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-indigo-300 transition-all hover:shadow-md">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-900">
                            {formData.task_type === 'video' ? 'Script' : 'Content'}
                          </p>
                          <p className="text-[10px] text-slate-500">Text content</p>
                        </div>
                      </div>
                      <Input
                        placeholder="Doc URL"
                        value={formData.files.script || ''}
                        onChange={(e) => handleFileChange('script', e.target.value)}
                        disabled={!canAction}
                        className="text-sm border-slate-300"
                      />
                    </div>

                    <div className="group relative bg-white rounded-xl p-4 border-2 border-slate-200 hover:border-indigo-300 transition-all hover:shadow-md">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                          <Music className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-900">
                            {formData.task_type === 'video' ? 'License' : 'Raw Assets'}
                          </p>
                          <p className="text-[10px] text-slate-500">Additional files</p>
                        </div>
                      </div>
                      <Input
                        placeholder="Assets URL"
                        value={formData.files.license || ''}
                        onChange={(e) => handleFileChange('license', e.target.value)}
                        disabled={!canAction}
                        className="text-sm border-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {formData.status === 'tracking' && (
                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 shadow-xl border border-cyan-400">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="font-semibold text-white">Performance Analytics</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <Label className="text-xs text-white/80 mb-2 block">👁️ Views</Label>
                        <Input
                          type="number"
                          value={formData.metrics.views}
                          onChange={(e) => setFormData({ ...formData, metrics: { ...formData.metrics, views: parseInt(e.target.value) } })}
                          disabled={!canAction}
                          className="bg-white/95 border-white/30 text-slate-900 font-semibold"
                        />
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <Label className="text-xs text-white/80 mb-2 block">❤️ Likes</Label>
                        <Input
                          type="number"
                          value={formData.metrics.likes}
                          onChange={(e) => setFormData({ ...formData, metrics: { ...formData.metrics, likes: parseInt(e.target.value) } })}
                          disabled={!canAction}
                          className="bg-white/95 border-white/30 text-slate-900 font-semibold"
                        />
                      </div>
                      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                        <Label className="text-xs text-white/80 mb-2 block">📊 CTR (%)</Label>
                        <Input
                          type="number"
                          value={formData.metrics.ctr}
                          onChange={(e) => setFormData({ ...formData, metrics: { ...formData.metrics, ctr: parseFloat(e.target.value) } })}
                          disabled={!canAction}
                          className="bg-white/95 border-white/30 text-slate-900 font-semibold"
                        />
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </ScrollArea>

            {/* RIGHT PANEL: COMMENTS & HISTORY */}
            <div className="w-full md:w-[350px] border-l flex flex-col bg-slate-50/50">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full rounded-none border-b bg-transparent p-0 h-10">
                  <TabsTrigger value="details" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent">Description</TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent">Discussion</TabsTrigger>
                  <TabsTrigger value="activity" className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent">Activity Log</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="flex-1 p-0 !mt-0 data-[state=active]:flex" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                  <style>{`
                      .marketing-details-tab .quill {
                        display: flex;
                        flex-direction: column;
                        height: 100%;
                        width: 100%;
                      }
                      .marketing-details-tab .ql-toolbar {
                        flex-shrink: 0;
                        border-top: none;
                        border-left: none;
                        border-right: none;
                        border-bottom: 1px solid #e2e8f0;
                        background: white;
                      }
                      .marketing-details-tab .ql-container {
                        flex: 1;
                        overflow-y: auto;
                        font-size: 14px;
                        border: none;
                        background: white;
                      }
                      .marketing-details-tab .ql-editor {
                        padding: 16px;
                        cursor: text;
                        min-height: 100%;
                      }
                      .marketing-details-tab .ql-toolbar button svg,
                      .marketing-details-tab .ql-toolbar span svg {
                         width: 18px;
                         height: 18px;
                      }
                    `}</style>
                  <div className="marketing-details-tab" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
                    <ReactQuill
                      theme="snow"
                      value={formData.description}
                      onChange={(content) => setFormData({ ...formData, description: content })}
                      style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}
                      readOnly={!canAction}
                      modules={{
                        toolbar: canAction ? [
                          [{ 'header': [1, 2, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                          ['link', 'clean']
                        ] : false,
                      }}
                      placeholder={canAction ? "Write campaign brief, script, and details..." : "No description provided."}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="comments" className="flex-1 flex flex-col !mt-0 p-0 h-full overflow-hidden data-[state=active]:flex bg-gradient-to-b from-slate-50 to-white">
                  <ScrollArea className="flex-1 p-5">
                    <div className="space-y-6 max-w-2xl">
                      {comments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
                            <Send className="w-8 h-8 text-indigo-500" />
                          </div>
                          <p className="text-slate-500 font-medium mb-1">No comments yet</p>
                          <p className="text-xs text-slate-400">Start the conversation</p>
                        </div>
                      ) : (
                        comments.map((c, idx) => {
                          const isCurrentUser = c.author_email === user?.email;
                          const authorUser = users.find(u => u.email === c.author_email);
                          const authorName = authorUser?.full_name || c.author_email?.split('@')[0] || 'Unknown';
                          const authorInitials = authorName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

                          return (
                            <div key={c.id} className={cn("flex gap-3", isCurrentUser && "flex-row-reverse")}>
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 shadow-sm",
                                isCurrentUser
                                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                                  : "bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700"
                              )}>
                                {authorInitials}
                              </div>
                              <div className={cn("space-y-1.5 flex-1 min-w-0 max-w-[85%]", isCurrentUser && "items-end")}>
                                <div className={cn(
                                  "rounded-2xl px-4 py-3 shadow-sm",
                                  isCurrentUser
                                    ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-tr-sm"
                                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                                )}>
                                  {/* Author name for non-current user */}
                                  {!isCurrentUser && (
                                    <p className="text-xs font-semibold text-indigo-600 mb-1.5">
                                      {authorName}
                                    </p>
                                  )}

                                  {/* Message content */}
                                  <div className={cn(
                                    "text-sm leading-relaxed whitespace-pre-wrap break-words",
                                    isCurrentUser ? "text-white" : "text-slate-700"
                                  )}>
                                    {c.content}
                                  </div>

                                  {/* Mentions */}
                                  {c.mentions && c.mentions.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {c.mentions.map(email => {
                                        const mentionedUser = users.find(u => u.email === email);
                                        return (
                                          <span
                                            key={email}
                                            className={cn(
                                              "text-xs px-2 py-0.5 rounded-full font-medium",
                                              isCurrentUser
                                                ? "bg-white/20 text-white"
                                                : "bg-indigo-50 text-indigo-700"
                                            )}
                                          >
                                            @{mentionedUser?.full_name || email.split('@')[0]}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  {c.attachments && c.attachments.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      {c.attachments.map((att, idx) => (
                                        <a
                                          key={idx}
                                          href={att.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={cn(
                                            "flex items-center gap-2.5 p-2.5 rounded-lg transition-all group",
                                            isCurrentUser
                                              ? "bg-white/15 hover:bg-white/25"
                                              : "bg-slate-50 hover:bg-slate-100 border border-slate-200"
                                          )}
                                        >
                                          {att.type?.startsWith('image/') ? (
                                            <div className="flex-1 min-w-0">
                                              <img
                                                src={att.url}
                                                alt={att.name}
                                                className="max-w-full h-auto rounded-lg max-h-56 object-contain shadow-sm"
                                              />
                                              <p className={cn(
                                                "text-xs mt-2 truncate",
                                                isCurrentUser ? "text-white/80" : "text-slate-600"
                                              )}>
                                                {att.name}
                                              </p>
                                            </div>
                                          ) : (
                                            <>
                                              <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                isCurrentUser ? "bg-white/20" : "bg-indigo-50"
                                              )}>
                                                <FileText className={cn(
                                                  "w-5 h-5",
                                                  isCurrentUser ? "text-white" : "text-indigo-500"
                                                )} />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                  "text-sm font-medium truncate",
                                                  isCurrentUser ? "text-white" : "text-slate-700"
                                                )}>
                                                  {att.name}
                                                </p>
                                                <p className={cn(
                                                  "text-xs",
                                                  isCurrentUser ? "text-white/70" : "text-slate-400"
                                                )}>
                                                  {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'File'}
                                                </p>
                                              </div>
                                              <Upload className={cn(
                                                "w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity",
                                                isCurrentUser ? "text-white/70" : "text-slate-400"
                                              )} />
                                            </>
                                          )}
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Timestamp */}
                                <div className={cn(
                                  "text-[11px] text-slate-400 px-2 flex items-center gap-1.5",
                                  isCurrentUser && "justify-end"
                                )}>
                                  <span>{format(new Date(c.created_date), 'MMM d, h:mm a')}</span>
                                  {isCurrentUser && (
                                    <span className="inline-flex items-center">
                                      <CheckCircle className="w-3 h-3 text-indigo-400" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  <div
                    className="p-4 border-t bg-white shadow-lg"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {/* Attachments Preview */}
                    {attachments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        {attachments.map((att, idx) => (
                          <div key={idx} className="relative group">
                            {att.type?.startsWith('image/') ? (
                              <div className="relative">
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="w-20 h-20 object-cover rounded-lg border-2 border-white shadow-sm"
                                />
                                <button
                                  onClick={() => removeAttachment(idx)}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg text-sm border border-slate-200 shadow-sm group-hover:shadow transition-shadow">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span className="max-w-[100px] truncate text-slate-700">{att.name}</span>
                                <button
                                  onClick={() => removeAttachment(idx)}
                                  className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <div className="relative">
                          <MentionInput
                            value={comment}
                            onChange={setComment}
                            users={mentionableUsers}
                            placeholder="Type @ to mention, paste screenshots, or drag files..."
                            className="min-h-[60px] pr-24 border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 rounded-xl"
                            onPaste={handlePaste}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept="image/*,.pdf,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files) {
                              Array.from(e.target.files).forEach(handleFileUpload);
                            }
                          }}
                          className="hidden"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile}
                          className="h-10 w-10 rounded-xl border-slate-300 hover:bg-slate-50"
                        >
                          <Paperclip className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          size="icon"
                          onClick={handleSendComment}
                          disabled={(!comment.trim() && attachments.length === 0) || uploadingFile}
                          className="h-10 w-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 shadow-md"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
                      <span>💡</span>
                      <span>Paste screenshots (Ctrl+V), drag files, or click</span>
                      <Paperclip className="w-3 h-3 inline" />
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="flex-1 !mt-0 p-0 h-full overflow-hidden flex flex-col data-[state=active]:flex">
                  {task && <ActivityLog taskId={task.id} user={user} />}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter className="p-5 border-t bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex justify-between w-full items-center">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <History className="w-3.5 h-3.5" />
                <span>{isEdit ? `Last updated ${format(new Date(task.updated_date), 'MMM d')}` : 'New Draft'}</span>
              </div>
              <div className="flex gap-2">
                {renderActions()}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revision Request Dialog */}
      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
            <DialogDescription>
              Please explain what needs to be revised. This comment will be visible to the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Revision Comment *</Label>
              <textarea
                className="w-full min-h-[120px] px-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe what needs to be changed..."
                value={revisionComment}
                onChange={(e) => setRevisionComment(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRevisionDialogOpen(false);
              setRevisionComment('');
              setPendingStatusChange(null);
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRevision}
              disabled={!revisionComment.trim()}
            >
              Send for Revision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}