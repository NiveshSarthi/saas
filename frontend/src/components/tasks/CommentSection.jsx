import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import {
  Send,
  MoreHorizontal,
  Edit,
  Trash2,
  Reply,
  Smile,
  Paperclip,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import MentionInput from '@/components/common/MentionInput';
import FileUpload from '@/components/common/FileUpload';
import VoiceRecorder from '@/components/common/VoiceRecorder';
import { Mic } from 'lucide-react';
import { processMentionsAndNotify, sendCommentNotification, MODULES } from '@/components/utils/notificationService';

const REACTIONS = ['👍', '👎', '❤️', '🎉', '😄', '🤔'];

export default function CommentSection({ taskId, comments = [], users = [], currentUser }) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const queryClient = useQueryClient();

  const addCommentMutation = useMutation({
    mutationFn: async (data) => {
      const comment = await base44.entities.Comment.create(data);
      // Log activity for comment
      await base44.entities.Activity.create({
        task_id: taskId,
        actor_email: currentUser?.email,
        action: 'commented',
        metadata: { comment_id: comment.id }
      });
      return comment;
    },
    onSuccess: async (comment, data) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      
      // Fetch task to get details and watchers
      const tasks = await base44.entities.Task.filter({ id: taskId });
      const task = tasks[0];
      
      // Process @mentions and send notifications
      if (newComment) {
        await processMentionsAndNotify({
          text: newComment,
          mentionedBy: currentUser?.email,
          mentionedByName: currentUser?.full_name || currentUser?.email,
          module: MODULES.TASK,
          itemName: task?.title || 'Task',
          itemId: taskId,
          link: `/task/${taskId}`,
          allUsers: users
        });
      }
      
      // Notify watchers about new comment
      if (task?.watchers && task.watchers.length > 0) {
        for (const watcherEmail of task.watchers) {
          if (watcherEmail !== currentUser?.email) {
            await sendCommentNotification({
              recipientEmail: watcherEmail,
              commentedBy: currentUser?.email,
              commentedByName: currentUser?.full_name || currentUser?.email,
              module: MODULES.TASK,
              itemName: task?.title || 'Task',
              itemId: taskId,
              link: `/task/${taskId}`,
              commentText: newComment || 'Added an attachment'
            });
          }
        }
      }
      
      setNewComment('');
      setReplyTo(null);
      setAttachments([]);
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Comment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      setEditingId(null);
      setEditContent('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => base44.entities.Comment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
    },
  });

  const handleDeleteAttachment = (comment, index) => {
    const newAttachments = comment.attachments.filter((_, i) => i !== index);
    updateCommentMutation.mutate({
      id: comment.id,
      data: { attachments: newAttachments }
    });
  };

  const extractMentions = (text) => {
    const mentionRegex = /@([^\s]+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      const user = users.find(u => 
        u.full_name === match[1] || u.email === match[1]
      );
      if (user) mentions.push(user.email);
    }
    return mentions;
  };

  const handleSubmit = () => {
    if (!newComment.trim() && attachments.length === 0) return;
    
    addCommentMutation.mutate({
      task_id: taskId,
      content: newComment || (attachments.length > 0 ? '' : newComment),
      author_email: currentUser?.email,
      parent_comment_id: replyTo?.id || null,
      mentions: extractMentions(newComment),
      attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type })),
      reactions: {}
    });
  };

  const handleReaction = (comment, emoji) => {
    const reactions = comment.reactions || {};
    const users = reactions[emoji] || [];
    
    if (users.includes(currentUser?.email)) {
      reactions[emoji] = users.filter(e => e !== currentUser?.email);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, currentUser?.email];
    }
    
    updateCommentMutation.mutate({ id: comment.id, data: { reactions } });
  };

  const getInitials = (email) => {
    if (!email) return '?';
    const user = users.find(u => u.email === email);
    if (user?.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  // Group comments by parent
  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  const renderComment = (comment, isReply = false) => {
    const isEditing = editingId === comment.id;
    const isOwner = comment.author_email === currentUser?.email;
    const isAdmin = currentUser?.role === 'admin';
    const replies = getReplies(comment.id);

    return (
      <div key={comment.id} className={cn("flex gap-3", isReply && "ml-10")}>
        <Avatar className={cn("flex-shrink-0", isReply ? "w-7 h-7" : "w-9 h-9")}>
          <AvatarFallback className={cn(
            "bg-indigo-100 text-indigo-600 font-medium",
            isReply ? "text-[10px]" : "text-xs"
          )}>
            {getInitials(comment.author_email)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-slate-900">
              {getUserName(comment.author_email)}
            </span>
            <span className="text-xs text-slate-400">
              {comment.created_date ? formatDistanceToNow(new Date(comment.created_date + 'Z'), { addSuffix: true }) : 'Just now'}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-slate-400">(edited)</span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-2">
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                users={users}
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => updateCommentMutation.mutate({ 
                    id: comment.id, 
                    data: { content: editContent, is_edited: true, edited_at: new Date().toISOString() }
                  })}
                >
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-sm prose-slate max-w-none">
                <ReactMarkdown>{comment.content}</ReactMarkdown>
              </div>
              
              {/* Attachments */}
              {comment.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {comment.attachments.map((att, i) => {
                    const isAudio = att.type?.startsWith('audio/') || att.name.endsWith('.webm') || att.name.endsWith('.mp3') || att.name.endsWith('.wav');
                    
                    if (isAudio) {
                      return (
                        <div key={i} className="relative group flex items-center gap-2 bg-slate-50 rounded-lg p-2 border border-slate-100 pr-8">
                          <div className="flex items-center gap-2">
                            <div className="bg-indigo-100 p-1.5 rounded-full">
                              <Mic className="w-3 h-3 text-indigo-600" />
                            </div>
                            <span className="text-xs font-medium text-slate-600">Voice Note</span>
                          </div>
                          <audio controls src={att.url} className="h-6 w-48" />
                          <a 
                            href={att.url} 
                            download={att.name}
                            className="text-xs text-slate-400 hover:text-slate-600"
                            title="Download"
                          >
                            <Paperclip className="w-3 h-3" />
                          </a>
                          {(isOwner || isAdmin) && (
                            <button
                              onClick={() => handleDeleteAttachment(comment, i)}
                              className="absolute top-1/2 -translate-y-1/2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete voice note"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={i} className="relative group">
                        <a 
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-indigo-600 hover:bg-slate-200"
                        >
                          <Paperclip className="w-3 h-3" />
                          {att.name}
                        </a>
                        {(isOwner || isAdmin) && (
                          <button
                            onClick={() => handleDeleteAttachment(comment, i)}
                            className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-sm border border-slate-200 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reactions */}
              <div className="flex items-center gap-2 mt-2">
                {Object.entries(comment.reactions || {}).map(([emoji, userList]) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(comment, emoji)}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                      userList.includes(currentUser?.email)
                        ? "bg-indigo-50 border-indigo-200"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    <span>{emoji}</span>
                    <span>{userList.length}</span>
                  </button>
                ))}
                
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="p-1 rounded hover:bg-slate-100">
                      <Smile className="w-4 h-4 text-slate-400" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <div className="flex gap-1">
                      {REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(comment, emoji)}
                          className="p-1 text-lg hover:bg-slate-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <button 
                  onClick={() => setReplyTo(comment)}
                  className="text-xs text-slate-500 hover:text-indigo-600"
                >
                  Reply
                </button>
              </div>
            </>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>

        {(isOwner || isAdmin) && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setEditingId(comment.id);
                setEditContent(comment.content);
              }}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem 
                  className="text-red-600"
                  onClick={() => deleteCommentMutation.mutate(comment.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Comment Input */}
      <div className="flex gap-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-medium">
            {getInitials(currentUser?.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          {replyTo && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Reply className="w-4 h-4" />
              Replying to {getUserName(replyTo.author_email)}
              <button 
                onClick={() => setReplyTo(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          )}
          
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            users={users}
            placeholder="Add a comment... Use @ to mention someone"
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileUpload
                compact
                files={attachments}
                onUpload={(file) => setAttachments(prev => [...prev, file])}
                onRemove={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
              />
              <VoiceRecorder 
                onRecordingComplete={(file) => setAttachments(prev => [...prev, file])}
              />
            </div>

            <Button 
              size="sm"
              onClick={handleSubmit}
              disabled={(!newComment.trim() && attachments.length === 0) || addCommentMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-6">
        {rootComments.map(comment => renderComment(comment))}
        
        {comments.length === 0 && (
          <p className="text-center text-slate-400 py-6">No comments yet. Be the first to comment!</p>
        )}
      </div>
    </div>
  );
}