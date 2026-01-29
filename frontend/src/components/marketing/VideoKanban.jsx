import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import VideoCard from './VideoCard';
import UrlPromptDialog from './UrlPromptDialog';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Define workflow columns with their properties
const COLUMNS = [
    { id: 'shoot', title: 'Shoot', color: 'bg-amber-50 border-amber-300', dotColor: 'bg-amber-500' },
    { id: 'editing', title: 'Editing', color: 'bg-blue-50 border-blue-300', dotColor: 'bg-blue-500' },
    { id: 'review', title: 'Review', color: 'bg-purple-50 border-purple-300', dotColor: 'bg-purple-500' },
    { id: 'revision', title: 'Revision', color: 'bg-orange-50 border-orange-300', dotColor: 'bg-orange-500' },
    { id: 'approval', title: 'Approval', color: 'bg-yellow-50 border-yellow-300', dotColor: 'bg-yellow-500' },
    { id: 'posting', title: 'Posting', color: 'bg-cyan-50 border-cyan-300', dotColor: 'bg-cyan-500' },
    { id: 'posted', title: 'Posted', color: 'bg-emerald-50 border-emerald-300', dotColor: 'bg-emerald-500' },
    { id: 'trash', title: 'Trash', color: 'bg-slate-100 border-slate-300', dotColor: 'bg-slate-500' },
];

// Transition rules for video workflow
const TRANSITION_RULES = {
    'shoot->editing': { requiredField: 'raw_file_url', message: 'Raw File URL is required to move to Editing' },
    'editing->review': { requiredField: 'revision_urls', message: 'At least one Revision URL is required to move to Review' },
    'revision->review': { requiredField: 'revision_urls', message: 'At least one Revision URL is required to move to Review' },
    'review->approval': { requiredField: 'final_video_url', message: 'Final Video URL is required to move to Approval' },
    'revision->approval': { requiredField: 'final_video_url', message: 'Final Video URL is required to move to Approval' },
    'approval->posting': { requiredField: 'final_video_url', message: 'Final Video URL is required to move to Posting' },
};

// Free transitions (no validation needed)
const FREE_TRANSITIONS = [
    'editing->revision',
    'revision->editing',
    'review->revision',
];

// Custom style function for proper drag positioning
const getDragStyle = (style, snapshot) => {
    if (!snapshot.isDragging) {
        return style;
    }

    return {
        ...style,
        // Ensure proper cursor attachment - keep transform as is
        transform: style?.transform,
        // Add smooth transition when dropping
        transition: snapshot.isDropAnimating
            ? 'all 0.2s cubic-bezier(0.2, 0, 0, 1)'
            : style?.transition,
        // Ensure the card stays at proper z-index
        zIndex: 9999,
        // Add shadow for visual feedback
        boxShadow: '0 15px 30px rgba(0, 0, 0, 0.15), 0 5px 15px rgba(0, 0, 0, 0.1)',
    };
};

