import React, { useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, XCircle, AlertCircle, Filter, X } from 'lucide-react';

const statusConfig = {
  checked_in: { 
    label: 'Checked In', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock
  },
  checked_out: { 
    label: 'Checked Out', 
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle2
  },
  not_checked_in: { 
    label: 'Not Checked In', 
    color: 'bg-slate-100 text-slate-600 border-slate-200',
    icon: XCircle
  },
  present: { label: 'Present', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  absent: { label: 'Absent', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  half_day: { label: 'Half Day', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertCircle },
  leave: { label: 'Leave', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: AlertCircle },
  work_from_home: { label: 'WFH', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
  sick_leave: { label: 'Sick Leave', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertCircle },
  casual_leave: { label: 'Casual Leave', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: AlertCircle }
};

export default function TeamAttendanceView({ allUsers, todayRecords }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch attendance records for the selected date
  const { data: dateRecords = [] } = useQuery({
    queryKey: ['team-attendance-by-date', selectedDate],
    queryFn: async () => {
      return await base44.entities.Attendance.filter({ date: selectedDate });
    },
  });

  const teamAttendance = allUsers.map(user => {
    const record = dateRecords.find(r => r.user_email === user.email);
    
    return {
      user,
      record,
      status: record?.status || 'not_checked_in',
      checkInTime: record?.check_in_time,
      checkOutTime: record?.check_out_time,
      totalHours: record?.total_hours,
      isLate: record?.is_late,
      isEarlyCheckout: record?.is_early_checkout,
      location: record?.location,
      notes: record?.notes
    };
  });

  // Apply filters
  let filteredTeam = teamAttendance;

  // Filter by selected users
  if (selectedUsers.length > 0) {
    filteredTeam = filteredTeam.filter(item => 
      selectedUsers.includes(item.user.email)
    );
  }

  // Filter by search term
  if (searchTerm) {
    filteredTeam = filteredTeam.filter(item => {
      const name = (item.user.full_name || item.user.email).toLowerCase();
      const email = item.user.email.toLowerCase();
      const search = searchTerm.toLowerCase();
      return name.includes(search) || email.includes(search);
    });
  }

  // Sort: Checked in first, then not checked in, then checked out
  const sortedTeam = [...filteredTeam].sort((a, b) => {
    // Prioritize by actual check-in status
    const aCheckedIn = (a.status === 'checked_in' || (a.status === 'present' && a.record?.check_in_time && !a.record?.check_out_time));
    const bCheckedIn = (b.status === 'checked_in' || (b.status === 'present' && b.record?.check_in_time && !b.record?.check_out_time));
    const aCheckedOut = (a.status === 'checked_out' || (a.status === 'present' && a.record?.check_out_time));
    const bCheckedOut = (b.status === 'checked_out' || (b.status === 'present' && b.record?.check_out_time));
    
    if (aCheckedIn && !bCheckedIn) return -1;
    if (!aCheckedIn && bCheckedIn) return 1;
    if (aCheckedOut && !bCheckedOut) return 1;
    if (!aCheckedOut && bCheckedOut) return -1;
    
    return 0;
  });

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const handleUserToggle = (userEmail) => {
    setSelectedUsers(prev => 
      prev.includes(userEmail)
        ? prev.filter(e => e !== userEmail)
        : [...prev, userEmail]
    );
  };

  const clearFilters = () => {
    setSelectedUsers([]);
    setSearchTerm('');
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const hasActiveFilters = selectedUsers.length > 0 || searchTerm || selectedDate !== format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-3 sm:space-y-4 overflow-x-hidden">
      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filters</h3>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Filter */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Date</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Search Filter */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Search Employee</label>
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* User Multi-Select */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Select Members ({selectedUsers.length} selected)
            </label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select members..." />
              </SelectTrigger>
              <SelectContent>
                {allUsers.map(user => (
                  <div
                    key={user.email}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-100 cursor-pointer"
                    onClick={() => handleUserToggle(user.email)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.email)}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{user.full_name || user.email}</span>
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Users Pills */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedUsers.map(email => {
              const user = allUsers.find(u => u.email === email);
              return (
                <Badge key={email} variant="secondary" className="flex items-center gap-1">
                  {user?.full_name || email}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => handleUserToggle(email)}
                  />
                </Badge>
              );
            })}
          </div>
        )}
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-semibold text-sm sm:text-base text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
            <span className="truncate">Team Attendance ({format(new Date(selectedDate), 'MMM d, yyyy')})</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 overflow-x-auto whitespace-nowrap scrollbar-thin">
            Showing: {sortedTeam.length} of {teamAttendance.length} | 
            Checked In: {sortedTeam.filter(t => (t.status === 'checked_in' || (t.status === 'present' && t.record?.check_in_time && !t.record?.check_out_time))).length} | 
            Checked Out: {sortedTeam.filter(t => (t.status === 'checked_out' || (t.status === 'present' && t.record?.check_out_time))).length} | 
            Not Checked In: {sortedTeam.filter(t => t.status === 'not_checked_in' || (t.status === 'present' && !t.record?.check_in_time)).length}
          </p>
        </div>

      <div className="overflow-x-auto scrollbar-thin -webkit-overflow-scrolling-touch">
        <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Employee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Check In</TableHead>
            <TableHead>Check Out</TableHead>
            <TableHead>Hours</TableHead>
            <TableHead>Flags</TableHead>
            <TableHead>Location</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTeam.map((item) => {
            const config = statusConfig[item.status] || statusConfig.not_checked_in;
            const StatusIcon = config.icon;

            return (
              <TableRow key={item.user.email} className={cn(
                item.status === 'not_checked_in' && 'bg-slate-50/50'
              )}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs">
                        {getInitials(item.user.full_name || item.user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">
                        {item.user.full_name || item.user.email}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn("text-xs flex items-center gap-1 w-fit", 
                    item.status === 'present' && item.record?.check_in_time && !item.record?.check_out_time 
                      ? statusConfig.checked_in.color 
                      : item.status === 'present' && item.record?.check_out_time 
                      ? statusConfig.checked_out.color 
                      : config.color
                  )}>
                    <StatusIcon className="w-3 h-3" />
                    {item.status === 'present' && item.record?.check_in_time && !item.record?.check_out_time 
                      ? 'Checked In' 
                      : item.status === 'present' && item.record?.check_out_time 
                      ? 'Checked Out' 
                      : config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  {item.record?.check_in_time ? (
                    <div className="font-medium text-sm">
                      {item.record.check_in_time.includes('T') || item.record.check_in_time.includes('Z')
                        ? format(new Date(item.record.check_in_time), 'HH:mm')
                        : item.record.check_in_time.split(':').slice(0, 2).join(':')}
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.record?.check_out_time ? (
                    <div className="font-medium text-sm">
                      {item.record.check_out_time.includes('T') || item.record.check_out_time.includes('Z')
                        ? format(new Date(item.record.check_out_time), 'HH:mm')
                        : item.record.check_out_time.split(':').slice(0, 2).join(':')}
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.record?.total_hours ? (
                    <span className="font-medium">{item.record.total_hours}h</span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {item.record?.is_late && (
                      <Badge variant="destructive" className="text-[10px]">Late</Badge>
                    )}
                    {item.record?.is_early_checkout && (
                      <Badge variant="warning" className="text-[10px]">Early</Badge>
                    )}
                    {!item.record?.is_late && !item.record?.is_early_checkout && item.status !== 'not_checked_in' && (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {item.record?.location ? (
                    <span className="text-xs text-slate-600">
                      ±{Math.round(item.record.location.accuracy || 0)}m
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {sortedTeam.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                No team members found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        </Table>
        </div>
        </div>
    </div>
  );
}