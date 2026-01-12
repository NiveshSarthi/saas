import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function MarketingDailyLogger({ user }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: existingLog = [] } = useQuery({
    queryKey: ['marketing-performance-today', user?.email, today],
    queryFn: () => base44.entities.MarketingPerformanceLog.filter({
      user_email: user?.email,
      date: today
    }),
    enabled: !!user
  });

  const [formData, setFormData] = useState({
    content_output: {
      egc_content: existingLog[0]?.content_output?.egc_content || 0,
      awareness_videos: existingLog[0]?.content_output?.awareness_videos || 0,
      educational_content: existingLog[0]?.content_output?.educational_content || 0,
      flyers: existingLog[0]?.content_output?.flyers || 0,
    },
    social_growth: {
      instagram_followers: existingLog[0]?.social_growth?.instagram_followers || 0,
      facebook_followers: existingLog[0]?.social_growth?.facebook_followers || 0,
      linkedin_followers: existingLog[0]?.social_growth?.linkedin_followers || 0,
    },
    engagement_metrics: {
      posts_published: existingLog[0]?.engagement_metrics?.posts_published || 0,
      total_engagement: existingLog[0]?.engagement_metrics?.total_engagement || 0,
      comments: existingLog[0]?.engagement_metrics?.comments || 0,
      shares: existingLog[0]?.engagement_metrics?.shares || 0,
    },
    notes: existingLog[0]?.notes || ''
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (existingLog[0]) {
        return base44.entities.MarketingPerformanceLog.update(existingLog[0].id, data);
      } else {
        return base44.entities.MarketingPerformanceLog.create({
          ...data,
          user_email: user.email,
          date: today
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marketing-performance-today']);
      queryClient.invalidateQueries(['marketing-performance-logs']);
      toast.success('Daily performance logged successfully');
      setOpen(false);
    }
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600">
          <Plus className="w-4 h-4 mr-2" />
          Log Today's Performance
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Performance Log - {format(new Date(), 'MMM d, yyyy')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Content Output */}
          <div>
            <h3 className="font-semibold text-sm mb-3 text-indigo-700">Content Output</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">EGC Content</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.content_output.egc_content}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_output: { ...formData.content_output, egc_content: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Awareness Videos</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.content_output.awareness_videos}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_output: { ...formData.content_output, awareness_videos: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Educational Content</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.content_output.educational_content}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_output: { ...formData.content_output, educational_content: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Flyers</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.content_output.flyers}
                  onChange={(e) => setFormData({
                    ...formData,
                    content_output: { ...formData.content_output, flyers: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Social Growth */}
          <div>
            <h3 className="font-semibold text-sm mb-3 text-emerald-700">Social Media Growth</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Instagram Followers</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.social_growth.instagram_followers}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_growth: { ...formData.social_growth, instagram_followers: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Facebook Followers</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.social_growth.facebook_followers}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_growth: { ...formData.social_growth, facebook_followers: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">LinkedIn Followers</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.social_growth.linkedin_followers}
                  onChange={(e) => setFormData({
                    ...formData,
                    social_growth: { ...formData.social_growth, linkedin_followers: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Engagement Metrics */}
          <div>
            <h3 className="font-semibold text-sm mb-3 text-purple-700">Engagement Metrics</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Posts Published</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.engagement_metrics.posts_published}
                  onChange={(e) => setFormData({
                    ...formData,
                    engagement_metrics: { ...formData.engagement_metrics, posts_published: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Total Engagement</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.engagement_metrics.total_engagement}
                  onChange={(e) => setFormData({
                    ...formData,
                    engagement_metrics: { ...formData.engagement_metrics, total_engagement: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Comments</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.engagement_metrics.comments}
                  onChange={(e) => setFormData({
                    ...formData,
                    engagement_metrics: { ...formData.engagement_metrics, comments: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Shares</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.engagement_metrics.shares}
                  onChange={(e) => setFormData({
                    ...formData,
                    engagement_metrics: { ...formData.engagement_metrics, shares: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs">Notes (Optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional context or achievements..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} className="bg-indigo-600">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save Performance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}