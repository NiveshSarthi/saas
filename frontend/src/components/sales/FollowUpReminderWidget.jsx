import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays } from 'date-fns';
import { AlertCircle, Calendar, Phone, Bell, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

export default function FollowUpReminderWidget({ user }) {
  const [dismissed, setDismissed] = useState([]);

  const { data: pageLeads = [] } = useQuery({
    queryKey: ['follow-up-reminders-page-leads', user?.email],
    queryFn: () => base44.entities.Lead.filter({ assigned_to: user?.email }, '-follow_up_date', 100),
    enabled: !!user?.email,
  });

  const { data: reLeads = [] } = useQuery({
    queryKey: ['follow-up-reminders-re-leads', user?.email],
    queryFn: () => base44.entities.RealEstateLead.filter({ assigned_to: user?.email }, '-next_followup_date', 100),
    enabled: !!user?.email,
  });

  const upcomingFollowUps = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const reminders = [];

    // Process Page Leads
    pageLeads.forEach(lead => {
      if (!lead.follow_up_date) return;
      const followUpDate = new Date(lead.follow_up_date);
      const daysUntil = differenceInDays(followUpDate, now);

      if (daysUntil <= 1 || followUpDate < now) {
        reminders.push({
          id: lead.id,
          name: lead.lead_name || 'Unknown',
          phone: lead.phone,
          followUpDate: lead.follow_up_date,
          daysUntil,
          isOverdue: followUpDate < now,
          source: 'Pages Leads'
        });
      }
    });

    // Process RE Leads
    reLeads.forEach(lead => {
      if (!lead.next_followup_date) return;
      const followUpDate = new Date(lead.next_followup_date);
      const daysUntil = differenceInDays(followUpDate, now);

      if (daysUntil <= 1 || followUpDate < now) {
        reminders.push({
          id: lead.id,
          name: lead.name || 'Unknown',
          phone: lead.phone,
          followUpDate: lead.next_followup_date,
          daysUntil,
          isOverdue: followUpDate < now,
          source: 'Lead Management'
        });
      }
    });

    return reminders
      .filter(r => !dismissed.includes(r.id))
      .sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.daysUntil - b.daysUntil;
      });
  }, [pageLeads, reLeads, dismissed]);

  if (upcomingFollowUps.length === 0) return null;

  const overdueCount = upcomingFollowUps.filter(r => r.isOverdue).length;
  const todayCount = upcomingFollowUps.filter(r => r.daysUntil === 0 && !r.isOverdue).length;

  return (
    <Card className={cn(
      "border-2 shadow-lg",
      overdueCount > 0 ? "border-red-300 bg-red-50/50" : "border-amber-300 bg-amber-50/50"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className={cn(
            "p-2 rounded-lg",
            overdueCount > 0 ? "bg-red-500" : "bg-amber-500"
          )}>
            <Bell className={cn(
              "w-5 h-5 text-white",
              overdueCount > 0 && "animate-pulse"
            )} />
          </div>
          Follow-up Reminders
          {overdueCount > 0 && (
            <Badge className="bg-red-600 text-white animate-pulse">
              {overdueCount} Overdue
            </Badge>
          )}
          {todayCount > 0 && (
            <Badge className="bg-amber-600 text-white">
              {todayCount} Today
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {upcomingFollowUps.map((reminder) => (
          <div 
            key={reminder.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg border transition-all hover:shadow-md",
              reminder.isOverdue 
                ? "bg-red-100 border-red-300" 
                : "bg-white border-amber-200"
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="w-10 h-10">
                <AvatarFallback className={cn(
                  "text-xs font-bold",
                  reminder.isOverdue 
                    ? "bg-red-500 text-white" 
                    : "bg-amber-500 text-white"
                )}>
                  {reminder.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{reminder.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Phone className="w-3 h-3" />
                  {reminder.phone}
                </div>
                <div className={cn(
                  "flex items-center gap-1.5 text-xs mt-1 font-medium",
                  reminder.isOverdue ? "text-red-700" : "text-amber-700"
                )}>
                  <Calendar className="w-3 h-3" />
                  {reminder.isOverdue 
                    ? `Overdue by ${Math.abs(reminder.daysUntil)} day(s)` 
                    : reminder.daysUntil === 0 
                      ? 'Due Today' 
                      : 'Due Tomorrow'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={createPageUrl(`LeadDetail?id=${reminder.id}`)}>
                <Button 
                  size="sm" 
                  variant={reminder.isOverdue ? "default" : "outline"}
                  className={cn(
                    reminder.isOverdue && "bg-red-600 hover:bg-red-700"
                  )}
                >
                  {reminder.isOverdue ? 'Take Action' : 'View'}
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed([...dismissed, reminder.id])}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}