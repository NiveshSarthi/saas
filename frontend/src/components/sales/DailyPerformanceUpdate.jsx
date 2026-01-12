import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function DailyPerformanceUpdate({ user, projects = [] }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    project_id: 'none',
    walkins_count: 0,
    meetings_count: 0,
    followups_count: 0,
    site_visits_count: 0,
    bookings_count: 0,
    notes: ''
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        user_email: user.email,
        project_id: data.project_id === 'none' ? null : data.project_id,
        walkins_count: Number(data.walkins_count),
        meetings_count: Number(data.meetings_count),
        followups_count: Number(data.followups_count),
        site_visits_count: Number(data.site_visits_count),
        bookings_count: Number(data.bookings_count),
      };
      return await base44.entities.DailySalesPerformance.create(payload);
    },
    onSuccess: () => {
      toast.success('Daily performance updated successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-sales-performance'] });
      setOpen(false);
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        project_id: 'none',
        walkins_count: 0,
        meetings_count: 0,
        followups_count: 0,
        site_visits_count: 0,
        bookings_count: 0,
        notes: ''
      });
    },
    onError: (error) => {
      toast.error(`Failed to update performance: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="w-4 h-4" />
          Update Daily Efforts
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Log Daily Performance</DialogTitle>
            <DialogDescription>
              Enter your sales activity numbers for the day.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project">Project (Optional)</Label>
                <Select 
                  value={formData.project_id} 
                  onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                >
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / No Project</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="walkins">Walk-Ins</Label>
                <Input
                  id="walkins"
                  type="number"
                  min="0"
                  value={formData.walkins_count}
                  onChange={(e) => setFormData({ ...formData, walkins_count: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meetings">Meetings</Label>
                <Input
                  id="meetings"
                  type="number"
                  min="0"
                  value={formData.meetings_count}
                  onChange={(e) => setFormData({ ...formData, meetings_count: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="followups">Follow-ups</Label>
                <Input
                  id="followups"
                  type="number"
                  min="0"
                  value={formData.followups_count}
                  onChange={(e) => setFormData({ ...formData, followups_count: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_visits">Site Visits</Label>
                <Input
                  id="site_visits"
                  type="number"
                  min="0"
                  value={formData.site_visits_count}
                  onChange={(e) => setFormData({ ...formData, site_visits_count: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bookings" className="text-emerald-600 font-semibold">Closures / Bookings</Label>
              <Input
                id="bookings"
                type="number"
                min="0"
                className="border-emerald-200 focus-visible:ring-emerald-500"
                value={formData.bookings_count}
                onChange={(e) => setFormData({ ...formData, bookings_count: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Comments</Label>
              <Textarea
                id="notes"
                placeholder="Any significant achievements or blockers..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={updateMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {updateMutation.isPending ? 'Saving...' : 'Save Log'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}