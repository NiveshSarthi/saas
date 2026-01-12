import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LogAnalyticsDialog({ open, onOpenChange, tasks = [] }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    task_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    views: 0,
    likes: 0,
    shares: 0,
    ctr: 0,
    spend: 0
  });

  const handleSubmit = async () => {
    if (!formData.task_id) {
      toast.error('Please select a campaign');
      return;
    }

    try {
      await base44.entities.MarketingAnalytics.create({
        task_id: formData.task_id,
        date: formData.date,
        views: parseInt(formData.views),
        likes: parseInt(formData.likes),
        shares: parseInt(formData.shares),
        ctr: parseFloat(formData.ctr),
        spend: parseFloat(formData.spend),
        platform: 'aggregate' // Simplified for manual entry
      });

      toast.success('Analytics data logged');
      queryClient.invalidateQueries(['marketing-analytics']);
      onOpenChange(false);
      // Reset form slightly but keep date
      setFormData(prev => ({ ...prev, views: 0, likes: 0, shares: 0, ctr: 0, spend: 0 }));
    } catch (error) {
      toast.error('Failed to log data');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Daily Performance</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Campaign</Label>
            <Select 
              value={formData.task_id} 
              onValueChange={(val) => setFormData({...formData, task_id: val})}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.campaign_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Views</Label>
              <Input 
                type="number" 
                value={formData.views}
                onChange={(e) => setFormData({...formData, views: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label>Likes (Engagement)</Label>
              <Input 
                type="number" 
                value={formData.likes}
                onChange={(e) => setFormData({...formData, likes: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Spend ($)</Label>
              <Input 
                type="number" 
                step="0.01"
                value={formData.spend}
                onChange={(e) => setFormData({...formData, spend: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label>CTR (%)</Label>
              <Input 
                type="number" 
                step="0.1"
                value={formData.ctr}
                onChange={(e) => setFormData({...formData, ctr: e.target.value})}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>Save Data</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}