import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, differenceInDays } from 'date-fns';
import { 
  Download, Filter, Search, Users, Phone, Mail, Calendar, 
  TrendingUp, AlertCircle, Building, ExternalLink, Eye,
  FileText, CheckCircle2, Clock, Target, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';
import { getVisibleSalesUsers } from '@/components/utils/salesPermissions';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

const SOURCE_LABELS = {
  facebook: 'Facebook Ads',
  walkin: 'Walk-in',
  call: 'Phone Call',
  referral: 'Referral',
  website: 'Website',
  instagram: 'Instagram',
  csv: 'CSV Import',
  manual: 'Manual Entry',
  whatsapp: 'WhatsApp'
};

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-100 text-blue-700' },
  contacted: { label: 'Contacted', color: 'bg-purple-100 text-purple-700' },
  screening: { label: 'Screening', color: 'bg-indigo-100 text-indigo-700' },
  qualified: { label: 'Qualified', color: 'bg-violet-100 text-violet-700' },
  proposal: { label: 'Proposal', color: 'bg-cyan-100 text-cyan-700' },
  negotiation: { label: 'Negotiation', color: 'bg-amber-100 text-amber-700' },
  site_visit: { label: 'Site Visit', color: 'bg-orange-100 text-orange-700' },
  agreement: { label: 'Agreement', color: 'bg-emerald-100 text-emerald-700' },
  payment: { label: 'Payment', color: 'bg-green-100 text-green-700' },
  closed_won: { label: 'Closed Won', color: 'bg-green-700 text-white' },
  follow_up: { label: 'Follow Up', color: 'bg-amber-100 text-amber-700' },
  negotiation: { label: 'Negotiation', color: 'bg-purple-100 text-purple-700' },
  closed_lost: { label: 'Closed Lost', color: 'bg-red-100 text-red-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' }
};

const CONTACT_STATUS_CONFIG = {
  not_contacted: { label: 'Not Contacted', color: 'bg-red-100 text-red-700' },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  connected: { label: 'Connected', color: 'bg-green-100 text-green-700' },
  interested: { label: 'Interested', color: 'bg-emerald-100 text-emerald-700' },
  not_interested: { label: 'Not Interested', color: 'bg-slate-100 text-slate-700' },
  not_picked: { label: 'Not Picked', color: 'bg-amber-100 text-amber-700' },
  switched_off: { label: 'Switched Off', color: 'bg-orange-100 text-orange-700' },
  wrong_number: { label: 'Wrong Number', color: 'bg-rose-100 text-rose-700' },
  follow_up: { label: 'Follow Up', color: 'bg-blue-100 text-blue-700' },
  follow_up_scheduled: { label: 'Follow-up Scheduled', color: 'bg-cyan-100 text-cyan-700' }
};

