import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const statusOptions = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'leave', label: 'Leave' },
  { value: 'work_from_home', label: 'Work From Home' },
  { value: 'sick_leave', label: 'Sick Leave' },
  { value: 'casual_leave', label: 'Casual Leave' },
  { value: 'weekoff', label: 'Week Off' },
  { value: 'holiday', label: 'Holiday' }
];

export default function MarkAttendanceDialog({ isOpen, onClose, selectedDate, currentUser, isAdmin, allUsers }) {
  const [formData, setFormData] = useState({
    user_email: currentUser?.email || '',
    date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '',
    status: 'present',
    check_in_time: '',
    check_out_time: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  // Fetch attendance settings for late calculation
  const { data: attendanceSettings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const result = await base44.entities.AttendanceSettings.list();
      return result[0] || null;
    },
  });

  useEffect(() => {
    if (isOpen && currentUser?.email) {
      setFormData({
        user_email: currentUser?.email,
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        status: 'present',
        check_in_time: '',
        check_out_time: '',
        notes: ''
      });
    }
  }, [isOpen, selectedDate, currentUser]);

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Location services not available'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let errorMsg = 'Failed to get location. ';
          if (error.code === 1) {
            errorMsg += 'Please allow location access.';
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

  const markAttendanceMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Mutation started with data:', data);
      
      // Fetch location, IP, and device info first
      let location = null;
      let ip = null;
      let deviceInfo = null;
      
      // Try to get location, but make it optional for admin users
      try {
        location = await getLocation();
        console.log('Location obtained:', location);
      } catch (error) {
        console.error('Location error:', error);
        // Admin can always proceed without location, non-admin users as well but with warning
        if (isAdmin) {
          console.log('Admin user - proceeding without location');
        } else {
          console.log('Regular user - proceeding without location');
          toast.warning('Attendance marked without location data');
        }
      }
      
      // Get IP address
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
      deviceInfo = `${browser} - ${navigator.platform}`;
      
      // Get user data from the allUsers prop (already fetched by parent)
      const userRecord = allUsers.find(u => u.email === data.user_email);
      
      // Convert time strings to ISO timestamps
      const attendanceData = { 
        ...data,
        user_name: userRecord?.full_name || data.user_email,
        department_id: userRecord?.department_id || null,
        role_id: userRecord?.role_id || null,
        location: location,
        ip_address: ip,
        device_info: deviceInfo,
        source: 'web'
      };
      
      if (data.check_in_time && data.check_in_time.includes(':')) {
        const [hours, minutes] = data.check_in_time.split(':');
        const checkInDate = new Date(data.date);
        checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        attendanceData.check_in_time = checkInDate.toISOString();
        
        // Calculate is_late based on attendance settings
        if (attendanceSettings) {
          const workStartTime = attendanceSettings.work_start_time || '09:00';
          const lateThresholdMinutes = attendanceSettings.late_threshold_minutes || 1;
          
          const [startHours, startMinutes] = workStartTime.split(':');
          const workStartDate = new Date(data.date);
          workStartDate.setHours(parseInt(startHours), parseInt(startMinutes), 0, 0);
          
          // Add late threshold to work start time
          const lateThresholdDate = new Date(workStartDate.getTime() + lateThresholdMinutes * 60 * 1000);
          
          // Check if check-in time is after the late threshold
          attendanceData.is_late = checkInDate > lateThresholdDate;
        } else {
          attendanceData.is_late = false;
        }
      }
      
      if (data.check_out_time && data.check_out_time.includes(':')) {
        const [hours, minutes] = data.check_out_time.split(':');
        const checkOutDate = new Date(data.date);
        checkOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        attendanceData.check_out_time = checkOutDate.toISOString();
      }

      // Calculate total hours if both times are provided
      if (attendanceData.check_in_time && attendanceData.check_out_time) {
        const checkIn = new Date(attendanceData.check_in_time);
        const checkOut = new Date(attendanceData.check_out_time);
        const diffMs = checkOut - checkIn;
        attendanceData.total_hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      console.log('Checking for existing attendance record...');
      const existing = await base44.entities.Attendance.filter({
        user_email: data.user_email,
        date: data.date
      });
      console.log('Existing records found:', existing.length);

      if (existing.length > 0) {
        console.log('Updating existing record:', existing[0].id);
        const result = await base44.entities.Attendance.update(existing[0].id, {
          ...attendanceData,
          marked_by: currentUser?.email
        });
        console.log('Update successful:', result);
        return result;
      } else {
        console.log('Creating new record with data:', attendanceData);
        const result = await base44.entities.Attendance.create({
          ...attendanceData,
          marked_by: currentUser?.email
        });
        console.log('Create successful:', result);
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['all-attendance-records'] });
      queryClient.invalidateQueries({ queryKey: ['today-all-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['custom-range-attendance'] });
      
      // Force refetch to ensure UI updates
      queryClient.refetchQueries({ queryKey: ['attendance'] });
      queryClient.refetchQueries({ queryKey: ['all-attendance-records'] });
      
      toast.success('Attendance marked successfully');
      onClose();
      setFormData({
        user_email: currentUser?.email || '',
        date: '',
        status: 'present',
        check_in_time: '',
        check_out_time: '',
        notes: ''
      });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error('Failed to mark attendance: ' + (error.message || 'Unknown error'));
    }
  });

  const handleSubmit = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('=== Form Submission Started ===');
    console.log('Current formData:', formData);
    console.log('Current user:', currentUser);
    console.log('Is admin:', isAdmin);
    
    // Auto-fill user email if not set (for HR/admin marking their own)
    const finalFormData = {
      ...formData,
      user_email: formData.user_email || currentUser?.email || ''
    };
    
    console.log('Final form data:', finalFormData);
    
    // Validate required fields
    if (!finalFormData.user_email || finalFormData.user_email.trim() === '') {
      toast.error('Please select a user');
      console.error('❌ Validation failed: No user selected');
      return;
    }
    
    if (!finalFormData.date || finalFormData.date.trim() === '') {
      toast.error('Please select a date');
      console.error('❌ Validation failed: No date selected');
      return;
    }
    
    console.log('✅ Validation passed, submitting attendance...');
    console.log('Mutation pending status before:', markAttendanceMutation.isPending);
    
    try {
      const result = await markAttendanceMutation.mutateAsync(finalFormData);
      console.log('✅ Mutation completed successfully:', result);
    } catch (err) {
      console.error('❌ Mutation error caught in handleSubmit:', err);
      toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isAdmin && (
            <div>
              <Label>User *</Label>
              <Select
                value={formData.user_email}
                onValueChange={(value) => setFormData({ ...formData, user_email: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers.map(user => (
                    <SelectItem key={user.email} value={user.email}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div>
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Check In</Label>
              <Input
                type="time"
                value={formData.check_in_time}
                onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Check Out</Label>
              <Input
                type="time"
                value={formData.check_out_time}
                onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add any notes..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={markAttendanceMutation.isPending}>
              {markAttendanceMutation.isPending ? 'Saving...' : 'Save Attendance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}