import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCheck,
  Check,
  Trash2,
  UserPlus,
  MessageSquare,
  AtSign,
  Calendar,
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const notificationIcons = {
  task_assigned: UserPlus,
  status_changed: Clock,
  comment_added: MessageSquare,
  mentioned: AtSign,
  due_reminder: Calendar,
  blocked_alert: AlertTriangle,
  review_requested: Check
};

const notificationColors = {
  task_assigned: 'bg-blue-100 text-blue-600',
  status_changed: 'bg-purple-100 text-purple-600',
  comment_added: 'bg-green-100 text-green-600',
  mentioned: 'bg-amber-100 text-amber-600',
  due_reminder: 'bg-red-100 text-red-600',
  blocked_alert: 'bg-red-100 text-red-600',
  review_requested: 'bg-indigo-100 text-indigo-600'
};

export default function Notifications() {
  const [filter, setFilter] = useState('all');
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter(
      { user_email: user?.email }, 
      '-created_date',
      100
    ),
    enabled: !!user?.email,
  });

  const updateNotificationMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Notification.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAsRead = (notification) => {
    if (!notification.read) {
      updateNotificationMutation.mutate({ id: notification.id, data: { read: true } });
    }
  };

  const markAllAsRead = () => {
    notifications
      .filter(n => !n.read)
      .forEach(n => {
        updateNotificationMutation.mutate({ id: n.id, data: { read: true } });
      });
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter !== 'all') return n.type === filter;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
          <TabsTrigger value="mentioned">Mentions</TabsTrigger>
          <TabsTrigger value="task_assigned">Assigned</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.map((notification) => {
          const Icon = notificationIcons[notification.type] || Bell;
          const colorClass = notificationColors[notification.type] || 'bg-slate-100 text-slate-600';

          return (
            <div
              key={notification.id}
              className={cn(
                "bg-white rounded-xl border p-4 transition-colors",
                notification.read 
                  ? "border-slate-100" 
                  : "border-indigo-200 bg-indigo-50/30"
              )}
            >
              <div className="flex gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                  colorClass
                )}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-slate-900">{notification.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{notification.message}</p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 mt-2" />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-slate-400">
                      {formatDistanceToNow(new Date(notification.created_date), { addSuffix: true })}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {notification.link && (
                        <Link to={createPageUrl(notification.link)}>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => markAsRead(notification)}
                          >
                            View
                          </Button>
                        </Link>
                      )}
                      {!notification.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsRead(notification)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-slate-400 hover:text-red-500"
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredNotifications.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-2xl">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No notifications</h3>
            <p className="text-slate-500">
              {filter === 'unread' ? "You're all caught up!" : "Nothing here yet"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}