export default function UnifiedAssignedLeadsReport({ user, allUsers, departments }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterContactStatus, setFilterContactStatus] = useState('all');
  const [filterBuilder, setFilterBuilder] = useState('all');
  const [filterFollowUp, setFilterFollowUp] = useState('all');

  // Fetch all leads from both modules
  const { data: pageLeads = [], isLoading: loadingPageLeads } = useQuery({
    queryKey: ['page-leads-report'],
    queryFn: () => base44.entities.Lead.list('-created_date', 5000),
    enabled: !!user,
  });

  const { data: realEstateLeads = [], isLoading: loadingRELeads } = useQuery({
    queryKey: ['re-leads-report'],
    queryFn: () => base44.entities.RealEstateLead.list('-created_date', 5000),
    enabled: !!user,
  });

  const { data: builders = [] } = useQuery({
    queryKey: ['builders'],
    queryFn: () => base44.entities.Builder.list('name'),
    enabled: !!user,
  });

  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);

  // Get visible users based on hierarchy
  const visibleSalesUsers = useMemo(() => {
    if (!user) return [];
    return getVisibleSalesUsers(user, allUsers, departments).filter(u => 
      u.department_id && salesDeptIds.includes(u.department_id)
    );
  }, [user, allUsers, departments, salesDeptIds]);

  // Normalize and merge leads from both sources
  const allLeads = useMemo(() => {
    const normalized = [];

    // Process Page Leads (from Lead entity)
    pageLeads.forEach(lead => {
      const assignedDate = lead.assigned_date || lead.import_date || lead.created_date;
      const lastActivityDate = lead.last_activity_date || lead.contacted_date || null;
      
      // Extract campaign/page name from notes
      let campaignName = '-';
      if (lead.notes) {
        const pageMatch = lead.notes.match(/Page Name: ([^\n]+)/);
        const formMatch = lead.notes.match(/Form Name: ([^\n]+)/);
        if (pageMatch) campaignName = pageMatch[1];
        if (formMatch) campaignName += ` - ${formMatch[1]}`;
      }

      normalized.push({
        id: lead.id,
        source_module: 'Pages Leads',
        lead_name: lead.lead_name || lead.name || 'Unknown',
        phone: lead.phone || '-',
        email: lead.email || '-',
        lead_source: SOURCE_LABELS[lead.lead_source] || lead.lead_source || 'Unknown',
        campaign_page: campaignName,
        assigned_to: lead.assigned_to,
        reporting_to: allUsers.find(u => u.email === lead.assigned_to)?.reports_to || '-',
        lead_status: lead.status || 'new',
        contact_status: lead.contact_status || 'not_contacted',
        assignment_date: assignedDate,
        last_activity_date: lastActivityDate,
        follow_up_date: lead.follow_up_date || lead.next_follow_up,
        builder_project: lead.property_interest || '-',
        location: lead.location || '-',
        notes: lead.notes || '',
        created_date: lead.fb_created_time || lead.created_date,
        tags: lead.tags || []
      });
    });

    // Process Real Estate Leads (from RealEstateLead entity)
    realEstateLeads.forEach(lead => {
      const assignedDate = lead.assigned_date || lead.first_contact_date || lead.created_date;
      const lastActivityDate = lead.last_contact_date || lead.first_contact_date || null;
      const campaignName = lead.campaign_id || '-';

      normalized.push({
        id: lead.id,
        source_module: 'Lead Management',
        lead_name: lead.name || 'Unknown',
        phone: lead.phone || '-',
        email: lead.email || '-',
        lead_source: lead.lead_source || 'Unknown',
        campaign_page: campaignName,
        assigned_to: lead.assigned_to,
        reporting_to: allUsers.find(u => u.email === lead.assigned_to)?.reports_to || '-',
        lead_status: lead.stage || 'New',
        contact_status: lead.verification_status?.toLowerCase() || 'pending',
        assignment_date: assignedDate,
        last_activity_date: lastActivityDate,
        follow_up_date: lead.next_followup_date,
        builder_project: '-',
        location: lead.location_preference || '-',
        notes: lead.notes || '',
        created_date: lead.created_date,
        tags: []
      });
    });

    return normalized;
  }, [pageLeads, realEstateLeads, allUsers]);

  // Apply role-based filtering
  const roleFilteredLeads = useMemo(() => {
    if (!user) return [];
    
    // Admin sees all leads
    if (user.role === 'admin') {
      return allLeads;
    }

    // Get subordinate emails
    const subordinateEmails = allUsers
      .filter(u => u.reports_to?.toLowerCase() === user.email?.toLowerCase())
      .map(u => u.email);

    // User sees their own leads + subordinates' leads
    return allLeads.filter(lead => 
      lead.assigned_to === user.email || 
      subordinateEmails.includes(lead.assigned_to)
    );
  }, [allLeads, user, allUsers]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    let result = roleFilteredLeads.filter(lead => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !lead.lead_name.toLowerCase().includes(query) &&
          !lead.phone.includes(query) &&
          !lead.email.toLowerCase().includes(query) &&
          !lead.campaign_page.toLowerCase().includes(query)
        ) return false;
      }

      // Date range filter
      if (dateRange !== 'all' && lead.assignment_date) {
        const assignDate = new Date(lead.assignment_date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        if (dateRange === 'today') {
          const todayStart = new Date(now);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);
          if (assignDate < todayStart || assignDate > todayEnd) return false;
        } else if (dateRange === 'yesterday') {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayEnd = new Date(yesterday);
          yesterdayEnd.setHours(23, 59, 59, 999);
          if (assignDate < yesterday || assignDate > yesterdayEnd) return false;
        } else if (dateRange === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          if (assignDate < weekAgo) return false;
        } else if (dateRange === 'month') {
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          if (assignDate < monthAgo) return false;
        } else if (dateRange === 'custom' && customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (assignDate < start || assignDate > end) return false;
        }
      }

      // Source filter
      if (filterSource !== 'all') {
        const normalizedSource = lead.lead_source.toLowerCase();
        if (filterSource === 'pages_leads' && lead.source_module !== 'Pages Leads') return false;
        if (filterSource === 'lead_management' && lead.source_module !== 'Lead Management') return false;
        if (!['pages_leads', 'lead_management'].includes(filterSource) && 
            !normalizedSource.includes(filterSource.toLowerCase())) return false;
      }

      // Assignee filter
      if (filterAssignee !== 'all' && lead.assigned_to !== filterAssignee) return false;

      // Status filter
      if (filterStatus !== 'all' && lead.lead_status.toLowerCase() !== filterStatus.toLowerCase()) return false;

      // Contact status filter
      if (filterContactStatus !== 'all' && lead.contact_status !== filterContactStatus) return false;

      // Builder filter
      if (filterBuilder !== 'all' && !lead.builder_project.toLowerCase().includes(filterBuilder.toLowerCase())) return false;

      // Follow-up filter - Enhanced overdue detection
      if (filterFollowUp === 'has_follow_up' && !lead.follow_up_date) return false;
      if (filterFollowUp === 'no_follow_up' && lead.follow_up_date) return false;
      if (filterFollowUp === 'overdue') {
        if (!lead.follow_up_date) return false;
        const followUpDate = new Date(lead.follow_up_date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (followUpDate >= now) return false; // Only show if past today
      }
      if (filterFollowUp === 'due_today') {
        if (!lead.follow_up_date) return false;
        const followUpDate = new Date(lead.follow_up_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (followUpDate < today || followUpDate >= tomorrow) return false;
      }
      if (filterFollowUp === 'due_tomorrow') {
        if (!lead.follow_up_date) return false;
        const followUpDate = new Date(lead.follow_up_date);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);
        if (followUpDate < tomorrow || followUpDate >= dayAfter) return false;
      }

      return true;
    });
    
    return result;
  }, [roleFilteredLeads, searchQuery, dateRange, customStartDate, customEndDate, 
      filterSource, filterAssignee, filterStatus, filterContactStatus, filterBuilder, filterFollowUp]);

  // Calculate summary stats - based on filtered leads
  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const total = filteredLeads.length;
    const active = filteredLeads.filter(l => !['closed_won', 'closed_lost', 'lost'].includes(l.lead_status.toLowerCase())).length;
    const closed = filteredLeads.filter(l => ['closed_won', 'closed_lost', 'lost'].includes(l.lead_status.toLowerCase())).length;
    const unfollowed = filteredLeads.filter(l => !l.last_activity_date).length;
    const notContacted = filteredLeads.filter(l => l.contact_status === 'not_contacted').length;
    const hot = filteredLeads.filter(l => ['qualified', 'proposal', 'negotiation', 'agreement'].includes(l.lead_status.toLowerCase())).length;
    const overdueFollowUps = filteredLeads.filter(l => {
      if (!l.follow_up_date) return false;
      const followUpDate = new Date(l.follow_up_date);
      return followUpDate < now;
    }).length;
    
    return { total, active, closed, unfollowed, notContacted, hot, overdueFollowUps };
  }, [filteredLeads]);

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Header
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 297, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('Assigned Leads Report', 14, 16);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 24);
    doc.text(`Total Leads: ${filteredLeads.length}`, 14, 30);

    let y = 45;

    // Summary Section
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Total: ${stats.total}`, 14, y);
    doc.text(`Active: ${stats.active}`, 60, y);
    doc.text(`Closed: ${stats.closed}`, 100, y);
    doc.text(`Not Contacted: ${stats.notContacted}`, 140, y);
    doc.text(`Hot Leads: ${stats.hot}`, 200, y);
    y += 15;

    // Table Header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Lead Name', 14, y);
    doc.text('Phone', 60, y);
    doc.text('Source', 95, y);
    doc.text('Assigned To', 125, y);
    doc.text('Status', 170, y);
    doc.text('Contact Status', 205, y);
    doc.text('Last Activity', 250, y);
    y += 7;

    // Table Rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    
    filteredLeads.slice(0, 30).forEach((lead, idx) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }

      const assignedUser = allUsers.find(u => u.email === lead.assigned_to);
      const assignedName = assignedUser?.full_name || lead.assigned_to?.split('@')[0] || 'Unassigned';

      doc.text(lead.lead_name.substring(0, 20), 14, y);
      doc.text(lead.phone.substring(0, 15), 60, y);
      doc.text(lead.lead_source.substring(0, 15), 95, y);
      doc.text(assignedName.substring(0, 20), 125, y);
      doc.text((STATUS_CONFIG[lead.lead_status.toLowerCase()]?.label || lead.lead_status).substring(0, 15), 170, y);
      doc.text((CONTACT_STATUS_CONFIG[lead.contact_status]?.label || lead.contact_status).substring(0, 18), 205, y);
      doc.text(lead.last_activity_date ? format(new Date(lead.last_activity_date), 'MMM d, yyyy').substring(0, 12) : '-', 250, y);
      
      y += 6;
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pageCount}`, 14, 200);
      doc.text('Confidential - Internal Use Only', 200, 200);
    }

    doc.save(`assigned-leads-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Report exported successfully');
  };

  // Export to Excel (CSV)
  const exportToExcel = () => {
    const headers = [
      'Lead Name', 'Phone', 'Email', 'Source', 'Source Module', 
      'Campaign/Page', 'Assigned To', 'Reporting To', 'Lead Status', 
      'Contact Status', 'Assignment Date', 'Last Activity', 
      'Follow-up Date', 'Builder/Project', 'Location'
    ];

    const rows = filteredLeads.map(lead => {
      const assignedUser = allUsers.find(u => u.email === lead.assigned_to);
      const reportingUser = allUsers.find(u => u.email === lead.reporting_to);

      return [
        lead.lead_name,
        lead.phone,
        lead.email,
        lead.lead_source,
        lead.source_module,
        lead.campaign_page,
        assignedUser?.full_name || lead.assigned_to || 'Unassigned',
        reportingUser?.full_name || lead.reporting_to || '-',
        STATUS_CONFIG[lead.lead_status.toLowerCase()]?.label || lead.lead_status,
        CONTACT_STATUS_CONFIG[lead.contact_status]?.label || lead.contact_status,
        lead.assignment_date ? format(new Date(lead.assignment_date), 'yyyy-MM-dd') : '-',
        lead.last_activity_date ? format(new Date(lead.last_activity_date), 'yyyy-MM-dd') : '-',
        lead.follow_up_date ? format(new Date(lead.follow_up_date), 'yyyy-MM-dd') : '-',
        lead.builder_project,
        lead.location
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assigned-leads-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Excel report exported successfully');
  };

  const getInitials = (name) => {
    if (!name || name === 'Unknown') return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUserName = (email) => getUserDisplayByEmail(email, allUsers);

  const isLoading = loadingPageLeads || loadingRELeads;

  if (isLoading) {
    return <div className="p-8 text-center">Loading assigned leads data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            Unified Assigned Leads Report
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Consolidated view of all assigned leads from Pages Leads & Lead Management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          <Button onClick={exportToPDF} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-indigo-100 text-sm">Total Assigned</span>
              <Users className="w-5 h-5 text-indigo-200" />
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-green-600 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100 text-sm">Active Leads</span>
              <TrendingUp className="w-5 h-5 text-green-200" />
            </div>
            <p className="text-3xl font-bold">{stats.active}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm">Closed Leads</span>
              <CheckCircle2 className="w-5 h-5 text-blue-200" />
            </div>
            <p className="text-3xl font-bold">{stats.closed}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-rose-600 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-100 text-sm">Not Contacted</span>
              <AlertCircle className="w-5 h-5 text-red-200" />
            </div>
            <p className="text-3xl font-bold">{stats.notContacted}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-100 text-sm">Unfollowed</span>
              <Clock className="w-5 h-5 text-amber-200" />
            </div>
            <p className="text-3xl font-bold">{stats.unfollowed}</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-gradient-to-br from-rose-500 to-red-600 text-white border-0 cursor-pointer hover:shadow-lg transition-all"
          onClick={() => setFilterFollowUp('overdue')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-red-100 text-sm">🚨 Overdue</span>
              <AlertCircle className="w-5 h-5 text-red-200 animate-pulse" />
            </div>
            <p className="text-3xl font-bold">{stats.overdueFollowUps}</p>
            <p className="text-xs text-red-100 mt-1">Click to filter</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-orange-100 text-sm">Hot Leads</span>
              <Zap className="w-5 h-5 text-orange-200" />
            </div>
            <p className="text-3xl font-bold">{stats.hot}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="bg-gradient-to-r from-slate-50 to-indigo-50 border-2 border-indigo-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="w-5 h-5 text-indigo-600" />
            Comprehensive Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="col-span-full">
              <label className="text-sm font-medium text-slate-700 block mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name, phone, email, campaign..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white"
                />
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
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
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Start Date</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">End Date</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </>
            )}

            {/* Lead Source */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Lead Source</label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="pages_leads">Pages Leads</SelectItem>
                  <SelectItem value="lead_management">Lead Management</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="walkin">Walk-in</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Assigned Member */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Assigned Member</label>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {visibleSalesUsers.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lead Status */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Lead Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="site_visit">Site Visit</SelectItem>
                  <SelectItem value="agreement">Agreement</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contact Status */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Contact Status</label>
              <Select value={filterContactStatus} onValueChange={setFilterContactStatus}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contact Status</SelectItem>
                  <SelectItem value="not_contacted">Not Contacted</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="not_interested">Not Interested</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Follow-up Status */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Follow-up Status</label>
              <Select value={filterFollowUp} onValueChange={setFilterFollowUp}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="overdue">🚨 Overdue Follow-ups</SelectItem>
                  <SelectItem value="due_today">📅 Due Today</SelectItem>
                  <SelectItem value="due_tomorrow">📅 Due Tomorrow</SelectItem>
                  <SelectItem value="has_follow_up">Has Follow-up Scheduled</SelectItem>
                  <SelectItem value="no_follow_up">No Follow-up Set</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Builder Filter */}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">Builder/Project</label>
              <Input
                placeholder="Filter by builder/project..."
                value={filterBuilder}
                onChange={(e) => setFilterBuilder(e.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setDateRange('all');
                setFilterSource('all');
                setFilterAssignee('all');
                setFilterStatus('all');
                setFilterContactStatus('all');
                setFilterFollowUp('all');
                setFilterBuilder('all');
              }}
            >
              Clear All Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-2 border-slate-200 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50 border-b-2">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Assigned Leads Report ({filteredLeads.length})
            </span>
            <Badge className="bg-indigo-100 text-indigo-700 text-sm px-3 py-1">
              {user?.role === 'admin' ? 'All Teams' : 'My Team'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-100 z-10">
                <TableRow>
                  <TableHead className="font-bold">Lead Name</TableHead>
                  <TableHead className="font-bold">Phone / Email</TableHead>
                  <TableHead className="font-bold">Source</TableHead>
                  <TableHead className="font-bold">Source Module</TableHead>
                  <TableHead className="font-bold">Campaign / Page</TableHead>
                  <TableHead className="font-bold">Assigned To</TableHead>
                  <TableHead className="font-bold">Reporting Officer</TableHead>
                  <TableHead className="font-bold">Lead Status</TableHead>
                  <TableHead className="font-bold">Contact Status</TableHead>
                  <TableHead className="font-bold">Assignment Date</TableHead>
                  <TableHead className="font-bold">Last Activity</TableHead>
                  <TableHead className="font-bold">Follow-up</TableHead>
                  <TableHead className="font-bold">Builder/Project</TableHead>
                  <TableHead className="text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-12 text-slate-500">
                      <div className="flex flex-col items-center gap-3">
                        <AlertCircle className="w-12 h-12 text-slate-300" />
                        <p className="font-medium">No assigned leads found</p>
                        <p className="text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead, idx) => {
                    const assignedUser = allUsers.find(u => u.email === lead.assigned_to);
                    const reportingUser = allUsers.find(u => u.email === lead.reporting_to);
                    const isOverdue = lead.follow_up_date && new Date(lead.follow_up_date) < new Date();

                    return (
                      <TableRow key={lead.id} className="hover:bg-indigo-50/30">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-9 h-9 border-2 border-white shadow-sm">
                              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold">
                                {getInitials(lead.lead_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold text-slate-900">{lead.lead_name}</p>
                              {lead.location !== '-' && (
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Building className="w-3 h-3" />
                                  {lead.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="font-medium">{lead.phone}</span>
                            </div>
                            {lead.email !== '-' && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[150px]">{lead.email}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-medium">
                            {lead.lead_source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            lead.source_module === 'Pages Leads' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'bg-purple-100 text-purple-700'
                          }>
                            {lead.source_module}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="text-sm text-slate-700 truncate block" title={lead.campaign_page}>
                            {lead.campaign_page}
                          </span>
                        </TableCell>
                        <TableCell>
                          {assignedUser ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-7 h-7">
                                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                                  {getInitials(assignedUser.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{assignedUser.full_name || lead.assigned_to}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {reportingUser ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="bg-purple-100 text-purple-700 text-[10px]">
                                  {getInitials(reportingUser.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{reportingUser.full_name || lead.reporting_to}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_CONFIG[lead.lead_status.toLowerCase()]?.color || 'bg-slate-100 text-slate-700'}>
                            {STATUS_CONFIG[lead.lead_status.toLowerCase()]?.label || lead.lead_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={CONTACT_STATUS_CONFIG[lead.contact_status]?.color || 'bg-slate-100 text-slate-700'}>
                            {CONTACT_STATUS_CONFIG[lead.contact_status]?.label || lead.contact_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {lead.assignment_date 
                            ? format(new Date(lead.assignment_date), 'MMM d, yyyy') 
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {lead.last_activity_date ? (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{format(new Date(lead.last_activity_date), 'MMM d, yyyy')}</span>
                            </div>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 text-xs">No Activity</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.follow_up_date ? (
                            <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                              {isOverdue ? (
                                <Badge className="bg-red-600 text-white animate-pulse">
                                  🚨 {format(new Date(lead.follow_up_date), 'MMM d')}
                                </Badge>
                              ) : (
                                <>
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {format(new Date(lead.follow_up_date), 'MMM d, yyyy')}
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {lead.builder_project !== '-' ? lead.builder_project : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={createPageUrl(`LeadDetail?id=${lead.id}`)}>
                            <Button variant="ghost" size="sm" className="h-8">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}