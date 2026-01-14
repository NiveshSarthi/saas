import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Bell, BellRing, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { formatDistanceToNow } from 'date-fns';
import { cleanupOldNotifications } from '@/components/utils/notificationHelper';

export default function PushNotifications({ userEmail }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [lastNotificationCount, setLastNotificationCount] = useState(0);
  const [showBanner, setShowBanner] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['push-notifications', userEmail],
    queryFn: () => base44.entities.Notification.filter(
      { user_email: userEmail, read: false },
      '-created_date',
      10
    ),
    refetchInterval: 30000, // Poll every 30 seconds
    enabled: !!userEmail,
  });

  // Request notification permission & cleanup old notifications
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        setHasPermission(true);
        setShowBanner(false);
      } else if (Notification.permission === 'default') {
        setShowBanner(true);
      }
    }
    
    // Cleanup old notifications once on mount
    if (userEmail) {
      cleanupOldNotifications().catch(console.error);
    }
  }, [userEmail]);

  // Show browser notification for new notifications
  useEffect(() => {
    if (hasPermission && notifications.length > lastNotificationCount && lastNotificationCount > 0) {
      const newNotification = notifications[0];
      if (newNotification) {
        new Notification(newNotification.title, {
          body: newNotification.message,
          icon: '/favicon.ico',
          tag: newNotification.id,
          requireInteraction: true,
          vibrate: [200, 100, 200],
        });
        
        // Play notification sound
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUQ0PVKzo8K1gGgU4k9nyyHkqBSh+zPHajzsKFGO56+ifUBALTKXh8LdjHQU2jdXwzn4tBSZ8zfHej0IKE2K26+mjURALSqPg77RiHgU0i9Twzn8uBSR6zPDdkEIJEmK26+mjUBELSKHe8LNhHgUzitHvzX4tBSN5y+/dj0IJEmG26Oii');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      }
    }
    setLastNotificationCount(notifications.length);
  }, [notifications, hasPermission, lastNotificationCount]);

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setHasPermission(permission === 'granted');
      if (permission === 'granted') {
        setShowBanner(false);
        // Test notification
        new Notification('Notifications Enabled! 🎉', {
          body: 'You will now receive push notifications for new leads and updates.',
          icon: '/favicon.ico',
          vibrate: [200, 100, 200],
        });
      } else {
        setShowBanner(false);
      }
    }
  };

  const markAsRead = async (id) => {
    await base44.entities.Notification.update(id, { read: true });
  };

  const getNotificationIcon = (type) => {
    const icons = {
      task_assigned: '📋',
      status_changed: '🔄',
      comment_added: '💬',
      mentioned: '@',
      due_reminder: '⏰',
      blocked_alert: '🚫',
      review_requested: '👀',
    };
    return icons[type] || '🔔';
  };

  return (
    <>
      {showBanner && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-white border-2 border-indigo-500 rounded-lg shadow-2xl p-4 animate-in slide-in-from-right">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <BellRing className="w-6 h-6 text-indigo-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">Enable Push Notifications</h3>
              <p className="text-sm text-slate-600 mb-3">
                Get instant alerts for new leads, assignments, and updates - even when the app is in the background!
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={requestPermission} className="bg-indigo-600 hover:bg-indigo-700">
                  <BellRing className="w-4 h-4 mr-1" />
                  Enable Notifications
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBanner(false)}>
                  Maybe Later
                </Button>
              </div>
            </div>
            <button 
              onClick={() => setShowBanner(false)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {notifications.length > 0 ? (
            <>
              <BellRing className="w-5 h-5 text-slate-600" />
              <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs bg-red-500">
                {notifications.length > 9 ? '9+' : notifications.length}
              </Badge>
            </>
          ) : (
            <Bell className="w-5 h-5 text-slate-400" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {!hasPermission && 'Notification' in window && (
              <Button size="sm" variant="outline" onClick={requestPermission}>
                Enable
              </Button>
            )}
          </div>
        </div>
        
        <div className="max-h-80 overflow-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">No new notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-3 border-b border-slate-50 hover:bg-slate-50 relative group"
              >
                <div className="flex gap-3">
                  <span className="text-lg">{getNotificationIcon(notif.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                    <p className="text-xs text-slate-500 truncate">{notif.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNow(new Date(notif.created_date + 'Z'), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => markAsRead(notif.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                {notif.link && (
                  <Link
                    to={notif.link}
                    className="absolute inset-0"
                    onClick={() => markAsRead(notif.id)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-2 border-t border-slate-100">
          <Link to={createPageUrl('Notifications')}>
            <Button variant="ghost" size="sm" className="w-full">
              View All Notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
    </>
  );
}