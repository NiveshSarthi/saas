import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export default function ITSettings() {
  const [newConfig, setNewConfig] = useState({
    priority: 'medium',
    sla_hours: 24,
    escalation_enabled: false,
    escalation_to_email: '',
  });

  const queryClient = useQueryClient();

  const { data: slaConfigs = [] } = useQuery({
    queryKey: ['sla-configs'],
    queryFn: () => base44.entities.ITSLAConfig.list(),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data) => base44.entities.ITSLAConfig.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
      toast.success('SLA configuration added');
      setNewConfig({
        priority: 'medium',
        sla_hours: 24,
        escalation_enabled: false,
        escalation_to_email: '',
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: (id) => base44.entities.ITSLAConfig.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sla-configs'] });
      toast.success('SLA configuration deleted');
    },
  });

  const handleCreateConfig = () => {
    if (!newConfig.priority || !newConfig.sla_hours) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (slaConfigs.some(c => c.priority === newConfig.priority)) {
      toast.error('Configuration for this priority already exists');
      return;
    }
    createConfigMutation.mutate(newConfig);
  };

  return (
    <div className="space-y-6 mt-6">
      <Card>
        <CardHeader>
          <CardTitle>SLA Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Existing Configs */}
          <div className="space-y-3">
            {slaConfigs.map(config => (
              <div key={config.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-medium capitalize">{config.priority} Priority</div>
                  <div className="text-sm text-slate-600">
                    SLA: {config.sla_hours} hours
                    {config.escalation_enabled && ` • Escalate to: ${config.escalation_to_email}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteConfigMutation.mutate(config.id)}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            ))}

            {slaConfigs.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No SLA configurations yet. Add one below.
              </p>
            )}
          </div>

          {/* Add New Config */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Add New SLA Rule</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select
                  value={newConfig.priority}
                  onValueChange={(val) => setNewConfig({ ...newConfig, priority: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p} value={p} disabled={slaConfigs.some(c => c.priority === p)}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>SLA Hours</Label>
                <Input
                  type="number"
                  value={newConfig.sla_hours}
                  onChange={(e) => setNewConfig({ ...newConfig, sla_hours: parseInt(e.target.value) })}
                />
              </div>

              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Enable Escalation</Label>
                  <Switch
                    checked={newConfig.escalation_enabled}
                    onCheckedChange={(checked) => setNewConfig({ ...newConfig, escalation_enabled: checked })}
                  />
                </div>
              </div>

              {newConfig.escalation_enabled && (
                <div className="col-span-2">
                  <Label>Escalate To (Email)</Label>
                  <Input
                    type="email"
                    placeholder="it-lead@example.com"
                    value={newConfig.escalation_to_email}
                    onChange={(e) => setNewConfig({ ...newConfig, escalation_to_email: e.target.value })}
                  />
                </div>
              )}

              <div className="col-span-2">
                <Button onClick={handleCreateConfig} disabled={createConfigMutation.isPending}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Configuration
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}