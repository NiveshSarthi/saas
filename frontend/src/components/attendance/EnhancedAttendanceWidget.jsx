import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  MapPin,
  Clock,
  Coffee,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const BREAK_DURATION_LIMIT = 60; // 60 minutes max break

export default function EnhancedAttendanceWidget() {
  const [user, setUser] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [breakTimeLeft, setBreakTimeLeft] = useState(BREAK_DURATION_LIMIT * 60); // in seconds
  const [showBreakAnimation, setShowBreakAnimation] = useState(false);
  const queryClient = useQueryClient();

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const today = format(new Date(), 'yyyy-MM-dd');

  // Get today's attendance record
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['today-attendance', user?.email, today],
    queryFn: async () => {
      if (!user?.email) return null;
      const records = await base44.entities.Attendance.filter({
        user_email: user.email,
        date: today
      });
      return records[0] || null;
    },
    enabled: !!user?.email,
    refetchInterval: 5000, // Refetch every 5 seconds to keep status updated
  });

  // Check-in mutation with geotagging
  const checkInMutation = useMutation({
    mutationFn: async () => {
      // Get current location
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            // Get location name (simplified - in production you'd use a geocoding service)
            const locationData = {
              latitude,
              longitude,
              accuracy,
              address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` // Placeholder
            };

            const attendanceData = {
              user_email: user.email,
              user_name: user.full_name,
              date: today,
              status: 'present',
              check_in: new Date(),
              check_in_location: locationData,
              current_status: 'checked_in',
              breaks: [],
              total_break_duration: 0
            };

            const result = await base44.entities.Attendance.create(attendanceData);
            resolve(result);
          },
          (error) => {
            console.error('Error getting location:', error);
            // Fallback to check-in without location
            const attendanceData = {
              user_email: user.email,
              user_name: user.full_name,
              date: today,
              status: 'present',
              check_in: new Date(),
              current_status: 'checked_in',
              breaks: [],
              total_break_duration: 0
            };
            resolve(base44.entities.Attendance.create(attendanceData));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      toast.success('Checked in successfully!');
    },
    onError: (error) => {
      toast.error('Check-in failed: ' + error.message);
    },
  });

  // Start break mutation
  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const updatedAttendance = {
        ...todayAttendance,
        current_status: 'on_break',
        break_start_time: new Date()
      };
      return await base44.entities.Attendance.update(todayAttendance.id, updatedAttendance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      setShowBreakAnimation(true);
      setBreakTimeLeft(BREAK_DURATION_LIMIT * 60);

      // Hide animation after 3 seconds
      setTimeout(() => setShowBreakAnimation(false), 3000);

      toast.success('Break started - enjoy your break!');
    },
  });

  // End break mutation
  const endBreakMutation = useMutation({
    mutationFn: async () => {
      const breakEndTime = new Date();
      const breakDuration = differenceInMinutes(breakEndTime, new Date(todayAttendance.break_start_time));

      const newBreak = {
        start_time: todayAttendance.break_start_time,
        end_time: breakEndTime,
        duration_minutes: breakDuration
      };

      const updatedBreaks = [...(todayAttendance.breaks || []), newBreak];
      const totalBreakDuration = updatedBreaks.reduce((sum, b) => sum + b.duration_minutes, 0);

      const updatedAttendance = {
        ...todayAttendance,
        breaks: updatedBreaks,
        total_break_duration: totalBreakDuration,
        current_status: 'checked_in',
        break_start_time: null
      };

      return await base44.entities.Attendance.update(todayAttendance.id, updatedAttendance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      toast.success('Break ended - welcome back!');
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const checkOutTime = new Date();
      const checkInTime = new Date(todayAttendance.check_in);
      const totalMinutes = differenceInMinutes(checkOutTime, checkInTime);
      const actualWorkingMinutes = totalMinutes - (todayAttendance.total_break_duration || 0);
      const actualWorkingHours = actualWorkingMinutes / 60;

      const updatedAttendance = {
        ...todayAttendance,
        check_out: checkOutTime,
        current_status: 'checked_out',
        actual_working_hours: actualWorkingHours
      };

      return await base44.entities.Attendance.update(todayAttendance.id, updatedAttendance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      toast.success('Checked out successfully! Have a great evening.');
    },
  });

  // Update break timer
  useEffect(() => {
    if (todayAttendance?.current_status === 'on_break' && todayAttendance.break_start_time) {
      const interval = setInterval(() => {
        const elapsed = differenceInSeconds(new Date(), new Date(todayAttendance.break_start_time));
        const remaining = Math.max(0, (BREAK_DURATION_LIMIT * 60) - elapsed);
        setBreakTimeLeft(remaining);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [todayAttendance]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      not_checked_in: { label: 'Not Checked In', color: 'bg-gray-100 text-gray-700' },
      checked_in: { label: 'Checked In', color: 'bg-green-100 text-green-700' },
      on_break: { label: 'On Break', color: 'bg-orange-100 text-orange-700' },
      checked_out: { label: 'Checked Out', color: 'bg-blue-100 text-blue-700' },
    };
    return statusConfig[status] || statusConfig.not_checked_in;
  };

  const calculateWorkingTime = () => {
    if (!todayAttendance?.check_in) return 0;

    const startTime = new Date(todayAttendance.check_in);
    const endTime = todayAttendance.check_out ? new Date(todayAttendance.check_out) : new Date();

    let totalMinutes = differenceInMinutes(endTime, startTime);
    const breakMinutes = todayAttendance.total_break_duration || 0;

    // If currently on break, add current break time to total breaks
    if (todayAttendance.current_status === 'on_break' && todayAttendance.break_start_time) {
      const currentBreakMinutes = differenceInMinutes(new Date(), new Date(todayAttendance.break_start_time));
      totalMinutes -= currentBreakMinutes;
    } else {
      totalMinutes -= breakMinutes;
    }

    return Math.max(0, totalMinutes);
  };

  if (!user) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Please log in to access attendance</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">Loading attendance...</p>
        </CardContent>
      </Card>
    );
  }

  const workingMinutes = calculateWorkingTime();
  const workingHours = (workingMinutes / 60).toFixed(1);

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Attendance
          </CardTitle>
          <div className="text-sm text-gray-500">
            {format(currentTime, 'EEEE, MMMM d, yyyy')}
          </div>
          <div className="text-lg font-mono text-blue-600">
            {format(currentTime, 'HH:mm:ss')}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge className={cn("text-sm px-3 py-1", getStatusBadge(todayAttendance?.current_status || 'not_checked_in').color)}>
              {getStatusBadge(todayAttendance?.current_status || 'not_checked_in').label}
            </Badge>
          </div>

          {/* Working Time Display */}
          {todayAttendance && (
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Today's Working Time</div>
              <div className="text-2xl font-bold text-green-600">
                {workingHours}h
              </div>
              <div className="text-xs text-gray-500">
                {Math.floor(workingMinutes / 60)}h {workingMinutes % 60}m
              </div>
            </div>
          )}

          {/* Break Timer */}
          {todayAttendance?.current_status === 'on_break' && (
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-600 mb-2">Break Time Remaining</div>
              <div className="text-3xl font-bold text-orange-600 font-mono">
                {formatTime(breakTimeLeft)}
              </div>
              <Progress
                value={(breakTimeLeft / (BREAK_DURATION_LIMIT * 60)) * 100}
                className="mt-2 h-2"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            {!todayAttendance && (
              <Button
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {checkInMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <MapPin className="w-5 h-5 mr-2" />
                )}
                Check In
              </Button>
            )}

            {todayAttendance?.current_status === 'checked_in' && (
              <Button
                onClick={() => startBreakMutation.mutate()}
                disabled={startBreakMutation.isPending}
                className="w-full bg-orange-600 hover:bg-orange-700"
                size="lg"
              >
                <Coffee className="w-5 h-5 mr-2" />
                Start Break
              </Button>
            )}

            {todayAttendance?.current_status === 'on_break' && (
              <Button
                onClick={() => endBreakMutation.mutate()}
                disabled={endBreakMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <Play className="w-5 h-5 mr-2" />
                End Break
              </Button>
            )}

            {todayAttendance?.current_status === 'checked_in' && (
              <Button
                onClick={() => checkOutMutation.mutate()}
                disabled={checkOutMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700"
                size="lg"
              >
                <Square className="w-5 h-5 mr-2" />
                Check Out
              </Button>
            )}

            {todayAttendance?.current_status === 'checked_out' && (
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-green-700">Day completed successfully!</p>
                <p className="text-xs text-gray-500 mt-1">
                  Checked out at {todayAttendance.check_out ? format(new Date(todayAttendance.check_out), 'HH:mm') : 'N/A'}
                </p>
              </div>
            )}
          </div>

          {/* Today's Summary */}
          {todayAttendance && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-600 mb-2">Today's Summary</div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Check-in:</span>
                  <div className="font-medium">
                    {todayAttendance.check_in ? format(new Date(todayAttendance.check_in), 'HH:mm') : 'N/A'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Breaks:</span>
                  <div className="font-medium">
                    {todayAttendance.breaks?.length || 0} ({todayAttendance.total_break_duration || 0}m)
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Break Animation Overlay */}
      {showBreakAnimation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm mx-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coffee className="w-10 h-10 text-orange-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Break Time Started! ☕</h3>
            <p className="text-gray-600 mb-4">Your today's timing is paused.</p>
            <p className="text-sm text-orange-600 font-medium">Enjoy your break and come back fast!</p>
            <div className="mt-4 text-xs text-gray-400">
              Maximum break time: {BREAK_DURATION_LIMIT} minutes
            </div>
          </div>
        </div>
      )}
    </>
  );
}