import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, parseISO, isWithinInterval } from 'date-fns';
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
  Download, Trophy, TrendingUp, TrendingDown, FileSpreadsheet, FileText,
  Video, FileImage, BookOpen, FileText as FlyerIcon, Instagram, Facebook, Linkedin
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

export default function MarketingKPIDashboard({ users = [], departments = [] }) {
  const today = new Date();

  const [dateRangeType, setDateRangeType] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(today), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(today), 'yyyy-MM-dd'));
  const [selectedMembers, setSelectedMembers] = useState([]);

  const dateRange = useMemo(() => {
    switch (dateRangeType) {
      case 'today':
        return { start: startOfDay(today), end: endOfDay(today) };
      case 'week':
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'quarter':
        return { start: startOfQuarter(today), end: endOfQuarter(today) };
      case 'year':
        return { start: startOfYear(today), end: endOfYear(today) };
      case 'custom':
        return {
          start: startOfDay(parseISO(customStartDate)),
          end: endOfDay(parseISO(customEndDate))
        };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  }, [dateRangeType, customStartDate, customEndDate]);

  const { data: performanceLogs = [] } = useQuery({
    queryKey: ['marketing-performance-logs'],
    queryFn: () => base44.entities.MarketingPerformanceLog.filter({}, '-date', 5000),
  });

  const { data: kpiSettings = [] } = useQuery({
    queryKey: ['marketing-kpi-settings'],
    queryFn: () => base44.entities.MarketingKPISettings.list(),
  });

  const marketingDeptIds = departments
    .filter(d => d.name?.toLowerCase().includes('marketing'))
    .map(d => d.id);

  const marketingUsers = users.filter(u => u.department_id && marketingDeptIds.includes(u.department_id));

  const filteredUsers = useMemo(() => {
    return marketingUsers.filter(u => {
      if (selectedMembers.length > 0 && !selectedMembers.includes(u.email)) return false;
      return true;
    });
  }, [marketingUsers, selectedMembers]);

  const currentSettings = kpiSettings.find(s => s.month === format(dateRange.start, 'yyyy-MM')) || kpiSettings[0];

  const userMetrics = useMemo(() => {
    return filteredUsers.map(user => {
      const userLogs = performanceLogs.filter(log => {
        if (log.user_email !== user.email) return false;
        const logDate = parseISO(log.date);
        return isWithinInterval(logDate, dateRange);
      });

      const egc = userLogs.reduce((sum, log) => sum + (log.content_output?.egc_content || 0), 0);
      const awareness = userLogs.reduce((sum, log) => sum + (log.content_output?.awareness_videos || 0), 0);
      const educational = userLogs.reduce((sum, log) => sum + (log.content_output?.educational_content || 0), 0);
      const flyers = userLogs.reduce((sum, log) => sum + (log.content_output?.flyers || 0), 0);

      const instagram = userLogs.reduce((sum, log) => sum + (log.social_growth?.instagram_followers || 0), 0);
      const facebook = userLogs.reduce((sum, log) => sum + (log.social_growth?.facebook_followers || 0), 0);
      const linkedin = userLogs.reduce((sum, log) => sum + (log.social_growth?.linkedin_followers || 0), 0);

      const posts = userLogs.reduce((sum, log) => sum + (log.engagement_metrics?.posts_published || 0), 0);
      const engagement = userLogs.reduce((sum, log) => sum + (log.engagement_metrics?.total_engagement || 0), 0);

      // Calculate performance based on targets
      let performancePercentage = 0;
      if (currentSettings) {
        const isWeekly = dateRangeType === 'week';
        const targets = currentSettings[isWeekly ? 'content_targets' : 'content_targets'];

        const egcTarget = isWeekly ? targets?.egc_weekly : targets?.egc_monthly;
        const awarenessTarget = isWeekly ? targets?.awareness_weekly : targets?.awareness_monthly;
        const educationalTarget = isWeekly ? targets?.educational_weekly : targets?.educational_monthly;
        const flyersTarget = isWeekly ? targets?.flyers_weekly : targets?.flyers_monthly;

        const contentPerf = [
          egcTarget ? (egc / egcTarget) * 100 : 0,
          awarenessTarget ? (awareness / awarenessTarget) * 100 : 0,
          educationalTarget ? (educational / educationalTarget) * 100 : 0,
          flyersTarget ? (flyers / flyersTarget) * 100 : 0,
        ].filter(p => p > 0);

        performancePercentage = contentPerf.length > 0
          ? contentPerf.reduce((sum, p) => sum + p, 0) / contentPerf.length
          : 0;
      }

      return {
        user,
        egc,
        awareness,
        educational,
        flyers,
        instagram,
        facebook,
        linkedin,
        posts,
        engagement,
        performancePercentage: Math.round(performancePercentage * 10) / 10,
        totalContent: egc + awareness + educational + flyers
      };
    });
  }, [filteredUsers, performanceLogs, dateRange, currentSettings, dateRangeType]);

  const sortedMetrics = [...userMetrics].sort((a, b) => b.performancePercentage - a.performancePercentage);
  const bestPerformer = sortedMetrics.length > 0 ? sortedMetrics[0] : null;

  // Calculate Production Goals vs Actuals
  const productionStats = useMemo(() => {
    // 1. Calculate Actuals from all filtered logs
    const actuals = {
      planning: 0,
      shoot: 0,
      editing: 0
    };

    // Filter logs for the selected date range
    const relevantLogs = performanceLogs.filter(log => {
      const logDate = parseISO(log.date);
      return isWithinInterval(logDate, dateRange);
    });

    relevantLogs.forEach(log => {
      actuals.planning += (log.production_workflow?.planning_completed || 0);
      actuals.shoot += (log.production_workflow?.shoots_completed || 0);
      actuals.editing += (log.production_workflow?.edits_completed || 0);
    });

    // 2. Get Goals based on timeframe
    let goals = { planning: 0, shoot: 0, editing: 0 };
    if (currentSettings?.production_goals) {
      const timeframeKey =
        dateRangeType === 'week' ? 'weekly' :
          dateRangeType === 'month' ? 'monthly' :
            dateRangeType === 'quarter' ? 'quarterly' :
              dateRangeType === 'year' ? 'yearly' : 'monthly'; // Default to monthly if custom or unknown

      goals.planning = currentSettings.production_goals.planning?.[timeframeKey] || 0;
      goals.shoot = currentSettings.production_goals.shoot?.[timeframeKey] || 0;
      goals.editing = currentSettings.production_goals.editing?.[timeframeKey] || 0;
    }

    // 3. Calculate Progress
    return {
      planning: { actual: actuals.planning, goal: goals.planning, percent: goals.planning ? Math.min((actuals.planning / goals.planning) * 100, 100) : 0 },
      shoot: { actual: actuals.shoot, goal: goals.shoot, percent: goals.shoot ? Math.min((actuals.shoot / goals.shoot) * 100, 100) : 0 },
      editing: { actual: actuals.editing, goal: goals.editing, percent: goals.editing ? Math.min((actuals.editing / goals.editing) * 100, 100) : 0 },
    };
  }, [performanceLogs, dateRange, currentSettings, dateRangeType]);

  // Summary stats
  const totalEGC = sortedMetrics.reduce((sum, m) => sum + m.egc, 0);
  const totalAwareness = sortedMetrics.reduce((sum, m) => sum + m.awareness, 0);
  const totalEducational = sortedMetrics.reduce((sum, m) => sum + m.educational, 0);
  const totalFlyers = sortedMetrics.reduce((sum, m) => sum + m.flyers, 0);
  const totalInstagram = sortedMetrics.reduce((sum, m) => sum + m.instagram, 0);
  const totalFacebook = sortedMetrics.reduce((sum, m) => sum + m.facebook, 0);
  const totalLinkedIn = sortedMetrics.reduce((sum, m) => sum + m.linkedin, 0);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Marketing KPI Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`, 14, 30);

    let y = 45;
    sortedMetrics.forEach((metric, index) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const name = metric.user.full_name || metric.user.email;
      doc.text(`${index + 1}. ${name} - ${metric.performancePercentage}%`, 14, y);
      y += 7;
    });

    doc.save('marketing_kpi_report.pdf');
    toast.success('PDF exported');
  };

  const exportToCSV = () => {
    const headers = ['Rank', 'Name', 'EGC', 'Awareness', 'Educational', 'Flyers', 'Instagram', 'Facebook', 'LinkedIn', 'Performance %'];
    const rows = sortedMetrics.map((m, i) => [
      i + 1,
      m.user.full_name || m.user.email,
      m.egc,
      m.awareness,
      m.educational,
      m.flyers,
      m.instagram,
      m.facebook,
      m.linkedin,
      m.performancePercentage
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marketing_kpi_report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>KPI Filters</CardTitle>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <Select value={dateRangeType} onValueChange={setDateRangeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
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
          </div>

          <div className="mt-4 space-y-2">
            <Label>Filter by Members (Optional)</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-slate-50">
              {marketingUsers.map(user => (
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

      {/* Production Goals Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-bold text-slate-800">{productionStats.planning.actual}</span>
              <span className="text-sm text-slate-500">Goal: {productionStats.planning.goal}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${productionStats.planning.percent}%` }}
              />
            </div>
            <p className="text-xs text-right mt-1 text-slate-400">{Math.round(productionStats.planning.percent)}%</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Shooting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-bold text-slate-800">{productionStats.shoot.actual}</span>
              <span className="text-sm text-slate-500">Goal: {productionStats.shoot.goal}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${productionStats.shoot.percent}%` }}
              />
            </div>
            <p className="text-xs text-right mt-1 text-slate-400">{Math.round(productionStats.shoot.percent)}%</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Editing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end mb-2">
              <span className="text-2xl font-bold text-slate-800">{productionStats.editing.actual}</span>
              <span className="text-sm text-slate-500">Goal: {productionStats.editing.goal}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${productionStats.editing.percent}%` }}
              />
            </div>
            <p className="text-xs text-right mt-1 text-slate-400">{Math.round(productionStats.editing.percent)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardContent className="pt-6">
            <Video className="w-8 h-8 text-indigo-500 mb-2" />
            <div className="text-2xl font-bold">{totalEGC}</div>
            <p className="text-xs text-slate-500 mt-1">EGC Content</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Video className="w-8 h-8 text-blue-500 mb-2" />
            <div className="text-2xl font-bold">{totalAwareness}</div>
            <p className="text-xs text-slate-500 mt-1">Awareness Videos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <BookOpen className="w-8 h-8 text-emerald-500 mb-2" />
            <div className="text-2xl font-bold">{totalEducational}</div>
            <p className="text-xs text-slate-500 mt-1">Educational</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <FlyerIcon className="w-8 h-8 text-purple-500 mb-2" />
            <div className="text-2xl font-bold">{totalFlyers}</div>
            <p className="text-xs text-slate-500 mt-1">Flyers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Instagram className="w-8 h-8 text-pink-500 mb-2" />
            <div className="text-2xl font-bold">{totalInstagram}</div>
            <p className="text-xs text-slate-500 mt-1">Instagram</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Facebook className="w-8 h-8 text-blue-600 mb-2" />
            <div className="text-2xl font-bold">{totalFacebook}</div>
            <p className="text-xs text-slate-500 mt-1">Facebook</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Linkedin className="w-8 h-8 text-blue-700 mb-2" />
            <div className="text-2xl font-bold">{totalLinkedIn}</div>
            <p className="text-xs text-slate-500 mt-1">LinkedIn</p>
          </CardContent>
        </Card>
      </div>

      {/* Best Performer */}
      {
        bestPerformer && bestPerformer.performancePercentage > 0 && (
          <Card className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Trophy className="w-12 h-12 text-amber-500" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900">Best Performer</h3>
                  <p className="text-2xl font-bold text-amber-600 mt-1">
                    {bestPerformer.user.full_name || bestPerformer.user.email}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-amber-600">{bestPerformer.performancePercentage}%</div>
                  <p className="text-sm text-slate-600 mt-1">Target Achievement</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      }

      {/* Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance ({sortedMetrics.length} members)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>EGC</TableHead>
                  <TableHead>Awareness</TableHead>
                  <TableHead>Educational</TableHead>
                  <TableHead>Flyers</TableHead>
                  <TableHead>Instagram</TableHead>
                  <TableHead>Facebook</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Performance %</TableHead>
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
                    <TableRow key={metric.user.email} className={isBest ? 'bg-amber-50/50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isBest && <Trophy className="w-4 h-4 text-amber-500" />}
                          <span className="font-mono text-sm">{index + 1}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700">
                              {getInitials(metric.user.full_name || metric.user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{metric.user.full_name || metric.user.email.split('@')[0]}</div>
                            <div className="text-xs text-slate-500">{metric.user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell><span className="font-semibold">{metric.egc}</span></TableCell>
                      <TableCell><span className="font-semibold">{metric.awareness}</span></TableCell>
                      <TableCell><span className="font-semibold">{metric.educational}</span></TableCell>
                      <TableCell><span className="font-semibold">{metric.flyers}</span></TableCell>
                      <TableCell><span className="font-semibold">{metric.instagram}</span></TableCell>
                      <TableCell><span className="font-semibold">{metric.facebook}</span></TableCell>
                      <TableCell><span className="font-semibold">{metric.linkedin}</span></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-lg ${performanceColor}`}>
                            {metric.performancePercentage}%
                          </span>
                          {metric.performancePercentage >= 100 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sortedMetrics.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                      No performance data found for the selected period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div >
  );
}