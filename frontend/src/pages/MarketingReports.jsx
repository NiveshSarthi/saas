import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download, Filter, TrendingUp, DollarSign, Eye, MousePointerClick,
  Share2, Calendar as CalendarIcon, Plus
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import LogAnalyticsDialog from '@/components/marketing/LogAnalyticsDialog';

// Helper to download CSV
const downloadCSV = (data, filename) => {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => Object.values(obj).join(','));
  const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function MarketingReports() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedContentType, setSelectedContentType] = useState('all'); // Added
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Fetch Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['marketing-tasks'],
    queryFn: () => base44.entities.MarketingTask.list(),
  });

  // Fetch Analytics History
  const { data: analytics = [] } = useQuery({
    queryKey: ['marketing-analytics'],
    queryFn: () => base44.entities.MarketingAnalytics.list('-date', 1000), // Get reasonable amount
  });

  // Filter Data
  const filteredData = useMemo(() => {
    let filteredAnalytics = analytics.filter(item => {
      const date = parseISO(item.date);
      const inDateRange = isWithinInterval(date, { start: dateRange.from, end: dateRange.to });

      const task = tasks.find(t => t.id === item.task_id);
      const matchesPlatform = selectedPlatform === 'all' || (task?.platforms || []).includes(selectedPlatform);
      const matchesCampaign = selectedCampaign === 'all' || task?.id === selectedCampaign;
      const matchesContentType = selectedContentType === 'all' || task?.task_type === selectedContentType; // Added

      return inDateRange && matchesPlatform && matchesCampaign && matchesContentType;
    });

    // Aggregate by Date
    const aggregatedByDate = filteredAnalytics.reduce((acc, curr) => {
      const date = curr.date;
      if (!acc[date]) {
        acc[date] = { date, views: 0, likes: 0, shares: 0, ctr: 0, spend: 0, count: 0 };
      }
      acc[date].views += curr.views || 0;
      acc[date].likes += curr.likes || 0;
      acc[date].shares += curr.shares || 0;
      acc[date].spend += curr.spend || 0;
      // Weighted CTR average is hard without impressions, simplified average:
      acc[date].ctr += curr.ctr || 0;
      acc[date].count += 1;
      return acc;
    }, {});

    return Object.values(aggregatedByDate)
      .map(d => ({ ...d, ctr: d.count ? Number((d.ctr / d.count).toFixed(2)) : 0 }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [analytics, tasks, dateRange, selectedPlatform, selectedCampaign]);

  // Aggregate Totals
  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      views: acc.views + curr.views,
      likes: acc.likes + curr.likes,
      shares: acc.shares + curr.shares,
      spend: acc.spend + curr.spend,
      ctr: acc.ctr + curr.ctr // Sum for now, avg later
    }), { views: 0, likes: 0, shares: 0, spend: 0, ctr: 0 });
  }, [filteredData]);

  const avgCtr = filteredData.length ? (totals.ctr / filteredData.length).toFixed(2) : 0;

  // Calculate video targets and actuals
  const videoTargets = {
    awareness_video: 32,
    campaign_video: 16,
    egc_videos: 12
  };

  const videoActuals = useMemo(() => {
    const filtered = tasks.filter(t => {
      if (t.task_type !== 'video' || !t.video_subcategory) return false;
      const taskDate = t.created_date ? parseISO(t.created_date.split('T')[0]) : null;
      return taskDate && isWithinInterval(taskDate, { start: dateRange.from, end: dateRange.to });
    });

    return {
      awareness_video: filtered.filter(t => t.video_subcategory === 'awareness_video').length,
      campaign_video: filtered.filter(t => t.video_subcategory === 'campaign_video').length,
      egc_videos: filtered.filter(t => t.video_subcategory === 'egc_videos').length
    };
  }, [tasks, dateRange]);

  // Status counts for Performance Overview
  const statusCounts = useMemo(() => {
    const filtered = tasks.filter(t => {
      const taskDate = t.created_date ? parseISO(t.created_date.split('T')[0]) : null;
      return taskDate && isWithinInterval(taskDate, { start: dateRange.from, end: dateRange.to });
    });

    const trashCount = filtered.filter(t => t.status === 'trash').length;
    const totalExcludingTrash = filtered.length - trashCount;
    const approvedButNotPublished = filtered.filter(t => t.status === 'approved').length;
    const published = filtered.filter(t => t.status === 'published').length;

    return {
      total: totalExcludingTrash,
      editing: filtered.filter(t => t.status === 'editing').length,
      review: filtered.filter(t => ['review', 'compliance', 'compliance_revision'].includes(t.status)).length,
      readyUnpublished: approvedButNotPublished,
      readyPublished: published,
      trash: trashCount
    };
  }, [tasks, dateRange]);

  // Export Handlers
  const handleExportPDF = () => {
    const doc = new jsPDF();

    // Header with gradient background
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Marketing Campaign Report', 14, 18);

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Period: ${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`, 14, 28);
    doc.text(`Platform: ${selectedPlatform === 'all' ? 'All Platforms' : selectedPlatform}`, 14, 34);

    // Performance Overview Section
    let y = 52;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Performance Overview', 14, y);

    y += 10;
    const cardWidth = 36;
    const cardHeight = 24;
    const gap = 2;

    // Total Card
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Total', 18, y + 5);
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text(statusCounts.total.toString(), 18, y + 13);
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('(excl. Trash)', 18, y + 19);

    // Ready Card
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14 + cardWidth + gap, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Ready', 18 + cardWidth + gap, y + 5);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${statusCounts.readyUnpublished} / ${statusCounts.readyPublished}`, 18 + cardWidth + gap, y + 12);
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Unpub / Pub', 18 + cardWidth + gap, y + 18);

    // Editing Card
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(14 + (cardWidth + gap) * 2, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Editing', 18 + (cardWidth + gap) * 2, y + 5);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(statusCounts.editing.toString(), 18 + (cardWidth + gap) * 2, y + 13);

    // Review Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14 + (cardWidth + gap) * 3, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Review', 18 + (cardWidth + gap) * 3, y + 5);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(statusCounts.review.toString(), 18 + (cardWidth + gap) * 3, y + 13);

    // Trash Card
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14 + (cardWidth + gap) * 4, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Trash', 18 + (cardWidth + gap) * 4, y + 5);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(statusCounts.trash.toString(), 18 + (cardWidth + gap) * 4, y + 13);

    y += cardHeight + 4;

    // Video Specific Card for PDF (Requested feature)
    if (selectedContentType === 'video') {
      // Calculate video specific stats
      const videoTasks = tasks.filter(t => {
        const taskDate = t.created_date ? parseISO(t.created_date.split('T')[0]) : null;
        return t.task_type === 'video' && taskDate && isWithinInterval(taskDate, { start: dateRange.from, end: dateRange.to });
      });

      const totalShoot = videoTasks.filter(t => t.status === 'shooting' || t.status === 'editing' || t.status === 'review' || t.shoot_date).length;
      const totalPlanned = videoTasks.filter(t => t.status === 'idea' || t.status === 'scripting').length;

      y += 6;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Video Production Status', 14, y);
      y += 10;

      const videoCardWidth = 50;
      const gap = 6;

      // Card 1: Shoot (Active Production)
      doc.setFillColor(236, 254, 255); // Cyan-50
      doc.roundedRect(14, y, videoCardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Shoot (Active)', 18, y + 5);
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(totalShoot.toString(), 18, y + 13);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Active Production', 18, y + 19);

      // Card 2: Planned
      doc.setFillColor(240, 253, 244); // Green-50
      doc.roundedRect(14 + videoCardWidth + gap, y, videoCardWidth, cardHeight, 3, 3, 'F');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Planned', 18 + videoCardWidth + gap, y + 5);
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'bold');
      doc.text(totalPlanned.toString(), 18 + videoCardWidth + gap, y + 13);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Idea / Scripting', 18 + videoCardWidth + gap, y + 19);

      y += cardHeight + 10;
    }

    // Video Production Targets
    y += 6;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Video Production Targets', 14, y);

    y += 10;
    const targetCardWidth = 45;

    // Total Videos Card
    const totalProduced = videoActuals.awareness_video + videoActuals.campaign_video + videoActuals.egc_videos;
    const totalTarget = videoTargets.awareness_video + videoTargets.campaign_video + videoTargets.egc_videos;
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(14, y, targetCardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Total Videos', 18, y + 5);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${totalProduced} / ${totalTarget}`, 18, y + 13);

    // Awareness Videos
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14 + targetCardWidth + gap, y, targetCardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Awareness Videos', 18 + targetCardWidth + gap, y + 5);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${videoActuals.awareness_video} / ${videoTargets.awareness_video}`, 18 + targetCardWidth + gap, y + 13);

    // Campaign Videos
    doc.setFillColor(254, 249, 195);
    doc.roundedRect(14 + (targetCardWidth + gap) * 2, y, targetCardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Campaign Videos', 18 + (targetCardWidth + gap) * 2, y + 5);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${videoActuals.campaign_video} / ${videoTargets.campaign_video}`, 18 + (targetCardWidth + gap) * 2, y + 13);

    // EGC Videos
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14 + (targetCardWidth + gap) * 3, y, targetCardWidth, cardHeight, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('EGC Videos', 18 + (targetCardWidth + gap) * 3, y + 5);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${videoActuals.egc_videos} / ${videoTargets.egc_videos}`, 18 + (targetCardWidth + gap) * 3, y + 13);

    // Content Details Table
    y += 30;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Content Details', 14, y);

    y += 8;

    // Fetch tasks with details for table
    const contentTasks = tasks.filter(t => {
      const taskDate = t.created_date ? parseISO(t.created_date.split('T')[0]) : null;
      return taskDate && isWithinInterval(taskDate, { start: dateRange.from, end: dateRange.to });
    }).slice(0, 20); // Limit to 20 for PDF space

    // Table Header
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y - 4, 182, 8, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.rect(14, y - 4, 182, 8, 'S');

    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('Campaign', 16, y);
    doc.text('Type', 70, y);
    doc.text('Status', 95, y);
    doc.text('Category', 120, y);
    doc.text('Editing', 150, y);
    doc.text('Date', 170, y);

    y += 8;

    // Table Rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);

    contentTasks.forEach((task, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;

        // Repeat header
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, 182, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, y - 4, 182, 8, 'S');
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.text('Campaign', 16, y);
        doc.text('Type', 70, y);
        doc.text('Status', 95, y);
        doc.text('Category', 120, y);
        doc.text('Editing', 150, y);
        doc.text('Date', 170, y);
        y += 8;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(14, y - 4, 182, 7, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 3, 196, y + 3);

      doc.text((task.campaign_name || '-').substring(0, 20), 16, y);
      doc.text(task.task_type || '-', 70, y);
      doc.text(task.status || '-', 95, y);
      doc.text((task.video_subcategory || '-').replace('_', ' '), 120, y);
      doc.text(task.level_of_editing || '-', 150, y);
      doc.text(task.created_date ? format(parseISO(task.created_date), 'MMM d') : '-', 170, y);

      y += 7;
    });

    y += 8;

    // Table Rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    filteredData.forEach((row, index) => {
      if (y > 275) {
        doc.addPage();
        y = 20;

        // Repeat header on new page
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, 182, 8, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, y - 4, 182, 8, 'S');
        doc.setFontSize(9);
        doc.setFont(undefined, 'bold');
        doc.text('Date', 16, y);
        doc.text('Views', 50, y);
        doc.text('Engagement', 75, y);
        doc.text('Shares', 110, y);
        doc.text('CTR %', 135, y);
        doc.text('Spend ($)', 160, y);
        y += 8;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.setFillColor(249, 250, 251);
        doc.rect(14, y - 4, 182, 7, 'F');
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 3, 196, y + 3);

      doc.text(row.date ? format(parseISO(row.date), 'MMM d, yyyy') : '-', 16, y);
      doc.text((row.views || 0).toLocaleString(), 50, y);
      doc.text((row.likes || 0).toLocaleString(), 75, y);
      doc.text((row.shares || 0).toLocaleString(), 110, y);
      doc.text((row.ctr || 0).toString(), 135, y);
      doc.text((row.spend || 0).toLocaleString(), 160, y);

      y += 7;
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.setFont(undefined, 'normal');
      doc.text(`Page ${i} of ${pageCount}`, 14, 287);
      doc.text('Generated by Marketing Analytics System', 105, 287, { align: 'center' });
    }

    doc.save(`marketing_report_${format(dateRange.from, 'yyyy-MM-dd')}_to_${format(dateRange.to, 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF Report exported');
  };

  const handleExportCSV = () => {
    downloadCSV(filteredData, 'marketing_analytics.csv');
    toast.success('CSV Report exported');
  };

  return (
    <div className="flex-1 p-6 space-y-6 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Campaign Analytics</h1>
          <p className="text-slate-500">Track performance metrics, budget spend, and engagement trends.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsLogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Log Data
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button onClick={handleExportPDF} className="bg-indigo-600">
            <Download className="w-4 h-4 mr-2" /> PDF Report
          </Button>
        </div>
      </div>

      <LogAnalyticsDialog
        open={isLogOpen}
        onOpenChange={setIsLogOpen}
        tasks={tasks}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-white">
            <CalendarIcon className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={format(dateRange.from, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: parseISO(e.target.value) }))}
              className="text-sm outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={format(dateRange.to, 'yyyy-MM-dd')}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: parseISO(e.target.value) }))}
              className="text-sm outline-none"
            />
          </div>

          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="YouTube">YouTube</SelectItem>
              <SelectItem value="Instagram">Instagram</SelectItem>
              <SelectItem value="Facebook">Facebook</SelectItem>
              <SelectItem value="TikTok">TikTok</SelectItem>
              <SelectItem value="LinkedIn">LinkedIn</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {tasks.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.campaign_name}</SelectItem>
              ))}
              {tasks.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.campaign_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedContentType} onValueChange={setSelectedContentType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Content Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Content Types</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="blog">Blog</SelectItem>
              <SelectItem value="flyer">Flyer</SelectItem>
              <SelectItem value="poster">Poster</SelectItem>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="social_post">Social Post</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" onClick={() => {
            setDateRange({ from: subDays(new Date(), 30), to: new Date() });
            setSelectedPlatform('all');
            setSelectedCampaign('all');
            setSelectedContentType('all');
          }}>
            Reset
          </Button>
        </CardContent>
      </Card>

      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>Content status distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Total</div>
              <div className="text-3xl font-bold text-slate-900">{statusCounts.total}</div>
              <div className="text-xs text-slate-400 mt-1">(excl. Trash)</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-xs text-slate-500 font-bold mb-1">Ready</div>
              <div className="text-2xl font-bold text-slate-900">{statusCounts.readyUnpublished} / {statusCounts.readyPublished}</div>
              <div className="text-xs text-slate-400 mt-1">Unpub / Pub</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Editing</div>
              <div className="text-3xl font-bold text-slate-900">{statusCounts.editing}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Review</div>
              <div className="text-3xl font-bold text-slate-900">{statusCounts.review}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Trash</div>
              <div className="text-3xl font-bold text-slate-900">{statusCounts.trash}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Production Status (Visible only for Video Content) */}
      {selectedContentType === 'video' && (() => {
        const videoStats = tasks.filter(t => {
          const taskDate = t.created_date ? parseISO(t.created_date.split('T')[0]) : null;
          return t.task_type === 'video' && taskDate && isWithinInterval(taskDate, { start: dateRange.from, end: dateRange.to });
        });
        const totalShoot = videoStats.filter(t => t.status === 'shooting' || t.status === 'editing' || t.status === 'review' || t.shoot_date).length;
        const totalPlanned = videoStats.filter(t => t.status === 'idea' || t.status === 'scripting').length;

        return (
          <Card>
            <CardHeader>
              <CardTitle>Video Production Status</CardTitle>
              <CardDescription>Pipeline overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                  <div className="text-xs text-slate-500 font-bold mb-1">Shoot (Active)</div>
                  <div className="text-2xl font-bold text-slate-900">{totalShoot}</div>
                  <div className="text-xs text-slate-400 mt-1">Active Production</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-xs text-slate-500 font-bold mb-1">Planned</div>
                  <div className="text-2xl font-bold text-slate-900">{totalPlanned}</div>
                  <div className="text-xs text-slate-400 mt-1">Idea / Scripting</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Video Production Targets */}
      <Card>
        <CardHeader>
          <CardTitle>Video Production Targets</CardTitle>
          <CardDescription>Monthly video production goals and actuals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-300">
              <div className="text-xs text-slate-500 font-bold mb-1">Total Videos</div>
              <div className="text-2xl font-bold text-slate-900">
                {videoActuals.awareness_video + videoActuals.campaign_video + videoActuals.egc_videos} / {videoTargets.awareness_video + videoTargets.campaign_video + videoTargets.egc_videos}
              </div>
              <div className="text-xs text-slate-400 mt-1">Produced / Target</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Awareness Videos</div>
              <div className="text-2xl font-bold text-slate-900">{videoActuals.awareness_video} / {videoTargets.awareness_video}</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Campaign Videos</div>
              <div className="text-2xl font-bold text-slate-900">{videoActuals.campaign_video} / {videoTargets.campaign_video}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-xs text-slate-500 font-medium mb-1">EGC Videos</div>
              <div className="text-2xl font-bold text-slate-900">{videoActuals.egc_videos} / {videoTargets.egc_videos}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.views.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Video & Page views</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.likes.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Likes & Shares</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg CTR</CardTitle>
            <MousePointerClick className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgCtr}%</div>
            <p className="text-xs text-slate-500">Click Through Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totals.spend.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Budget utilized</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Views and Engagement over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLikes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'MMM d')}
                    minTickGap={30}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => format(parseISO(date), 'MMM d, yyyy')}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="views" stroke="#6366f1" fillOpacity={1} fill="url(#colorViews)" name="Views" />
                  <Area type="monotone" dataKey="likes" stroke="#10b981" fillOpacity={1} fill="url(#colorLikes)" name="Engagement" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget vs Spend</CardTitle>
            <CardDescription>Daily spending Analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'MMM d')}
                  />
                  <YAxis prefix="$" />
                  <Tooltip
                    formatter={(value) => [`$${value}`, 'Spend']}
                    labelFormatter={(date) => format(parseISO(date), 'MMM d, yyyy')}
                  />
                  <Bar dataKey="spend" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Spend ($)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CTR Trends</CardTitle>
            <CardDescription>Click-Through Rate (%) Performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'MMM d')}
                  />
                  <YAxis unit="%" />
                  <Tooltip
                    formatter={(value) => [`${value}%`, 'CTR']}
                    labelFormatter={(date) => format(parseISO(date), 'MMM d, yyyy')}
                  />
                  <Line type="monotone" dataKey="ctr" stroke="#ec4899" strokeWidth={2} dot={false} name="CTR (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}