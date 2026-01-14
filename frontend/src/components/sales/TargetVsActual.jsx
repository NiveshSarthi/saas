import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, startOfWeek, endOfWeek, isSameWeek, isSameMonth, subDays, startOfDay, endOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, Trophy, CalendarDays } from 'lucide-react';
import SalesEffortBreakdown from './SalesEffortBreakdown';

export default function TargetVsActual({ user, allUsers = [] }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedUserEmail, setSelectedUserEmail] = useState(user?.role === 'admin' ? 'all' : user?.email);
  const [selectedGroupId, setSelectedGroupId] = useState('all');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  
  const isSalesMgr = user?.job_title === 'Sales Manager';
  
  // Filter users for Sales Manager
  const visibleUsers = React.useMemo(() => {
    if (!user) return allUsers;
    if (user.role === 'admin' || !isSalesMgr) return allUsers;
    
    // Sales Manager: only their reports + themselves
    return allUsers.filter(u => {
      if (u.email?.toLowerCase() === user.email?.toLowerCase()) return true;
      if (u.reports_to?.toLowerCase() === user.email?.toLowerCase()) return true;
      return false;
    });
  }, [allUsers, user, isSalesMgr]);

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['sales-targets', selectedMonth],
    queryFn: () => base44.entities.SalesTarget.filter({ month: selectedMonth }),
  });

  const { data: dailyPerformance = [] } = useQuery({
    queryKey: ['daily-sales-performance', selectedMonth],
    queryFn: async () => {
      // Fetch enough history to cover the month
      return await base44.entities.DailySalesPerformance.list('-date', 2000);
    }
  });

  const { data: salesActivities = [] } = useQuery({
    queryKey: ['sales-activities', selectedMonth],
    queryFn: () => base44.entities.SalesActivity.list('-date', 2000),
  });

  const metrics = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = isSameMonth(parseISO(`${selectedMonth}-01`), today);
    
    // Define Time Ranges
    // 1. Outcome Metrics (Closures/Bookings) - Always MTD (Month to Date) or Full Month
    const outcomeStart = startOfMonth(parseISO(`${selectedMonth}-01`));
    const outcomeEnd = endOfMonth(parseISO(`${selectedMonth}-01`)); // Filters handle if date > today naturally by data availability, but logically it's the whole month window

    // 2. Effort Metrics (Walk-ins, Meetings, etc.) - Last 7 Days if Current Month, else Full Month
    const trackingPeriodDays = isCurrentMonth ? 7 : 30; // Default 30 for past months
    const effortEnd = isCurrentMonth ? endOfDay(today) : outcomeEnd;
    const effortStart = isCurrentMonth ? startOfDay(subDays(today, trackingPeriodDays - 1)) : outcomeStart;

    // Helper to filter by range
    const filterByRange = (data, start, end) => data.filter(item => {
       const d = new Date(item.date);
       return d >= start && d <= end;
    });

    const outcomePerformance = filterByRange(dailyPerformance, outcomeStart, outcomeEnd);
    const outcomeActivities = filterByRange(salesActivities, outcomeStart, outcomeEnd);

    const effortPerformance = filterByRange(dailyPerformance, effortStart, effortEnd);
    const effortActivities = filterByRange(salesActivities, effortStart, effortEnd);

    // Determine the list of relevant users if a Group is selected
    let groupMemberEmails = [];
    if (selectedGroupId !== 'all') {
      const group = groups.find(g => g.id === selectedGroupId);
      if (group && group.members) {
        groupMemberEmails = group.members;
      }
    }

    // Filter Targets
    const filteredTargets = targets.filter(t => {
      // 1. Project Filter
      if (selectedProjectId !== 'all' && t.project_id !== selectedProjectId) return false;
      
      // 2. User/Group Filter
      if (selectedUserEmail !== 'all') {
        // Individual View: Only show this user's targets
        return t.user_email === selectedUserEmail;
      } else if (selectedGroupId !== 'all') {
        // Team View: Show Team Target OR Member Targets
        const isGroupTarget = t.group_id === selectedGroupId;
        const isMemberTarget = t.user_email && groupMemberEmails.includes(t.user_email);
        return isGroupTarget || isMemberTarget;
      }
      return true; // All targets
    });



    // Aggregate Targets (Raw Monthly)
    const rawTotalTarget = filteredTargets.reduce((acc, t) => ({
      walkins: acc.walkins + (t.walkin_target || 0),
      meetings: acc.meetings + (t.meeting_target || 0),
      followups: acc.followups + (t.followup_target || 0),
      site_visits: acc.site_visits + (t.site_visit_target || 0),
      bookings: acc.bookings + (t.booking_count_target || 0),
      weekly_bookings: acc.weekly_bookings + (t.weekly_booking_target || 0),
    }), { walkins: 0, meetings: 0, followups: 0, site_visits: 0, bookings: 0, weekly_bookings: 0 });

    // Scale Effort Targets if Current Month (7 days view)
    const totalTarget = { ...rawTotalTarget };
    if (isCurrentMonth) {
       totalTarget.walkins = Math.ceil(rawTotalTarget.walkins * (trackingPeriodDays / 30));
       totalTarget.meetings = Math.ceil(rawTotalTarget.meetings * (trackingPeriodDays / 30));
       totalTarget.followups = Math.ceil(rawTotalTarget.followups * (trackingPeriodDays / 30));
       totalTarget.site_visits = Math.ceil(rawTotalTarget.site_visits * (trackingPeriodDays / 30));
       // Bookings (Closures) are NOT scaled (MTD)
    }

    // Filter Actuals (Effort vs Outcome)
    const filterForUserGroup = (data) => data.filter(item => {
       // 1. Project Filter
       if (selectedProjectId !== 'all' && item.project_id && item.project_id !== selectedProjectId) return false;
       
       // 2. User/Group Filter
       if (selectedUserEmail !== 'all') {
         return item.user_email === selectedUserEmail;
       } else if (selectedGroupId !== 'all') {
         return groupMemberEmails.includes(item.user_email);
       }
       return true;
    });

    const filteredEffortPerf = filterForUserGroup(effortPerformance);
    const filteredEffortActs = filterForUserGroup(effortActivities);
    
    const filteredOutcomePerf = filterForUserGroup(outcomePerformance);
    const filteredOutcomeActs = filterForUserGroup(outcomeActivities);

    // Aggregate Actuals
    const totalActual = {
       walkins: filteredEffortPerf.reduce((acc, p) => acc + (p.walkins_count || 0), 0) + filteredEffortActs.filter(a => a.type === 'walk_in').length,
       meetings: filteredEffortPerf.reduce((acc, p) => acc + (p.meetings_count || 0), 0),
       followups: filteredEffortPerf.reduce((acc, p) => acc + (p.followups_count || 0), 0),
       site_visits: filteredEffortPerf.reduce((acc, p) => acc + (p.site_visits_count || 0), 0),
       // Outcomes use MTD
       bookings: filteredOutcomePerf.reduce((acc, p) => acc + (p.bookings_count || 0), 0) + filteredOutcomeActs.filter(a => a.type === 'closure').length,
    };

    // Calculate Weekly Actuals (Current Week)
    // For weekly, we always use the current week data (independent of 7-day rolling)
    const currentWeekPerformance = outcomePerformance.filter(p => isSameWeek(parseISO(p.date), today));
    const currentWeekActivities = outcomeActivities.filter(a => isSameWeek(parseISO(a.date), today));
    
    const weeklyActualBookings = currentWeekPerformance.reduce((acc, p) => acc + (p.bookings_count || 0), 0) + 
                                 currentWeekActivities.filter(a => a.type === 'closure').length;

    // Calculate User-wise Breakdown
    const breakdown = visibleUsers.map(u => {
       // Effort Actuals (7 days if current)
       const userEffortPerf = effortPerformance.filter(p => p.user_email === u.email);
       const userEffortActs = effortActivities.filter(a => a.user_email === u.email);
       
       // Outcome Actuals (MTD)
       const userOutcomePerf = outcomePerformance.filter(p => p.user_email === u.email);
       const userOutcomeActs = outcomeActivities.filter(a => a.user_email === u.email);
       
       // Target Logic (with Inheritance)
       let assignedTarget = targets.find(t => t.user_email === u.email);
       if (!assignedTarget) {
         const userGroupIds = groups
           .filter(g => g.members?.includes(u.email))
           .map(g => g.id);
         
         if (userGroupIds.length > 0) {
           assignedTarget = targets.find(t => t.group_id && userGroupIds.includes(t.group_id));
         }
       }

       // Base Monthly Targets
       const monthlyTargets = {
         walkins: assignedTarget ? (assignedTarget.walkin_target || 0) : 0,
         meetings: assignedTarget ? (assignedTarget.meeting_target || 0) : 0,
         followups: assignedTarget ? (assignedTarget.followup_target || 0) : 0,
         site_visits: assignedTarget ? (assignedTarget.site_visit_target || 0) : 0,
         bookings: assignedTarget ? (assignedTarget.booking_count_target || 0) : 0,
       };

       // Scale Effort Targets if Current Month
       const finalTargets = { ...monthlyTargets };
       if (isCurrentMonth) {
          finalTargets.walkins = Math.ceil(monthlyTargets.walkins * (trackingPeriodDays / 30));
          finalTargets.meetings = Math.ceil(monthlyTargets.meetings * (trackingPeriodDays / 30));
          finalTargets.followups = Math.ceil(monthlyTargets.followups * (trackingPeriodDays / 30));
          finalTargets.site_visits = Math.ceil(monthlyTargets.site_visits * (trackingPeriodDays / 30));
          // Bookings remain MTD
       }
       
       return {
         email: u.email,
         name: u.full_name || u.email,
         walkInsCount: userEffortPerf.reduce((acc, p) => acc + (p.walkins_count || 0), 0) + userEffortActs.filter(a => a.type === 'walk_in').length,
         meetingsCount: userEffortPerf.reduce((acc, p) => acc + (p.meetings_count || 0), 0),
         followupsCount: userEffortPerf.reduce((acc, p) => acc + (p.followups_count || 0), 0),
         siteVisitsCount: userEffortPerf.reduce((acc, p) => acc + (p.site_visits_count || 0), 0),
         bookingsCount: userOutcomePerf.reduce((acc, p) => acc + (p.bookings_count || 0), 0) + userOutcomeActs.filter(a => a.type === 'closure').length,
         targets: finalTargets
       };
    });

    return { 
      target: totalTarget, 
      actual: totalActual,
      weekly: {
        target: totalTarget.weekly_bookings,
        actual: weeklyActualBookings
      },
      breakdown
    };
  }, [targets, dailyPerformance, salesActivities, selectedUserEmail, selectedGroupId, selectedProjectId, groups, visibleUsers, selectedMonth]);

  const renderProgress = (label, actual, target, colorClass) => {
    const percentage = target > 0 ? Math.min(Math.round((actual / target) * 100), 100) : 0;
    const isOverPerforming = actual >= target && target > 0;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
          <div className="text-right">
             <span className={cn("text-lg font-bold", isOverPerforming ? "text-emerald-600" : "text-slate-900")}>
               {actual}
             </span>
             <span className="text-xs text-slate-400 ml-1">/ {target}</span>
          </div>
        </div>
        <Progress value={percentage} className="h-2" indicatorClassName={colorClass} />
        <div className="flex justify-between items-center">
           <p className="text-[10px] text-slate-400">
             {isSameMonth(parseISO(`${selectedMonth}-01`), new Date()) && label !== 'Monthly Bookings' && label !== 'Weekly Bookings' 
               ? '(Last 7 Days)' 
               : '(Monthly)'}
           </p>
           {target > 0 && (
              <p className="text-xs text-right text-slate-500">{percentage}% Achieved</p>
           )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Target vs Actual
          </CardTitle>
          <p className="text-sm text-slate-500">Performance for {format(new Date(selectedMonth), 'MMMM yyyy')}</p>
        </div>
        <div className="flex flex-col gap-2 items-end">
           <div className="flex gap-2">
             <input 
               type="month" 
               value={selectedMonth} 
               onChange={(e) => setSelectedMonth(e.target.value)}
               className="text-xs p-1 border rounded bg-transparent h-8"
             />
             <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => (
                     <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
             </Select>
           </div>
           
           {user?.role === 'admin' && (
             <div className="flex gap-2">
                <Select value={selectedGroupId} onValueChange={(v) => { setSelectedGroupId(v); setSelectedUserEmail('all'); }}>
                   <SelectTrigger className="w-[130px] h-8 text-xs">
                     <SelectValue placeholder="All Teams" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Teams</SelectItem>
                     {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                     ))}
                   </SelectContent>
                </Select>

                <Select value={selectedUserEmail} onValueChange={(v) => { setSelectedUserEmail(v); setSelectedGroupId('all'); }}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Individual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Individuals</SelectItem>
                    {visibleUsers.map(u => (
                       <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </div>
           )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          {renderProgress('Walk-ins', metrics.actual.walkins, metrics.target.walkins, 'bg-blue-500')}
          {renderProgress('Meetings', metrics.actual.meetings, metrics.target.meetings, 'bg-purple-500')}
          {renderProgress('Follow-ups', metrics.actual.followups, metrics.target.followups, 'bg-amber-500')}
          {renderProgress('Site Visits', metrics.actual.site_visits, metrics.target.site_visits, 'bg-indigo-500')}
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
           <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
             <Target className="w-4 h-4" /> Sales Targets (Bookings)
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {renderProgress('Monthly Bookings', metrics.actual.bookings, metrics.target.bookings, 'bg-emerald-500')}
             {metrics.weekly.target > 0 && (
                <div className="relative">
                   <div className="absolute -top-3 left-0 bg-blue-50 text-blue-600 text-[10px] px-2 py-0.5 rounded-full font-medium border border-blue-100 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Current Week
                   </div>
                   {renderProgress('Weekly Bookings', metrics.weekly.actual, metrics.weekly.target, 'bg-cyan-500')}
                </div>
             )}
           </div>
        </div>

        {/* Forecast Section */}
        {metrics.target.bookings > 0 && (
           <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">End of Month Forecast</h4>
              <div className="flex justify-between items-center">
                 <div>
                   <p className="text-2xl font-bold text-slate-900">
                     {Math.round(metrics.actual.bookings / (new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()))}
                   </p>
                   <p className="text-xs text-slate-500">Projected Bookings</p>
                 </div>
                 <div className="text-right">
                   <p className={`text-sm font-medium ${
                      Math.round(metrics.actual.bookings / (new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())) >= metrics.target.bookings 
                      ? 'text-emerald-600' 
                      : 'text-amber-600'
                   }`}>
                      {Math.round(metrics.actual.bookings / (new Date().getDate() / new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate())) >= metrics.target.bookings 
                        ? 'On Track to Hit Target' 
                        : 'Action Required to Hit Target'}
                   </p>
                 </div>
              </div>
           </div>
        )}

        {user?.role === 'admin' && selectedUserEmail === 'all' && (
           <div className="mt-8">
             <h3 className="text-sm font-semibold text-slate-900 mb-4">Team Efforts Breakdown</h3>
             <SalesEffortBreakdown userStats={metrics.breakdown} />
           </div>
        )}
      </CardContent>
    </Card>
  );
}