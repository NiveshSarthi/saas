import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Phone,
  MessageSquare,
  UserPlus,
  FileText,
  Calendar,
  CheckCircle,
  RefreshCw,
  Plus,
  MoreVertical,
  UserCircle2,
  Send,
  ArrowRight,
  History,
  Mail,
  MapPin,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const ACTIVITY_CONFIG = {
  Call: { icon: Phone, color: 'bg-purple-500', label: 'Phone Call' },
  Note: { icon: MessageSquare, color: 'bg-slate-500', label: 'Note' },
  'Stage Change': { icon: RefreshCw, color: 'bg-purple-500', label: 'Stage Change' },
  Assignment: { icon: UserPlus, color: 'bg-amber-500', label: 'Assignment' },
  Email: { icon: Mail, color: 'bg-indigo-500', label: 'Email' },
  WhatsApp: { icon: MessageSquare, color: 'bg-green-500', label: 'WhatsApp' },
  Meeting: { icon: Calendar, color: 'bg-rose-500', label: 'Meeting' },
  'Site Visit': { icon: MapPin, color: 'bg-orange-500', label: 'Site Visit' },
  'Follow-up': { icon: Clock, color: 'bg-blue-500', label: 'Follow-up' },
};

export default function LeadTimeline({ leadId, currentUser, users = [] }) {
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [discussionText, setDiscussionText] = useState('');
  const queryClient = useQueryClient();

  const getUserName = (email) => {
    const user = users.find(u => u.email === email);
    return user?.full_name || email;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: () => base44.entities.RELeadActivity.filter({ lead_id: leadId }, '-created_date', 50),
    enabled: !!leadId,
  });

  // Deduplicate activities by ID
  const uniqueActivities = useMemo(() => {
    const seen = new Set();
    return activities.filter(activity => {
      if (!activity.id) return false;
      if (seen.has(activity.id)) return false;
      seen.add(activity.id);
      return true;
    });
  }, [activities]);

  const addDiscussionMutation = useMutation({
    mutationFn: async (text) => {
      return await base44.entities.RELeadActivity.create({
        lead_id: leadId,
        activity_type: 'Note',
        description: text,
        actor_email: currentUser?.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      setDiscussionText('');
      toast.success('Discussion added');
    }
  });

  const handleAddDiscussion = () => {
    if (!discussionText.trim()) return;
    addDiscussionMutation.mutate(discussionText);
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'new': 'New',
      'contacted': 'Contacted',
      'screening': 'Screening',
      'qualified': 'Qualified',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'site_visit': 'Site Visit',
      'agreement': 'Agreement',
      'payment': 'Payment',
      'closed_won': 'Closed Won',
      'lost': 'Lost',
      'cold': 'Cold'
    };
    return statusMap[status] || status;
  };

  // Filter discussions (notes) and other activities
  const discussions = uniqueActivities.filter(a => a.activity_type === 'Note');
  const systemActivities = uniqueActivities.filter(a => a.activity_type !== 'Note');

  return (
    <div className="space-y-4">
      {/* Discussion Section */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Discussion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <Avatar className="w-9 h-9 flex-shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-medium">
                {getInitials(getUserName(currentUser?.email))}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="Share your thoughts, notes or updates about this lead..."
                value={discussionText}
                onChange={(e) => setDiscussionText(e.target.value)}
                className="min-h-[100px] mb-3 resize-none border-slate-200 focus:border-blue-500"
              />
              <Button
                size="sm"
                onClick={handleAddDiscussion}
                disabled={!discussionText.trim() || addDiscussionMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Send className="w-4 h-4 mr-2" />
                {addDiscussionMutation.isPending ? 'Posting...' : 'Post Discussion'}
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {/* Discussion List */}
          <ScrollArea className="h-[300px] pr-4">
            {discussions.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-500">No discussions yet</p>
                <p className="text-xs text-slate-400 mt-1">Start a conversation about this lead</p>
              </div>
            ) : (
              <div className="space-y-3">
                {discussions.map((discussion) => {
                  const userName = getUserName(discussion.actor_email);
                  const messageText = discussion.description || '(No message)';
                  
                  return (
                    <div key={discussion.id} className="flex gap-3">
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-600 text-white text-xs font-semibold">
                          {getInitials(userName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-slate-900">
                              {userName}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {format(new Date(discussion.created_date), 'MMM dd, hh:mm a')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {messageText}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Activity History Section */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-0">
              {systemActivities.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm text-slate-500">No activity recorded yet</p>
                  <p className="text-xs text-slate-400 mt-1">System activities will appear here</p>
                </div>
              ) : (
                systemActivities.map((activity, index) => {
                  const config = ACTIVITY_CONFIG[activity.activity_type] || ACTIVITY_CONFIG['Note'] || { icon: MessageSquare, color: 'bg-slate-500', label: 'Activity' };
                  const Icon = config.icon;
                  const isLast = index === systemActivities.length - 1;

                  return (
                    <div key={activity.id} className="relative">
                      {/* Vertical Line */}
                      {!isLast && (
                        <div className="absolute left-5 top-12 bottom-0 w-px bg-slate-200" />
                      )}

                      <div className="flex items-start gap-4 pb-6">
                        {/* Icon */}
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 z-10 shadow-md",
                          config.color
                        )}>
                          <Icon className="w-5 h-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                            {/* Date & Time */}
                            <div className="text-xs text-slate-500 mb-2">
                              {format(new Date(activity.created_date), 'MMMM dd, yyyy • hh:mm a')}
                            </div>
                            
                            {/* Activity Title */}
                            <div className="font-semibold text-slate-900 mb-2">
                              {activity.activity_type === 'Stage Change' && activity.metadata?.from && activity.metadata?.to ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>Stage Updated</span>
                                  <div className="flex items-center gap-2 text-sm font-normal">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                                      {getStatusLabel(activity.metadata.from)}
                                    </span>
                                    <ArrowRight className="w-4 h-4 text-slate-400" />
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">
                                      {getStatusLabel(activity.metadata.to)}
                                    </span>
                                  </div>
                                </div>
                              ) : activity.description?.includes('→') ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>Status Updated</span>
                                  <div className="text-sm font-normal text-slate-600">
                                    {activity.description}
                                  </div>
                                </div>
                              ) : (
                                config.label
                              )}
                            </div>

                            {/* Description */}
                            {activity.description && !activity.description.includes('→') && (
                              <div className="text-sm text-slate-600 mb-2 p-2 bg-slate-50 rounded">
                                {activity.description}
                              </div>
                            )}

                            {/* User */}
                            {activity.actor_email && !activity.actor_email.includes('base44.com') && !activity.actor_email.includes('service') && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <UserCircle2 className="w-3.5 h-3.5" />
                                <span>Status changed by {getUserName(activity.actor_email)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}