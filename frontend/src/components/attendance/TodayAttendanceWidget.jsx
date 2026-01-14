import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, MapPin, Pause, Play, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function TodayAttendanceWidget({ user }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState(null);
  const [workingTime, setWorkingTime] = useState(0); // in seconds
  const [breakTime, setBreakTime] = useState(0); // in seconds
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const workingTimerRef = useRef(null);
  const breakTimerRef = useRef(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const requestLocation = async () => {
    console.log('Requesting location...');
    
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    // Check permission state first
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
      console.log('Permission state:', permissionStatus.state);
      
      if (permissionStatus.state === 'denied') {
        toast.error('Location is blocked in browser settings', {
          duration: 7000,
          description: 'Click the lock/info icon in address bar → Site settings → Location → Allow'
        });
        return;
      }
    } catch (e) {
      console.log('Permission API not available:', e);
    }
    
    toast.info('Requesting location access...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location received:', position.coords);
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        toast.success('Location enabled successfully');
      },
      (error) => {
        console.error('Location error:', error);
        if (error.code === 1) {
          toast.error('Location permission denied', {
            duration: 7000,
            description: 'To enable: Click lock icon in address bar → Site settings → Location → Allow, then refresh page'
          });
        } else if (error.code === 2) {
          toast.error('Location unavailable. Please check your device settings.');
        } else if (error.code === 3) {
          toast.error('Location request timed out. Please try again.');
        } else {
          toast.error('Failed to get location. Please try again.');
        }
      },
      { 
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: attendance } = useQuery({
    queryKey: ['today-attendance', user?.email, today],
    queryFn: () => base44.entities.Attendance.filter({
      user_email: user?.email,
      date: today
    }),
    enabled: !!user?.email,
    refetchInterval: 30000
  });

  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: () => base44.entities.AttendanceSettings.list(),
    select: (data) => data?.[0]
  });

  const todayRecord = attendance?.[0];
  const hasCheckedIn = !!todayRecord?.check_in_time;
  const hasCheckedOut = !!todayRecord?.check_out_time;

  // Timer effects
  useEffect(() => {
    if (hasCheckedIn && !hasCheckedOut && !isOnBreak) {
      // Start working timer
      workingTimerRef.current = setInterval(() => {
        setWorkingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (workingTimerRef.current) {
        clearInterval(workingTimerRef.current);
        workingTimerRef.current = null;
      }
    }

    return () => {
      if (workingTimerRef.current) {
        clearInterval(workingTimerRef.current);
      }
    };
  }, [hasCheckedIn, hasCheckedOut, isOnBreak]);

  useEffect(() => {
    if (isOnBreak) {
      // Start break timer
      breakTimerRef.current = setInterval(() => {
        setBreakTime(prev => prev + 1);
      }, 1000);
    } else {
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }
    }

    return () => {
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
      }
    };
  }, [isOnBreak]);

  // Load existing timer data from attendance record
  useEffect(() => {
    if (todayRecord) {
      if (todayRecord.total_working_seconds) {
        setWorkingTime(todayRecord.total_working_seconds);
      }
      if (todayRecord.total_break_duration) {
        setBreakTime(todayRecord.total_break_duration * 60); // convert minutes to seconds
      }
      if (todayRecord.current_status === 'on_break') {
        setIsOnBreak(true);
      }
    }
  }, [todayRecord]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!location || !location.latitude || !location.longitude) {
        throw new Error('Location is required for check-in. Please enable location access in your browser.');
      }

      const now = new Date();
      
      // Get IP address
      let ip = null;
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const ipData = await response.json();
        ip = ipData.ip;
      } catch (e) {
        console.error('Failed to get IP:', e);
      }

      // Get device info
      const ua = navigator.userAgent;
      let browser = "Unknown";
      if (ua.includes("Firefox")) browser = "Firefox";
      else if (ua.includes("Chrome")) browser = "Chrome";
      else if (ua.includes("Safari")) browser = "Safari";
      else if (ua.includes("Edge")) browser = "Edge";
      const deviceInfo = `${browser} - ${navigator.platform}`;

      // Calculate is_late
      let isLate = false;
      if (settings && settings.work_start_time) {
        const [hours, minutes] = settings.work_start_time.split(':').map(Number);
        const workStartTime = new Date(now);
        workStartTime.setHours(hours, minutes, 0, 0);
        
        const lateThreshold = settings.late_threshold_minutes || 1;
        const lateTime = new Date(workStartTime.getTime() + lateThreshold * 60000);
        
        isLate = now > lateTime;
      }

      const attendanceData = {
        user_email: user.email,
        user_name: user.full_name || user.email,
        department_id: user.department_id,
        role_id: user.role_id,
        date: today,
        check_in_time: now.toISOString(),
        status: 'checked_in',
        source: 'web',
        ip_address: ip,
        location: location,
        device_info: deviceInfo,
        is_late: isLate,
        marked_by: user.email
      };
      
      if (todayRecord) {
        return await base44.entities.Attendance.update(todayRecord.id, attendanceData);
      } else {
        return await base44.entities.Attendance.create(attendanceData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['today-attendance']);
      toast.success('Checked in successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to check in');
    }
  });

  const breakMutation = useMutation({
    mutationFn: async (onBreak) => {
      if (!todayRecord) return;

      const currentTime = new Date();
      const totalWorkingSeconds = workingTime;
      const totalBreakMinutes = Math.round(breakTime / 60);

      return await base44.entities.Attendance.update(todayRecord.id, {
        current_status: onBreak ? 'on_break' : 'checked_in',
        total_working_seconds: totalWorkingSeconds,
        total_break_duration: totalBreakMinutes,
        last_break_start: onBreak ? currentTime.toISOString() : null
      });
    },
    onSuccess: (data, onBreak) => {
      setIsOnBreak(onBreak);
      queryClient.invalidateQueries(['today-attendance']);
    },
    onError: (error) => {
      toast.error('Failed to update break status');
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!todayRecord || !todayRecord.check_in_time) {
        throw new Error('Please check in first');
      }

      const now = new Date();
      const checkInTime = new Date(todayRecord.check_in_time);
      const diffMs = now.getTime() - checkInTime.getTime();
      const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      const totalWorkingSeconds = workingTime;
      const totalBreakMinutes = Math.round(breakTime / 60);

      const isEarlyCheckout = settings && settings.early_checkout_threshold_hours
        ? totalHours < settings.early_checkout_threshold_hours
        : false;

      return await base44.entities.Attendance.update(todayRecord.id, {
        check_out_time: now.toISOString(),
        total_hours: totalHours,
        total_working_seconds: totalWorkingSeconds,
        total_break_duration: totalBreakMinutes,
        status: 'present',
        current_status: 'checked_out',
        is_early_checkout: isEarlyCheckout
      });
    },
    onSuccess: () => {
      // Stop all timers
      if (workingTimerRef.current) {
        clearInterval(workingTimerRef.current);
        workingTimerRef.current = null;
      }
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }
      queryClient.invalidateQueries(['today-attendance']);
      toast.success('Checked out successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to check out');
    }
  });

  const isLate = () => {
    if (!hasCheckedIn || !settings?.check_in_time) return false;
    const [settingHours, settingMinutes] = settings.check_in_time.split(':');
    const [checkInHours, checkInMinutes] = todayRecord.check_in_time.split(':');
    const settingTime = parseInt(settingHours) * 60 + parseInt(settingMinutes);
    const checkInTimeMinutes = parseInt(checkInHours) * 60 + parseInt(checkInMinutes);
    return checkInTimeMinutes > settingTime;
  };

  const isEarly = () => {
    if (!hasCheckedOut || !settings?.check_out_time) return false;
    const [settingHours, settingMinutes] = settings.check_out_time.split(':');
    const [checkOutHours, checkOutMinutes] = todayRecord.check_out_time.split(':');
    const settingTime = parseInt(settingHours) * 60 + parseInt(settingMinutes);
    const checkOutTimeMinutes = parseInt(checkOutHours) * 60 + parseInt(checkOutMinutes);
    return checkOutTimeMinutes < settingTime;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';

    // Handle ISO timestamp format
    if (timeStr.includes('T') || timeStr.includes('Z')) {
      return format(new Date(timeStr), 'hh:mm a');
    }

    // Handle HH:mm:ss format
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleBreak = () => {
    breakMutation.mutate(!isOnBreak);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="w-5 h-5 text-indigo-600" />
            Today's Attendance
          </CardTitle>
          {hasCheckedOut && (
            <Badge className="bg-green-100 text-green-700">
              Checked Out
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-500">Track your presence</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Time Display */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white text-center">
          <div className="text-sm opacity-90 mb-2">
            {format(currentTime, 'EEEE, MMMM dd, yyyy')}
          </div>
          <div className="text-5xl font-bold tracking-tight mb-1">
            {format(currentTime, 'hh:mm:ss')}
          </div>
          <div className="text-lg opacity-90">
            {format(currentTime, 'a')}
          </div>
        </div>

        {/* Working Timer Display */}
        {hasCheckedIn && !hasCheckedOut && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4" />
                Working Time
              </div>
              {isOnBreak && (
                <Badge className="bg-orange-100 text-orange-700 flex items-center gap-1">
                  <Coffee className="w-3 h-3" />
                  On Break
                </Badge>
              )}
            </div>
            <div className="text-3xl font-bold text-slate-900 font-mono">
              {formatDuration(workingTime)}
            </div>
            {breakTime > 0 && (
              <div className="text-sm text-slate-500 mt-1">
                Break Time: {formatDuration(breakTime)}
              </div>
            )}
          </div>
        )}

        {/* Check In/Out Times */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-xl p-4 ${hasCheckedIn ? 'bg-green-50 border-2 border-green-200' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
              <LogIn className="w-4 h-4" />
              Check In
            </div>
            {hasCheckedIn ? (
              <>
                <div className="text-2xl font-bold text-slate-900">
                  {formatTime(todayRecord.check_in_time)}
                </div>
                {isLate() && (
                  <Badge variant="secondary" className="mt-2 bg-red-100 text-red-700">
                    Late
                  </Badge>
                )}
              </>
            ) : (
              <div className="text-slate-400">--:-- --</div>
            )}
          </div>

          <div className={`rounded-xl p-4 ${hasCheckedOut ? 'bg-red-50 border-2 border-red-200' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
              <LogOut className="w-4 h-4" />
              Check Out
            </div>
            {hasCheckedOut ? (
              <>
                <div className="text-2xl font-bold text-slate-900">
                  {formatTime(todayRecord.check_out_time)}
                </div>
                {isEarly() && (
                  <Badge variant="secondary" className="mt-2 bg-orange-100 text-orange-700">
                    Early
                  </Badge>
                )}
              </>
            ) : (
              <div className="text-slate-400">--:-- --</div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {!hasCheckedIn ? (
            <Button
              onClick={() => checkInMutation.mutate()}
              disabled={!location || checkInMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="lg"
              title={!location ? 'Location permission required' : ''}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Check In
            </Button>
          ) : hasCheckedIn && !hasCheckedOut ? (
            <Button
              onClick={toggleBreak}
              disabled={breakMutation.isPending}
              className={isOnBreak ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}
              size="lg"
            >
              {isOnBreak ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Resume Work
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Take Break
                </>
              )}
            </Button>
          ) : null}

          <Button
            onClick={() => checkOutMutation.mutate()}
            disabled={!location || !hasCheckedIn || hasCheckedOut || checkOutMutation.isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
            size="lg"
            title={!location ? 'Location permission required' : ''}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Check Out
          </Button>
        </div>

        {/* Location Info */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {location ? (
                <>
                  <MapPin className="w-3 h-3 text-green-600" />
                  <span className="text-green-600 font-medium">✓ Location enabled</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3 h-3 text-red-600" />
                  <span className="text-red-600 font-medium">⚠ Location permission required</span>
                </>
              )}
            </div>
            {!location && (
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  requestLocation();
                }}
                size="sm"
                variant="outline"
                className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                type="button"
              >
                Enable Location
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}