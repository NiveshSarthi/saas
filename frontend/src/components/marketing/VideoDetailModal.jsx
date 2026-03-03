import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { sendAssignmentNotification, processMentionsAndNotify, MODULES } from '@/components/utils/notificationService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MentionInput from '@/components/common/MentionInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import {
    Video,
    FileText,
    MessageSquare,
    History,
    Save,
    Plus,
    ExternalLink,
    Trash2,
    Send,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function VideoDetailModal({
    isOpen,
    onClose,
    video,
    categories = [],
    users = [],
    departments = [],
    currentUser,
    isAdmin,
    onRefetch
}) {
    const marketingDept = (departments || []).find(d => d.name.toLowerCase() === 'marketing');
    const marketingDeptId = marketingDept?.id || marketingDept?._id;

    const roleFilteredUsers = useMemo(() => {
        return {
            assigned_director: marketingDeptId ? users.filter(u => u.department_id === marketingDeptId) : users,
            assigned_cameraman: users.filter(u => u.job_title?.toLowerCase() === 'cameraman'),
            assigned_editor: users.filter(u => u.job_title?.toLowerCase() === 'editor'),
            assigned_manager: marketingDeptId ? users.filter(u => u.department_id === marketingDeptId) : users,
        };
    }, [users, marketingDeptId]);

    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('details');
    const [formData, setFormData] = useState({});
    const [newRevisionUrl, setNewRevisionUrl] = useState('');
    const [newComment, setNewComment] = useState('');

    // Initialize form data
    useEffect(() => {
        if (video) {
            setFormData({
                title: video.title || '',
                description: video.description || '',
                category_id: video.category_id || '',
                editing_level: video.editing_level || 'B',
                raw_file_url: video.raw_file_url || '',
                editing_url: video.editing_url || '',
                final_video_url: video.final_video_url || '',
                assigned_director: video.assigned_director || '',
                assigned_cameraman: video.assigned_cameraman || '',
                assigned_editor: video.assigned_editor || '',
                assigned_manager: video.assigned_manager || ''
            });
        }
    }, [video]);

    // Fetch comments
    const { data: comments = [] } = useQuery({
        queryKey: ['video-comments', video?.id || video?._id],
        queryFn: () => base44.entities.VideoComment.filter(
            { video_id: video?.id || video?._id },
            '-created_at',
            100
        ),
        enabled: !!video && activeTab === 'comments'
    });

    // Fetch activity logs
    const { data: activityLogs = [] } = useQuery({
        queryKey: ['video-logs', video?.id || video?._id],
        queryFn: () => base44.entities.VideoLog.filter(
            { video_id: video?.id || video?._id },
            '-created_at',
            100
        ),
        enabled: !!video && activeTab === 'activity'
    });

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async (data) => {
            // detailed checking for assignment changes
            const roles = [
                { key: 'assigned_director', label: 'Director' },
                { key: 'assigned_cameraman', label: 'Cameraman' },
                { key: 'assigned_editor', label: 'Editor' },
                { key: 'assigned_manager', label: 'Manager' }
            ];

            for (const role of roles) {
                if (data[role.key] && data[role.key] !== video[role.key]) {
                    try {
                        await sendAssignmentNotification({
                            assignedTo: data[role.key],
                            assignedBy: currentUser?.email,
                            assignedByName: currentUser?.full_name || currentUser?.email,
                            module: MODULES.MARKETING_TASK,
                            itemName: data.title || video.title,
                            itemId: video.id || video._id,
                            description: `Role: ${role.label}`,
                            link: `/Marketing?video=${video.id || video._id}`,
                            metadata: {}
                        });
                    } catch (e) {
                        console.error('Failed to send notification for role update', e);
                    }
                }
            }

            return base44.entities.Video.update(video.id || video._id, {
                ...data,
                updated_at: new Date()
            });
        },
        onSuccess: async () => {
            // Log activity
            await base44.entities.VideoLog.create({
                video_id: video.id || video._id,
                action: 'field_updated',
                user_email: currentUser?.email,
                user_name: currentUser?.full_name || currentUser?.email,
                details: { message: 'Video details updated' }
            });
            toast.success('Video updated successfully');
            onRefetch?.();
        },
        onError: () => toast.error('Failed to update video')
    });

    // Add revision URL mutation
    const addRevisionMutation = useMutation({
        mutationFn: async (url) => {
            const currentRevisions = video.revision_urls || [];
            const newRevisionNumber = currentRevisions.length + 1;
            return base44.entities.Video.update(video.id || video._id, {
                revision_urls: [
                    ...currentRevisions,
                    { url, revision_number: newRevisionNumber, added_at: new Date(), added_by: currentUser?.email }
                ],
                updated_at: new Date()
            });
        },
        onSuccess: async () => {
            await base44.entities.VideoLog.create({
                video_id: video.id || video._id,
                action: 'revision_added',
                user_email: currentUser?.email,
                user_name: currentUser?.full_name || currentUser?.email,
                details: { revision_number: (video.revision_urls?.length || 0) + 1 }
            });
            toast.success('Revision URL added');
            setNewRevisionUrl('');
            onRefetch?.();
        },
        onError: () => toast.error('Failed to add revision URL')
    });

    // Add comment mutation
    const addCommentMutation = useMutation({
        mutationFn: async (content) => {
            const result = await base44.entities.VideoComment.create({
                video_id: video.id || video._id,
                user_email: currentUser?.email,
                user_name: currentUser?.full_name || currentUser?.email,
                content,
                mentions: [] // Extraction handled by helper below
            });

            // Process mentions and send notifications
            await processMentionsAndNotify({
                text: content,
                mentionedBy: currentUser?.email,
                mentionedByName: currentUser?.full_name || currentUser?.email,
                module: MODULES.MARKETING_TASK,
                itemName: video.title,
                itemId: video.id || video._id,
                link: `/Marketing?video=${video.id || video._id}`,
                allUsers: users
            });

            return result;
        },
        onSuccess: async () => {
            await base44.entities.VideoLog.create({
                video_id: video.id || video._id,
                action: 'comment_added',
                user_email: currentUser?.email,
                user_name: currentUser?.full_name || currentUser?.email,
                details: {}
            });
            queryClient.invalidateQueries({ queryKey: ['video-comments', video?.id || video?._id] });
            setNewComment('');
        },
        onError: () => toast.error('Failed to add comment')
    });

    // Delete video mutation (Admin only)
    const deleteMutation = useMutation({
        mutationFn: async () => {
            return base44.entities.Video.update(video.id || video._id, {
                is_deleted: true,
                deleted_by: currentUser?.email,
                deleted_at: new Date()
            });
        },
        onSuccess: () => {
            toast.success('Video deleted');
            onRefetch?.();
            onClose();
        },
        onError: () => toast.error('Failed to delete video')
    });

    const handleSave = () => {
        saveMutation.mutate(formData);
    };

    const handleAddRevision = (e) => {
        e.preventDefault();
        if (!newRevisionUrl.trim()) return;
        addRevisionMutation.mutate(newRevisionUrl);
    };

    const handleAddComment = (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        addCommentMutation.mutate(newComment);
    };

    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    const getUserName = (email) => {
        const user = users.find(u => u.email === email);
        return user?.full_name || email?.split('@')[0] || 'Unknown';
    };

    const getActivityIcon = (action) => {
        switch (action) {
            case 'created': return '🎬';
            case 'status_changed': return '📋';
            case 'field_updated': return '✏️';
            case 'comment_added': return '💬';
            case 'revision_added': return '🔄';
            default: return '📌';
        }
    };

    const getActivityDescription = (log) => {
        switch (log.action) {
            case 'created':
                return 'created this video';
            case 'status_changed':
                return `moved from ${log.details?.from} to ${log.details?.to}`;
            case 'field_updated':
                return log.details?.message || 'updated video details';
            case 'comment_added':
                return 'added a comment';
            case 'revision_added':
                return `added revision #${log.details?.revision_number}`;
            default:
                return log.action;
        }
    };

    if (!video) return null;

    const category = categories.find(c => (c.id || c._id) === video.category_id);

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="border-b pb-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: category?.color || '#6366F1' }}
                            >
                                <Video className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg">{video.title}</DialogTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline">{video.status}</Badge>
                                    <Badge className={`text-xs ${video.editing_level === 'A+' ? 'bg-purple-100 text-purple-700' :
                                        video.editing_level === 'A' ? 'bg-blue-100 text-blue-700' :
                                            'bg-slate-100 text-slate-700'
                                        }`} variant="outline">
                                        {video.editing_level}
                                    </Badge>
                                    {category && (
                                        <Badge style={{ backgroundColor: `${category.color}20`, color: category.color }} variant="outline">
                                            {category.name}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="border-b w-full justify-start rounded-none bg-transparent p-0">
                        <TabsTrigger
                            value="details"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none"
                        >
                            <FileText className="w-4 h-4 mr-1" />
                            Details
                        </TabsTrigger>
                        <TabsTrigger
                            value="comments"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none"
                        >
                            <MessageSquare className="w-4 h-4 mr-1" />
                            Comments ({comments.length})
                        </TabsTrigger>
                        <TabsTrigger
                            value="activity"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none"
                        >
                            <History className="w-4 h-4 mr-1" />
                            Activity
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                        {/* Details Tab */}
                        <TabsContent value="details" className="mt-0 h-full flex-1 flex flex-col min-h-0 data-[state=active]:flex">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0 touch-pan-y">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Title</Label>
                                            <Input
                                                value={formData.title || ''}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Category</Label>
                                            <Select
                                                value={formData.category_id || ''}
                                                onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(cat => (
                                                        <SelectItem key={cat.id || cat._id} value={cat.id || cat._id}>
                                                            {cat.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Description</Label>
                                        <Textarea
                                            rows={3}
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Editing Level</Label>
                                            <Select
                                                value={formData.editing_level || 'B'}
                                                onValueChange={(v) => setFormData({ ...formData, editing_level: v })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="B">B - Basic</SelectItem>
                                                    <SelectItem value="A">A - Medium</SelectItem>
                                                    <SelectItem value="A+">A+ - Highest</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* URLs Section */}
                                    <div className="space-y-3 pt-4 border-t">
                                        <h4 className="font-medium text-sm">Video URLs</h4>

                                        <div className="space-y-2">
                                            <Label>Raw File URL</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={formData.raw_file_url || ''}
                                                    onChange={(e) => setFormData({ ...formData, raw_file_url: e.target.value })}
                                                    className="flex-1"
                                                />
                                                {formData.raw_file_url && (
                                                    <Button variant="outline" size="icon" asChild>
                                                        <a href={formData.raw_file_url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Editing URL</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={formData.editing_url || ''}
                                                    onChange={(e) => setFormData({ ...formData, editing_url: e.target.value })}
                                                    className="flex-1"
                                                />
                                                {formData.editing_url && (
                                                    <Button variant="outline" size="icon" asChild>
                                                        <a href={formData.editing_url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Revision URLs */}
                                        <div className="space-y-2">
                                            <Label>Revision URLs</Label>
                                            {video.revision_urls?.length > 0 && (
                                                <div className="space-y-1 mb-2">
                                                    {video.revision_urls.map((rev, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded">
                                                            <Badge variant="outline" className="text-xs">Rev {rev.revision_number}</Badge>
                                                            <a
                                                                href={rev.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline truncate flex-1"
                                                            >
                                                                {rev.url}
                                                            </a>
                                                            <span className="text-xs text-slate-400">
                                                                by {getUserName(rev.added_by)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <Input
                                                    type="url"
                                                    placeholder="Add new revision URL..."
                                                    value={newRevisionUrl}
                                                    onChange={(e) => setNewRevisionUrl(e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Button type="button" size="icon" onClick={handleAddRevision} disabled={addRevisionMutation.isPending}>
                                                    <Plus className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Final Video URL</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={formData.final_video_url || ''}
                                                    onChange={(e) => setFormData({ ...formData, final_video_url: e.target.value })}
                                                    className="flex-1"
                                                />
                                                {formData.final_video_url && (
                                                    <Button variant="outline" size="icon" asChild>
                                                        <a href={formData.final_video_url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Team Assignment */}
                                    <div className="space-y-3 pt-4 border-t">
                                        <h4 className="font-medium text-sm">Team Assignment</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {[
                                                { key: 'assigned_director', label: 'Director' },
                                                { key: 'assigned_cameraman', label: 'Cameraman' },
                                                { key: 'assigned_editor', label: 'Editor' },
                                                { key: 'assigned_manager', label: 'Manager' }
                                            ].map(({ key, label }) => (
                                                <div key={key} className="space-y-2">
                                                    <Label>{label}</Label>
                                                    <Select
                                                        value={formData[key] || ''}
                                                        onValueChange={(v) => setFormData({ ...formData, [key]: v })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {(roleFilteredUsers[key] || users).map(user => (
                                                                <SelectItem key={user.email} value={user.email}>
                                                                    {user.full_name || user.email}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-4 border-t">
                                        <div>
                                            {isAdmin && video.status === 'trash' && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => deleteMutation.mutate()}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-1" />
                                                    {deleteMutation.isPending ? 'Deleting...' : 'Permanently Delete'}
                                                </Button>
                                            )}
                                        </div>
                                        <Button
                                            onClick={handleSave}
                                            disabled={saveMutation.isPending}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                        >
                                            <Save className="w-4 h-4 mr-1" />
                                            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Comments Tab */}
                        <TabsContent value="comments" className="mt-0 h-full flex-1 flex flex-col min-h-0 data-[state=active]:flex">
                            <div className="flex flex-col flex-1 space-y-4 p-4 min-h-0 overflow-hidden">
                                {/* Revision URLs (Shared with Details) */}
                                <div className="space-y-3 pb-4 border-b">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm flex items-center gap-2">
                                            <History className="w-4 h-4 text-indigo-500" />
                                            Revision URLs
                                        </h4>
                                        <Badge variant="secondary" className="text-[10px] uppercase">Track Progress</Badge>
                                    </div>

                                    {video.revision_urls?.length > 0 && (
                                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                                            {video.revision_urls.map((rev, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-sm bg-slate-50 p-2 rounded border border-slate-200 shadow-sm transition-all hover:bg-slate-100">
                                                    <Badge variant="outline" className="text-xs bg-white">Rev {rev.revision_number}</Badge>
                                                    <a
                                                        href={rev.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline truncate flex-1 font-medium"
                                                    >
                                                        {rev.url}
                                                    </a>
                                                    <span className="text-[10px] text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded">
                                                        {getUserName(rev.added_by)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <Input
                                            type="url"
                                            placeholder="Paste new revision URL..."
                                            value={newRevisionUrl}
                                            onChange={(e) => setNewRevisionUrl(e.target.value)}
                                            className="flex-1 h-9 text-sm"
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleAddRevision}
                                            disabled={addRevisionMutation.isPending || !newRevisionUrl.trim()}
                                            className="h-9 px-3"
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Add
                                        </Button>
                                    </div>
                                </div>

                                {/* Comment Input */}
                                <div className="relative shrink-0">
                                    <form onSubmit={handleAddComment} className="flex gap-2 items-start">
                                        <div className="flex-1">
                                            <MentionInput
                                                value={newComment}
                                                onChange={setNewComment}
                                                users={users}
                                                placeholder="Add a comment... Use @ to mention team members"
                                                className="min-h-[80px]"
                                            />
                                        </div>
                                        <Button type="submit" disabled={addCommentMutation.isPending || !newComment.trim()} className="mt-1">
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </form>
                                </div>

                                {/* Comments List */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar -mx-4 px-4 pb-4 touch-pan-y">
                                    <div className="space-y-3">
                                        {comments.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400">
                                                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                <p>No comments yet</p>
                                            </div>
                                        ) : (
                                            comments.map(comment => (
                                                <div key={comment.id || comment._id} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                                                    <Avatar className="w-8 h-8">
                                                        <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                                                            {getInitials(comment.user_name)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-medium text-sm">{comment.user_name}</span>
                                                            <span className="text-xs text-slate-400">
                                                                {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                            {comment.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="activity" className="h-full flex-1 overflow-hidden m-0 flex flex-col min-h-0 data-[state=active]:flex">
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0 touch-pan-y">
                                <div className="space-y-3 pb-6">
                                    {activityLogs.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p>No activity logged yet</p>
                                        </div>
                                    ) : (
                                        activityLogs.map(log => (
                                            <div key={log.id || log._id} className="flex gap-3 p-3 border-l-2 border-indigo-200 bg-slate-50/50">
                                                <div className="text-lg">{getActivityIcon(log.action)}</div>
                                                <div className="flex-1">
                                                    <p className="text-sm">
                                                        <span className="font-medium">{log.user_name || log.user_email}</span>
                                                        {' '}{getActivityDescription(log)}
                                                    </p>
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                                        <Clock className="w-3 h-3" />
                                                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
