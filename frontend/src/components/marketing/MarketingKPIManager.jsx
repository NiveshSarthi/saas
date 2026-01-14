import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, startOfMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketingKPIManager() {
  const queryClient = useQueryClient();
  const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM');
  
  const { data: settings = [] } = useQuery({
    queryKey: ['marketing-kpi-settings', currentMonth],
    queryFn: () => base44.entities.MarketingKPISettings.filter({ month: currentMonth }),
  });

  const existingSettings = settings[0];

  const [formData, setFormData] = useState({
    content_targets: {
      egc_weekly: existingSettings?.content_targets?.egc_weekly || 4,
      egc_monthly: existingSettings?.content_targets?.egc_monthly || 16,
      awareness_weekly: existingSettings?.content_targets?.awareness_weekly || 6,
      awareness_monthly: existingSettings?.content_targets?.awareness_monthly || 24,
      educational_weekly: existingSettings?.content_targets?.educational_weekly || 2,
      educational_monthly: existingSettings?.content_targets?.educational_monthly || 8,
      flyers_weekly: existingSettings?.content_targets?.flyers_weekly || 5,
      flyers_monthly: existingSettings?.content_targets?.flyers_monthly || 20,
    },
    social_targets: {
      instagram_daily: existingSettings?.social_targets?.instagram_daily || 45,
      instagram_weekly: existingSettings?.social_targets?.instagram_weekly || 300,
      instagram_monthly: existingSettings?.social_targets?.instagram_monthly || 1200,
      facebook_daily: existingSettings?.social_targets?.facebook_daily || 14,
      facebook_weekly: existingSettings?.social_targets?.facebook_weekly || 100,
      facebook_monthly: existingSettings?.social_targets?.facebook_monthly || 400,
      linkedin_daily: existingSettings?.social_targets?.linkedin_daily || 14,
      linkedin_weekly: existingSettings?.social_targets?.linkedin_weekly || 100,
      linkedin_monthly: existingSettings?.social_targets?.linkedin_monthly || 400,
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingSettings) {
        return base44.entities.MarketingKPISettings.update(existingSettings.id, data);
      } else {
        return base44.entities.MarketingKPISettings.create({ ...data, month: currentMonth });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marketing-kpi-settings']);
      toast.success('KPI targets saved successfully');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Content Output Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">EGC Content</h3>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.egc_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, egc_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.egc_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, egc_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">Awareness Videos</h3>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.awareness_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, awareness_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.awareness_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, awareness_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">Educational Content</h3>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.educational_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, educational_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.educational_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, educational_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">Flyers</h3>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.flyers_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, flyers_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.content_targets.flyers_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_targets: { ...formData.content_targets, flyers_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Social Media Growth Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">Instagram</h3>
              <div className="space-y-2">
                <Label className="text-xs">Daily Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.instagram_daily}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, instagram_daily: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.instagram_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, instagram_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.instagram_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, instagram_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">Facebook</h3>
              <div className="space-y-2">
                <Label className="text-xs">Daily Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.facebook_daily}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, facebook_daily: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.facebook_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, facebook_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.facebook_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, facebook_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-slate-700">LinkedIn</h3>
              <div className="space-y-2">
                <Label className="text-xs">Daily Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.linkedin_daily}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, linkedin_daily: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Weekly Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.linkedin_weekly}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, linkedin_weekly: parseInt(e.target.value) }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Monthly Target</Label>
                <Input
                  type="number"
                  value={formData.social_targets.linkedin_monthly}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_targets: { ...formData.social_targets, linkedin_monthly: parseInt(e.target.value) }
                  })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-indigo-600">
          <Save className="w-4 h-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save KPI Targets'}
        </Button>
      </div>
    </div>
  );
}