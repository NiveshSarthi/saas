import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Video, Trash2, ExternalLink } from 'lucide-react';

// Editing level labels
const EDITING_LEVELS = {
    'B': { label: 'Basic', color: 'bg-slate-100 text-slate-700' },
    'A': { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
    'A+': { label: 'Highest', color: 'bg-purple-100 text-purple-700' }
};

export default function VideoCard({ video, categoryColor, category, users, onClick, isAdmin }) {
    // Get user initials
    const getInitials = (email) => {
        if (!email) return '?';
        const user = users?.find(u => u.email === email);
        if (user?.full_name) {
            return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        return email.slice(0, 2).toUpperCase();
    };

    // Get user name
    const getUserName = (email) => {
        const user = users?.find(u => u.email === email);
        return user?.full_name || email?.split('@')[0] || 'Unknown';
    };

    const editingLevel = EDITING_LEVELS[video.editing_level] || EDITING_LEVELS['B'];

    return (
        <div
            onClick={onClick}
            className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer group overflow-hidden"
            style={{ borderLeftWidth: '4px', borderLeftColor: categoryColor }}
        >
            <div className="p-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-sm text-slate-800 line-clamp-2 flex-1">
                        {video.title}
                    </h4>
                    <Badge className={`text-[10px] px-1.5 py-0 ${editingLevel.color}`}>
                        {video.editing_level}
                    </Badge>
                </div>

                {/* Category */}
                {category && (
                    <div className="flex items-center gap-1 mb-2">
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: categoryColor }}
                        />
                        <span className="text-xs text-slate-500 truncate">{category.name}</span>
                    </div>
                )}

                {/* Description preview */}
                {video.description && (
                    <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                        {video.description}
                    </p>
                )}

                {/* URL indicators */}
                <div className="flex flex-wrap gap-1 mb-2">
                    {video.raw_file_url && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50">
                            Raw ✓
                        </Badge>
                    )}
                    {video.editing_url && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600">
                            Edit ✓
                        </Badge>
                    )}
                    {video.revision_urls?.length > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-50 text-orange-600">
                            Rev {video.revision_urls.length}
                        </Badge>
                    )}
                    {video.final_video_url && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-600">
                            Final ✓
                        </Badge>
                    )}
                </div>

                {/* Assigned Team */}
                <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                        {[
                            { email: video.assigned_director, role: 'D' },
                            { email: video.assigned_cameraman, role: 'C' },
                            { email: video.assigned_editor, role: 'E' },
                            { email: video.assigned_manager, role: 'M' }
                        ].map((member, idx) => (
                            <Avatar
                                key={idx}
                                className="w-6 h-6 border-2 border-white ring-1 ring-slate-100"
                                title={`${member.role === 'D' ? 'Director' : member.role === 'C' ? 'Cameraman' : member.role === 'E' ? 'Editor' : 'Manager'}: ${getUserName(member.email)}`}
                            >
                                <AvatarFallback className="text-[9px] bg-slate-100 text-slate-600">
                                    {getInitials(member.email)}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                    </div>

                    {/* Quick actions - visible on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {video.final_video_url && (
                            <a
                                href={video.final_video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                                title="Open final video"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                        {video.status === 'trash' && isAdmin && (
                            <button
                                className="p-1 hover:bg-red-100 rounded text-red-400 hover:text-red-600"
                                title="Permanently delete (Admin only)"
                                onClick={e => {
                                    e.stopPropagation();
                                    // Delete will be handled by parent
                                }}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
