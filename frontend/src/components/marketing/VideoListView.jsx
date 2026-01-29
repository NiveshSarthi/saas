import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, ArrowUpDown, Eye, Trash2, CheckSquare, Square } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

// Status labels with colors
const STATUS_CONFIG = {
    shoot: { label: 'Shoot', color: 'bg-amber-100 text-amber-700' },
    editing: { label: 'Editing', color: 'bg-blue-100 text-blue-700' },
    review: { label: 'Review', color: 'bg-purple-100 text-purple-700' },
    revision: { label: 'Revision', color: 'bg-orange-100 text-orange-700' },
    approval: { label: 'Approval', color: 'bg-yellow-100 text-yellow-700' },
    posting: { label: 'Posting', color: 'bg-cyan-100 text-cyan-700' },
    posted: { label: 'Posted', color: 'bg-emerald-100 text-emerald-700' },
    trash: { label: 'Trash', color: 'bg-slate-100 text-slate-700' }
};

const EDITING_LEVELS = {
    'B': { label: 'Basic', color: 'bg-slate-100 text-slate-700' },
    'A': { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
    'A+': { label: 'Highest', color: 'bg-purple-100 text-purple-700' }
};

export default function VideoListView({
    videos,
    categories,
    users,
    onEditVideo,
    isAdmin,
    selectedVideoIds = [],
    onToggleVideo,
    onSelectAll
}) {
    const [sortField, setSortField] = useState('created_at');
    const [sortDirection, setSortDirection] = useState('desc');
    const [statusFilter, setStatusFilter] = useState('all');

    // Get category by ID
    const getCategory = (categoryId) => {
        return categories.find(c => (c.id || c._id) === categoryId);
    };

    // Get user name
    const getUserName = (email) => {
        const user = users?.find(u => u.email === email);
        return user?.full_name || email?.split('@')[0] || '-';
    };

    // Get initials
    const getInitials = (email) => {
        if (!email) return '?';
        const user = users?.find(u => u.email === email);
        if (user?.full_name) {
            return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        return email.slice(0, 2).toUpperCase();
    };

    // Sort function
    const sortedVideos = [...videos]
        .filter(v => !v.is_deleted)
        .filter(v => statusFilter === 'all' || v.status === statusFilter)
        .sort((a, b) => {
            let aVal = a[sortField];
            let bVal = b[sortField];

            if (sortField === 'created_at') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const SortableHeader = ({ field, children }) => (
        <TableHead
            className="cursor-pointer hover:bg-slate-50"
            onClick={() => toggleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-indigo-600' : 'text-slate-300'}`} />
            </div>
        </TableHead>
    );

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Status:</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                                <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <span className="text-sm text-slate-400">
                    {sortedVideos.length} video{sortedVideos.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Table */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={sortedVideos.length > 0 && selectedVideoIds.length >= sortedVideos.length}
                                    onCheckedChange={onSelectAll}
                                />
                            </TableHead>
                            <SortableHeader field="title">Title</SortableHeader>
                            <TableHead>Category</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Team</TableHead>
                            <TableHead>URLs</TableHead>
                            <SortableHeader field="created_at">Created</SortableHeader>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedVideos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                                    No videos found
                                </TableCell>
                            </TableRow>
                        ) : (
                            sortedVideos.map(video => {
                                const category = getCategory(video.category_id);
                                const status = STATUS_CONFIG[video.status] || STATUS_CONFIG.shoot;
                                const level = EDITING_LEVELS[video.editing_level] || EDITING_LEVELS.B;

                                return (
                                    <TableRow
                                        key={video.id || video._id}
                                        className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedVideoIds.includes(video.id || video._id) ? 'bg-slate-100/80 shadow-inner' : ''}`}
                                        onClick={() => onEditVideo(video)}
                                    >
                                        {/* Selection */}
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedVideoIds.includes(video.id || video._id)}
                                                onCheckedChange={() => onToggleVideo(video.id || video._id)}
                                            />
                                        </TableCell>
                                        {/* Title */}
                                        <TableCell>
                                            <div
                                                className="flex items-center gap-2"
                                                style={{ borderLeft: `3px solid ${category?.color || '#6366F1'}`, paddingLeft: '8px' }}
                                            >
                                                <span className="font-medium truncate max-w-[200px]">{video.title}</span>
                                            </div>
                                        </TableCell>

                                        {/* Category */}
                                        <TableCell>
                                            {category && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-xs"
                                                    style={{ backgroundColor: `${category.color}15`, borderColor: category.color, color: category.color }}
                                                >
                                                    {category.name}
                                                </Badge>
                                            )}
                                        </TableCell>

                                        {/* Status */}
                                        <TableCell>
                                            <Badge className={`text-xs ${status.color}`}>
                                                {status.label}
                                            </Badge>
                                        </TableCell>

                                        {/* Level */}
                                        <TableCell>
                                            <Badge className={`text-xs ${level.color}`}>
                                                {video.editing_level}
                                            </Badge>
                                        </TableCell>

                                        {/* Team */}
                                        <TableCell>
                                            <div className="flex -space-x-2">
                                                {[
                                                    video.assigned_director,
                                                    video.assigned_cameraman,
                                                    video.assigned_editor,
                                                    video.assigned_manager
                                                ].filter(Boolean).map((email, idx) => (
                                                    <Avatar
                                                        key={idx}
                                                        className="w-6 h-6 border-2 border-white"
                                                        title={getUserName(email)}
                                                    >
                                                        <AvatarFallback className="text-[9px] bg-slate-100">
                                                            {getInitials(email)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ))}
                                            </div>
                                        </TableCell>

                                        {/* URLs */}
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {video.raw_file_url && (
                                                    <Badge variant="outline" className="text-[10px] px-1">Raw</Badge>
                                                )}
                                                {video.revision_urls?.length > 0 && (
                                                    <Badge variant="outline" className="text-[10px] px-1 bg-orange-50">
                                                        Rev {video.revision_urls.length}
                                                    </Badge>
                                                )}
                                                {video.final_video_url && (
                                                    <Badge variant="outline" className="text-[10px] px-1 bg-emerald-50">Final</Badge>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Created */}
                                        <TableCell className="text-sm text-slate-500">
                                            {new Date(video.created_at).toLocaleDateString()}
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={(e) => { e.stopPropagation(); onEditVideo(video); }}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                {video.final_video_url && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            window.open(video.final_video_url, '_blank');
                                                        }}
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
