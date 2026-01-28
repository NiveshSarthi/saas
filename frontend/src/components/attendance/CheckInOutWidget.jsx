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
import SalesVisitDialog from './SalesVisitDialog';
import ActiveVisitCard from './ActiveVisitCard';

export default function CheckInOutWidget({ user, todayRecord, onUpdate }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [gettingLocation, setGettingLocation] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const queryClient = useQueryClient();

  // Fetch departments to identify Sales users
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user
  });

  const isSalesUser = React.useMemo(() => {
    if (!user) return false;

    // 1. Check Department logic
    if (departments.length > 0) {
      const dept = departments.find(d => d.id === user.department_id);
      const deptName = dept?.name?.toLowerCase();
      if (deptName?.includes('sales') || deptName?.includes('marketing') || deptName?.includes('presales')) return true;
    }

    // 2. Check Role/Department ID hardcodes
    const deptId = user.department_id?.toLowerCase() || '';
    if (deptId.includes('sales') || deptId.includes('marketing')) return true;

    // 3. Check Job Title
    const title = user.job_title?.toLowerCase() || '';
    return title.includes('sales') || title.includes('business development') || title.includes('executive') || title.includes('manager');
  }, [user, departments]);

  // Fetch active site visit
  const { data: activeVisit } = useQuery({
    queryKey: ['active-visit', user?.email],
    queryFn: async () => {
      const visits = await base44.entities.SiteVisit.filter({
        user_email: user?.email,
        status: 'ongoing'
      });
      return visits && visits.length > 0 ? visits[0] : null;
    },
    enabled: !!user?.email
  });

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const res = await base44.entities.AttendanceSettings.list();
      return res[0] || null;
    }
  });

  // Fetch work days (holidays)
  const { data: workDays = [] } = useQuery({
    queryKey: ['work-days-widget'],
    queryFn: () => base44.entities.WorkDay.list()
  });

  // Helpers
  const getIPAddress = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data.ip;
    } catch (e) {
      console.warn('CheckIn Process: IP Fetch failed/timed out', e);
      return '0.0.0.0';
    }
  };

  const getDeviceInfo = () => {
    return navigator.userAgent;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371e3; // metres
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

  const isWorkDay = (date, settings, workDaysList = []) => {
    const day = date.getDay();
    const dateStr = format(date, 'yyyy-MM-dd');
    const isHoliday = workDaysList.find(wd => wd.date === dateStr && wd.is_holiday);
    if (isHoliday) return false;
    return !(settings?.week_off_days || []).includes(day);
  };

  const isLateCheckIn = (date, settings) => {
    if (!settings?.work_start_time) return false;
    const [hours, minutes] = settings.work_start_time.split(':').map(Number);
    const workStart = new Date(date);
    workStart.setHours(hours, minutes, 0, 0);
    const buffer = settings.late_threshold_minutes || 15;
    workStart.setMinutes(workStart.getMinutes() + buffer);
    return date > workStart;
  };

  // State calculations
  const isWeekOff = React.useMemo(() => {
    if (!settings) return false;
    return !isWorkDay(new Date(), settings, workDays);
  }, [settings, workDays]);

  const canCheckIn = React.useMemo(() => {
    // 1. If no record for today yet -> Allow
    if (!todayRecord) return true;

    // 2. Safety check for active session (already checked in but not out)
    if (todayRecord.status === 'checked_in' && !todayRecord.check_out) return false;

    // 3. If we have ANY record (completed, present, checked_out, etc.)
    // We can only check in again if multiple checkins are allowed
    return settings?.allow_multiple_checkins === true;
  }, [settings, todayRecord]);

  const canCheckOut = React.useMemo(() => {
    return todayRecord && todayRecord.status === 'checked_in' && !todayRecord.check_out;
  }, [todayRecord]);

  // Update time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getLocation = (useHighAccuracy = true) => {
    return new Promise((resolve) => {
      console.log('CheckIn Process: Starting getLocation', { useHighAccuracy });
      toast.info('Requesting location access...');

      if (!navigator.geolocation) {
        console.error('CheckIn Process: Geolocation not supported');
        toast.error('Location services not supported by your browser');
        resolve(null);
        return;
      }

      const options = {
        timeout: useHighAccuracy ? 10000 : 5000, // Increased timeout slightly
        enableHighAccuracy: useHighAccuracy,
        maximumAge: 0 // Force fresh location
      };

      const successCallback = (position) => {
        console.log('CheckIn Process: Location success', position);
        setGettingLocation(false);
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      };

      const errorCallback = async (error) => {
        console.warn('CheckIn Process: Location error', error.code, error.message);

        if (error.code === 1) { // Permission Denied
          setGettingLocation(false);
          setLocationPermissionDenied(true);
          toast.error('Location access denied. Please enable it in browser settings.');
          resolve(null);
        } else if (useHighAccuracy) {
          // Fallback to standard accuracy
          console.log('CheckIn Process: High accuracy failed, retrying with low accuracy...');
          toast.loading('High accuracy failed, trying standard location...');
          const standardLocation = await getLocation(false);
          resolve(standardLocation);
        } else {
          setGettingLocation(false);
          toast.error(`Location failed: ${error.message}`);
          resolve(null);
        }
      };

      // Safety timeout in case the browser's geolocation API hangs (happens on some Windows devices)
      const safetyTimeout = setTimeout(() => {
        console.error('CheckIn Process: Safety timeout triggered');
        if (useHighAccuracy) {
          // Try fallback
          // We can't easily cancel the pending geolocation request, but we can resolve this promise
          // The errorCallback might still fire later but we've already resolved.
          // Ideally we just treat it as a fail or fallback here.
          console.log('CheckIn Process: Triggering fallback due to timeout');
          // We'll let the fallback logic handle it by simulating an error or just recursively calling
          getLocation(false).then(resolve);
        } else {
          setGettingLocation(false);
          toast.error('Location request timed out. Please check your GPS.');
          resolve(null);
        }
      }, 12000); // 12 seconds total timeout (slightly longer than options.timeout)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(safetyTimeout);
          successCallback(pos);
        },
        (err) => {
          clearTimeout(safetyTimeout);
          errorCallback(err);
        },
        options
      );
    });
  };

  const checkInMutation = useMutation({
    mutationFn: async () => {
      console.log('CheckIn Process: Mutation Started');
      toast.info('Starting Check-in Process...');
      const now = new Date();

      try {
        console.log('CheckIn Process: Settings & Record', { settings, todayRecord, isWorkDay: settings ? isWorkDay(now, settings) : 'N/A' });

        if (settings && !isWorkDay(now, settings)) {
          throw new Error('Today is a week-off or holiday. Attendance not required.');
        }

        if (todayRecord && todayRecord.check_in && settings && !settings.allow_multiple_checkins) {
          throw new Error('You have already checked in today');
        }

        const today = format(now, 'yyyy-MM-dd');

        let location = null;
        let ip = null;

        // STRICT LOCATION ENFORCEMENT
        location = await getLocation();

        // If geofencing enabled and no location -> BLOCK
        if (settings?.enable_geofencing && !location) {
          throw new Error("Location access is MANDATORY for attendance geofencing. Please ensure GPS is active.");
        }

        console.log('CheckIn Process: Fetching IP...');
        toast.info('Fetching IP Address...');
        ip = await getIPAddress();
        console.log('CheckIn Process: IP fetched', ip);

        if (settings && settings.enable_geofencing && location) {
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

        console.log('CheckIn Process: Saving to Database...', attendanceData);
        toast.info('Saving attendance...');

        let dbResponse;
        if (todayRecord) {
          dbResponse = await base44.entities.Attendance.update(todayRecord.id, attendanceData);
        } else {
          dbResponse = await base44.entities.Attendance.create(attendanceData);
        }
        console.log('CheckIn Process: Database Save Success', dbResponse);
        toast.success('Attendance Saved!');
      } catch (err) {
        console.error('CheckIn Process: Mutation Error Detected', err);
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today', user?.email] });
      toast.success('Successfully checked in');
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Check in failed');
    }
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const ip = await getIPAddress();
      let location = await getLocation();

      if (settings?.enable_geofencing && !location) {
        throw new Error("Location access is MANDATORY for checkout geofencing. Please ensure GPS is active.");
      }

      const checkInTime = new Date(todayRecord.check_in);
      const diffMs = now.getTime() - checkInTime.getTime();
      const hours = diffMs / (1000 * 60 * 60);

      const updateData = {
        check_out: now.toISOString(),
        status: 'completed',
        total_hours: hours,
        checkout_location: location,
        checkout_ip: ip
      };

      await base44.entities.Attendance.update(todayRecord.id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-attendance', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['attendance-today', user?.email] });
      toast.success('Checked out successfully');
      if (onUpdate) onUpdate();
    },
    onError: (error) => {
      toast.error(error.message || 'Check out failed');
    }
  });

  const handleStartVisitClick = async () => {
    try {
      const loc = await getLocation();

      if (!loc && settings?.enable_geofencing) {
        toast.error("Location is required to start a site visit.");
        return;
      }

      setCurrentLocation(loc);
      setVisitDialogOpen(true);
    } catch (e) {
      toast.error("Location access needed for Gate Pass");
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Visit Card */}
      {activeVisit && <ActiveVisitCard visit={activeVisit} currentLocation={currentLocation} />}

      <Card className="border-0 shadow-lg bg-gradient-to-r from-indigo-600 to-purple-700 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-10"></div>

        <div className="relative p-6 flex flex-col items-center justify-between gap-6 md:gap-8">

          {/* Top: Clock & Date */}
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full justify-center sm:justify-start">
            <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl flex-shrink-0">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <div className="text-center sm:text-left">
              <div className="text-sm font-medium text-indigo-100">
                {format(currentTime, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-4xl sm:text-5xl font-bold tracking-tight whitespace-nowrap">
                {format(currentTime, 'hh:mm:ss')}
                <span className="text-xl sm:text-2xl font-medium ml-2 text-indigo-200">{format(currentTime, 'a')}</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
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

          {/* Location Error Alert */}
          {locationPermissionDenied && (
            <div className="w-full bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-6 h-6 text-red-200" />
              <div className="flex-1">
                <p className="font-bold text-red-100">Location Access Required</p>
                <p className="text-sm text-red-200/80">
                  Please enable location services in your browser settings to mark attendance.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => getLocation()}
                className="bg-white text-red-600 hover:bg-red-50"
              >
                Retry Location
              </Button>
            </div>
          )}

          {/* Middle: Stats (Only if checked in) */}
          {todayRecord && (
            <div className="flex flex-wrap items-center justify-around gap-4 w-full bg-indigo-800/20 p-4 rounded-xl border border-white/5">
              <div className="text-center flex-1 min-w-[80px]">
                <p className="text-xs text-indigo-200 uppercase font-semibold mb-1">Check In</p>
                <p className="text-lg sm:text-xl font-bold">
                  {(() => {
                    if (!todayRecord.check_in) return '-';
                    const d = new Date(todayRecord.check_in);
                    return !isNaN(d.getTime()) ? format(d, 'hh:mm a') : 'Invalid Time';
                  })()}
                </p>
              </div>
              <div className="w-px h-8 bg-white/20"></div>
              <div className="text-center flex-1 min-w-[80px]">
                <p className="text-xs text-indigo-200 uppercase font-semibold mb-1">Check Out</p>
                <p className="text-lg sm:text-xl font-bold">
                  {(() => {
                    if (!todayRecord.check_out) return '-';
                    const d = new Date(todayRecord.check_out);
                    return !isNaN(d.getTime()) ? format(d, 'hh:mm a') : '-';
                  })()}
                </p>
              </div>
              <div className="w-px h-8 bg-white/20"></div>
              <div className="text-center flex-1 min-w-[80px]">
                <p className="text-xs text-indigo-200 uppercase font-semibold mb-1">Duration</p>
                <p className="text-lg sm:text-xl font-bold">
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

          {/* Bottom: Actions */}
          <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full">
            {user?.role_id === 'admin' && ( // Debug helpers only for admin if needed, hidden for now
              null
            )}

            {isWeekOff && (
              <div className="sm:hidden w-full mb-2">
                <Badge variant="outline" className="w-full justify-center text-amber-300 border-amber-300/50 bg-amber-900/20 py-1">
                  Holiday / Week Off
                </Badge>
              </div>
            )}

            {!locationPermissionDenied && (
              <Button
                size="lg"
                onClick={() => {
                  console.log('CheckIn Process: Button Clicked');
                  toast.info("Button Clicked - Initiating...");
                  checkInMutation.mutate();
                }}
                disabled={!canCheckIn || checkInMutation.isPending || gettingLocation}
                className={cn(
                  "flex-1 h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all",
                  canCheckIn
                    ? "bg-white text-indigo-600 hover:bg-indigo-50"
                    : "bg-indigo-900/50 text-indigo-400 cursor-not-allowed"
                )}
              >
                <LogIn className="w-5 h-5 mr-2 sm:mr-3" />
                {gettingLocation ? 'Locating...' : (todayRecord?.check_out && !canCheckIn ? 'Completed' : 'Check In')}
              </Button>
            )}

            {locationPermissionDenied && (
              <Button
                size="lg"
                onClick={() => getLocation()} // Retry
                className="flex-1 h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all bg-red-600 hover:bg-red-700 text-white animate-pulse"
              >
                <MapPin className="w-5 h-5 mr-2 sm:mr-3" />
                Enable Location
              </Button>
            )}

            {/* Site Visit Button (Only if Checked In/Present AND Sales AND No Active Visit) */}
            {todayRecord && !todayRecord.check_out && isSalesUser && !activeVisit && (
              <Button
                size="lg"
                onClick={handleStartVisitClick}
                disabled={locationPermissionDenied} // Disable if location denied
                className={cn(
                  "flex-1 h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all text-white",
                  locationPermissionDenied
                    ? "bg-slate-600 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                <MapPin className="w-5 h-5 mr-2 sm:mr-3" />
                Start Visit
              </Button>
            )}

            <Button
              size="lg"
              onClick={() => checkOutMutation.mutate()}
              disabled={!canCheckOut || checkOutMutation.isPending}
              className={cn(
                "flex-1 h-12 sm:h-14 rounded-xl font-bold text-base sm:text-lg shadow-lg transition-all",
                canCheckOut
                  ? "bg-orange-500 hover:bg-orange-600 text-white border-2 border-transparent"
                  : "bg-indigo-900/50 text-indigo-400 border-2 border-transparent cursor-not-allowed"
              )}
            >
              <LogOut className="w-5 h-5 mr-2 sm:mr-3" />
              Check Out
            </Button>
          </div>

        </div>
      </Card>

      <SalesVisitDialog
        open={visitDialogOpen}
        onOpenChange={setVisitDialogOpen}
        user={user}
        currentLocation={currentLocation}
      />
    </div>
  );
}