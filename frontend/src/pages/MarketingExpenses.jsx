import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { format } from 'date-fns';
import {
  Plus,
  TrendingUp,
  Target,
  DollarSign,
  Edit,
  Trash2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function MarketingExpenses() {
  const { can } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [formData, setFormData] = useState({
    campaign_name: '',
    platform: 'facebook',
    allocated_budget: '',
    spent_amount: 0,
    start_date: '',
    end_date: '',
    status: 'active',
    leads_generated: 0,
    conversions: 0,
    revenue_generated: 0
  });

  const queryClient = useQueryClient();

  if (!can('marketing_expenses', 'read')) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to view Marketing Expenses.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  const { data: campaigns = [] } = useQuery({
    queryKey: ['marketing-expenses'],
    queryFn: () => base44.entities.MarketingExpense.list('-created_date', 1000),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const remaining = data.allocated_budget - (data.spent_amount || 0);
      const cpl = data.leads_generated > 0 ? data.spent_amount / data.leads_generated : 0;
      const roi = data.spent_amount > 0 ? ((data.revenue_generated - data.spent_amount) / data.spent_amount) * 100 : 0;
      
      return base44.entities.MarketingExpense.create({
        ...data,
        remaining_budget: remaining,
        cost_per_lead: cpl,
        roi: roi
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-expenses'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const remaining = data.allocated_budget - (data.spent_amount || 0);
      const cpl = data.leads_generated > 0 ? data.spent_amount / data.leads_generated : 0;
      const roi = data.spent_amount > 0 ? ((data.revenue_generated - data.spent_amount) / data.spent_amount) * 100 : 0;
      
      return base44.entities.MarketingExpense.update(id, {
        ...data,
        remaining_budget: remaining,
        cost_per_lead: cpl,
        roi: roi
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-expenses'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MarketingExpense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-expenses'] });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setDialogOpen(true);
  };

  const handleAISuggest = async () => {
    if (!formData.campaign_name) return;
    
    setAiSuggesting(true);
    try {
      const { data } = await base44.functions.invoke('autoCategorizeTran', {
        transaction_type: 'marketing',
        description: formData.campaign_name,
        amount: formData.allocated_budget
      });

      if (data.success && data.suggestions) {
        const suggestions = data.suggestions;
        setFormData(prev => ({
          ...prev,
          platform: suggestions.platform || prev.platform,
          campaign_type: suggestions.campaign_type || prev.campaign_type
        }));
      }
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiSuggesting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      campaign_name: '',
      platform: 'facebook',
      allocated_budget: '',
      spent_amount: 0,
      start_date: '',
      end_date: '',
      status: 'active',
      leads_generated: 0,
      conversions: 0,
      revenue_generated: 0
    });
    setEditingItem(null);
  };

  const totalBudget = campaigns.reduce((sum, c) => sum + (c.allocated_budget || 0), 0);
  const totalSpent = campaigns.reduce((sum, c) => sum + (c.spent_amount || 0), 0);
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads_generated || 0), 0);
  const avgCPL = totalLeads > 0 ? totalSpent / totalLeads : 0;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'paused': return 'bg-yellow-100 text-yellow-700';
      case 'completed': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2 sm:gap-3">
            <Target className="w-8 h-8 text-purple-600" />
            Marketing Expenses
          </h1>
          <p className="text-slate-600 mt-1">Track campaigns, budgets, and ROI</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit' : 'Add'} Campaign</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex justify-end mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAISuggest}
                  disabled={aiSuggesting || !formData.campaign_name}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiSuggesting ? 'AI Analyzing...' : 'AI Suggest Platform & Type'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Campaign Name</Label>
                  <Input
                    value={formData.campaign_name}
                    onChange={(e) => setFormData({...formData, campaign_name: e.target.value})}
                    required
                    placeholder="Enter campaign name for AI suggestions"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={formData.platform} onValueChange={(val) => setFormData({...formData, platform: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Allocated Budget</Label>
                  <Input
                    type="number"
                    value={formData.allocated_budget}
                    onChange={(e) => setFormData({...formData, allocated_budget: parseFloat(e.target.value)})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Spent Amount</Label>
                  <Input
                    type="number"
                    value={formData.spent_amount}
                    onChange={(e) => setFormData({...formData, spent_amount: parseFloat(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Leads Generated</Label>
                  <Input
                    type="number"
                    value={formData.leads_generated}
                    onChange={(e) => setFormData({...formData, leads_generated: parseInt(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Conversions</Label>
                  <Input
                    type="number"
                    value={formData.conversions}
                    onChange={(e) => setFormData({...formData, conversions: parseInt(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Revenue Generated</Label>
                  <Input
                    type="number"
                    value={formData.revenue_generated}
                    onChange={(e) => setFormData({...formData, revenue_generated: parseFloat(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                  {editingItem ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Budget</p>
                <p className="text-2xl font-bold text-slate-900">₹{(totalBudget / 100000).toFixed(2)}L</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Spent</p>
                <p className="text-2xl font-bold text-purple-600">₹{(totalSpent / 100000).toFixed(2)}L</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Leads</p>
                <p className="text-2xl font-bold text-green-600">{totalLeads}</p>
              </div>
              <Target className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg CPL</p>
                <p className="text-2xl font-bold text-orange-600">₹{avgCPL.toFixed(0)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Budget Usage</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>CPL</TableHead>
                <TableHead>ROI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => {
                const budgetUsage = campaign.allocated_budget > 0 
                  ? (campaign.spent_amount / campaign.allocated_budget) * 100 
                  : 0;
                
                return (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.campaign_name}</TableCell>
                    <TableCell className="capitalize">{campaign.platform?.replace('_', ' ')}</TableCell>
                    <TableCell>₹{(campaign.allocated_budget || 0).toLocaleString()}</TableCell>
                    <TableCell>₹{(campaign.spent_amount || 0).toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={budgetUsage} className="h-2" />
                        <span className="text-xs text-slate-600">{budgetUsage.toFixed(0)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{campaign.leads_generated || 0}</TableCell>
                    <TableCell>₹{(campaign.cost_per_lead || 0).toFixed(0)}</TableCell>
                    <TableCell className={campaign.roi >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {(campaign.roi || 0).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(campaign)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(campaign.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}