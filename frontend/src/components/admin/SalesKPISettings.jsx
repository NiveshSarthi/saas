import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Save, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function SalesKPISettingsPanel() {
  const queryClient = useQueryClient();
  
  const { data: kpiSettings = [], isLoading } = useQuery({
    queryKey: ['kpi-settings'],
    queryFn: () => base44.entities.SalesKPISettings.list('-created_date', 1),
  });

  const existingSettings = kpiSettings[0];

  const [settings, setSettings] = useState({
    tracking_period_days: 7,
    min_walkins_per_day: 1,
    min_closures_per_period: 1,
    is_active: true
  });

  useEffect(() => {
    if (existingSettings) {
      setSettings({
        tracking_period_days: existingSettings.tracking_period_days ?? 7,
        min_walkins_per_day: existingSettings.min_walkins_per_day ?? 1,
        min_closures_per_period: existingSettings.min_closures_per_period ?? 1,
        is_active: existingSettings.is_active ?? true
      });
    }
  }, [existingSettings]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingSettings) {
        return base44.entities.SalesKPISettings.update(existingSettings.id, data);
      } else {
        return base44.entities.SalesKPISettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-settings'] });
      toast.success('KPI settings saved successfully');
    },
    onError: () => {
      toast.error('Failed to save settings');
    }
  });

  const handleSave = () => {
    saveMutation.mutate({
      tracking_period_days: parseInt(settings.tracking_period_days) || 7,
      min_walkins_per_day: parseInt(settings.min_walkins_per_day) || 1,
      min_closures_per_period: parseInt(settings.min_closures_per_period) || 1,
      is_active: settings.is_active
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Sales KPI Configuration</CardTitle>
            <CardDescription>Configure KPI targets for the sales team</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div>
            <Label className="text-base font-medium">Enable KPI Tracking</Label>
            <p className="text-sm text-slate-500">Turn on/off KPI tracking for sales team</p>
          </div>
          <Switch
            checked={settings.is_active}
            onCheckedChange={(checked) => setSettings({ ...settings, is_active: checked })}
          />
        </div>

        {/* Tracking Period */}
        <div className="space-y-2">
          <Label htmlFor="tracking_period">Tracking Period (Days)</Label>
          <Input
            id="tracking_period"
            type="number"
            min="1"
            max="90"
            value={settings.tracking_period_days}
            onChange={(e) => setSettings({ ...settings, tracking_period_days: e.target.value })}
            className="max-w-xs"
          />
          <p className="text-sm text-slate-500">
            The number of days to look back when calculating KPIs (e.g., 7 for weekly)
          </p>
        </div>

        {/* Walk-ins per day */}
        <div className="space-y-2">
          <Label htmlFor="min_walkins">Minimum Walk-Ins Per Day</Label>
          <Input
            id="min_walkins"
            type="number"
            min="0"
            max="50"
            value={settings.min_walkins_per_day}
            onChange={(e) => setSettings({ ...settings, min_walkins_per_day: e.target.value })}
            className="max-w-xs"
          />
          <p className="text-sm text-slate-500">
            Each sales member must log at least this many walk-ins every day
          </p>
        </div>

        {/* Closures per period */}
        <div className="space-y-2">
          <Label htmlFor="min_closures">Minimum Closures Per Period</Label>
          <Input
            id="min_closures"
            type="number"
            min="0"
            max="100"
            value={settings.min_closures_per_period}
            onChange={(e) => setSettings({ ...settings, min_closures_per_period: e.target.value })}
            className="max-w-xs"
          />
          <p className="text-sm text-slate-500">
            Each sales member must have at least this many closures within the tracking period
          </p>
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">How KPIs are calculated:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Walk-In KPI:</strong> Member must have logged at least {settings.min_walkins_per_day} walk-in(s) on each of the last {settings.tracking_period_days} days</li>
              <li><strong>Closure KPI:</strong> Member must have at least {settings.min_closures_per_period} closure(s) total in the last {settings.tracking_period_days} days</li>
            </ul>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button 
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}