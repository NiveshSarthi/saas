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
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

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

      if (todayRecord && todayRecord.check_in_time && settings && !settings.allow_multiple_checkins) {
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
        check_in_time: now.toISOString(),
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
      if (!todayRecord || !todayRecord.check_in_time) {
        throw new Error('Please check in first');
      }

      const now = new Date();
      const checkInTime = new Date(todayRecord.check_in_time);
      const diffMs = now - checkInTime;
      const totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

      const isEarlyCheckout = settings && settings.early_checkout_threshold_hours 
        ? totalHours < settings.early_checkout_threshold_hours 
        : false;

      await base44.entities.Attendance.update(todayRecord.id, {
        check_out_time: now.toISOString(),
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
  const canCheckOut = todayRecord && (todayRecord.status === 'checked_in' && !todayRecord.check_out_time);
  const isWeekOff = settings && !isWorkDay(new Date(), settings);

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Today's Attendance</span>
              <p className="text-sm text-slate-500 mt-0.5">Track your presence</p>
            </div>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {isWeekOff && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-sm text-amber-800 font-medium">
              Today is a week-off/holiday. Attendance not required.
            </span>
          </div>
        )}

        {/* Current Date & Time - Hero Style */}
        <div className="text-center p-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>
          <div className="relative">
            <div className="text-sm text-white/80 mb-2 font-medium">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="text-5xl font-bold text-white mb-1 tracking-tight">
              {format(currentTime, 'hh:mm:ss')}
            </div>
            <div className="text-lg text-white/90 font-semibold">
              {format(currentTime, 'a')}
            </div>
          </div>
        </div>

        {/* Check-in/out Times - Modern Cards */}
        {todayRecord && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <LogIn className="w-4 h-4 text-green-600" />
                <div className="text-xs font-semibold text-green-700">Check In</div>
              </div>
              <div className="text-xl font-bold text-green-900">
                {todayRecord.check_in_time ? (
                  todayRecord.check_in_time.includes('T') || todayRecord.check_in_time.includes('Z')
                    ? format(new Date(todayRecord.check_in_time), 'hh:mm a')
                    : todayRecord.check_in_time
                ) : '-'}
              </div>
              {todayRecord.is_late && (
                <Badge variant="destructive" className="mt-2 text-[10px]">⚠️ Late</Badge>
              )}
            </div>
            <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <LogOut className="w-4 h-4 text-red-600" />
                <div className="text-xs font-semibold text-red-700">Check Out</div>
              </div>
              <div className="text-xl font-bold text-red-900">
                {todayRecord.check_out_time ? (
                  todayRecord.check_out_time.includes('T') || todayRecord.check_out_time.includes('Z')
                    ? format(new Date(todayRecord.check_out_time), 'hh:mm a')
                    : todayRecord.check_out_time
                ) : '-'}
              </div>
              {todayRecord.is_early_checkout && (
                <Badge variant="warning" className="mt-2 text-[10px]">⚡ Early</Badge>
              )}
            </div>
          </div>
        )}

        {/* Total Hours - Highlight Card */}
        {todayRecord?.total_hours && (
          <div className="p-6 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border-2 border-amber-200 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/30 rounded-full -mr-12 -mt-12"></div>
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <div className="text-sm font-semibold text-amber-700">Total Working Hours</div>
              </div>
              <div className="text-4xl font-bold text-amber-900">
                {todayRecord.total_hours}<span className="text-2xl">h</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons - Modern Style */}
        <div className="flex gap-4">
          <Button
            onClick={() => checkInMutation.mutate()}
            disabled={!canCheckIn || checkInMutation.isPending || gettingLocation}
            className={cn(
              "flex-1 h-14 rounded-2xl font-semibold shadow-lg transition-all",
              canCheckIn && "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 hover:shadow-xl hover:scale-105"
            )}
          >
            <LogIn className="w-5 h-5 mr-2" />
            {gettingLocation ? 'Getting Location...' : 'Check In'}
          </Button>

          <Button
            onClick={() => checkOutMutation.mutate()}
            disabled={!canCheckOut || checkOutMutation.isPending}
            className={cn(
              "flex-1 h-14 rounded-2xl font-semibold shadow-lg transition-all",
              canCheckOut && "bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 hover:shadow-xl hover:scale-105"
            )}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Check Out
          </Button>
        </div>

        {/* Location Info */}
        {todayRecord?.location && (
          <div className="flex items-center gap-2 text-xs text-slate-500 p-2 bg-white rounded border">
            <MapPin className="w-3 h-3" />
            Location tracked (±{Math.round(todayRecord.location.accuracy)}m)
          </div>
        )}
      </CardContent>
    </Card>
  );
}