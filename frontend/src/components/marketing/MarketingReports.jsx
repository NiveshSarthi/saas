import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, differenceInDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import {
  BarChart3, FileText, Users, TrendingUp, Calendar as CalendarIcon,
  Download, Filter, ChevronDown, Package, Video, Image as ImageIcon,
  Youtube, Instagram, Facebook, Linkedin, Twitter, PlayCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { jsPDF } from 'jspdf';
import { cn } from '@/lib/utils';

const PLATFORM_ICONS = {
  'YouTube': <Youtube className="w-4 h-4" />,
  'Instagram': <Instagram className="w-4 h-4" />,
  'Facebook': <Facebook className="w-4 h-4" />,
  'LinkedIn': <Linkedin className="w-4 h-4" />,
  'Twitter': <Twitter className="w-4 h-4" />,
  'TikTok': <PlayCircle className="w-4 h-4" />
};

const TYPE_LABELS = {
  video: 'Video',
  flyer: 'Flyer',
  poster: 'Poster',
  social_post: 'Social Post',
  article: 'Article',
  other: 'Other'
};

const STATUS_LABELS = {
  editing: 'Editing',
  review: 'Internal Review',
  revision: 'Revision Required',
  compliance: 'Compliance Review',
  compliance_revision: 'Legal Fix Required',
  approved: 'Publishing Queue',
  published: 'Published',
  tracking: 'Analytics Tracking',
  closed: 'Completed',
  trash: 'Trash'
};

export default function MarketingReports({ tasks = [], videos = [], categories = [], users = [], departments = [], marketingGoals = [] }) {
  // Combine tasks and videos for a unified view
  const unifiedTasks = useMemo(() => {
    // 1. Process legacy tasks (MarketingTask)
    const processedTasks = tasks.map(t => ({
      ...t,
      id: t.id || t._id,
      source_type: 'marketing_task'
    }));

    // 2. Process new Video entities
    const processedVideos = videos.map(v => {
      const category = categories.find(c => c.id === v.category_id || c._id === v.category_id);

      // Standardize status for the report labels
      // Report statuses: editing, review, revision, compliance, compliance_revision, approved, published, tracking, closed, trash
      // Video statuses: shoot, editing, review, revision, approval, posting, posted, trash
      let standardizedStatus = v.status;
      if (v.status === 'shoot') standardizedStatus = 'editing'; // Initial stage
      if (v.status === 'approval') standardizedStatus = 'approved';
      if (v.status === 'posting') standardizedStatus = 'approved';
      if (v.status === 'posted') standardizedStatus = 'published';

      return {
        ...v,
        id: v.id || v._id,
        source_type: 'video',
        campaign_name: v.title, // Use title as campaign name for videos
        task_type: 'video',
        status: standardizedStatus,
        video_subcategory: category?.name?.toLowerCase().includes('awareness') ? 'awareness_video' :
          category?.name?.toLowerCase().includes('campaign') ? 'campaign_video' :
            category?.name?.toLowerCase().includes('egc') ? 'egc_videos' : 'awareness_video', // Default or guess
        created_date: v.created_at || v.updated_at || new Date().toISOString(),
        updated_date: v.updated_at || v.created_at || new Date().toISOString(),
        assignee_email: v.assigned_editor, // Map editor as primary assignee for simplified reporting
        reviewer_email: v.assigned_manager,
        compliance_email: v.assigned_director,
        publisher_email: v.assigned_manager,
        analytics_email: v.assigned_director
      };
    });

    return [...processedTasks, ...processedVideos];
  }, [tasks, videos, categories]);

  const [reportType, setReportType] = useState('production');
  const [dateRange, setDateRange] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedVideoSubcategory, setSelectedVideoSubcategory] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedMember, setSelectedMember] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [stuckThreshold, setStuckThreshold] = useState(3); // Days threshold for "stuck" tasks

  // Get date range boundaries
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        end = now;
        break;
      case 'month':
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        end = now;
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = startOfDay(parseISO(customStartDate));
          end = endOfDay(parseISO(customEndDate));
        } else {
          return null;
        }
        break;
      default:
        return null;
    }

    return { start, end };
  };

  // Filter tasks by date and other criteria
  const filteredTasks = useMemo(() => {
    const range = getDateRange();
    if (!range) return unifiedTasks;

    return unifiedTasks.filter(task => {
      // Date filter
      if (!task.created_date) return false;
      const createdDate = parseISO(task.created_date);
      if (!isWithinInterval(createdDate, { start: range.start, end: range.end })) {
        return false;
      }

      // Collateral filter
      if (selectedCampaign !== 'all' && task.campaign_name !== selectedCampaign) return false;

      // Type filter
      if (selectedType !== 'all' && task.task_type !== selectedType) return false;

      // Video subcategory filter
      if (selectedVideoSubcategory !== 'all' && task.video_subcategory !== selectedVideoSubcategory) return false;

      // Platform filter
      if (selectedPlatform !== 'all') {
        if (!task.platforms || !task.platforms.includes(selectedPlatform)) return false;
      }

      // Member filter
      if (selectedMember !== 'all' && task.assignee_email !== selectedMember) return false;

      // Status filter
      if (selectedStatus !== 'all' && task.status !== selectedStatus) return false;

      return true;
    });
  }, [tasks, dateRange, customStartDate, customEndDate, selectedCampaign, selectedType, selectedVideoSubcategory, selectedPlatform, selectedMember, selectedStatus]);

  // Calculate video targets and actuals
  const videoTargets = {
    awareness_video: 32,
    campaign_video: 16,
    egc_videos: 12
  };

  const videoActuals = useMemo(() => {
    const filtered = filteredTasks.filter(t =>
      t.task_type === 'video' && t.video_subcategory
    );

    return {
      awareness_video: filtered.filter(t => t.video_subcategory === 'awareness_video').length,
      campaign_video: filtered.filter(t => t.video_subcategory === 'campaign_video').length,
      egc_videos: filtered.filter(t => t.video_subcategory === 'egc_videos').length
    };
  }, [filteredTasks]);

  // Status counts for Performance Overview
  const statusCounts = useMemo(() => {
    const trashCount = filteredTasks.filter(t => t.status === 'trash').length;
    const approvedButNotPublished = filteredTasks.filter(t => t.status === 'approved').length;
    const published = filteredTasks.filter(t => t.status === 'published').length;

    return {
      total: filteredTasks.length,
      editing: filteredTasks.filter(t => t.status === 'editing').length,
      review: filteredTasks.filter(t => ['review', 'compliance', 'compliance_revision'].includes(t.status)).length,
      readyUnpublished: approvedButNotPublished,
      readyPublished: published,
      trash: trashCount
    };
  }, [filteredTasks]);

  // Get unique collateral
  const collateral = useMemo(() => {
    return [...new Set(unifiedTasks.map(t => t.campaign_name).filter(Boolean))].sort();
  }, [unifiedTasks]);

  // Get unique platforms
  const platforms = useMemo(() => {
    const platformSet = new Set();
    unifiedTasks.forEach(t => {
      if (t.platforms && Array.isArray(t.platforms)) {
        t.platforms.forEach(p => platformSet.add(p));
      }
    });
    return Array.from(platformSet).sort();
  }, [unifiedTasks]);

  // Summary stats for other sections
  const summaryStats = useMemo(() => {
    const completed = filteredTasks.filter(t => t.status === 'closed' || t.status === 'published').length;
    const inProgress = filteredTasks.filter(t => ['editing', 'review', 'compliance', 'approved'].includes(t.status)).length;
    const revisions = filteredTasks.filter(t => t.status.includes('revision')).length;
    const inReview = filteredTasks.filter(t => t.status === 'review').length;
    const inCompliance = filteredTasks.filter(t => ['compliance', 'compliance_revision'].includes(t.status)).length;
    const readyToPublish = filteredTasks.filter(t => t.status === 'approved').length;

    // Individual status counts
    const editing = filteredTasks.filter(t => t.status === 'editing').length;
    const revision = filteredTasks.filter(t => t.status === 'revision').length;
    const complianceRevision = filteredTasks.filter(t => t.status === 'compliance_revision').length;
    const published = filteredTasks.filter(t => t.status === 'published').length;
    const tracking = filteredTasks.filter(t => t.status === 'tracking').length;
    const closed = filteredTasks.filter(t => t.status === 'closed').length;
    const approved = filteredTasks.filter(t => t.status === 'approved').length;
    const trash = filteredTasks.filter(t => t.status === 'trash').length;

    return {
      total: filteredTasks.length,
      completed,
      inProgress,
      revisions,
      inReview,
      inCompliance,
      readyToPublish,
      editing,
      revision,
      complianceRevision,
      published,
      tracking,
      closed,
      approved,
      trash,
      completionRate: filteredTasks.length > 0 ? Math.round((completed / filteredTasks.length) * 100) : 0
    };
  }, [filteredTasks]);

  // Production Report Data - Track all workflow stages
  const productionData = useMemo(() => {
    return filteredTasks.map(task => {
      const editor = users.find(u => u.email === task.assignee_email);
      const reviewer = users.find(u => u.email === task.reviewer_email);
      const compliance = users.find(u => u.email === task.compliance_email);
      const publisher = users.find(u => u.email === task.publisher_email);
      const analyst = users.find(u => u.email === task.analytics_email);

      let timeTaken = null;
      if (task.status === 'closed' || task.status === 'published') {
        if (task.created_date && task.updated_date) {
          const created = parseISO(task.created_date);
          const updated = parseISO(task.updated_date);
          timeTaken = differenceInDays(updated, created);
        }
      }

      // Count unique team members
      const uniqueMembers = new Set([
        task.assignee_email,
        task.reviewer_email,
        task.compliance_email,
        task.publisher_email,
        task.analytics_email
      ].filter(Boolean));

      return {
        ...task,
        editorName: editor?.full_name || task.assignee_email || 'Unassigned',
        reviewerName: reviewer?.full_name || task.reviewer_email || '-',
        complianceName: compliance?.full_name || task.compliance_email || '-',
        publisherName: publisher?.full_name || task.publisher_email || '-',
        analystName: analyst?.full_name || task.analytics_email || '-',
        teamSize: uniqueMembers.size,
        timeTaken: timeTaken !== null ? `${timeTaken} days` : 'In Progress'
      };
    });
  }, [filteredTasks, users]);

  // Member Performance Data - Track ALL workflow participants
  const memberPerformance = useMemo(() => {
    const memberStats = {};

    // Initialize member stats
    const initMember = (email) => {
      if (!email || memberStats[email]) return;
      const user = users.find(u => u.email === email);
      memberStats[email] = {
        name: user?.full_name || email,
        email,
        asEditor: 0,
        asReviewer: 0,
        asCompliance: 0,
        asPublisher: 0,
        asAnalyst: 0,
        totalInvolved: 0,
        completed: 0,
        videos: 0,
        creatives: 0,
        revisionsRequested: 0,
        tasksCompleted: 0
      };
    };

    filteredTasks.forEach(task => {
      // Track Editor
      if (task.assignee_email) {
        initMember(task.assignee_email);
        memberStats[task.assignee_email].asEditor++;
        memberStats[task.assignee_email].totalInvolved++;

        if (task.task_type === 'video') memberStats[task.assignee_email].videos++;
        else memberStats[task.assignee_email].creatives++;

        if (task.status === 'closed' || task.status === 'published') {
          memberStats[task.assignee_email].tasksCompleted++;
        }
      }

      // Track Reviewer
      if (task.reviewer_email) {
        initMember(task.reviewer_email);
        memberStats[task.reviewer_email].asReviewer++;
        if (!task.assignee_email || task.reviewer_email !== task.assignee_email) {
          memberStats[task.reviewer_email].totalInvolved++;
        }

        // Count revisions requested by this reviewer
        if (task.status === 'revision') {
          memberStats[task.reviewer_email].revisionsRequested++;
        }
      }

      // Track Compliance
      if (task.compliance_email) {
        initMember(task.compliance_email);
        memberStats[task.compliance_email].asCompliance++;
        if (task.compliance_email !== task.assignee_email && task.compliance_email !== task.reviewer_email) {
          memberStats[task.compliance_email].totalInvolved++;
        }

        if (task.status === 'compliance_revision') {
          memberStats[task.compliance_email].revisionsRequested++;
        }
      }

      // Track Publisher
      if (task.publisher_email) {
        initMember(task.publisher_email);
        memberStats[task.publisher_email].asPublisher++;
        if (task.publisher_email !== task.assignee_email &&
          task.publisher_email !== task.reviewer_email &&
          task.publisher_email !== task.compliance_email) {
          memberStats[task.publisher_email].totalInvolved++;
        }
      }

      // Track Analyst
      if (task.analytics_email) {
        initMember(task.analytics_email);
        memberStats[task.analytics_email].asAnalyst++;
        if (task.analytics_email !== task.assignee_email &&
          task.analytics_email !== task.reviewer_email &&
          task.analytics_email !== task.compliance_email &&
          task.analytics_email !== task.publisher_email) {
          memberStats[task.analytics_email].totalInvolved++;
        }
      }
    });

    return Object.values(memberStats).sort((a, b) => b.totalInvolved - a.totalInvolved);
  }, [filteredTasks, users]);

  // Platform Report Data
  const platformData = useMemo(() => {
    const platformStats = {};

    filteredTasks.forEach(task => {
      if (!task.platforms || !Array.isArray(task.platforms)) return;

      task.platforms.forEach(platform => {
        if (!platformStats[platform]) {
          platformStats[platform] = {
            platform,
            total: 0,
            completed: 0,
            videos: 0,
            creatives: 0
          };
        }

        platformStats[platform].total++;
        if (task.status === 'closed' || task.status === 'published') {
          platformStats[platform].completed++;
        }
        if (task.task_type === 'video') {
          platformStats[platform].videos++;
        } else {
          platformStats[platform].creatives++;
        }
      });
    });

    return Object.values(platformStats);
  }, [filteredTasks]);

  // Collateral Report Data - Track all workflow participants
  const campaignData = useMemo(() => {
    const campaignStats = {};

    filteredTasks.forEach(task => {
      const campaign = task.campaign_name || 'Unnamed Collateral';

      if (!campaignStats[campaign]) {
        campaignStats[campaign] = {
          campaign,
          total: 0,
          completed: 0,
          pending: 0,
          inReview: 0,
          inRevision: 0,
          videos: 0,
          creatives: 0,
          allMembers: new Set(),
          editors: new Set(),
          reviewers: new Set()
        };
      }

      campaignStats[campaign].total++;
      if (task.status === 'closed' || task.status === 'published') {
        campaignStats[campaign].completed++;
      } else {
        campaignStats[campaign].pending++;
      }

      if (task.status === 'review') campaignStats[campaign].inReview++;
      if (task.status.includes('revision')) campaignStats[campaign].inRevision++;

      if (task.task_type === 'video') {
        campaignStats[campaign].videos++;
      } else {
        campaignStats[campaign].creatives++;
      }

      // Track all team members involved
      [task.assignee_email, task.reviewer_email, task.compliance_email,
      task.publisher_email, task.analytics_email].forEach(email => {
        if (email) campaignStats[campaign].allMembers.add(email);
      });

      if (task.assignee_email) campaignStats[campaign].editors.add(task.assignee_email);
      if (task.reviewer_email) campaignStats[campaign].reviewers.add(task.reviewer_email);
    });

    return Object.entries(campaignStats).map(([campaign, stats]) => ({
      ...stats,
      totalMembers: stats.allMembers.size,
      editorsCount: stats.editors.size,
      reviewersCount: stats.reviewers.size,
      completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
    }));
  }, [filteredTasks]);

  // Stage Tracking Data - Days stuck at current stage
  const stageTrackingData = useMemo(() => {
    return filteredTasks
      .filter(task => task.status !== 'closed') // Only active tasks
      .map(task => {
        const assignee = users.find(u => u.email === task.assignee_email);
        const updatedDate = task.updated_date ? parseISO(task.updated_date) : new Date();
        const now = new Date();
        const daysAtStage = differenceInDays(now, updatedDate);

        // Determine who owns this stage
        let currentOwner = task.assignee_email;
        if (task.status === 'review') currentOwner = task.reviewer_email;
        if (task.status === 'compliance' || task.status === 'compliance_revision') currentOwner = task.compliance_email;
        if (task.status === 'approved') currentOwner = task.publisher_email;
        if (task.status === 'published' || task.status === 'tracking') currentOwner = task.analytics_email;

        const owner = users.find(u => u.email === currentOwner);
        const isStuck = daysAtStage >= stuckThreshold;

        return {
          ...task,
          assigneeName: assignee?.full_name || task.assignee_email || 'Unassigned',
          currentStage: STATUS_LABELS[task.status] || task.status,
          daysAtStage,
          isStuck,
          currentOwnerName: owner?.full_name || currentOwner || 'Unassigned',
          lastUpdated: format(updatedDate, 'MMM d, yyyy')
        };
      })
      .sort((a, b) => b.daysAtStage - a.daysAtStage); // Sort by most stuck first
  }, [filteredTasks, users, stuckThreshold]);

  // Stage-wise bottleneck analysis
  const stageBottlenecks = useMemo(() => {
    const stageStats = {};

    stageTrackingData.forEach(task => {
      const stage = task.status;
      if (!stageStats[stage]) {
        stageStats[stage] = {
          stage: STATUS_LABELS[stage] || stage,
          totalTasks: 0,
          stuckTasks: 0,
          avgDays: 0,
          totalDays: 0,
          maxDays: 0
        };
      }

      stageStats[stage].totalTasks++;
      stageStats[stage].totalDays += task.daysAtStage;
      if (task.isStuck) stageStats[stage].stuckTasks++;
      if (task.daysAtStage > stageStats[stage].maxDays) stageStats[stage].maxDays = task.daysAtStage;
    });

    return Object.values(stageStats).map(stat => ({
      ...stat,
      avgDays: stat.totalTasks > 0 ? (stat.totalDays / stat.totalTasks).toFixed(1) : 0
    })).sort((a, b) => b.stuckTasks - a.stuckTasks);
  }, [stageTrackingData]);

  // Export to PDF
  const exportToPDF = () => {
    // Use landscape if video subcategory filter is active
    const orientation = selectedVideoSubcategory !== 'all' ? 'landscape' : 'portrait';
    const doc = new jsPDF(orientation);
    const range = getDateRange();

    // Modern gradient header with enhanced decorative elements
    const pageWidth = orientation === 'landscape' ? 297 : 210;

    // Gradient background (simulated with multiple rectangles)
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 35, pageWidth, 15, 'F');

    // Decorative wave pattern
    doc.setFillColor(139, 92, 246);
    for (let i = 0; i < pageWidth; i += 8) {
      doc.circle(i, 48, 3, 'F');
    }

    // Decorative circles - enhanced
    doc.setFillColor(255, 255, 255, 0.1);
    doc.circle(pageWidth - 30, 8, 15, 'F');
    doc.circle(pageWidth - 15, 25, 10, 'F');
    doc.setFillColor(236, 72, 153);
    doc.circle(pageWidth - 20, 12, 6, 'F');
    doc.setFillColor(167, 139, 250);
    doc.circle(pageWidth - 12, 30, 4, 'F');

    // Main title with shadow effect
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(26);
    doc.setFont(undefined, 'bold');
    doc.text('Marketing Reports', 14.5, 20.5);
    doc.setTextColor(255, 255, 255);
    doc.text('Marketing Reports', 14, 20);

    // Subtitle
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(224, 231, 255);
    doc.text('Content Production & Performance Analysis', 14, 28);

    // Info boxes
    doc.setFontSize(8);
    doc.setTextColor(199, 210, 254);
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 36);
    if (range) {
      doc.text(`Period: ${format(range.start, 'MMM d, yyyy')} - ${format(range.end, 'MMM d, yyyy')}`, 14, 42);
    }

    // Applied Filters in colored box
    let y = 58;
    const filters = [];
    if (selectedCampaign !== 'all') filters.push(`Collateral: ${selectedCampaign}`);
    if (selectedType !== 'all') filters.push(`Type: ${TYPE_LABELS[selectedType] || selectedType}`);
    if (selectedVideoSubcategory !== 'all') filters.push(`Video: ${selectedVideoSubcategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
    if (selectedPlatform !== 'all') filters.push(`Platform: ${selectedPlatform}`);
    if (selectedMember !== 'all') {
      const member = users.find(u => u.email === selectedMember);
      filters.push(`Member: ${member?.full_name || selectedMember}`);
    }
    if (selectedStatus !== 'all') filters.push(`Status: ${STATUS_LABELS[selectedStatus] || selectedStatus}`);

    if (filters.length > 0) {
      doc.setFillColor(254, 249, 195);
      doc.roundedRect(14, y - 4, pageWidth - 28, 8, 2, 2, 'F');
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text('Active Filters:', 16, y);
      doc.setFont(undefined, 'normal');
      doc.text(filters.join(' | '), 42, y);
      y += 10;
    } else {
      y = 58;
    }

    // Performance Overview Section
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Performance Overview', 14, y);
    y += 10;

    // Summary Cards - 5 cards as per requirements (Total, Ready, Editing, Review, Trash)
    const cardWidth = 37;
    const cardHeight = 20;
    const gap = 2;

    // Total Card
    doc.setFillColor(220, 222, 235);
    doc.roundedRect(14.8, y + 0.8, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(14, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(199, 210, 254);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('TOTAL', 16, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(statusCounts.total.toString(), 16, y + 13);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('(incl. Trash)', 16, y + 17);

    // Ready Card
    doc.setFillColor(220, 222, 235);
    doc.roundedRect(14.8 + cardWidth + gap, y + 0.8, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(14 + cardWidth + gap, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(187, 247, 208);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('READY', 16 + cardWidth + gap, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text((statusCounts.readyUnpublished + statusCounts.readyPublished).toString(), 16 + cardWidth + gap, y + 13);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text(`${statusCounts.readyUnpublished}/${statusCounts.readyPublished} Pub/Unpub`, 16 + cardWidth + gap, y + 17);

    // Editing Card
    doc.setFillColor(220, 222, 235);
    doc.roundedRect(14.8 + (cardWidth + gap) * 2, y + 0.8, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(14 + (cardWidth + gap) * 2, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(254, 243, 199);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('EDITING', 16 + (cardWidth + gap) * 2, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(statusCounts.editing.toString(), 16 + (cardWidth + gap) * 2, y + 13);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('In creation', 16 + (cardWidth + gap) * 2, y + 17);

    // Review Card
    doc.setFillColor(220, 222, 235);
    doc.roundedRect(14.8 + (cardWidth + gap) * 3, y + 0.8, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFillColor(100, 116, 139);
    doc.roundedRect(14 + (cardWidth + gap) * 3, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(203, 213, 225);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('REVIEW', 16 + (cardWidth + gap) * 3, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(statusCounts.review.toString(), 16 + (cardWidth + gap) * 3, y + 13);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Under review', 16 + (cardWidth + gap) * 3, y + 17);

    // Trash Card
    doc.setFillColor(220, 222, 235);
    doc.roundedRect(14.8 + (cardWidth + gap) * 4, y + 0.8, cardWidth, cardHeight, 3, 3, 'F');
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(14 + (cardWidth + gap) * 4, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setTextColor(254, 202, 202);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('TRASH', 16 + (cardWidth + gap) * 4, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(statusCounts.trash.toString(), 16 + (cardWidth + gap) * 4, y + 13);
    doc.setFontSize(6);
    doc.setFont(undefined, 'normal');
    doc.text('Discarded', 16 + (cardWidth + gap) * 4, y + 17);

    y += cardHeight + 8;

    // Video Production Status (Requested feature - active vs planned)
    if (selectedType === 'video' || selectedVideoSubcategory !== 'all') {
      // Filter video tasks
      const videoTasks = filteredTasks.filter(t => t.task_type === 'video');

      // Calculate explicit counts based on requirements
      // Shoot/Active: Goals with a defined shoot_date
      const totalShoot = marketingGoals.filter(g => g.shoot_date).length;

      // Planned: Goals without a shoot_date
      const totalPlanned = marketingGoals.filter(g => !g.shoot_date).length;

      // Section title
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Video Production Status', 14, y);
      y += 8;

      const statusCardWidth = 50;
      const statusCardHeight = 22;
      const statusGap = 4;

      // Shoot (Active) Card
      doc.setFillColor(236, 254, 255); // Cyan-50
      doc.roundedRect(14, y, statusCardWidth, statusCardHeight, 3, 3, 'F');
      // Border
      doc.setDrawColor(165, 243, 252); // Cyan-200
      doc.roundedRect(14, y, statusCardWidth, statusCardHeight, 3, 3, 'S');

      doc.setTextColor(22, 78, 99); // Cyan-900
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('SHOOT (ACTIVE)', 18, y + 6);

      doc.setTextColor(8, 145, 178); // Cyan-600
      doc.setFontSize(16);
      doc.text(totalShoot.toString(), 18, y + 14);

      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text('Active Production', 18, y + 18);

      // Planned Card
      doc.setFillColor(240, 253, 244); // Green-50
      doc.roundedRect(14 + statusCardWidth + statusGap, y, statusCardWidth, statusCardHeight, 3, 3, 'F');
      doc.setDrawColor(187, 247, 208); // Green-200
      doc.roundedRect(14 + statusCardWidth + statusGap, y, statusCardWidth, statusCardHeight, 3, 3, 'S');

      doc.setTextColor(20, 83, 45); // Green-900
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('PLANNED', 18 + statusCardWidth + statusGap, y + 6);

      doc.setTextColor(22, 163, 74); // Green-600
      doc.setFontSize(16);
      doc.text(totalPlanned.toString(), 18 + statusCardWidth + statusGap, y + 14);

      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.text('Idea / Scripting', 18 + statusCardWidth + statusGap, y + 18);

      y += statusCardHeight + 10;
    }

    // Video Subcategory Performance Cards
    if (selectedType === 'video' || selectedVideoSubcategory !== 'all') {
      // Calculate targets based on date range
      const range = getDateRange();
      const monthsInRange = range ? Math.max(1, Math.round((range.end - range.start) / (1000 * 60 * 60 * 24 * 30.44))) : 1;

      const subcategoryTargets = {
        'awareness_video': { target: 32, label: 'Awareness Video' },
        'campaign_video': { target: 16, label: 'Campaign Video' },
        'egc_videos': { target: 12, label: 'EGC Videos' }
      };

      // Calculate TOTAL videos created per subcategory (not just completed)
      const subcategoryStats = {};
      Object.keys(subcategoryTargets).forEach(subcat => {
        const totalCreated = filteredTasks.filter(t =>
          t.task_type === 'video' &&
          t.video_subcategory === subcat
        ).length;
        subcategoryStats[subcat] = totalCreated;
      });

      // Section title
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Video Production Targets', 14, y);
      y += 8;

      // Video subcategory cards
      const videoCardWidth = 45;
      const videoCardHeight = 18;
      const videoCardGap = 3;
      let xPos = 14;

      Object.entries(subcategoryTargets).forEach(([subcat, config], idx) => {
        const totalCreated = subcategoryStats[subcat] || 0;
        const totalTarget = config.target * monthsInRange;
        const percentage = totalTarget > 0 ? Math.round((totalCreated / totalTarget) * 100) : 0;

        // Card shadow
        doc.setFillColor(220, 222, 235);
        doc.roundedRect(xPos + 0.8, y + 0.8, videoCardWidth, videoCardHeight, 3, 3, 'F');

        // Card background with gradient simulation
        if (idx === 0) {
          doc.setFillColor(147, 51, 234); // Purple for Awareness
        } else if (idx === 1) {
          doc.setFillColor(59, 130, 246); // Blue for Campaign
        } else {
          doc.setFillColor(16, 185, 129); // Green for EGC
        }
        doc.roundedRect(xPos, y, videoCardWidth, videoCardHeight, 3, 3, 'F');

        // Category label
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont(undefined, 'bold');
        doc.text(config.label.toUpperCase(), xPos + 3, y + 5);

        // Total Created / Target
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text(`${totalCreated}/${totalTarget}`, xPos + 3, y + 12);

        // Progress label
        doc.setFontSize(6);
        doc.setFont(undefined, 'normal');
        doc.text(`${percentage}% Complete`, xPos + 3, y + 15);

        xPos += videoCardWidth + videoCardGap;
      });

      // Total Videos Card
      const totalVideosCreated = Object.values(subcategoryStats).reduce((sum, val) => sum + val, 0);
      const totalVideosTarget = Object.values(subcategoryTargets).reduce((sum, config) => sum + (config.target * monthsInRange), 0);
      const totalPercentage = totalVideosTarget > 0 ? Math.round((totalVideosCreated / totalVideosTarget) * 100) : 0;

      // Total Card shadow
      doc.setFillColor(220, 222, 235);
      doc.roundedRect(xPos + 0.8, y + 0.8, videoCardWidth, videoCardHeight, 3, 3, 'F');

      // Total Card background - slate gray
      doc.setFillColor(100, 116, 139);
      doc.roundedRect(xPos, y, videoCardWidth, videoCardHeight, 3, 3, 'F');

      // Total label
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text('TOTAL VIDEOS', xPos + 3, y + 5);

      // Total Created / Target
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(`${totalVideosCreated}/${totalVideosTarget}`, xPos + 3, y + 12);

      // Progress label
      doc.setFontSize(6);
      doc.setFont(undefined, 'normal');
      doc.text('Produced / Target', xPos + 3, y + 15);

      y += videoCardHeight + 10;
    }

    // Section divider
    doc.setDrawColor(199, 210, 254);
    doc.setLineWidth(0.5);
    doc.line(14, y - 5, pageWidth - 14, y - 5);

    // Modern Table Header with enhanced gradient effect
    const tableWidth = orientation === 'landscape' ? pageWidth - 28 : 182;
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(14.3, y - 3.3, tableWidth, 10, 2, 2, 'F');
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(14, y - 4, tableWidth, 10, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');

    if (orientation === 'landscape' && selectedVideoSubcategory !== 'all') {
      // Landscape layout with video category column
      doc.text('COLLATERAL', 16, y);
      doc.text('TYPE', 70, y);
      doc.text('VIDEO CATEGORY', 100, y);
      doc.text('EDITING', 140, y);
      doc.text('EDITOR', 165, y);
      doc.text('REVIEWER', 195, y);
      doc.text('PUBLISHER', 230, y);
      doc.text('STATUS', 265, y);
    } else {
      // Portrait layout
      doc.text('COLLATERAL', 16, y);
      doc.text('TYPE / CATEGORY', 50, y);
      doc.text('EDITING', 75, y);
      doc.text('EDITOR', 95, y);
      doc.text('REVIEWER', 120, y);
      doc.text('PUBLISHER', 145, y);
      doc.text('STATUS', 170, y);
    }
    y += 10;

    // Group production data by video category if video type is selected
    const shouldGroupByCategory = selectedType === 'video' || selectedVideoSubcategory !== 'all';
    let groupedData = {};

    if (shouldGroupByCategory) {
      productionData.forEach(task => {
        const category = task.video_subcategory || 'Other Videos';
        if (!groupedData[category]) {
          groupedData[category] = [];
        }
        groupedData[category].push(task);
      });
    } else {
      groupedData = { 'All Content': productionData };
    }

    // Table Rows with modern styling
    doc.setFont(undefined, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);

    // Set page height threshold based on orientation
    const pageHeightThreshold = orientation === 'landscape' ? 185 : 270;

    Object.entries(groupedData).forEach(([category, categoryTasks]) => {
      let categorySerialNumber = 0;
      // Add category heading if grouping by category
      if (shouldGroupByCategory && Object.keys(groupedData).length > 1) {
        if (y > pageHeightThreshold - 20) {
          doc.addPage(orientation);
          y = 25;
        }

        // Category Section Header
        doc.setFillColor(79, 70, 229);
        doc.roundedRect(14, y, tableWidth, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        const categoryLabel = category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        doc.text(categoryLabel, 18, y + 7);
        doc.setFontSize(7);
        const completedCount = categoryTasks.filter(t => t.status === 'closed' || t.status === 'published').length;

        // Calculate target based on video subcategory and date range
        const range = getDateRange();
        const monthsInRange = range ? Math.max(1, Math.round((range.end - range.start) / (1000 * 60 * 60 * 24 * 30.44))) : 1;

        const monthlyTargets = {
          'awareness_video': 32,
          'campaign_video': 16,
          'egc_videos': 12
        };

        const targetPerMonth = monthlyTargets[category] || 0;
        const totalTarget = targetPerMonth * monthsInRange;

        const totalCreatedCount = categoryTasks.length;
        const displayText = totalTarget > 0
          ? `(${totalCreatedCount}/${totalTarget})`
          : `(${totalCreatedCount}/${categoryTasks.length})`;

        doc.text(displayText, tableWidth - 30, y + 7);
        y += 16;

        // Repeat table header after category heading
        doc.setFillColor(79, 70, 229);
        doc.roundedRect(14.3, y - 3.3, tableWidth, 10, 2, 2, 'F');
        doc.setFillColor(99, 102, 241);
        doc.roundedRect(14, y - 4, tableWidth, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');

        if (orientation === 'landscape' && selectedVideoSubcategory !== 'all') {
          doc.text('S.NO', 16, y);
          doc.text('COLLATERAL', 30, y);
          doc.text('TYPE', 85, y);
          doc.text('VIDEO CATEGORY', 115, y);
          doc.text('EDITOR', 155, y);
          doc.text('REVIEWER', 190, y);
          doc.text('PUBLISHER', 225, y);
          doc.text('STATUS', 260, y);
        } else {
          doc.text('S.NO', 16, y);
          doc.text('COLLATERAL', 28, y);
          doc.text('TYPE / CATEGORY', 67, y);
          doc.text('EDITOR', 94, y);
          doc.text('REVIEWER', 122, y);
          doc.text('PUBLISHER', 150, y);
          doc.text('STATUS', 178, y);
        }
        y += 10;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(7);
        doc.setTextColor(51, 65, 85);
      }

      categoryTasks.forEach((task, idx) => {
        categorySerialNumber++;
        if (y > pageHeightThreshold) {
          doc.addPage(orientation);
          y = 25;

          // Repeat modern header
          doc.setFillColor(79, 70, 229);
          doc.roundedRect(14.3, y - 3.3, tableWidth, 10, 2, 2, 'F');
          doc.setFillColor(99, 102, 241);
          doc.roundedRect(14, y - 4, tableWidth, 10, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont(undefined, 'bold');

          if (orientation === 'landscape' && selectedVideoSubcategory !== 'all') {
            doc.text('S.NO', 16, y);
            doc.text('COLLATERAL', 30, y);
            doc.text('TYPE', 80, y);
            doc.text('VIDEO CATEGORY', 105, y);
            doc.text('EDITING', 145, y);
            doc.text('EDITOR', 170, y);
            doc.text('REVIEWER', 200, y);
            doc.text('PUBLISHER', 235, y);
            doc.text('STATUS', 270, y);
          } else {
            doc.text('S.NO', 16, y);
            doc.text('COLLATERAL', 28, y);
            doc.text('TYPE / CATEGORY', 62, y);
            doc.text('EDITING', 87, y);
            doc.text('EDITOR', 107, y);
            doc.text('REVIEWER', 132, y);
            doc.text('PUBLISHER', 157, y);
            doc.text('STATUS', 182, y);
          }
          y += 10;
          doc.setFont(undefined, 'normal');
          doc.setFontSize(7);
          doc.setTextColor(51, 65, 85);
        }

        // Alternate row colors with enhanced styling
        if (idx % 2 === 0) {
          doc.setFillColor(249, 250, 251);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.roundedRect(14, y - 3.5, tableWidth, 7.5, 1.5, 1.5, 'F');

        // Subtle left border accent
        doc.setFillColor(99, 102, 241);
        doc.roundedRect(14, y - 3.5, 1, 7.5, 0, 0, 'F');

        const collateralName = (task.campaign_name || 'N/A').substring(0, orientation === 'landscape' ? 22 : 15);
        const taskType = (TYPE_LABELS[task.task_type] || task.task_type || 'N/A').substring(0, 10);
        const videoCategory = task.task_type === 'video' && task.video_subcategory
          ? task.video_subcategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()).substring(0, 15)
          : '-';
        const levelOfEditing = task.level_of_editing || '-';
        const editor = (task.editorName || '-').substring(0, 12);
        const reviewer = (task.reviewerName || '-').substring(0, 12);
        const publisher = (task.publisherName || '-').substring(0, 12);
        const statusLabel = (STATUS_LABELS[task.status] || task.status || 'N/A').substring(0, 10);

        doc.setFont(undefined, 'normal');
        doc.setTextColor(51, 65, 85);

        if (orientation === 'landscape' && selectedVideoSubcategory !== 'all') {
          // Landscape layout with serial number, video category, and editing level
          doc.setFont(undefined, 'bold');
          doc.text(categorySerialNumber.toString(), 16, y);
          doc.text(collateralName, 30, y);
          doc.setFont(undefined, 'normal');
          doc.text(taskType, 80, y);
          doc.text(videoCategory, 105, y);
          doc.text(levelOfEditing, 145, y);
          doc.text(editor, 170, y);
          doc.text(reviewer, 200, y);
          doc.text(publisher, 235, y);
        } else {
          // Portrait layout with serial number and editing level
          let taskTypeDisplay = taskType;
          if (task.task_type === 'video' && task.video_subcategory) {
            taskTypeDisplay += ` (${task.video_subcategory.replace('_', ' ').split(' ').map(w => w[0].toUpperCase()).join('')})`;
          }
          doc.setFont(undefined, 'bold');
          doc.text(categorySerialNumber.toString(), 16, y);
          doc.text(collateralName, 28, y);
          doc.setFont(undefined, 'normal');
          const typePrefix = task.task_type === 'video' ? '[V]' : '[C]';
          doc.text(`${typePrefix} ${taskTypeDisplay}`, 62, y);
          doc.text(levelOfEditing, 87, y);
          doc.text(editor, 107, y);
          doc.text(reviewer, 132, y);
          doc.text(publisher, 157, y);
        }

        // Status with color coding
        if (task.status === 'closed' || task.status === 'published') {
          doc.setTextColor(16, 185, 129);
        } else if (task.status.includes('revision')) {
          doc.setTextColor(239, 68, 68);
        } else if (task.status === 'review' || task.status === 'compliance') {
          doc.setTextColor(59, 130, 246);
        } else {
          doc.setTextColor(100, 116, 139);
        }
        doc.setFont(undefined, 'bold');
        doc.text(statusLabel, orientation === 'landscape' ? 270 : 182, y);
        doc.setTextColor(51, 65, 85);
        doc.setFont(undefined, 'normal');

        y += 7;
      });

      // Add spacing between categories
      if (shouldGroupByCategory && Object.keys(groupedData).length > 1) {
        y += 5;
      }
    });

    // Footer with enhanced decorative elements
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Footer gradient bar
      const footerY = orientation === 'landscape' ? 200 : 282;
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(14, footerY - 2, pageWidth - 28, 10, 2, 2, 'F');

      // Footer content
      doc.setFontSize(7);
      doc.setTextColor(79, 70, 229);
      doc.setFont(undefined, 'bold');
      doc.text(`Page ${i} of ${pageCount}`, 16, footerY + 4);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(99, 102, 241);
      doc.text('Marketing System Report', pageWidth / 2, footerY + 4, { align: 'center' });
      doc.setTextColor(148, 163, 184);
      doc.text(`© ${new Date().getFullYear()}`, pageWidth - 16, footerY + 4, { align: 'right' });
    }

    doc.save(`marketing-report-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {dateRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Collateral</label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Collateral</SelectItem>
                  {collateral.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Content Type</label>
              <Select value={selectedType} onValueChange={(v) => {
                setSelectedType(v);
                if (v !== 'video') setSelectedVideoSubcategory('all');
              }}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="flyer">Flyer</SelectItem>
                  <SelectItem value="poster">Poster</SelectItem>
                  <SelectItem value="social_post">Social Post</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedType === 'video' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Video Category</label>
                <Select value={selectedVideoSubcategory} onValueChange={setSelectedVideoSubcategory}>
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Video Types</SelectItem>
                    <SelectItem value="egc_videos">EGC Videos</SelectItem>
                    <SelectItem value="campaign_video">Campaign Video</SelectItem>
                    <SelectItem value="awareness_video">Awareness Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Platform</label>
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {platforms.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Team Member</label>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="editing">Editing</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="trash">Trash</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={exportToPDF} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
              <Download className="w-4 h-4 mr-2" />
              Export to PDF
            </Button>
          </div>
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
              <div className="text-xs text-slate-400 mt-1">(incl. Trash)</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-xs text-slate-500 font-bold mb-1">Ready</div>
              <div className="text-3xl font-bold text-slate-900">{statusCounts.readyUnpublished + statusCounts.readyPublished}</div>
              <div className="text-xs text-slate-400 mt-1">{statusCounts.readyUnpublished}/{statusCounts.readyPublished} Pub/Unpub</div>
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
      {(selectedType === 'video' || selectedVideoSubcategory !== 'all') && (() => {
        // Shoot/Active: Goals with a defined shoot_date
        const totalShoot = marketingGoals.filter(g => g.shoot_date).length;
        // Planned: Goals without a shoot_date
        const totalPlanned = marketingGoals.filter(g => !g.shoot_date).length;

        return (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Video Production Status</CardTitle>
              <CardDescription>Pipeline overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
                  <div className="text-xs text-slate-500 font-bold mb-1">Shoot (Active)</div>
                  <div className="text-3xl font-bold text-slate-900">{totalShoot}</div>
                  <div className="text-xs text-slate-400 mt-1">Active Production</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <div className="text-xs text-slate-500 font-bold mb-1">Planned</div>
                  <div className="text-3xl font-bold text-slate-900">{totalPlanned}</div>
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
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Awareness Videos</div>
              <div className="text-2xl font-bold text-slate-900">{videoActuals.awareness_video} / {videoTargets.awareness_video}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="text-xs text-slate-500 font-medium mb-1">Campaign Videos</div>
              <div className="text-2xl font-bold text-slate-900">{videoActuals.campaign_video} / {videoTargets.campaign_video}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-xs text-slate-500 font-medium mb-1">EGC Videos</div>
              <div className="text-2xl font-bold text-slate-900">{videoActuals.egc_videos} / {videoTargets.egc_videos}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-300">
              <div className="text-xs text-slate-500 font-bold mb-1">Total Videos</div>
              <div className="text-2xl font-bold text-slate-900">
                {videoActuals.awareness_video + videoActuals.campaign_video + videoActuals.egc_videos} / {videoTargets.awareness_video + videoTargets.campaign_video + videoTargets.egc_videos}
              </div>
              <div className="text-xs text-slate-400 mt-1">Produced / Target</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats - Workflow Focused */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-indigo-100 text-sm">Total Tasks</span>
              <Package className="w-5 h-5 text-indigo-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.total}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100 text-sm">Completed</span>
              <TrendingUp className="w-5 h-5 text-green-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.completed}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm">In Review</span>
              <Users className="w-5 h-5 text-blue-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.inReview}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-100 text-sm">Compliance</span>
              <BarChart3 className="w-5 h-5 text-amber-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.inCompliance}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-100 text-sm">Revisions</span>
              <FileText className="w-5 h-5 text-red-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.revisions}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyan-100 text-sm">Ready to Publish</span>
              <TrendingUp className="w-5 h-5 text-cyan-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.readyToPublish}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-pink-600 border-0 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-pink-100 text-sm">Completion Rate</span>
              <TrendingUp className="w-5 h-5 text-pink-200" />
            </div>
            <p className="text-3xl font-bold">{summaryStats.completionRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="workflow">
            <TrendingUp className="w-4 h-4 mr-2" />
            Workflow Tracking
          </TabsTrigger>
          <TabsTrigger value="production">
            <FileText className="w-4 h-4 mr-2" />
            Content Production
          </TabsTrigger>
          <TabsTrigger value="member">
            <Users className="w-4 h-4 mr-2" />
            Member Performance
          </TabsTrigger>
          <TabsTrigger value="platform">
            <Video className="w-4 h-4 mr-2" />
            Platform Report
          </TabsTrigger>
          <TabsTrigger value="campaign">
            <BarChart3 className="w-4 h-4 mr-2" />
            Campaign Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-6">
          {/* Stuck Threshold Control */}
          <Card className="mb-6 bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-amber-900">Stuck Task Threshold</p>
                  <p className="text-sm text-amber-700">Tasks at the same stage for this many days are marked as stuck</p>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={stuckThreshold}
                    onChange={(e) => setStuckThreshold(parseInt(e.target.value) || 3)}
                    className="w-20 bg-white"
                  />
                  <span className="text-sm font-medium text-amber-900">days</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stage Bottlenecks */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-600" />
                Workflow Bottlenecks - Stage Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Total Tasks</TableHead>
                    <TableHead>Stuck Tasks</TableHead>
                    <TableHead>Avg Days at Stage</TableHead>
                    <TableHead>Max Days</TableHead>
                    <TableHead>Risk Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stageBottlenecks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        No active tasks found
                      </TableCell>
                    </TableRow>
                  ) : (
                    stageBottlenecks.map((stage, idx) => {
                      const riskLevel = stage.stuckTasks > 3 ? 'high' : stage.stuckTasks > 1 ? 'medium' : 'low';
                      return (
                        <TableRow key={stage.stage || idx}>
                          <TableCell className="font-medium">{stage.stage}</TableCell>
                          <TableCell>{stage.totalTasks}</TableCell>
                          <TableCell>
                            {stage.stuckTasks > 0 ? (
                              <Badge className="bg-red-100 text-red-700">
                                {stage.stuckTasks} stuck
                              </Badge>
                            ) : (
                              <span className="text-slate-500">0</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">{stage.avgDays} days</TableCell>
                          <TableCell>{stage.maxDays} days</TableCell>
                          <TableCell>
                            <Badge className={cn(
                              riskLevel === 'high' && 'bg-red-100 text-red-700',
                              riskLevel === 'medium' && 'bg-orange-100 text-orange-700',
                              riskLevel === 'low' && 'bg-green-100 text-green-700'
                            )}>
                              {riskLevel === 'high' && '🔴 High Risk'}
                              {riskLevel === 'medium' && '🟡 Medium Risk'}
                              {riskLevel === 'low' && '🟢 Low Risk'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detailed Stage Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-indigo-600" />
                Task Stage Tracking - Days Stuck Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collateral</TableHead>
                    <TableHead>Content Type</TableHead>
                    <TableHead>Current Stage</TableHead>
                    <TableHead>Days at Stage</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Current Owner</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stageTrackingData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500">
                        No active tasks found
                      </TableCell>
                    </TableRow>
                  ) : (
                    stageTrackingData.map((task, idx) => (
                      <TableRow key={task.id || idx} className={cn(task.isStuck && 'bg-red-50')}>
                        <TableCell className="font-medium">{task.campaign_name}</TableCell>
                        <TableCell>{TYPE_LABELS[task.task_type] || task.task_type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-medium">
                            {task.currentStage}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-bold text-lg",
                              task.daysAtStage >= stuckThreshold && "text-red-600",
                              task.daysAtStage < stuckThreshold && task.daysAtStage >= Math.floor(stuckThreshold / 2) && "text-orange-600",
                              task.daysAtStage < Math.floor(stuckThreshold / 2) && "text-green-600"
                            )}>
                              {task.daysAtStage}
                            </span>
                            <span className="text-sm text-slate-500">days</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{task.lastUpdated}</TableCell>
                        <TableCell>{task.currentOwnerName}</TableCell>
                        <TableCell>
                          {task.isStuck ? (
                            <Badge className="bg-red-600 text-white animate-pulse">
                              ⚠️ STUCK
                            </Badge>
                          ) : task.daysAtStage >= Math.floor(stuckThreshold / 2) ? (
                            <Badge className="bg-orange-100 text-orange-700">
                              ⚡ At Risk
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">
                              ✓ On Track
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Content Production Report - Complete Workflow Journey
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2">
                Shows each content piece's journey through all workflow stages with team members at each step
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Collateral Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Platforms</TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>✏️ Editor</span>
                          <span className="text-xs text-slate-500">Created</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>👀 Reviewer</span>
                          <span className="text-xs text-slate-500">Reviewed</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>⚖️ Compliance</span>
                          <span className="text-xs text-slate-500">Legal</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>🚀 Publisher</span>
                          <span className="text-xs text-slate-500">Published</span>
                        </div>
                      </TableHead>
                      <TableHead>Team Size</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time Taken</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-slate-500">
                          No data found for selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      productionData.map((task, idx) => (
                        <TableRow key={task.id || idx}>
                          <TableCell className="font-medium max-w-[200px] truncate">{task.campaign_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline">{TYPE_LABELS[task.task_type] || task.task_type}</Badge>
                              {task.task_type === 'video' && task.video_subcategory && (
                                <Badge className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                                  {task.video_subcategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {task.platforms?.slice(0, 2).map(p => (
                                <span key={p} className="text-slate-600" title={p}>{PLATFORM_ICONS[p]}</span>
                              ))}
                              {task.platforms?.length > 2 && (
                                <span className="text-xs text-slate-500">+{task.platforms.length - 2}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{task.editorName}</TableCell>
                          <TableCell className="text-sm">{task.reviewerName}</TableCell>
                          <TableCell className="text-sm">{task.complianceName}</TableCell>
                          <TableCell className="text-sm">{task.publisherName}</TableCell>
                          <TableCell>
                            <Badge className="bg-indigo-100 text-indigo-700">
                              {task.teamSize} {task.teamSize === 1 ? 'person' : 'people'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              task.status === 'closed' && 'bg-emerald-100 text-emerald-700',
                              task.status === 'published' && 'bg-green-100 text-green-700',
                              task.status.includes('revision') && 'bg-orange-100 text-orange-700',
                              task.status === 'review' && 'bg-blue-100 text-blue-700',
                              task.status.includes('compliance') && 'bg-purple-100 text-purple-700'
                            )}>
                              {STATUS_LABELS[task.status] || task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">{task.timeTaken}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="member" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                Member Performance Report - Complete Workflow Contribution
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2">
                Tracks each member's contribution across all workflow stages (Editor, Reviewer, Compliance, Publisher, Analyst)
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Total Involved</TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>As Editor</span>
                          <span className="text-xs text-slate-500">(Created)</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>As Reviewer</span>
                          <span className="text-xs text-slate-500">(Reviewed)</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>As Compliance</span>
                          <span className="text-xs text-slate-500">(Legal)</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>As Publisher</span>
                          <span className="text-xs text-slate-500">(Published)</span>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="flex flex-col">
                          <span>As Analyst</span>
                          <span className="text-xs text-slate-500">(Tracked)</span>
                        </div>
                      </TableHead>
                      <TableHead>Videos/Creatives</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Revisions Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberPerformance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-slate-500">
                          No data found for selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      memberPerformance.map((member, idx) => (
                        <TableRow key={member.email || idx}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge className="bg-indigo-100 text-indigo-700 font-semibold">
                              {member.totalInvolved}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.asEditor > 0 ? (
                              <Badge className="bg-blue-100 text-blue-700">
                                ✏️ {member.asEditor}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.asReviewer > 0 ? (
                              <Badge className="bg-purple-100 text-purple-700">
                                👀 {member.asReviewer}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.asCompliance > 0 ? (
                              <Badge className="bg-amber-100 text-amber-700">
                                ⚖️ {member.asCompliance}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.asPublisher > 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-700">
                                🚀 {member.asPublisher}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.asAnalyst > 0 ? (
                              <Badge className="bg-cyan-100 text-cyan-700">
                                📊 {member.asAnalyst}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {member.videos > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  🎥 {member.videos}
                                </Badge>
                              )}
                              {member.creatives > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  🎨 {member.creatives}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-700">
                              ✓ {member.tasksCompleted}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {member.revisionsRequested > 0 ? (
                              <Badge className="bg-orange-100 text-orange-700">
                                ↩️ {member.revisionsRequested}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="platform" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform-Wise Content Report</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Total Content</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Videos</TableHead>
                    <TableHead>Creatives</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">
                        No data found for selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    platformData.map((platform, idx) => (
                      <TableRow key={platform.platform || idx}>
                        <TableCell className="flex items-center gap-2 font-medium">
                          {PLATFORM_ICONS[platform.platform]}
                          {platform.platform}
                        </TableCell>
                        <TableCell>{platform.total}</TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-700">
                            {platform.completed}
                          </Badge>
                        </TableCell>
                        <TableCell>{platform.videos}</TableCell>
                        <TableCell>{platform.creatives}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaign" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
                Collateral-Wise Marketing Report - Team Collaboration
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2">
                Shows all team members involved in each collateral across the entire workflow
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collateral</TableHead>
                    <TableHead>Total Content</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>In Review</TableHead>
                    <TableHead>Needs Revision</TableHead>
                    <TableHead>Videos</TableHead>
                    <TableHead>Creatives</TableHead>
                    <TableHead>Total Team</TableHead>
                    <TableHead>Editors</TableHead>
                    <TableHead>Reviewers</TableHead>
                    <TableHead>Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-slate-500">
                        No data found for selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    campaignData.map((campaign, idx) => (
                      <TableRow key={campaign.campaign || idx}>
                        <TableCell className="font-medium max-w-[200px] truncate">{campaign.campaign}</TableCell>
                        <TableCell>
                          <Badge className="bg-indigo-100 text-indigo-700">
                            {campaign.total}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-emerald-100 text-emerald-700">
                            ✓ {campaign.completed}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {campaign.inReview > 0 ? (
                            <Badge className="bg-blue-100 text-blue-700">
                              👀 {campaign.inReview}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {campaign.inRevision > 0 ? (
                            <Badge className="bg-orange-100 text-orange-700">
                              ↩️ {campaign.inRevision}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">🎥 {campaign.videos}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">🎨 {campaign.creatives}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-purple-100 text-purple-700 font-semibold">
                            👥 {campaign.totalMembers}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-blue-700">
                            ✏️ {campaign.editorsCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-purple-700">
                            👀 {campaign.reviewersCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-slate-200 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-green-500 h-2 rounded-full"
                                style={{ width: `${campaign.completionRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold">{campaign.completionRate}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}