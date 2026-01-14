import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, Trophy, TrendingUp, TrendingDown, Calendar as CalendarIcon, 
  Users, Filter, ArrowUpDown, FileSpreadsheet, FileText, Target, Award, Sparkles
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { isSalesManager } from '@/components/utils/salesPermissions';

export default function SalesMemberComparison({ users = [], departments = [], projects = [] }) {
  const today = new Date();
  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setCurrentUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);
  
  const [dateRangeType, setDateRangeType] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedProject, setSelectedProject] = useState('all');
  const [sortBy, setSortBy] = useState('performance');
  const [sortOrder, setSortOrder] = useState('desc');

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    switch (dateRangeType) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case 'week':
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'custom':
        return { 
          start: startOfDay(parseISO(customStartDate)), 
          end: endOfDay(parseISO(customEndDate)) 
        };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  }, [dateRangeType, customStartDate, customEndDate]);

  // Fetch data
  const { data: activities = [] } = useQuery({
    queryKey: ['sales-activities-comparison'],
    queryFn: () => base44.entities.SalesActivity.filter({}, '-date', 5000),
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['sales-targets-comparison'],
    queryFn: () => base44.entities.SalesTarget.list(),
  });

  const { data: dailyPerformance = [] } = useQuery({
    queryKey: ['daily-performance-comparison'],
    queryFn: () => base44.entities.DailySalesPerformance.filter({}, '-date', 5000),
  });

  // Get sales department IDs
  const salesDeptIds = departments
    .filter(d => d.name?.toLowerCase().includes('sales'))
    .map(d => d.id);

  const isSalesMgr = isSalesManager(currentUser);

  // Filter users by department and hierarchy
  const filteredUsers = useMemo(() => {
    let baseFilteredUsers = users.filter(u => {
      if (!u.department_id || !salesDeptIds.includes(u.department_id)) return false;
      if (selectedDepartment !== 'all' && u.department_id !== selectedDepartment) return false;
      return true;
    });

    // Sales Manager: only see themselves + their direct reports
    if (isSalesMgr && currentUser) {
      baseFilteredUsers = baseFilteredUsers.filter(u => {
        if (u.email?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
        if (u.reports_to?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
        return false;
      });
    }

    return baseFilteredUsers;
  }, [users, salesDeptIds, selectedDepartment, isSalesMgr, currentUser]);

  // Calculate metrics for each user
  const userMetrics = useMemo(() => {
    // Apply member selection filter here only for metrics calculation
    const usersToCalculate = selectedMembers.length > 0 
      ? filteredUsers.filter(u => selectedMembers.includes(u.email))
      : filteredUsers;
      
    return usersToCalculate.map(user => {
      // Filter activities for this user within date range
      const userActivities = activities.filter(a => {
        if (a.user_email !== user.email) return false;
        const activityDate = parseISO(a.date);
        if (!isWithinInterval(activityDate, dateRange)) return false;
        if (selectedProject !== 'all' && a.project_id !== selectedProject) return false;
        return true;
      });

      // Filter daily performance for this user within date range
      const userDailyPerf = dailyPerformance.filter(dp => {
        if (dp.user_email !== user.email) return false;
        const perfDate = parseISO(dp.date);
        return isWithinInterval(perfDate, dateRange);
      });

      // Calculate metrics (count approved and pending activities, exclude only rejected/changes_requested)
      const walkIns = userActivities.filter(a => 
        a.type === 'walk_in' && 
        (!a.approval_status || a.approval_status === 'approved' || a.approval_status === 'pending' || a.approval_status === 'pending_assignment')
      ).length;
      const closures = userActivities.filter(a => 
        a.type === 'closure' && 
        (!a.approval_status || a.approval_status === 'approved' || a.approval_status === 'pending' || a.approval_status === 'pending_assignment')
      ).length;
      const meetings = userDailyPerf.reduce((sum, dp) => sum + (dp.meetings || 0), 0);
      const followUps = userDailyPerf.reduce((sum, dp) => sum + (dp.follow_ups || 0), 0);
      const siteVisits = userDailyPerf.reduce((sum, dp) => sum + (dp.site_visits || 0), 0);

      // Get target for this user
      const monthKey = format(dateRange.start, 'yyyy-MM');
      const userTarget = targets.find(t => 
        t.user_email === user.email && 
        t.month === monthKey
      );

      const targetWalkIns = userTarget?.walk_ins_target || 0;
      const targetClosures = userTarget?.closures_target || 0;

      // Calculate performance percentage
      let performancePercentage = 0;
      if (targetWalkIns > 0 || targetClosures > 0) {
        const walkInPerf = targetWalkIns > 0 ? (walkIns / targetWalkIns) * 100 : 100;
        const closurePerf = targetClosures > 0 ? (closures / targetClosures) * 100 : 100;
        performancePercentage = (walkInPerf + closurePerf) / 2;
      }

      // Simple forecast (based on current pace)
      const daysInRange = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.ceil((new Date() - dateRange.start) / (1000 * 60 * 60 * 24));
      const projectedWalkIns = daysElapsed > 0 ? Math.round((walkIns / daysElapsed) * daysInRange) : walkIns;
      const projectedClosures = daysElapsed > 0 ? Math.round((closures / daysElapsed) * daysInRange) : closures;

      return {
        user,
        walkIns,
        closures,
        meetings,
        followUps,
        siteVisits,
        targetWalkIns,
        targetClosures,
        performancePercentage: Math.round(performancePercentage * 10) / 10,
        projectedWalkIns,
        projectedClosures,
        totalActivities: walkIns + closures + meetings + followUps + siteVisits
      };
    });
  }, [filteredUsers, activities, dailyPerformance, targets, dateRange, selectedProject, selectedMembers]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    const sorted = [...userMetrics].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'walkIns':
          valueA = a.walkIns;
          valueB = b.walkIns;
          break;
        case 'closures':
          valueA = a.closures;
          valueB = b.closures;
          break;
        case 'meetings':
          valueA = a.meetings;
          valueB = b.meetings;
          break;
        case 'followUps':
          valueA = a.followUps;
          valueB = b.followUps;
          break;
        case 'siteVisits':
          valueA = a.siteVisits;
          valueB = b.siteVisits;
          break;
        case 'performance':
          valueA = a.performancePercentage;
          valueB = b.performancePercentage;
          break;
        case 'total':
          valueA = a.totalActivities;
          valueB = b.totalActivities;
          break;
        default:
          valueA = a.performancePercentage;
          valueB = b.performancePercentage;
      }

      const primaryComparison = sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
      
      // Tiebreaker: if primary values are equal, sort by total activities
      if (primaryComparison === 0) {
        return b.totalActivities - a.totalActivities;
      }
      
      return primaryComparison;
    });

    return sorted;
  }, [userMetrics, sortBy, sortOrder]);

  const bestPerformer = sortedMetrics.length > 0 ? sortedMetrics[0] : null;

  // Export handlers
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Sales Performance Comparison', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Period: ${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 14, 36);

    let y = 50;
    doc.setFontSize(12);
    doc.text('Performance Summary', 14, y);
    y += 10;

    doc.setFontSize(9);
    sortedMetrics.forEach((metric, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      const name = metric.user.full_name || metric.user.email;
      doc.text(`${index + 1}. ${name}`, 14, y);
      doc.text(`Walk-ins: ${metric.walkIns} | Closures: ${metric.closures} | Performance: ${metric.performancePercentage}%`, 14, y + 5);
      y += 12;
    });

    doc.save('sales_comparison.pdf');
    toast.success('PDF exported successfully');
  };

  const exportToCSV = () => {
    const headers = ['Rank', 'Name', 'Walk-ins', 'Target Walk-ins', 'Closures', 'Target Closures', 'Meetings', 'Follow-ups', 'Site Visits', 'Performance %', 'Forecast Walk-ins', 'Forecast Closures'];
    const rows = sortedMetrics.map((m, i) => [
      i + 1,
      m.user.full_name || m.user.email,
      m.walkIns,
      m.targetWalkIns,
      m.closures,
      m.targetClosures,
      m.meetings,
      m.followUps,
      m.siteVisits,
      m.performancePercentage,
      m.projectedWalkIns,
      m.projectedClosures
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_comparison.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const toggleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  // Summary stats
  const totalWalkIns = sortedMetrics.reduce((sum, m) => sum + m.walkIns, 0);
  const totalClosures = sortedMetrics.reduce((sum, m) => sum + m.closures, 0);
  const totalMeetings = sortedMetrics.reduce((sum, m) => sum + m.meetings, 0);
  const totalFollowUps = sortedMetrics.reduce((sum, m) => sum + m.followUps, 0);
  const avgPerformance = sortedMetrics.length > 0 
    ? Math.round((sortedMetrics.reduce((sum, m) => sum + m.performancePercentage, 0) / sortedMetrics.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Filters Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Comparison Filters
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRangeType} onValueChange={setDateRangeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRangeType === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Department Filter */}
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.filter(d => salesDeptIds.includes(d.id)).map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Filter */}
            <div className="space-y-2">
              <Label>Project (Optional)</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(proj => (
                    <SelectItem key={proj.id} value={proj.id}>{proj.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Member Multi-select */}
          <div className="mt-4 space-y-2">
            <Label>Select Members (Optional - Leave empty for all)</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50">
              {filteredUsers.map(user => (
                <Badge
                  key={user.email}
                  variant={selectedMembers.includes(user.email) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedMembers(prev =>
                      prev.includes(user.email)
                        ? prev.filter(e => e !== user.email)
                        : [...prev, user.email]
                    );
                  }}
                >
                  {user.full_name || user.email}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-blue-600">{totalWalkIns}</div>
                <p className="text-sm text-slate-600 mt-1 font-medium">Total Walk-ins</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-emerald-600">{totalClosures}</div>
                <p className="text-sm text-slate-600 mt-1 font-medium">Total Closures</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <Award className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-purple-600">{totalMeetings}</div>
                <p className="text-sm text-slate-600 mt-1 font-medium">Total Meetings</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <CalendarIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-amber-600">{totalFollowUps}</div>
                <p className="text-sm text-slate-600 mt-1 font-medium">Total Follow-ups</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-indigo-600">{avgPerformance}%</div>
                <p className="text-sm text-slate-600 mt-1 font-medium">Avg Performance</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-full">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Performer Highlight */}
      {bestPerformer && (
        <Card className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/20 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-200/20 rounded-full -ml-12 -mb-12" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-400 rounded-full animate-pulse opacity-20" />
                <Trophy className="w-16 h-16 text-amber-500 relative z-10" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-bold text-slate-900">🏆 Top Performer</h3>
                </div>
                <p className="text-3xl font-bold text-amber-600 mt-1">
                  {bestPerformer.user.full_name || bestPerformer.user.email}
                </p>
                <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {bestPerformer.walkIns} Walk-ins
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    {bestPerformer.closures} Closures
                  </span>
                </div>
              </div>
              <div className="text-right bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-md border border-amber-200">
                <div className="text-5xl font-bold text-amber-600">{bestPerformer.performancePercentage}%</div>
                <p className="text-sm text-slate-600 mt-2 font-medium">Performance Score</p>
                <Badge className="mt-2 bg-amber-500 hover:bg-amber-600">
                  {bestPerformer.performancePercentage >= 100 ? 'Target Exceeded' : 'Leading'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Performance Comparison ({sortedMetrics.length} members)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-12 bg-slate-50">#</TableHead>
                  <TableHead className="bg-slate-50">Member</TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('walkIns')}>
                    <div className="flex items-center gap-1">
                      Walk-ins <ArrowUpDown className={`w-3 h-3 ${sortBy === 'walkIns' ? 'text-indigo-600' : ''}`} />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('closures')}>
                    <div className="flex items-center gap-1">
                      Closures <ArrowUpDown className={`w-3 h-3 ${sortBy === 'closures' ? 'text-indigo-600' : ''}`} />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('meetings')}>
                    <div className="flex items-center gap-1">
                      Meetings <ArrowUpDown className={`w-3 h-3 ${sortBy === 'meetings' ? 'text-indigo-600' : ''}`} />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('followUps')}>
                    <div className="flex items-center gap-1">
                      Follow-ups <ArrowUpDown className={`w-3 h-3 ${sortBy === 'followUps' ? 'text-indigo-600' : ''}`} />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('siteVisits')}>
                    <div className="flex items-center gap-1">
                      Site Visits <ArrowUpDown className={`w-3 h-3 ${sortBy === 'siteVisits' ? 'text-indigo-600' : ''}`} />
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleSort('performance')}>
                    <div className="flex items-center gap-1">
                      Performance % <ArrowUpDown className={`w-3 h-3 ${sortBy === 'performance' ? 'text-indigo-600' : ''}`} />
                    </div>
                  </TableHead>
                  <TableHead className="bg-slate-50">Forecast</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.map((metric, index) => {
                  const isBest = index === 0;
                  const performanceColor = 
                    metric.performancePercentage >= 100 ? 'text-emerald-600' :
                    metric.performancePercentage >= 75 ? 'text-blue-600' :
                    metric.performancePercentage >= 50 ? 'text-amber-600' : 'text-red-600';

                  return (
                    <TableRow 
                      key={metric.user.email}
                      className={`hover:bg-slate-50 transition-colors ${isBest ? 'bg-gradient-to-r from-amber-50 to-yellow-50/50 border-l-4 border-l-amber-400' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isBest && <Trophy className="w-5 h-5 text-amber-500 animate-pulse" />}
                          <span className={`font-mono ${isBest ? 'font-bold text-amber-600' : 'text-slate-600'}`}>
                            {index + 1}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={`w-10 h-10 ${isBest ? 'ring-2 ring-amber-400' : ''}`}>
                            <AvatarFallback className={`text-xs font-semibold ${isBest ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                              {getInitials(metric.user.full_name || metric.user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className={`font-medium ${isBest ? 'text-amber-900' : ''}`}>
                              {metric.user.full_name || metric.user.email.split('@')[0]}
                              {isBest && <Badge className="ml-2 bg-amber-500 text-xs">🥇 Best</Badge>}
                            </div>
                            <div className="text-xs text-slate-500">{metric.user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-blue-600">{metric.walkIns}</span>
                            {metric.targetWalkIns > 0 && (
                              <span className="text-xs text-slate-500">of {metric.targetWalkIns}</span>
                            )}
                          </div>
                          {metric.targetWalkIns > 0 && (
                            <div className="w-16 bg-slate-100 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min((metric.walkIns / metric.targetWalkIns) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-emerald-600">{metric.closures}</span>
                            {metric.targetClosures > 0 && (
                              <span className="text-xs text-slate-500">of {metric.targetClosures}</span>
                            )}
                          </div>
                          {metric.targetClosures > 0 && (
                            <div className="w-16 bg-slate-100 rounded-full h-2">
                              <div 
                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min((metric.closures / metric.targetClosures) * 100, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold text-purple-600 border-purple-300">
                          {metric.meetings}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold text-amber-600 border-amber-300">
                          {metric.followUps}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold text-indigo-600 border-indigo-300">
                          {metric.siteVisits}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`font-bold text-xl px-3 py-1 rounded-lg ${
                            metric.performancePercentage >= 100 ? 'bg-emerald-100 text-emerald-700' :
                            metric.performancePercentage >= 75 ? 'bg-blue-100 text-blue-700' :
                            metric.performancePercentage >= 50 ? 'bg-amber-100 text-amber-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {metric.performancePercentage}%
                          </div>
                          {metric.performancePercentage >= 100 ? (
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1 bg-slate-50 p-2 rounded-lg">
                          <div className="flex items-center justify-between text-slate-700">
                            <span>Walk-ins:</span>
                            <span className="font-bold text-blue-600">{metric.projectedWalkIns}</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-700">
                            <span>Closures:</span>
                            <span className="font-bold text-emerald-600">{metric.projectedClosures}</span>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedMetrics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                      No data found for the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}