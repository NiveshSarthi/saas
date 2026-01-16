import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, MapPin, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CheckInOutWidget({ user, todayRecord, onUpdate }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gettingLocation, setGettingLocation] = useState(false);
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const result = await base44.entities.AttendanceSettings.list();
      return result[0] || null;
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let browser = "Unknown";
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    return `${browser} - ${navigator.platform}`;
  };

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Location services not available on this device'));
        return;
      }

      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGettingLocation(false);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          setGettingLocation(false);
          let errorMsg = 'Failed to get location. ';
          if (error.code === 1) {
            errorMsg += 'Please allow location access in browser settings.';
          } else if (error.code === 2) {
            errorMsg += 'Location unavailable.';
          } else if (error.code === 3) {
            errorMsg += 'Location request timed out.';
          }
          reject(new Error(errorMsg));
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  };

  const getIPAddress = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      return null;
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const isWorkDay = (date, settings) => {
    if (!settings) return true;

    const dayOfWeek = date.getDay();
    if (settings.week_off_days && settings.week_off_days.includes(dayOfWeek)) {
      return false;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    if (settings.holidays && settings.holidays.some(h => h.date === dateStr)) {
      return false;
    }

    return true;
  };

  const isLateCheckIn = (checkInTime, settings) => {
    if (!settings || !settings.work_start_time) return false;

    const [hours, minutes] = settings.work_start_time.split(':').map(Number);
    const workStartTime = new Date(checkInTime);
    workStartTime.setHours(hours, minutes, 0, 0);

    const lateThreshold = settings.late_threshold_minutes || 1;
    const lateTime = new Date(workStartTime.getTime() + lateThreshold * 60000);

    return checkInTime > lateTime;
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();

      if (settings && !isWorkDay(now, settings)) {
        throw new Error('Today is a week-off or holiday. Attendance not required.');
      }

      if (todayRecord && todayRecord.check_in && settings && !settings.allow_multiple_checkins) {
        throw new Error('You have already checked in today');
      }

      const today = format(now, 'yyyy-MM-dd');

      let location = null;
      let ip = null;

      try {
        location = await getLocation();
        if (!location || !location.latitude || !location.longitude) {
          throw new Error('Location is required for check-in. Please enable location access in your browser.');
        }
      } catch (error) {
        console.error('Location error:', error);
        toast.error(error.message);
        throw error;
      }

      ip = await getIPAddress();

      if (settings && settings.enable_geofencing) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          settings.office_latitude,
          settings.office_longitude
        );

        if (distance > settings.geofence_radius_meters) {
          throw new Error(`You are ${Math.round(distance)}m away. Must be within ${settings.geofence_radius_meters}m.`);
        }
      }

      const isLate = isLateCheckIn(now, settings);

      const attendanceData = {
        user_email: user.email,
        user_name: user.full_name || user.email,
        department_id: user.department_id,
        role_id: user.role_id,
        date: today,
        check_in: now.toISOString(),
        status: 'checked_in',
        source: 'web',
        ip_address: ip,
        location: location,
        device_info: getDeviceInfo(),
        is_late: isLate,
        marked_by: user.email
      };

      console.log('Check-in data being saved:', {
        ...attendanceData,
        location: JSON.stringify(location),
        has_location: !!location,
        has_lat: !!location?.latitude,
        has_lng: !!location?.longitude
      });

      if (todayRecord) {
        await base44.entities.Attendance.update(todayRecord.id, attendanceData);
      } else {
        await base44.entities.Attendance.create(attendanceData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      queryClient.invalidateQueries(['today-attendance']);
      toast.success('✅ Checked in successfully!');
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      // Allow checkout if record exists and status implies we are checked in, even if time is missing due to a glitch
      if (!todayRecord) {
        throw new Error('Please check in first');
      }

      const now = new Date();
      let totalHours = 0;

      // Only calculate duration if we have a valid check-in time
      if (todayRecord.check_in) {
        const checkInTime = new Date(todayRecord.check_in);
        if (!isNaN(checkInTime.getTime())) {
          const diffMs = now - checkInTime;
          totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
        }
      }

      const isEarlyCheckout = settings && settings.early_checkout_threshold_hours
        ? totalHours < settings.early_checkout_threshold_hours
        : false;

      await base44.entities.Attendance.update(todayRecord.id, {
        check_out: now.toISOString(),
        total_hours: totalHours,
        status: 'present',
        is_early_checkout: isEarlyCheckout
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      queryClient.invalidateQueries(['today-attendance']);
      toast.success('✅ Checked out successfully!');
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const getStatusBadge = () => {
    if (!todayRecord) {
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Not Checked In
        </Badge>
      );
    }

    if (todayRecord.status === 'checked_out' || (todayRecord.status === 'present' && todayRecord.check_out_time)) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Checked Out
        </Badge>
      );
    }

    return (
      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
        <Clock className="w-3 h-3 mr-1" />
        Checked In
      </Badge>
    );
  };

  const canCheckIn = !todayRecord || todayRecord.status === 'not_checked_in' || (settings && settings.allow_multiple_checkins);
  const canCheckOut = todayRecord && (todayRecord.status === 'checked_in' && !todayRecord.check_out);
  const isWeekOff = settings && !isWorkDay(new Date(), settings);

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-600 to-purple-700 text-white overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-10"></div>

      <div className="relative p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-8">

        {/* Left: Clock & Date */}
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
            <Clock className="w-10 h-10 text-white" />
          </div>
          <div>
            <div className="text-sm font-medium text-indigo-100">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="text-5xl font-bold tracking-tight">
              {format(currentTime, 'hh:mm:ss')}
              <span className="text-2xl font-medium ml-2 text-indigo-200">{format(currentTime, 'a')}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={cn("bg-white/20 hover:bg-white/30 text-white border-0", !todayRecord && "animate-pulse")}>
                {todayRecord ? (todayRecord.status === 'checked_in' ? 'Running' : 'Completed') : 'Not Started'}
              </Badge>
              {todayRecord?.location && (
                <span className="text-xs text-indigo-200 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Stats (Only if checked in) */}
        {todayRecord && (
          <div className="flex flex-wrap items-center gap-4 lg:gap-8 lg:border-l lg:border-white/10 lg:pl-8 w-full lg:w-auto justify-center lg:justify-start bg-indigo-800/20 lg:bg-transparent p-4 lg:p-0 rounded-xl lg:rounded-none">
            <div className="text-center lg:text-left">
              <p className="text-xs text-indigo-200 uppercase font-semibold">Check In</p>
              <p className="text-xl lg:text-2xl font-bold">
                {(() => {
                  if (!todayRecord.check_in) return '-';
                  const d = new Date(todayRecord.check_in);
                  return !isNaN(d.getTime()) ? format(d, 'hh:mm a') : 'Invalid Time';
                })()}
              </p>
            </div>
            <div className="w-px h-8 bg-white/20 lg:hidden"></div>
            <div className="text-center lg:text-left">
              <p className="text-xs text-indigo-200 uppercase font-semibold">Check Out</p>
              <p className="text-xl lg:text-2xl font-bold">
                {(() => {
                  if (!todayRecord.check_out) return '-';
                  const d = new Date(todayRecord.check_out);
                  return !isNaN(d.getTime()) ? format(d, 'hh:mm a') : '-';
                })()}
              </p>
            </div>
            <div className="w-px h-8 bg-white/20 lg:hidden"></div>
            <div className="text-center lg:text-left">
              <p className="text-xs text-indigo-200 uppercase font-semibold">Duration</p>
              <p className="text-xl lg:text-2xl font-bold">
                {(() => {
                  const hours = todayRecord.total_hours || 0;
                  const h = Math.floor(hours);
                  const m = Math.round((hours - h) * 60);
                  if (h === 0 && m === 0) return '0h';
                  return `${h}h ${m}m`;
                })()}
              </p>
            </div>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-4 w-full lg:w-auto">
          {isWeekOff && (
            <Badge variant="outline" className="text-amber-300 border-amber-300/50 bg-amber-900/20 mr-2">
              Holiday
            </Badge>
          )}

          <Button
            size="lg"
            onClick={() => checkInMutation.mutate()}
            disabled={!canCheckIn || checkInMutation.isPending || gettingLocation}
            className={cn(
              "flex-1 lg:flex-none h-14 px-8 rounded-xl font-bold text-lg shadow-lg transition-all",
              canCheckIn
                ? "bg-white text-indigo-600 hover:bg-indigo-50"
                : "bg-indigo-900/50 text-indigo-400 cursor-not-allowed"
            )}
          >
            <LogIn className="w-5 h-5 mr-3" />
            {gettingLocation ? 'Locating...' : 'Check In'}
          </Button>

          <Button
            size="lg"
            onClick={() => checkOutMutation.mutate()}
            disabled={!canCheckOut || checkOutMutation.isPending}
            className={cn(
              "flex-1 lg:flex-none h-14 px-8 rounded-xl font-bold text-lg shadow-lg transition-all",
              canCheckOut
                ? "bg-orange-500 hover:bg-orange-600 text-white border-2 border-transparent"
                : "bg-indigo-900/50 text-indigo-400 border-2 border-transparent cursor-not-allowed"
            )}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Check Out
          </Button>
        </div>

      </div>
    </Card>
  );
}