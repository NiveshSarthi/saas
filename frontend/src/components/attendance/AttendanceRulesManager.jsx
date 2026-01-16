import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Save, Plus, Trash2, MapPin, Clock, Calendar as CalendarIcon, ShieldCheck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';

export default function AttendanceRulesManager() {
  const queryClient = useQueryClient();
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  // Fetch Settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const result = await base44.entities.AttendanceSettings.list();
      return result[0] || null;
    },
  });

  // Fetch WorkDays (Holidays)
  const { data: holidays = [], isLoading: isLoadingHolidays } = useQuery({
    queryKey: ['holidays-list'],
    queryFn: async () => {
      const allWorkDays = await base44.entities.WorkDay.list();
      return allWorkDays.filter(wd => wd.is_holiday).sort((a, b) => new Date(a.date) - new Date(b.date));
    }
  });

  const [formData, setFormData] = useState({
    work_start_time: '09:00',
    late_threshold_minutes: 15,
    minimum_work_hours: 8,
    early_checkout_threshold_hours: 8,
    allow_multiple_checkins: false,
    enable_geofencing: false,
    office_latitude: null,
    office_longitude: null,
    geofence_radius_meters: 500,
    week_off_days: [0], // Sunday default
    require_checkout: true,
    auto_checkout_time: '23:59',
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        work_start_time: settings.work_start_time || '09:00',
        late_threshold_minutes: settings.late_threshold_minutes || 15,
        minimum_work_hours: settings.minimum_work_hours || 8,
        early_checkout_threshold_hours: settings.early_checkout_threshold_hours || 8,
        allow_multiple_checkins: settings.allow_multiple_checkins || false,
        enable_geofencing: settings.enable_geofencing || false,
        office_latitude: settings.office_latitude || null,
        office_longitude: settings.office_longitude || null,
        geofence_radius_meters: settings.geofence_radius_meters || 500,
        week_off_days: settings.week_off_days || [0],
        require_checkout: settings.require_checkout !== false,
        auto_checkout_time: settings.auto_checkout_time || '23:59',
      });
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (settings) {
        return await base44.entities.AttendanceSettings.update(settings.id, data);
      } else {
        return await base44.entities.AttendanceSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance-settings']);
      toast.success('Rules updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update rules: ' + error.message);
    },
  });

  const addHolidayMutation = useMutation({
    mutationFn: async (holiday) => {
      // Check if exists
      const existing = await base44.entities.WorkDay.filter({ date: holiday.date });
      if (existing.length > 0) {
        return await base44.entities.WorkDay.update(existing[0].id, {
          is_holiday: true,
          name: holiday.name,
          description: 'Holiday'
        });
      } else {
        return await base44.entities.WorkDay.create({
          date: holiday.date,
          is_holiday: true,
          name: holiday.name,
          description: 'Holiday',
          is_weekoff: false
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['holidays-list']);
      queryClient.invalidateQueries(['work-days']); // Update calendar caches
      setNewHoliday({ date: '', name: '' });
      toast.success('Holiday added successfully');
    },
    onError: (e) => toast.error(e.message)
  });

  const removeHolidayMutation = useMutation({
    mutationFn: async (id) => {
      // We can either delete the WorkDay record OR set is_holiday to false
      // Deleting is cleaner if it's just a holiday record
      return await base44.entities.WorkDay.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['holidays-list']);
      queryClient.invalidateQueries(['work-days']);
      toast.success('Holiday removed');
    }
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(formData);
  };

  const handleWeekOffToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      week_off_days: prev.week_off_days.includes(day)
        ? prev.week_off_days.filter(d => d !== day)
        : [...prev.week_off_days, day]
    }));
  };

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (isLoadingSettings) {
    return <div className="text-center py-12 text-slate-500">Loading configuration...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6">

      {/* Left Column: General Settings */}
      <div className="lg:col-span-2 space-y-8">

        {/* Work Hours Card */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Work Hours & Policies</CardTitle>
                <CardDescription>Define daily schedules and time tracking rules</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <Label className="text-slate-600">Work Start Time</Label>
                <div className="relative">
                  <Input
                    type="time"
                    className="pl-10 h-10 border-slate-200 bg-slate-50/50"
                    value={formData.work_start_time}
                    onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className="text-slate-600">Late Threshold (min)</Label>
                <Input
                  type="number"
                  className="h-10 border-slate-200 bg-slate-50/50"
                  value={formData.late_threshold_minutes}
                  onChange={(e) => setFormData({ ...formData, late_threshold_minutes: e.target.value === '' ? '' : parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-slate-600">Min. Hours (Full Day)</Label>
                <Input
                  type="number"
                  step="0.5"
                  className="h-10 border-slate-200 bg-slate-50/50"
                  value={formData.minimum_work_hours}
                  onChange={(e) => setFormData({ ...formData, minimum_work_hours: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-slate-600">Early Checkout (hrs)</Label>
                <Input
                  type="number"
                  step="0.5"
                  className="h-10 border-slate-200 bg-slate-50/50"
                  value={formData.early_checkout_threshold_hours}
                  onChange={(e) => setFormData({ ...formData, early_checkout_threshold_hours: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Allow Multiple Check-ins</Label>
                  <p className="text-sm text-slate-400">Can users check in/out multiple times a day?</p>
                </div>
                <Switch
                  checked={formData.allow_multiple_checkins}
                  onCheckedChange={(checked) => setFormData({ ...formData, allow_multiple_checkins: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Mandatory Checkout</Label>
                  <p className="text-sm text-slate-400">Mark absent if no checkout recorded?</p>
                </div>
                <Switch
                  checked={formData.require_checkout}
                  onCheckedChange={(checked) => setFormData({ ...formData, require_checkout: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Auto Checkout Time</Label>
                  <p className="text-sm text-slate-400">Time to auto-checkout if forgotten</p>
                </div>
                <Input
                  type="time"
                  className="w-32 h-9"
                  value={formData.auto_checkout_time}
                  onChange={(e) => setFormData({ ...formData, auto_checkout_time: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geofencing Card */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Location & Geofencing</CardTitle>
                <CardDescription>Restrict attendance marking to office location</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-xl">
              <div>
                <Label className="text-base text-emerald-900">Enable Geofencing</Label>
                <p className="text-xs text-emerald-600/80">Only allow check-in within radius</p>
              </div>
              <Switch
                checked={formData.enable_geofencing}
                onCheckedChange={(checked) => setFormData({ ...formData, enable_geofencing: checked })}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>

            {formData.enable_geofencing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                <div>
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    value={formData.office_latitude || ''}
                    onChange={(e) => setFormData({ ...formData, office_latitude: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    value={formData.office_longitude || ''}
                    onChange={(e) => setFormData({ ...formData, office_longitude: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Radius (meters)</Label>
                  <Input
                    type="number"
                    value={formData.geofence_radius_meters}
                    onChange={(e) => setFormData({ ...formData, geofence_radius_meters: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      toast.info("Using current location...");
                      navigator.geolocation.getCurrentPosition(
                        pos => setFormData({ ...formData, office_latitude: pos.coords.latitude, office_longitude: pos.coords.longitude }),
                        err => toast.error(err.message)
                      );
                    }}
                    className="w-full border-dashed"
                  >
                    <MapPin className="w-4 h-4 mr-2" /> Set Current Location
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Right Column: Calendar & Holidays */}
      <div className="space-y-8">

        {/* Week Offs */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-50 rounded-xl">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <CardTitle className="text-lg">Weekly Offs</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 text-center">
              {weekDays.map((day, index) => {
                const isWeekOff = formData.week_off_days.includes(index);
                return (
                  <div
                    key={day}
                    onClick={() => handleWeekOffToggle(index)}
                    className={cn(
                      "flex-1 min-w-[3.5rem] py-2 rounded-lg text-xs font-bold cursor-pointer transition-all border",
                      isWeekOff
                        ? "bg-purple-100 text-purple-700 border-purple-200"
                        : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
                    )}
                  >
                    {day.substring(0, 3)}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card className="border-0 shadow-lg rounded-3xl overflow-hidden flex flex-col max-h-[600px]">
          <div className="h-1 bg-gradient-to-r from-rose-500 to-orange-500"></div>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <PartyPopperWrapper className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Holidays</CardTitle>
                <CardDescription>Manage national holidays</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden flex flex-col">
            <div className="flex gap-2 mb-4">
              <Input
                type="date"
                className="flex-[2]"
                value={newHoliday.date}
                onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
              />
              <Input
                placeholder="Name"
                className="flex-[3]"
                value={newHoliday.name}
                onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })}
              />
              <Button onClick={() => addHolidayMutation.mutate(newHoliday)} disabled={addHolidayMutation.isPending || !newHoliday.date || !newHoliday.name} size="icon" className="bg-rose-600 hover:bg-rose-700">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {holidays.map(holiday => (
                <div key={holiday.id} className="group flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-rose-100 hover:bg-rose-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center bg-white p-1.5 rounded border border-slate-200 min-w-[2.5rem]">
                      <span className="text-[10px] font-bold text-rose-600 uppercase">{format(parseISO(holiday.date), 'MMM')}</span>
                      <span className="text-sm font-bold text-slate-700">{format(parseISO(holiday.date), 'dd')}</span>
                    </div>
                    <span className="font-medium text-sm text-slate-700">{holiday.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeHolidayMutation.mutate(holiday.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {holidays.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">No holidays configured</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={handleSave}
          disabled={saveSettingsMutation.isPending}
          size="lg"
          className="rounded-full shadow-2xl h-14 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg transition-transform hover:scale-105"
        >
          <Save className="w-5 h-5 mr-2" />
          {saveSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>

    </div>
  );
}

// Icon wrapper to avoid missing import if lucide-react doesn't export PartyPopper directly or named differently in some versions
const PartyPopperWrapper = (props) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5.8 11.3 2 12.7c.9-1.2 2-3 4-2.8 2.1.2 4 .8 4.7 2.1l-4.9-.7Z" />
    <path d="M5 3v5" />
    <path d="M9 2.1 7.6 6.3" />
    <path d="M7 17.5 5.8 18c.2-2.1.8-4 2.1-4.7 1.2-.9 3-2 2.8-4l-3.7 8.2Z" />
    <path d="M11.3 5.8 12.7 2c1.2.9 3 2 2.8 4-.2 2.1-.8 4-2.1 4.7l-2.1-4.9Z" />
    <path d="M16 11H8V9" />
    <path d="M12 21h-2" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)