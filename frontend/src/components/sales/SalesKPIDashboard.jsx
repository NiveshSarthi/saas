import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, isSameDay, parseISO, startOfDay, eachDayOfInterval, endOfDay } from 'date-fns';
import SalesSummaryCards from '@/components/sales/SalesSummaryCards';
import SalesTrendChart from '@/components/sales/SalesTrendChart';
import SalesTeamTable from '@/components/sales/SalesTeamTable';
import SalesPerformanceBreakdown from '@/components/sales/SalesPerformanceBreakdown';
import SalesUnderperformers from '@/components/sales/SalesUnderperformers';
import { isSalesManager, getVisibleSalesUsers } from '@/components/utils/salesPermissions';

export default function SalesKPIDashboard({ currentUser, users, departments }) {
  const salesDepts = departments.filter(d => d.name?.toLowerCase().includes('sales'));
  const salesDeptIds = salesDepts.map(d => d.id);
  const isSalesMgr = isSalesManager(currentUser);
  const isSalesExec = currentUser?.job_title === 'Sales Executive';

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations-sales'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const salesUsersFromEntity = users.filter(u => u.department_id && salesDeptIds.includes(u.department_id));

  const salesUsersFromInvitations = invitations
    .filter(inv => inv.department_id && salesDeptIds.includes(inv.department_id))
    .filter(inv => !users.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
    .map(inv => ({
      id: inv.id,
      email: inv.email,
      full_name: inv.full_name || inv.email?.split('@')[0],
      department_id: inv.department_id,
      role_id: inv.role_id,
      reports_to: inv.reports_to,
      job_title: inv.job_title,
      type: 'invitation'
    }));

  const allSalesUsers = [...salesUsersFromEntity, ...salesUsersFromInvitations];

  // Filter users based on role: Sales Executives see only themselves, Sales Managers see themselves + reports
  const salesUsers = React.useMemo(() => {
    if (!currentUser) return allSalesUsers;

    // Sales Executive: only see themselves
    if (isSalesExec) {
      return allSalesUsers.filter(u =>
        u.email?.toLowerCase() === currentUser.email?.toLowerCase()
      );
    }

    // Sales Manager: see themselves + their direct reports
    if (isSalesMgr) {
      return allSalesUsers.filter(u => {
        if (u.email?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
        if (u.reports_to?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
        return false;
      });
    }

    // Admin or Sales Head sees everyone
    return allSalesUsers;
  }, [allSalesUsers, currentUser, isSalesMgr, isSalesExec]);

  const { data: dailyPerformance = [] } = useQuery({
    queryKey: ['daily-sales-performance'],
    queryFn: () => base44.entities.DailySalesPerformance.filter({}, '-date', 1000),
  });

  const { data: salesActivities = [] } = useQuery({
    queryKey: ['sales-activities-dashboard'],
    queryFn: () => base44.entities.SalesActivity.filter({}, '-date', 1000),
  });

  const { data: kpiSettings = [] } = useQuery({
    queryKey: ['kpi-settings'],
    queryFn: () => base44.entities.SalesKPISettings.list('-created_date', 1),
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['sales-targets-dashboard'],
    queryFn: () => base44.entities.SalesTarget.filter({ month: format(new Date(), 'yyyy-MM') }),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-dashboard'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups-dashboard'],
    queryFn: () => base44.entities.Group.list(),
  });

  const settings = {
    tracking_period_days: 7, // Fixed to 7 days as requested
    min_walkins_per_day: 1, // Fixed to 1 walkin per day as requested
    min_closures_per_period: parseInt(kpiSettings[0]?.min_closures_per_period || 1)
  };

  const dashboardData = useMemo(() => {
    if (salesDepts.length === 0) return null;

    const today = new Date();
    const endDate = endOfDay(today);
    const startDate = startOfDay(subDays(today, settings.tracking_period_days - 1));

    // Generate exact array of days to iterate over
    const periodDays = eachDayOfInterval({ start: startDate, end: endDate });

    // Get visible user emails for filtering
    const visibleUserEmails = salesUsers.map(u => u.email?.toLowerCase());

    // Filter Daily Performance by Date Range AND visible users
    const periodPerformance = dailyPerformance.filter(p => {
      if (!p.date) return false;
      const d = new Date(p.date);
      if (isNaN(d.getTime())) return false;
      if (d < startDate || d > endDate) return false;
      return visibleUserEmails.includes(p.user_email?.toLowerCase());
    }).map(p => ({
      ...p,
      dateStr: p.date ? format(new Date(p.date), 'yyyy-MM-dd') : ''
    }));

    // Filter Sales Activities by Date Range AND visible users - Only count fully verified activities
    const periodActivities = salesActivities.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      if (d < startDate || d > endDate) return false;
      if (!visibleUserEmails.includes(a.user_email?.toLowerCase())) return false;

      // KPI Counting Rule: Only count if BOTH verifications are APPROVED (verified)
      const builderVerified = !a.builder_email || a.builder_verification_status === 'verified';
      const roVerified = a.ro_verification_status === 'verified';

      return builderVerified && roVerified;
    }).map(a => ({
      ...a,
      dateStr: a.date ? format(new Date(a.date), 'yyyy-MM-dd') : ''
    }));

    // MTD Calculations - Only count fully verified activities AND visible users
    const startOfMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const mtdPerformance = dailyPerformance.filter(p => {
      if (!p.date) return false;
      const d = new Date(p.date);
      if (isNaN(d.getTime())) return false;
      if (d < startOfMonthDate || d > endDate) return false;
      return visibleUserEmails.includes(p.user_email?.toLowerCase());
    });
    const mtdActivities = salesActivities.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      if (d < startOfMonthDate || d > endDate) return false;
      if (!visibleUserEmails.includes(a.user_email?.toLowerCase())) return false;

      const builderVerified = !a.builder_email || a.builder_verification_status === 'verified';
      const roVerified = a.ro_verification_status === 'verified';

      return builderVerified && roVerified;
    });

    // Today's Stats - Only count fully verified activities AND visible users
    const todayStr = format(today, 'yyyy-MM-dd');
    const todayPerformance = dailyPerformance.filter(p => {
      if (!p.date) return false;
      const d = new Date(p.date);
      if (isNaN(d.getTime())) return false;
      if (format(d, 'yyyy-MM-dd') !== todayStr) return false;
      return visibleUserEmails.includes(p.user_email?.toLowerCase());
    });
    const todayActivities = salesActivities.filter(a => {
      if (!a.date) return false;
      const d = new Date(a.date);
      if (isNaN(d.getTime())) return false;
      if (format(d, 'yyyy-MM-dd') !== todayStr) return false;
      if (!visibleUserEmails.includes(a.user_email?.toLowerCase())) return false;

      const builderVerified = !a.builder_email || a.builder_verification_status === 'verified';
      const roVerified = a.ro_verification_status === 'verified';

      return builderVerified && roVerified;
    });

    const todayWalkIns = todayPerformance.reduce((acc, p) => acc + (p.walkins_count || 0), 0) + todayActivities.filter(a => a.type === 'walk_in').length;
    const todayMeetings = todayPerformance.reduce((acc, p) => acc + (p.meetings_count || 0), 0);
    const todayFollowups = todayPerformance.reduce((acc, p) => acc + (p.followups_count || 0), 0);
    const todayClosures = todayPerformance.reduce((acc, p) => acc + (p.bookings_count || 0), 0) + todayActivities.filter(a => (a.type === 'closure' || a.status === 'closed_won')).length;

    // MTD Walk-ins
    const mtdWalkIns = mtdPerformance.reduce((acc, p) => acc + (p.walkins_count || 0), 0) + mtdActivities.filter(a => a.type === 'walk_in').length;

    // 1. User Stats & Daily Progress
    const userStats = salesUsers.map(user => {
      // Filter for Tracking Period (7 Days) - Used for Effort Metrics
      const userPerf = periodPerformance.filter(p =>
        p.user_email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
      );
      const userActivities = periodActivities.filter(a =>
        a.user_email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
      );

      // Filter for MTD (Month to Date) - Used for Outcome Metrics (Closures)
      const userPerfMTD = mtdPerformance.filter(p =>
        p.user_email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
      );
      const userActivitiesMTD = mtdActivities.filter(a =>
        a.user_email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
      );

      // Effort Metrics (Walk-ins, Meetings, Follow-ups) -> Use Tracking Period (7 Days)
      const walkInsCount = userPerf.reduce((acc, p) => acc + (p.walkins_count || 0), 0) +
        userActivities.filter(a => a.type === 'walk_in').length;

      const meetingsCount = userPerf.reduce((acc, p) => acc + (p.meetings_count || 0), 0);
      const followupsCount = userPerf.reduce((acc, p) => acc + (p.followups_count || 0), 0);

      // Outcome Metrics (Closures) -> Use MTD (Month to Date)
      const closuresCount = userPerfMTD.reduce((acc, p) => acc + (p.bookings_count || 0), 0) +
        userActivitiesMTD.filter(a => (a.type === 'closure' || a.status === 'closed_won')).length;

      let daysWithWalkIn = 0;

      // Map strictly over the calculated interval days
      const dailyProgress = periodDays.map(day => {
        const currentDayStr = format(day, 'yyyy-MM-dd');
        // Find performance for this day
        const dayPerf = userPerf.find(p => p.dateStr === currentDayStr);
        // Count activities for this day
        const dayActivityCount = userActivities.filter(a => a.dateStr === currentDayStr && a.type === 'walk_in').length;

        const count = (dayPerf ? (dayPerf.walkins_count || 0) : 0) + dayActivityCount;

        const status = count >= settings.min_walkins_per_day ? 'met' : (count > 0 ? 'partial' : 'missed');

        if (count >= settings.min_walkins_per_day) daysWithWalkIn++;

        return {
          date: day.toISOString(),
          count,
          status
        };
      });

      // Target Calculation for User - Deduplicate and prefer "All Projects" target
      const userTargets = targets.filter(t => t.user_email?.toLowerCase() === user.email?.toLowerCase());

      let assignedTarget = null;
      if (userTargets.length > 0) {
        // Prefer "All Projects" target (project_id is null)
        assignedTarget = userTargets.find(t => !t.project_id) || userTargets[0];
      }

      // If no individual target, look for group target (Department/Team)
      if (!assignedTarget) {
        const userGroupIds = groups
          .filter(g => g.members?.includes(user.email))
          .map(g => g.id);

        if (userGroupIds.length > 0) {
          assignedTarget = targets.find(t => t.group_id && userGroupIds.includes(t.group_id));
        }
      }

      // If using a monthly target but viewing a shorter period (like 7 days), scale the target
      const isShortPeriod = settings.tracking_period_days < 20;

      // Use assigned target if exists (even if 0), otherwise defaults (30 walk-ins, 3 closures)
      const monthlyWalkinTarget = assignedTarget ? (assignedTarget.walkin_target || 0) : 30;
      const monthlyClosureTarget = assignedTarget ? (assignedTarget.booking_count_target || 0) : 3;

      const walkInTarget = isShortPeriod
        ? Math.ceil(monthlyWalkinTarget * (settings.tracking_period_days / 30))
        : monthlyWalkinTarget;

      // Closure Target is always Monthly (MTD)
      const closureTarget = monthlyClosureTarget;

      // If target is 0: 0 count = 0%, >0 count = 100% (bonus)
      const walkInCompliance = walkInTarget > 0
        ? Math.round((walkInsCount / walkInTarget) * 100)
        : (walkInsCount > 0 ? 100 : 0);

      const closureCompliance = closureTarget > 0
        ? Math.round((closuresCount / closureTarget) * 100)
        : (closuresCount > 0 ? 100 : 0);

      return {
        user,
        walkInsCount,
        meetingsCount,
        followupsCount,
        closuresCount,
        dailyProgress,
        walkInCompliance,
        closureCompliance,
        targets: { walkInTarget, closureTarget }
      };
    });

    // 2. Totals & Compliance
    const totalWalkIns = userStats.reduce((acc, s) => acc + s.walkInsCount, 0);
    const totalMeetings = userStats.reduce((acc, s) => acc + s.meetingsCount, 0);
    const totalFollowups = userStats.reduce((acc, s) => acc + s.followupsCount, 0);
    const totalClosures = userStats.reduce((acc, s) => acc + s.closuresCount, 0);

    // MTD & Target Aggregations - Sum targets from database only (no defaults)
    // For each user, prefer "All Projects" target (project_id is null), otherwise take first target
    const teamTargetsMap = new Map();

    // Only process targets that exist in database for visible users
    targets
      .filter(t => t.user_email && !t.group_id && visibleUserEmails.includes(t.user_email?.toLowerCase()))
      .forEach(t => {
        const email = t.user_email.toLowerCase();
        const existing = teamTargetsMap.get(email);

        if (!existing) {
          teamTargetsMap.set(email, t);
        } else {
          // Prefer "All Projects" (project_id is null)
          if (!t.project_id && existing.project_id) {
            teamTargetsMap.set(email, t);
          }
        }
      });

    const deduplicatedTeamTargets = Array.from(teamTargetsMap.values());

    // Sum only from database targets - if no targets exist, show 0
    const teamBookingTarget = deduplicatedTeamTargets.reduce((acc, t) => acc + (t.booking_count_target || 0), 0);
    const teamWalkInTarget = deduplicatedTeamTargets.reduce((acc, t) => acc + (t.walkin_target || 0), 0);
    const mtdBookings = mtdPerformance.reduce((acc, p) => acc + (p.bookings_count || 0), 0) + mtdActivities.filter(a => (a.type === 'closure' || a.status === 'closed_won')).length;
    const mtdPerformancePct = teamBookingTarget > 0 ? Math.round((mtdBookings / teamBookingTarget) * 100) : 0;

    // Forecast (Linear Projection)
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const forecastBookings = dayOfMonth > 0 ? Math.round((mtdBookings / dayOfMonth) * daysInMonth) : 0;
    const forecastWalkIns = dayOfMonth > 0 ? Math.round((mtdWalkIns / dayOfMonth) * daysInMonth) : 0;

    // 3. Chart Data (Aggregation by Date)
    const chartData = periodDays.map(day => {
      const dateStr = day.toISOString();
      const dayStrFormatted = format(day, 'yyyy-MM-dd');

      const dayPerfs = periodPerformance.filter(p => p.dateStr === dayStrFormatted);
      const dayActs = periodActivities.filter(a => a.dateStr === dayStrFormatted);

      const dayWalkIns = dayPerfs.reduce((acc, p) => acc + (p.walkins_count || 0), 0) +
        dayActs.filter(a => a.type === 'walk_in').length;

      const dayMeetings = dayPerfs.reduce((acc, p) => acc + (p.meetings_count || 0), 0);
      const dayFollowups = dayPerfs.reduce((acc, p) => acc + (p.followups_count || 0), 0);

      const dayClosures = dayPerfs.reduce((acc, p) => acc + (p.bookings_count || 0), 0) +
        dayActs.filter(a => (a.type === 'closure' || a.status === 'closed_won')).length;

      return {
        date: dateStr,
        walkIns: dayWalkIns,
        meetings: dayMeetings,
        followups: dayFollowups,
        closures: dayClosures
      };
    });

    return {
      userStats,
      totals: {
        mtdBookings,
        teamBookingTarget,
        teamWalkInTarget,
        mtdPerformancePct,
        forecastBookings,
        todayWalkIns,
        todayMeetings,
        todayFollowups,
        todayClosures,
        mtdWalkIns,
        forecastWalkIns,
        // Kept for backward compat or other uses
        walkIns: totalWalkIns,
        meetings: totalMeetings,
        followups: totalFollowups,
        closures: totalClosures
      },
      chartData,
      period: settings.tracking_period_days
    };

  }, [salesUsers, dailyPerformance, salesActivities, targets, settings.tracking_period_days, settings.min_walkins_per_day, settings.min_closures_per_period]);

  if (!dashboardData) return null;

  return (
    <div className="space-y-8">
      {/* Top Summary Panel */}
      <SalesSummaryCards
        mtdBookings={dashboardData.totals.mtdBookings}
        teamBookingTarget={dashboardData.totals.teamBookingTarget}
        mtdPerformancePct={dashboardData.totals.mtdPerformancePct}
        forecastBookings={dashboardData.totals.forecastBookings}
        todayWalkIns={dashboardData.totals.todayWalkIns}
        todayMeetings={dashboardData.totals.todayMeetings}
        todayFollowups={dashboardData.totals.todayFollowups}
        todayClosures={dashboardData.totals.todayClosures}
        mtdWalkIns={dashboardData.totals.mtdWalkIns}
        forecastWalkIns={dashboardData.totals.forecastWalkIns}
        teamWalkInTarget={dashboardData.totals.teamWalkInTarget}
      />

      {/* Underperformer Alerts - Moved to top row */}
      <SalesUnderperformers userStats={dashboardData.userStats} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Detailed Reports Section */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-900">Performance Trends</h3>
            <SalesTrendChart
              data={dashboardData.chartData}
              period={dashboardData.period}
            />
          </div>
        </div>

        {!isSalesExec && (
          <div className="space-y-8">
            <SalesPerformanceBreakdown
              activities={dailyPerformance}
              currentUser={currentUser}
            />
          </div>
        )}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Team Target Performance</h3>
        <SalesTeamTable
          userStats={dashboardData.userStats}
          trackingPeriod={dashboardData.period}
        />
      </div>
    </div>
  );
}