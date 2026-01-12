import React, { useState, useMemo } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Download, Calendar, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { jsPDF } from 'jspdf';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';

export default function DownloadActivityReportDialog({ activities, users }) {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [memberFilter, setMemberFilter] = useState('all');
  const [approvalFilter, setApprovalFilter] = useState('all');
  const [formatType, setFormatType] = useState('csv');

  const getDateRangeDates = () => {
    const today = new Date();
    let from, to;

    switch (dateRange) {
      case 'today':
        from = to = format(today, 'yyyy-MM-dd');
        break;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        from = to = format(tomorrow, 'yyyy-MM-dd');
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        from = to = format(yesterday, 'yyyy-MM-dd');
        break;
      case 'this_week':
        from = format(startOfWeek(today), 'yyyy-MM-dd');
        to = format(endOfWeek(today), 'yyyy-MM-dd');
        break;
      case 'this_month':
        from = format(startOfMonth(today), 'yyyy-MM-dd');
        to = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'custom':
        from = customFrom;
        to = customTo;
        break;
      default:
        from = to = format(today, 'yyyy-MM-dd');
    }

    return { from, to };
  };

  const filteredActivities = useMemo(() => {
    const { from, to } = getDateRangeDates();
    
    return activities.filter(activity => {
      // Date range filter
      if (from && to) {
        const activityDate = format(parseISO(activity.date), 'yyyy-MM-dd');
        if (activityDate < from || activityDate > to) return false;
      }

      // Type filter
      if (typeFilter !== 'all' && activity.type !== typeFilter) return false;

      // Member filter
      if (memberFilter !== 'all' && activity.user_email !== memberFilter) return false;

      // Approval status filter
      if (approvalFilter !== 'all') {
        if (approvalFilter === 'pending' && activity.approval_status !== 'pending') return false;
        if (approvalFilter === 'approved' && activity.approval_status !== 'approved') return false;
        if (approvalFilter === 'builder_verified' && activity.builder_verification_status !== 'verified') return false;
        if (approvalFilter === 'ro_verified' && activity.ro_verification_status !== 'verified') return false;
      }

      return true;
    });
  }, [activities, dateRange, customFrom, customTo, typeFilter, memberFilter, approvalFilter]);

  const handleDownload = () => {
    if (dateRange === 'custom' && (!customFrom || !customTo)) {
      alert('Please select custom date range');
      return;
    }

    if (formatType === 'csv') {
      downloadCSV();
    } else {
      downloadPDF();
    }
    
    setOpen(false);
  };

  const downloadCSV = () => {
    const headers = [
      'Activity ID',
      'Sales Member',
      'Category',
      'Email',
      'Customer Name',
      'Phone',
      'Source',
      'Type',
      'Lead Status',
      'Builder Approval',
      'RO Approval',
      'Date & Time',
      'Notes',
      'Lead Type',
      'Property Type',
      'Deal Value'
    ];

    const rows = filteredActivities.map(activity => {
      const member = users.find(u => u.email === activity.user_email);
      return [
        activity.id,
        member?.full_name || activity.user_email,
        member?.user_category || 'N/A',
        activity.user_email,
        activity.customer_name || '',
        activity.customer_phone || '',
        activity.source || '',
        activity.type === 'walk_in' ? 'Walk-In' : 'Closure',
        activity.status || '',
        activity.builder_email ? (activity.builder_verification_status || 'pending') : 'N/A',
        activity.ro_verification_status || 'pending',
        format(parseISO(activity.date), 'MMM d, yyyy h:mm a'),
        activity.notes || '',
        activity.lead_type || '',
        activity.property_type || '',
        activity.deal_value || '0'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    const { from, to } = getDateRangeDates();

    // Header Background
    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, 297, 35, 'F');

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Sales Activity Logs Report', 14, 15);

    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, 14, 23);
    doc.text(`Period: ${from} to ${to}`, 14, 28);
    doc.text(`Total Activities: ${filteredActivities.length}`, 220, 23);

    // Stats Summary
    const walkIns = filteredActivities.filter(a => a.type === 'walk_in').length;
    const closures = filteredActivities.filter(a => a.type === 'closure').length;
    const totalValue = filteredActivities.reduce((sum, a) => sum + (parseFloat(a.deal_value) || 0), 0);
    
    doc.text(`Walk-Ins: ${walkIns} | Closures: ${closures}`, 220, 28);

    // Reset color for body
    doc.setTextColor(0, 0, 0);

    // Table
    doc.setFontSize(9);
    let y = 50;

    // Headers with background
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.rect(10, y - 6, 277, 9, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.text('Member', 12, y);
    doc.text('Customer', 55, y);
    doc.text('Phone', 90, y);
    doc.text('Type', 120, y);
    doc.text('Source', 145, y);
    doc.text('Builder', 170, y);
    doc.text('RO', 195, y);
    doc.text('Status', 215, y);
    doc.text('Date', 245, y);
    doc.text('Value', 270, y);
    
    doc.setFont('helvetica', 'normal');
    y += 9;
    doc.setDrawColor(203, 213, 225);
    doc.line(10, y - 2, 287, y - 2);

    // Rows with alternating colors
    filteredActivities.forEach((activity, index) => {
      if (y > 190) {
        doc.addPage('landscape');
        
        // Repeat header on new page
        y = 20;
        doc.setFillColor(241, 245, 249);
        doc.rect(10, y - 6, 277, 9, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.text('Member', 12, y);
        doc.text('Customer', 55, y);
        doc.text('Phone', 90, y);
        doc.text('Type', 120, y);
        doc.text('Source', 145, y);
        doc.text('Builder', 170, y);
        doc.text('RO', 195, y);
        doc.text('Status', 215, y);
        doc.text('Date', 245, y);
        doc.text('Value', 270, y);
        doc.setFont('helvetica', 'normal');
        y += 9;
      }

      // Alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(10, y - 6, 277, 8, 'F');
      }

      const member = users.find(u => u.email === activity.user_email);
      const memberName = (member?.full_name || activity.user_email).substring(0, 18);
      const customerName = (activity.customer_name || '-').substring(0, 16);
      const phone = (activity.customer_phone || '-').substring(0, 13);
      const activityType = activity.type === 'walk_in' ? 'Walk-In' : 'Closure';
      const source = (activity.source || '-').substring(0, 11);
      
      // Builder approval with color
      const builderStatus = activity.builder_email ? (activity.builder_verification_status || 'pending') : 'N/A';
      if (builderStatus === 'verified') {
        doc.setTextColor(5, 150, 105); // Green
        doc.text('OK', 170, y);
      } else if (builderStatus === 'not_verified') {
        doc.setTextColor(220, 38, 38); // Red
        doc.text('No', 170, y);
      } else if (builderStatus === 'pending') {
        doc.setTextColor(217, 119, 6); // Amber
        doc.text('Wait', 170, y);
      } else {
        doc.setTextColor(100, 116, 139); // Gray
        doc.text('N/A', 170, y);
      }
      
      // RO approval with color
      doc.setTextColor(0, 0, 0);
      const roStatus = activity.ro_verification_status || 'pending';
      if (roStatus === 'verified') {
        doc.setTextColor(5, 150, 105);
        doc.text('OK', 195, y);
      } else if (roStatus === 'not_verified') {
        doc.setTextColor(220, 38, 38);
        doc.text('No', 195, y);
      } else {
        doc.setTextColor(217, 119, 6);
        doc.text('Wait', 195, y);
      }
      
      // Reset color
      doc.setTextColor(0, 0, 0);
      
      const status = (activity.status || '-').substring(0, 12);
      const dealValue = activity.deal_value ? `${parseFloat(activity.deal_value).toLocaleString()}` : '-';

      doc.text(memberName, 12, y);
      doc.text(customerName, 55, y);
      doc.text(phone, 90, y);
      
      // Activity type with color
      if (activity.type === 'walk_in') {
        doc.setTextColor(59, 130, 246); // Blue
        doc.text(activityType, 120, y);
      } else {
        doc.setTextColor(16, 185, 129); // Green
        doc.text(activityType, 120, y);
      }
      doc.setTextColor(0, 0, 0);
      
      doc.text(source, 145, y);
      doc.text(status, 215, y);
      doc.text(format(parseISO(activity.date), 'MMM d'), 245, y);
      doc.text(dealValue.substring(0, 11), 270, y);

      y += 8;
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${pageCount}`, 250, 200);
      doc.text('Confidential - Sales Performance Report', 14, 200);
    }

    doc.save(`sales-activity-logs-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg">
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Download className="w-5 h-5 text-emerald-600" />
            Download Activity Logs Report
          </DialogTitle>
          <DialogDescription>
            Configure filters and download format for activity logs export
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Date Range
            </Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="tomorrow">Tomorrow</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>

            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-2">
                  <Label className="text-sm">From Date</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">To Date</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Optional Filters */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Optional Filters</Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Activity Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="walk_in">Walk-In</SelectItem>
                    <SelectItem value="closure">Closure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Member</Label>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger>
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
                <Label className="text-sm">Approval Status</Label>
                <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="builder_verified">Builder Verified</SelectItem>
                    <SelectItem value="ro_verified">RO Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Format</Label>
                <Select value={formatType} onValueChange={setFormatType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-green-600" />
                        CSV (Excel)
                      </div>
                    </SelectItem>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-red-600" />
                        PDF
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Preview Count */}
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <p className="text-sm text-indigo-900 font-medium">
              📊 {filteredActivities.length} activities will be exported
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleDownload}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Download {formatType.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}