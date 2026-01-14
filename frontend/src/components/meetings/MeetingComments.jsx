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
  Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import MentionInput from '@/components/common/MentionInput';
import FileUpload from '@/components/common/FileUpload';

export default function MeetingComments({ 
  meetingId, 
  comments = [], 
  users = [], 
  currentUser,
  participants = []
}) {
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [attachments, setAttachments] = useState([]);
  const queryClient = useQueryClient();

  // Filter users to only show participants for mentions
  const participantUsers = users.filter(u => participants.includes(u.email));

  const addCommentMutation = useMutation({
    mutationFn: async (data) => {
      const comment = await base44.entities.MeetingComment.create(data);
      
      // Notify mentioned users
      const mentions = extractMentions(data.content);
      for (const email of mentions) {
        if (email !== currentUser?.email) {
          await base44.entities.Notification.create({
            user_email: email,
            type: 'mentioned',
            title: 'You were mentioned in a meeting',
            message: `${currentUser?.full_name || currentUser?.email} mentioned you in a meeting discussion`,
            actor_email: currentUser?.email,
            link: `MeetingRoom?id=${meetingId}`
          });
        }
      }
      
      return comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-comments', meetingId] });
      setNewComment('');
      setAttachments([]);
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MeetingComment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-comments', meetingId] });
      setEditingId(null);
      setEditContent('');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (id) => base44.entities.MeetingComment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-comments', meetingId] });
    },
  });

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
    if (!newComment.trim()) return;
    
    addCommentMutation.mutate({
      meeting_id: meetingId,
      content: newComment,
      author_email: currentUser?.email,
      mentions: extractMentions(newComment),
      attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type }))
    });
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
          <MentionInput
            value={newComment}
            onChange={setNewComment}
            users={participantUsers}
            placeholder="Add to the discussion..."
          />
          
          <div className="flex items-center justify-between">
            <FileUpload
              compact
              files={attachments}
              onUpload={(file) => setAttachments(prev => [...prev, file])}
              onRemove={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
            />
            
            <Button 
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim() || addCommentMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => {
          const isEditing = editingId === comment.id;
          const isOwner = comment.author_email === currentUser?.email;
          const isAdmin = currentUser?.role === 'admin';

          return (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-medium">
                  {getInitials(comment.author_email)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-slate-900">
                    {getUserName(comment.author_email)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatDistanceToNow(new Date(comment.created_date), { addSuffix: true })}
                  </span>
                </div>
                
                {isEditing ? (
                  <div className="space-y-2">
                    <MentionInput
                      value={editContent}
                      onChange={setEditContent}
                      users={participantUsers}
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => updateCommentMutation.mutate({ 
                          id: comment.id, 
                          data: { content: editContent }
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
                    
                    {comment.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {comment.attachments.map((att, i) => (
                          <a 
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-indigo-600 hover:bg-slate-200"
                          >
                            <Paperclip className="w-3 h-3" />
                            {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </>
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
        })}
        
        {comments.length === 0 && (
          <p className="text-center text-slate-400 py-6">No discussion yet. Start the conversation!</p>
        )}
      </div>
    </div>
  );
}