export default function VideoKanban({
    videos,
    categories,
    users,
    onEditVideo,
    user,
    refetch,
    isAdmin,
    selectedVideoIds = [],
    onToggleVideo
}) {
    const [collapsedColumns, setCollapsedColumns] = useState({});
    const [hiddenColumns, setHiddenColumns] = useState({ posted: true });
    const [urlPrompt, setUrlPrompt] = useState(null);

    const toggleCollapse = (columnId) => {
        setCollapsedColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
    };

    const toggleHidden = (columnId) => {
        setHiddenColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
    };

    const logActivity = async (videoId, action, details) => {
        try {
            await base44.entities.VideoLog.create({
                video_id: videoId,
                action,
                user_email: user?.email,
                user_name: user?.full_name || user?.email,
                details
            });
        } catch (err) {
            console.error('Failed to log activity:', err);
        }
    };

    const checkTransition = (video, fromStatus, toStatus) => {
        const transitionKey = `${fromStatus}->${toStatus}`;

        if (toStatus === 'trash') return { allowed: true };
        if (FREE_TRANSITIONS.includes(transitionKey)) return { allowed: true };

        const rule = TRANSITION_RULES[transitionKey];
        if (rule) {
            const field = rule.requiredField;
            if (field === 'revision_urls') {
                if (!video.revision_urls || video.revision_urls.length === 0) {
                    return { allowed: false, ...rule, urlType: 'revision' };
                }
            } else if (!video[field]) {
                return { allowed: false, ...rule, urlType: field.replace('_url', '').replace('_', ' ') };
            }
        }

        return { allowed: true };
    };

    const onDragEnd = async (result) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const video = videos.find(v => (v.id || v._id) === draggableId);
        if (!video) return;

        const fromStatus = source.droppableId;
        const toStatus = destination.droppableId;

        const transitionCheck = checkTransition(video, fromStatus, toStatus);

        if (!transitionCheck.allowed) {
            setUrlPrompt({
                video,
                fromStatus,
                toStatus,
                message: transitionCheck.message,
                urlType: transitionCheck.urlType,
                requiredField: transitionCheck.requiredField
            });
            return;
        }

        await performMove(video, fromStatus, toStatus);
    };

    const performMove = async (video, fromStatus, toStatus, additionalData = {}) => {
        try {
            const updateData = {
                status: toStatus,
                updated_at: new Date(),
                ...additionalData
            };

            await base44.entities.Video.update(video.id || video._id, updateData);

            await logActivity(video.id || video._id, 'status_changed', {
                from: fromStatus,
                to: toStatus,
                ...(additionalData.raw_file_url && { raw_file_url: additionalData.raw_file_url }),
                ...(additionalData.final_video_url && { final_video_url: additionalData.final_video_url })
            });

            toast.success(`Moved to ${COLUMNS.find(c => c.id === toStatus)?.title}`);
            refetch();
        } catch (error) {
            toast.error('Failed to move video');
            console.error(error);
        }
    };

    const handleUrlPromptSubmit = async (url) => {
        if (!urlPrompt) return;

        const { video, fromStatus, toStatus, requiredField } = urlPrompt;

        let updateData = {};

        if (requiredField === 'revision_urls') {
            const currentRevisions = video.revision_urls || [];
            const newRevisionNumber = currentRevisions.length + 1;
            updateData.revision_urls = [
                ...currentRevisions,
                { url, revision_number: newRevisionNumber, added_at: new Date(), added_by: user?.email }
            ];
        } else {
            updateData[requiredField] = url;
        }

        await performMove(video, fromStatus, toStatus, updateData);
        setUrlPrompt(null);
    };

    const getCategoryColor = (categoryId) => {
        const category = categories.find(c => (c.id || c._id) === categoryId);
        return category?.color || '#6366F1';
    };

    const visibleColumns = COLUMNS.filter(col => !hiddenColumns[col.id]);
    const hiddenColumnsList = COLUMNS.filter(col => hiddenColumns[col.id]);

    return (
        <div className="flex flex-col h-full">
            {/* Hidden columns toggle */}
            {hiddenColumnsList.length > 0 && (
                <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-slate-500">Hidden columns:</span>
                    {hiddenColumnsList.map(col => (
                        <Button
                            key={col.id}
                            variant="outline"
                            size="sm"
                            onClick={() => toggleHidden(col.id)}
                            className="text-xs"
                        >
                            <Eye className="w-3 h-3 mr-1" />
                            Show {col.title}
                        </Button>
                    ))}
                </div>
            )}

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex h-full overflow-x-auto gap-3 pb-4">
                    {visibleColumns.map((column) => {
                        const columnVideos = videos.filter(v => v.status === column.id && !v.is_deleted);
                        const isCollapsed = collapsedColumns[column.id];

                        return (
                            <div
                                key={column.id}
                                className={`flex flex-col h-full transition-all duration-200 flex-shrink-0 ${isCollapsed ? 'w-[60px]' : 'w-[300px]'}`}
                            >
                                {/* Column Header */}
                                <div className={`p-3 rounded-t-xl border-b-2 flex items-center justify-between ${column.color} backdrop-blur-sm`}>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => toggleCollapse(column.id)}
                                            className="hover:bg-white/50 rounded p-1 transition-colors"
                                        >
                                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        <div className={`w-2 h-2 rounded-full ${column.dotColor}`} />
                                        {!isCollapsed && (
                                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                                                {column.title}
                                            </h3>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full text-slate-600 shadow-sm">
                                            {columnVideos.length}
                                        </span>
                                        {!isCollapsed && (
                                            <button
                                                onClick={() => toggleHidden(column.id)}
                                                className="hover:bg-white/50 rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                title="Hide column"
                                            >
                                                <EyeOff className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Droppable Area */}
                                {!isCollapsed && (
                                    <div className="flex-1 bg-slate-50/80 border-x border-b rounded-b-xl p-2 overflow-y-auto scrollbar-thin">
                                        <Droppable droppableId={column.id}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                    className={`min-h-[120px] space-y-2 transition-all duration-200 rounded-lg p-1 ${snapshot.isDraggingOver
                                                        ? 'bg-indigo-50/70 ring-2 ring-indigo-200 ring-inset'
                                                        : ''
                                                        }`}
                                                >
                                                    {columnVideos.map((video, index) => (
                                                        <Draggable
                                                            key={video.id || video._id}
                                                            draggableId={video.id || video._id}
                                                            index={index}
                                                        >
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    {...provided.dragHandleProps}
                                                                    style={getDragStyle(provided.draggableProps.style, snapshot)}
                                                                    className={`transition-transform duration-150 ${snapshot.isDragging
                                                                        ? 'rotate-[1deg] scale-[1.02] cursor-grabbing opacity-95'
                                                                        : 'cursor-grab hover:scale-[1.01]'
                                                                        }`}
                                                                >
                                                                    <VideoCard
                                                                        video={video}
                                                                        categoryColor={getCategoryColor(video.category_id)}
                                                                        category={categories.find(c => (c.id || c._id) === video.category_id)}
                                                                        users={users}
                                                                        onClick={() => onEditVideo(video)}
                                                                        isAdmin={isAdmin}
                                                                        isSelected={selectedVideoIds.includes(video.id || video._id)}
                                                                        onToggleSelection={() => onToggleVideo(video.id || video._id)}
                                                                        selectionModeActive={selectedVideoIds.length > 0}
                                                                    />
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                )}

                                {/* Collapsed indicator */}
                                {isCollapsed && (
                                    <div className="flex-1 bg-slate-50/50 border-x border-b rounded-b-xl flex items-center justify-center">
                                        <div className="transform -rotate-90 whitespace-nowrap text-xs font-medium text-slate-400">
                                            {column.title} ({columnVideos.length})
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </DragDropContext>

            {/* URL Prompt Dialog */}
            {urlPrompt && (
                <UrlPromptDialog
                    isOpen={!!urlPrompt}
                    onClose={() => setUrlPrompt(null)}
                    onSubmit={handleUrlPromptSubmit}
                    title={`${urlPrompt.urlType?.charAt(0).toUpperCase()}${urlPrompt.urlType?.slice(1)} URL Required`}
                    message={urlPrompt.message}
                    urlType={urlPrompt.urlType}
                />
            )}
        </div>
    );
}
