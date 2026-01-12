import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, Plus, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function AttendanceRulesManager() {
  const queryClient = useQueryClient();
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: async () => {
      const result = await base44.entities.AttendanceSettings.list();
      return result[0] || null;
    },
  });

  const [formData, setFormData] = useState({
    work_start_time: '09:00',
    late_threshold_minutes: 1,
    minimum_work_hours: 8,
    early_checkout_threshold_hours: 8,
    allow_multiple_checkins: false,
    enable_geofencing: false,
    office_latitude: null,
    office_longitude: null,
    geofence_radius_meters: 500,
    week_off_days: [0, 1],
    holidays: [],
    require_checkout: true,
    auto_checkout_time: '23:59',
  });

  React.useEffect(() => {
    if (settings) {
      setFormData({
        work_start_time: settings.work_start_time || '09:00',
        late_threshold_minutes: settings.late_threshold_minutes || 1,
        minimum_work_hours: settings.minimum_work_hours || 8,
        early_checkout_threshold_hours: settings.early_checkout_threshold_hours || 8,
        allow_multiple_checkins: settings.allow_multiple_checkins || false,
        enable_geofencing: settings.enable_geofencing || false,
        office_latitude: settings.office_latitude || null,
        office_longitude: settings.office_longitude || null,
        geofence_radius_meters: settings.geofence_radius_meters || 500,
        week_off_days: settings.week_off_days || [0, 1],
        holidays: settings.holidays || [],
        require_checkout: settings.require_checkout !== false,
        auto_checkout_time: settings.auto_checkout_time || '23:59',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (settings) {
        return await base44.entities.AttendanceSettings.update(settings.id, data);
      } else {
        return await base44.entities.AttendanceSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance-settings']);
      toast.success('Attendance rules updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update rules: ' + error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleWeekOffToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      week_off_days: prev.week_off_days.includes(day)
        ? prev.week_off_days.filter(d => d !== day)
        : [...prev.week_off_days, day]
    }));
  };

  const addHoliday = () => {
    if (newHoliday.date && newHoliday.name) {
      setFormData(prev => ({
        ...prev,
        holidays: [...prev.holidays, newHoliday]
      }));
      setNewHoliday({ date: '', name: '' });
      toast.success('Holiday added');
    }
  };

  const removeHoliday = (index) => {
    setFormData(prev => ({
      ...prev,
      holidays: prev.holidays.filter((_, i) => i !== index)
    }));
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            office_latitude: position.coords.latitude,
            office_longitude: position.coords.longitude
          }));
          toast.success('Office location set to current position');
        },
        (error) => {
          toast.error('Failed to get location: ' + error.message);
        }
      );
    }
  };

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Work Hours & Late Policy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Work Start Time</Label>
              <Input
                type="time"
                value={formData.work_start_time}
                onChange={(e) => setFormData({ ...formData, work_start_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Late Threshold (minutes after start time)</Label>
              <Input
                type="number"
                value={formData.late_threshold_minutes}
                onChange={(e) => setFormData({ ...formData, late_threshold_minutes: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Minimum Work Hours (Full Day)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.minimum_work_hours}
                onChange={(e) => setFormData({ ...formData, minimum_work_hours: parseFloat(e.target.value) })}
              />
            </div>
            <div>
              <Label>Early Checkout Threshold (hours)</Label>
              <Input
                type="number"
                step="0.5"
                value={formData.early_checkout_threshold_hours}
                onChange={(e) => setFormData({ ...formData, early_checkout_threshold_hours: parseFloat(e.target.value) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Allow Multiple Check-ins Per Day</Label>
              <p className="text-xs text-slate-500">Users can check-in multiple times</p>
            </div>
            <Switch
              checked={formData.allow_multiple_checkins}
              onCheckedChange={(checked) => setFormData({ ...formData, allow_multiple_checkins: checked })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Require Check-out</Label>
              <p className="text-xs text-slate-500">Users must check out</p>
            </div>
            <Switch
              checked={formData.require_checkout}
              onCheckedChange={(checked) => setFormData({ ...formData, require_checkout: checked })}
            />
          </div>

          <div>
            <Label>Auto Checkout Time (if not checked out)</Label>
            <Input
              type="time"
              value={formData.auto_checkout_time}
              onChange={(e) => setFormData({ ...formData, auto_checkout_time: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Geo-Fencing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <Label>Enable Geo-Fencing</Label>
              <p className="text-xs text-slate-500">Require check-in within office radius</p>
            </div>
            <Switch
              checked={formData.enable_geofencing}
              onCheckedChange={(checked) => setFormData({ ...formData, enable_geofencing: checked })}
            />
          </div>

          {formData.enable_geofencing && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Office Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.office_latitude || ''}
                    onChange={(e) => setFormData({ ...formData, office_latitude: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Office Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={formData.office_longitude || ''}
                    onChange={(e) => setFormData({ ...formData, office_longitude: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Geofence Radius (meters)</Label>
                <Input
                  type="number"
                  value={formData.geofence_radius_meters}
                  onChange={(e) => setFormData({ ...formData, geofence_radius_meters: parseInt(e.target.value) })}
                />
              </div>
              <Button variant="outline" onClick={getCurrentLocation}>
                <MapPin className="w-4 h-4 mr-2" />
                Use Current Location as Office
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Week Offs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {weekDays.map((day, index) => (
              <div
                key={index}
                onClick={() => handleWeekOffToggle(index)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  formData.week_off_days.includes(index)
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-sm font-medium text-center">{day}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>National Holidays</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                placeholder="Date"
              />
            </div>
            <div className="flex-1">
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                placeholder="Holiday Name"
              />
            </div>
            <Button onClick={addHoliday}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {formData.holidays.map((holiday, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">{holiday.name}</p>
                  <p className="text-sm text-slate-500">{holiday.date}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeHoliday(index)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}
            {formData.holidays.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No holidays added</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Rules'}
        </Button>
      </div>
    </div>
  );
}