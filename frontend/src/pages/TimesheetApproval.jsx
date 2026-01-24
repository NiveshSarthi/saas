import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Calendar,
  User,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  FileText,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TimesheetApproval() {
  const [user, setUser] = useState(null);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState(null); // 'approve' or 'reject'
  const [reviewComments, setReviewComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [freelancerFilter, setFreelancerFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not logged in');
      }
    };
    fetchUser();
  }, []);

  // Get all timesheets for approval
  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ['timesheets-approval', statusFilter, freelancerFilter, startDateFilter, endDateFilter],
    queryFn: async () => {
      let filter = {};
      if (statusFilter !== 'all') {
        filter.status = statusFilter;
      }
      if (freelancerFilter !== 'all') {
        filter.freelancer_email = freelancerFilter;
      }
      if (startDateFilter || endDateFilter) {
        if (startDateFilter && endDateFilter) {
          filter.period_start = { $gte: startDateFilter };
          filter.period_end = { $lte: endDateFilter };
        } else if (startDateFilter) {
          filter.period_start = { $gte: startDateFilter };
        } else if (endDateFilter) {
          filter.period_end = { $lte: endDateFilter };
        }
      }

      return await base44.entities.Timesheet.filter(filter, '-submitted_at');
    },
    enabled: !!user?.email && (user?.role === 'admin' || user?.role === 'manager'),
  });

  // Get freelancers for filter
  const { data: freelancers = [] } = useQuery({
    queryKey: ['freelancers-for-filter'],
    queryFn: () => base44.entities.User.filter({ role: 'freelancer' }),
    enabled: !!user?.email && (user?.role === 'admin' || user?.role === 'manager'),
  });

  const approveTimesheetMutation = useMutation({
    mutationFn: async ({ timesheetId, comments }) => {
      return await base44.entities.Timesheet.update(timesheetId, {
        status: 'approved',
        approved_at: new Date(),
        approved_by: user.email,
        comments: comments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets-approval'] });
      setReviewDialogOpen(false);
      setSelectedTimesheet(null);
      setReviewComments('');
      toast.success('Timesheet approved successfully');
    },
  });

  const rejectTimesheetMutation = useMutation({
    mutationFn: async ({ timesheetId, reason, comments }) => {
      return await base44.entities.Timesheet.update(timesheetId, {
        status: 'rejected',
        rejected_at: new Date(),
        rejected_by: user.email,
        rejection_reason: reason,
        comments: comments
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timesheets-approval'] });
      setReviewDialogOpen(false);
      setSelectedTimesheet(null);
      setReviewComments('');
      setRejectionReason('');
      toast.success('Timesheet rejected');
    },
  });

  const handleApprove = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setReviewAction('approve');
    setReviewDialogOpen(true);
    setReviewComments('');
  };

  const handleReject = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setReviewAction('reject');
    setReviewDialogOpen(true);
    setReviewComments('');
    setRejectionReason('');
  };

  const handleConfirmReview = () => {
    if (reviewAction === 'approve') {
      approveTimesheetMutation.mutate({
        timesheetId: selectedTimesheet.id,
        comments: reviewComments
      });
    } else if (reviewAction === 'reject') {
      if (!rejectionReason.trim()) {
        toast.error('Please provide a reason for rejection');
        return;
      }
      rejectTimesheetMutation.mutate({
        timesheetId: selectedTimesheet.id,
        reason: rejectionReason,
        comments: reviewComments
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: AlertCircle },
      submitted: { label: 'Submitted', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
      approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
      rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
    };
    const config = statusConfig[status] || statusConfig.draft;
    const IconComponent = config.icon;

    return (
      <Badge className={cn("flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border shadow-sm", config.color)}>
        <IconComponent className="w-3.5 h-3.5" />
        {config.label}
      </Badge>
    );
  };

  const formatWeekRange = (weekStart) => {
    const start = new Date(weekStart);
    const end = addDays(start, 6);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  };

  const handleExportPDF = () => {
    if (timesheets.length === 0) {
      toast.error('No timesheets to export');
      return;
    }

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text('Timesheet Approval Report', 14, 20);

    // Subtitle
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${format(new Date(), 'MMM d, yyyy HH:mm')}`, 14, 28);
    doc.text(`Filter: ${statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`, 14, 34);
    if (startDateFilter || endDateFilter) {
      const dateText = `Period: ${startDateFilter ? format(new Date(startDateFilter), 'MMM d, yyyy') : 'Start'} - ${endDateFilter ? format(new Date(endDateFilter), 'MMM d, yyyy') : 'End'}`;
      doc.text(dateText, 14, 40);
    }

    let yPos = 45;

    // Process each timesheet
    timesheets.forEach((timesheet, index) => {
      // Add new page if needed
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      // Timesheet header
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 30);
      doc.text(`${index + 1}. ${timesheet.freelancer_name}`, 14, yPos);

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Week: ${formatWeekRange(timesheet.week_start_date)}`, 14, yPos + 6);
      doc.text(`Status: ${timesheet.status}`, 14, yPos + 12);
      doc.text(`Total Hours: ${timesheet.total_hours}h`, 100, yPos + 12);

      yPos += 20;

      // Entries table
      if (timesheet.entries && timesheet.entries.length > 0) {
        const tableData = timesheet.entries.map(entry => [
          format(new Date(entry.date), 'MMM d, yyyy'),
          entry.task_title || 'N/A',
          entry.project_name || 'N/A',
          `${entry.hours}h`,
          entry.description || '-'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Task Name', 'Project', 'Hours Taken', 'Description']],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [79, 70, 229],
            fontSize: 8,
            fontStyle: 'bold'
          },
          styles: {
            fontSize: 8,
            cellPadding: 3
          },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 40 },
            2: { cellWidth: 30 },
            3: { cellWidth: 20, halign: 'center' },
            4: { cellWidth: 'auto' }
          },
          margin: { left: 14, right: 14 }
        });

        yPos = doc.lastAutoTable.finalY + 15;
      } else {
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('No time entries', 14, yPos);
        yPos += 15;
      }
    });

    // Save PDF
    const filename = `Timesheet_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
    toast.success('PDF exported successfully');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">Please log in to access timesheet approval.</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin' && user.role !== 'manager') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
          <p className="text-slate-500">Only administrators and managers can access timesheet approval.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="animate-in slide-in-from-left-4 duration-500">
            <h1 className="text-3xl font-bold text-slate-900">Timesheet Approval</h1>
            <p className="text-slate-500 mt-1 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Review and approve freelancer timesheets
            </p>
          </div>
        </div>

        {/* Filters and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Card */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-indigo-500" />
              <h3 className="font-semibold text-slate-900">Filters</h3>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-slate-50 border-slate-200 h-10 rounded-lg">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-auto">
                <Select value={freelancerFilter} onValueChange={setFreelancerFilter}>
                  <SelectTrigger className="w-full sm:w-[220px] bg-slate-50 border-slate-200 h-10 rounded-lg">
                    <SelectValue placeholder="Freelancer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Freelancers</SelectItem>
                    {freelancers.map(freelancer => (
                      <SelectItem key={freelancer.email} value={freelancer.email}>
                        {freelancer.full_name || freelancer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={(e) => setStartDateFilter(e.target.value)}
                    className="w-[140px] h-10 bg-slate-50 border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <span className="text-slate-400">to</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={(e) => setEndDateFilter(e.target.value)}
                    className="w-[140px] h-10 bg-slate-50 border-slate-200 rounded-lg text-sm"
                  />
                </div>
                {(startDateFilter || endDateFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStartDateFilter('');
                      setEndDateFilter('');
                    }}
                    className="h-10 px-2 text-slate-400 hover:text-indigo-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              <div className="ml-auto flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  disabled={timesheets.length === 0}
                  className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <div className="text-sm text-slate-500">
                  Showing {timesheets.length} result{timesheets.length !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
            <h3 className="text-sm font-medium text-indigo-100 mb-1">Pending Reviews</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {timesheets.filter(t => t.status === 'submitted').length}
              </span>
              <span className="text-sm text-indigo-200">timesheets</span>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 text-xs text-indigo-100 flex items-center gap-2">
              <Clock className="w-3 h-3" />
              Needs attention
            </div>
          </div>
        </div>

        {/* Timesheets Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-20 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-slate-500">Loading timesheets...</p>
            </div>
          ) : timesheets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100">
                  <TableHead className="text-slate-500 font-semibold bg-slate-50/50 pl-6">Freelancer</TableHead>
                  <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Week</TableHead>
                  <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Period</TableHead>
                  <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Total Hours</TableHead>
                  <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Status</TableHead>
                  <TableHead className="text-slate-500 font-semibold bg-slate-50/50">Submitted</TableHead>
                  <TableHead className="text-center text-slate-500 font-semibold bg-slate-50/50 w-[200px] pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((timesheet) => (
                  <TableRow key={timesheet.id} className="hover:bg-slate-50/80 border-slate-100 transition-colors group">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                          {timesheet.freelancer_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{timesheet.freelancer_name}</div>
                          <div className="text-xs text-slate-500">{timesheet.freelancer_email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-slate-700">{formatWeekRange(timesheet.week_start_date)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {format(new Date(timesheet.period_start), 'MMM d')} - {format(new Date(timesheet.period_end), 'MMM d')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded text-sm">{timesheet.total_hours}h</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(timesheet.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-500">
                        {timesheet.submitted_at ? format(new Date(timesheet.submitted_at), 'MMM d, yyyy') : '-'}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedTimesheet(timesheet)}
                          className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>

                        {timesheet.status === 'submitted' && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(timesheet)}
                              className="h-8 w-8 p-0 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 hover:text-emerald-700 rounded-full shadow-sm border border-emerald-200"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReject(timesheet)}
                              className="h-8 w-8 p-0 bg-rose-100 text-rose-600 hover:bg-rose-200 hover:text-rose-700 rounded-full shadow-sm border border-rose-200"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-20 text-center flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No timesheets found</h3>
              <p className="text-slate-500 max-w-sm">No timesheets match the current filters. Adjust the filters or check back later.</p>
            </div>
          )}
        </div>

        {/* Timesheet Details Dialog */}
        <Dialog open={!!selectedTimesheet && !reviewDialogOpen} onOpenChange={() => setSelectedTimesheet(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-0 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                  <User className="w-6 h-6 text-indigo-500" />
                  {selectedTimesheet?.freelancer_name}
                </DialogTitle>
                {selectedTimesheet && getStatusBadge(selectedTimesheet.status)}
              </div>
              <DialogDescription className="text-slate-500 mt-1">
                Week range: {selectedTimesheet ? formatWeekRange(selectedTimesheet.week_start_date) : ''}
              </DialogDescription>
            </DialogHeader>

            {selectedTimesheet && (
              <div className="space-y-8 pt-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Hours</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedTimesheet.total_hours}h</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Entries</p>
                    <p className="text-2xl font-bold text-slate-900">{selectedTimesheet.entries?.length || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Submitted On</p>
                    <p className="text-lg font-medium text-slate-900">
                      {selectedTimesheet.submitted_at ? format(new Date(selectedTimesheet.submitted_at), 'MMM d, yyyy HH:mm') : 'Not submitted yet'}
                    </p>
                  </div>
                </div>

                {/* Time Entries */}
                <div>
                  <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-400" />
                    Time Entries
                  </h4>
                  {selectedTimesheet.entries?.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTimesheet.entries.map((entry, index) => (
                        <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center flex-wrap gap-2">
                                <span className="font-bold text-slate-900 text-lg">{entry.task_title}</span>
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100">{entry.project_name}</Badge>
                              </div>
                              <p className="text-slate-600 text-sm leading-relaxed">{entry.description}</p>
                            </div>
                            <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                              <div className="flex items-center gap-2 text-slate-500 text-sm">
                                <Calendar className="w-4 h-4" />
                                {format(new Date(entry.date), 'MMM d, yyyy')}
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-700 text-base font-bold px-3 py-1">
                                {entry.hours}h
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <p className="text-slate-500">No time entries found</p>
                    </div>
                  )}
                </div>

                {/* Approval/Rejection Info */}
                {selectedTimesheet.status !== 'submitted' && selectedTimesheet.status !== 'draft' && (
                  <div className={cn(
                    "rounded-xl p-6 border",
                    selectedTimesheet.status === 'approved' ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
                  )}>
                    <h4 className={cn(
                      "text-lg font-bold mb-4 flex items-center gap-2",
                      selectedTimesheet.status === 'approved' ? "text-emerald-800" : "text-rose-800"
                    )}>
                      {selectedTimesheet.status === 'approved' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      {selectedTimesheet.status === 'approved' ? 'Approval Details' : 'Rejection Details'}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className={cn("text-xs font-bold uppercase tracking-wider mb-1", selectedTimesheet.status === 'approved' ? "text-emerald-600" : "text-rose-600")}>Reviewed By</p>
                        <p className="font-medium text-slate-900">{selectedTimesheet.approved_by || selectedTimesheet.rejected_by}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs font-bold uppercase tracking-wider mb-1", selectedTimesheet.status === 'approved' ? "text-emerald-600" : "text-rose-600")}>Date</p>
                        <p className="font-medium text-slate-900">
                          {selectedTimesheet.approved_at ?
                            format(new Date(selectedTimesheet.approved_at), 'MMM d, yyyy HH:mm') :
                            selectedTimesheet.rejected_at ?
                              format(new Date(selectedTimesheet.rejected_at), 'MMM d, yyyy HH:mm') : '-'
                          }
                        </p>
                      </div>
                    </div>

                    {selectedTimesheet.rejection_reason && (
                      <div className="mt-4 pt-4 border-t border-rose-200">
                        <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Reason for Rejection</p>
                        <p className="text-rose-800 bg-white/50 p-3 rounded-lg border border-rose-100">{selectedTimesheet.rejection_reason}</p>
                      </div>
                    )}

                    {selectedTimesheet.comments && (
                      <div className={cn("mt-4 pt-4 border-t", selectedTimesheet.status === 'approved' ? "border-emerald-200" : "border-rose-200")}>
                        <p className={cn("text-xs font-bold uppercase tracking-wider mb-1", selectedTimesheet.status === 'approved' ? "text-emerald-600" : "text-rose-600")}>Comments</p>
                        <p className="text-slate-700 italic">"{selectedTimesheet.comments}"</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedTimesheet.status === 'submitted' && (
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                    <Button
                      variant="outline"
                      onClick={() => handleReject(selectedTimesheet)}
                      className="border-rose-200 text-rose-700 hover:bg-rose-50 h-10 px-6 font-semibold"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedTimesheet)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-6 font-semibold shadow-lg shadow-emerald-200"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl rounded-2xl">
            <DialogHeader className="pb-4 border-b border-slate-100">
              <DialogTitle className={cn(
                "flex items-center gap-2 text-xl font-bold",
                reviewAction === 'approve' ? "text-emerald-600" : "text-rose-600"
              )}>
                {reviewAction === 'approve' ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
                {reviewAction === 'approve' ? 'Approve' : 'Reject'} Timesheet
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1">
                {selectedTimesheet && (
                  <span>
                    Confirm action for <strong>{selectedTimesheet.freelancer_name}</strong>'s timesheet?
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-4">
              {reviewAction === 'reject' && (
                <div>
                  <Label htmlFor="rejection-reason" className="text-rose-600 font-semibold">
                    Reason for Rejection <span className="text-rose-500">*</span>
                  </Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Please explain why the timesheet is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="mt-1 bg-rose-50 border-rose-200 focus:ring-rose-500 resize-none placeholder:text-rose-300"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="review-comments" className="text-slate-700 font-semibold">Comments (Optional)</Label>
                <Textarea
                  id="review-comments"
                  placeholder="Add any additional notes..."
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  rows={3}
                  className="mt-1 bg-slate-50 border-slate-200 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)} className="border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReview}
                disabled={
                  approveTimesheetMutation.isPending ||
                  rejectTimesheetMutation.isPending ||
                  (reviewAction === 'reject' && !rejectionReason.trim())
                }
                className={cn(
                  "shadow-lg text-white font-semibold transition-all hover:scale-105 active:scale-95",
                  reviewAction === 'approve'
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                    : "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                )}
              >
                {approveTimesheetMutation.isPending || rejectTimesheetMutation.isPending ? (
                  'Processing...'
                ) : (
                  <>
                    {reviewAction === 'approve' ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    {reviewAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}