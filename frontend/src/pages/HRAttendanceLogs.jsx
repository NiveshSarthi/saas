import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subDays, parseISO, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Clock,
  MapPin,
  Coffee,
  User,
  Download,
  Filter,
  Eye,
  TrendingUp,
  Users,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function HRAttendanceLogs() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

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

  // Get all users for filtering
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-hr-attendance'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user?.role_id === 'hr',
  });

  // Get attendance records for selected date
  const { data: attendanceRecords = [], isLoading } = useQuery({
    queryKey: ['attendance-logs', selectedDate, selectedUser],
    queryFn: async () => {
      let filter = { date: selectedDate };
      if (selectedUser !== 'all') {
        filter.user_email = selectedUser;
      }
      return await base44.entities.Attendance.filter(filter);
    },
    enabled: !!user?.role_id === 'hr',
  });

  // Get freelancer data for hours reporting
  const { data: freelancers = [] } = useQuery({
    queryKey: ['freelancers-for-attendance'],
    queryFn: () => base44.entities.User.filter({ role: 'freelancer' }),
    enabled: !!user?.role_id === 'hr',
  });

  // Calculate summary statistics
  const calculateStats = () => {
    const stats = {
      totalUsers: users.length,
      presentToday: attendanceRecords.filter(r => r.status === 'present').length,
      absentToday: users.length - attendanceRecords.filter(r => r.status === 'present').length,
      onBreak: attendanceRecords.filter(r => r.current_status === 'on_break').length,
      totalWorkingHours: 0,
      totalBreakMinutes: 0,
      checkedOut: attendanceRecords.filter(r => r.current_status === 'checked_out').length,
    };

    attendanceRecords.forEach(record => {
      if (record.actual_working_hours) {
        stats.totalWorkingHours += record.actual_working_hours;
      }
      if (record.total_break_duration) {
        stats.totalBreakMinutes += record.total_break_duration;
      }
    });

    return stats;
  };

  const stats = calculateStats();

  // Get freelancer hours summary
  const getFreelancerHours = () => {
    const freelancerHours = {};

    freelancers.forEach(freelancer => {
      const freelancerRecords = attendanceRecords.filter(r => r.user_email === freelancer.email);
      const totalHours = freelancerRecords.reduce((sum, r) => sum + (r.actual_working_hours || 0), 0);
      const totalBreakMinutes = freelancerRecords.reduce((sum, r) => sum + (r.total_break_duration || 0), 0);

      freelancerHours[freelancer.email] = {
        freelancer,
        hours: totalHours,
        breakMinutes: totalBreakMinutes,
        records: freelancerRecords.length
      };
    });

    return freelancerHours;
  };

  const freelancerHours = getFreelancerHours();

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusBadge = (record) => {
    if (!record.check_in) {
      return <Badge className="bg-gray-100 text-gray-700">Not Checked In</Badge>;
    }
    if (record.current_status === 'checked_out') {
      return <Badge className="bg-blue-100 text-blue-700">Checked Out</Badge>;
    }
    if (record.current_status === 'on_break') {
      return <Badge className="bg-orange-100 text-orange-700">On Break</Badge>;
    }
    if (record.current_status === 'checked_in') {
      return <Badge className="bg-green-100 text-green-700">Present</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-700">Unknown</Badge>;
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Please log in to access attendance logs.</p>
      </div>
    );
  }

  if (user.role_id !== 'hr') {
    return (
      <div className="p-6 lg:p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Restricted</h2>
        <p className="text-slate-500 mt-2">Only HR managers can access attendance logs.</p>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Attendance Logs</h1>
            <p className="text-slate-600 mt-1">Monitor employee check-in/check-out and working hours</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="date-select">Date</Label>
              <Input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.email} value={user.email}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present Today</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.presentToday}</div>
            <p className="text-xs text-muted-foreground">Out of {stats.totalUsers} employees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Break</CardTitle>
            <Coffee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.onBreak}</div>
            <p className="text-xs text-muted-foreground">Currently taking break</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalWorkingHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">Active working hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Break Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.totalBreakMinutes)}</div>
            <p className="text-xs text-muted-foreground">Total break duration</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance Records</TabsTrigger>
          <TabsTrigger value="freelancers">Freelancer Hours</TabsTrigger>
        </TabsList>

        {/* Attendance Records Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Attendance Records - {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-slate-500 mt-4">Loading attendance records...</p>
                </div>
              ) : attendanceRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Working Hours</TableHead>
                      <TableHead>Break Time</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceRecords.map((record) => {
                      const userData = users.find(u => u.email === record.user_email);
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div className="font-semibold">{record.user_name || userData?.full_name}</div>
                              <div className="text-sm text-slate-500">{record.user_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(record)}</TableCell>
                          <TableCell>
                            {record.check_in ? format(parseISO(record.check_in), 'HH:mm') : '-'}
                            {record.check_in_location && (
                              <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                GPS
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.check_out ? format(parseISO(record.check_out), 'HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            {record.actual_working_hours ? (
                              <span className="font-medium text-green-600">
                                {record.actual_working_hours.toFixed(1)}h
                              </span>
                            ) : record.current_status === 'checked_in' ? (
                              <span className="text-blue-600">In Progress</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {record.total_break_duration ? (
                              <span className="font-medium text-orange-600">
                                {formatDuration(record.total_break_duration)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {record.check_in_location ? (
                              <div className="text-xs">
                                <div className="text-green-600">✓ GPS Tracked</div>
                                <div className="text-slate-400 truncate max-w-24">
                                  {record.check_in_location.address}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400">Not tracked</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRecord(record);
                                setDetailsDialogOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No attendance records</h3>
                  <p className="text-slate-500">No employees have checked in on this date</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Freelancer Hours Tab */}
        <TabsContent value="freelancers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Freelancer Working Hours - {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</CardTitle>
              <p className="text-sm text-muted-foreground">Detailed breakdown of freelancer productivity</p>
            </CardHeader>
            <CardContent>
              {Object.keys(freelancerHours).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Freelancer</TableHead>
                      <TableHead>Total Hours</TableHead>
                      <TableHead>Break Time</TableHead>
                      <TableHead>Net Working</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Efficiency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(freelancerHours).map((data) => (
                      <TableRow key={data.freelancer.email}>
                        <TableCell className="font-medium">
                          <div>
                            <div className="font-semibold">{data.freelancer.full_name || data.freelancer.email}</div>
                            <div className="text-sm text-slate-500">{data.freelancer.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{data.hours.toFixed(1)}h</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-orange-600">
                            {formatDuration(data.breakMinutes)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            {(data.hours - data.breakMinutes / 60).toFixed(1)}h
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{data.records}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            (data.hours - data.breakMinutes / 60) >= 6
                              ? "bg-green-100 text-green-700"
                              : (data.hours - data.breakMinutes / 60) >= 4
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          )}>
                            {(data.hours - data.breakMinutes / 60) >= 6 ? 'High' :
                             (data.hours - data.breakMinutes / 60) >= 4 ? 'Medium' : 'Low'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No freelancer data</h3>
                  <p className="text-slate-500">No freelancers found or no attendance records for this date</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Attendance Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Attendance Details</DialogTitle>
            <DialogDescription>
              {selectedRecord && `${selectedRecord.user_name} - ${format(parseISO(selectedRecord.date), 'MMMM d, yyyy')}`}
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm text-gray-500">Check-in Time</span>
                  <div className="font-medium">
                    {selectedRecord.check_in ? format(parseISO(selectedRecord.check_in), 'HH:mm:ss') : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Check-out Time</span>
                  <div className="font-medium">
                    {selectedRecord.check_out ? format(parseISO(selectedRecord.check_out), 'HH:mm:ss') : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Working Hours</span>
                  <div className="font-medium text-green-600">
                    {selectedRecord.actual_working_hours ? `${selectedRecord.actual_working_hours.toFixed(1)}h` : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Total Break Time</span>
                  <div className="font-medium text-orange-600">
                    {selectedRecord.total_break_duration ? formatDuration(selectedRecord.total_break_duration) : '0m'}
                  </div>
                </div>
              </div>

              {/* Location Info */}
              {selectedRecord.check_in_location && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Check-in Location
                  </h4>
                  <div className="text-sm text-gray-600">
                    <div>Coordinates: {selectedRecord.check_in_location.latitude}, {selectedRecord.check_in_location.longitude}</div>
                    <div>Accuracy: ±{selectedRecord.check_in_location.accuracy}m</div>
                    <div>Address: {selectedRecord.check_in_location.address}</div>
                  </div>
                </div>
              )}

              {/* Break Details */}
              {selectedRecord.breaks && selectedRecord.breaks.length > 0 && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    Break History
                  </h4>
                  <div className="space-y-2">
                    {selectedRecord.breaks.map((breakItem, index) => (
                      <div key={index} className="flex items-center justify-between text-sm p-2 bg-orange-50 rounded">
                        <div>
                          <span className="font-medium">Break {index + 1}</span>
                          <div className="text-xs text-gray-500">
                            {format(parseISO(breakItem.start_time), 'HH:mm')} - {format(parseISO(breakItem.end_time), 'HH:mm')}
                          </div>
                        </div>
                        <Badge className="bg-orange-100 text-orange-700">
                          {breakItem.duration_minutes}m
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Status */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Current Status</h4>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedRecord)}
                  {selectedRecord.current_status === 'on_break' && selectedRecord.break_start_time && (
                    <span className="text-sm text-orange-600">
                      (Started at {format(parseISO(selectedRecord.break_start_time), 'HH:mm')})
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}