import React, { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Calendar as CalendarIcon,
  ArrowRight,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { isSalesManager } from '@/components/utils/salesPermissions';

const METRICS_CONFIG = {
  walk_ins: { 
    label: 'Walk-ins', 
    color: 'bg-blue-500', 
    icon: Users,
    bg: 'bg-blue-50',
    textColor: 'text-blue-700'
  },
  meetings: { 
    label: 'Meetings', 
    color: 'bg-purple-500', 
    icon: Briefcase,
    bg: 'bg-purple-50',
    textColor: 'text-purple-700'
  },
  follow_ups: { 
    label: 'Follow-ups', 
    color: 'bg-amber-500', 
    icon: Clock,
    bg: 'bg-amber-50',
    textColor: 'text-amber-700'
  },
  closures: { 
    label: 'Closures / Bookings', 
    color: 'bg-emerald-500', 
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    textColor: 'text-emerald-700'
  }
};

export default function SalesPerformanceBreakdown({ activities = [], currentUser }) {
  const [dateRange, setDateRange] = useState('month'); // today, week, month, custom
  const [customDate, setCustomDate] = useState({ from: undefined, to: undefined });

  const { data: usersFromEntity = [] } = useQuery({
    queryKey: ['users-breakdown'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations-breakdown'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const allUsers = useMemo(() => [
    ...usersFromEntity,
    ...invitations
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
        job_title: inv.job_title,
        reports_to: inv.reports_to,
      }))
  ], [usersFromEntity, invitations]);

  const isSalesMgr = isSalesManager(currentUser);
  const isSalesExec = currentUser?.job_title === 'Sales Executive';

  // Get visible user emails (for Sales Manager: self + direct reports, for Sales Executive: self only)
  const visibleUserEmails = useMemo(() => {
    if (!currentUser) return [];
    
    // Sales Executive: only themselves
    if (isSalesExec) {
      return [currentUser.email?.toLowerCase()];
    }
    
    // Admin or non-Sales Manager sees all
    if (currentUser.role === 'admin' || !isSalesMgr) {
      return null; // null = no filtering
    }
    
    // Sales Manager: only themselves + direct reports
    const visible = allUsers.filter(u => {
      if (u.email?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
      if (u.reports_to?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
      return false;
    }).map(u => u.email?.toLowerCase());
    
    return visible;
  }, [currentUser, isSalesMgr, isSalesExec, allUsers]);

  // Filter activities based on selected date range AND visible users
  const filteredActivities = useMemo(() => {
    const now = new Date();
    let start, end;

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'week':
        start = startOfDay(subDays(now, 7));
        end = endOfDay(now);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfDay(now);
        break;
      case 'custom':
        if (customDate.from) {
          start = startOfDay(customDate.from);
          end = customDate.to ? endOfDay(customDate.to) : endOfDay(customDate.from);
        }
        break;
      default:
        start = startOfMonth(now);
        end = endOfDay(now);
    }

    if (!start) return activities;

    return activities.filter(a => {
      const date = new Date(a.date);
      if (!isWithinInterval(date, { start, end })) return false;
      
      // Filter by visible users for Sales Managers
      if (visibleUserEmails && visibleUserEmails.length > 0) {
        return visibleUserEmails.includes(a.user_email?.toLowerCase());
      }
      
      return true;
    });
  }, [activities, dateRange, customDate, visibleUserEmails]);

  // Calculate metrics from DailySalesPerformance records
  const stats = useMemo(() => {
    return filteredActivities.reduce((acc, a) => {
      acc.walk_ins += (a.walkins_count || 0);
      acc.meetings += (a.meetings_count || 0);
      acc.follow_ups += (a.followups_count || 0);
      acc.closures += (a.bookings_count || 0);
      return acc;
    }, { walk_ins: 0, meetings: 0, follow_ups: 0, closures: 0 });
  }, [filteredActivities]);

  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl sm:rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Sales Performance Breakdown
          </h3>
          <p className="text-xs text-slate-500 mt-1">Key indicators breakdown</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 Days</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <CalendarIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={customDate.from}
                  selected={customDate}
                  onSelect={setCustomDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="space-y-5 max-h-[400px] overflow-y-auto pr-2">
        {Object.entries(METRICS_CONFIG).map(([key, config]) => {
          const count = stats[key];
          // Calculate percentage relative to total activities in this view
          // or maybe max value to scale bars nicely? 
          // Let's use percentage of total activities displayed to show distribution.
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
          const Icon = config.icon;

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("p-1.5 rounded-md", config.bg)}>
                    <Icon className={cn("w-4 h-4", config.textColor)} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {config.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900 dark:text-white block">{count}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-500", config.color)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-8 text-right">{percentage}%</span>
              </div>
            </div>
          );
        })}

        {total === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">
            No sales activities found for this period
          </div>
        )}
      </div>
    </div>
  );
}