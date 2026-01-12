import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { format, addMonths } from 'date-fns';
import {
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function CashFlowForecast() {
  const { can } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    month: format(new Date(), 'yyyy-MM'),
    opening_balance: 0,
    expected_inflow: 0,
    expected_outflow: 0
  });

  const queryClient = useQueryClient();

  if (!can('cash_flow', 'read')) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have permission to view Cash Flow Forecast.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator for access.</p>
        </div>
      </div>
    );
  }

  const { data: forecasts = [] } = useQuery({
    queryKey: ['forecasts'],
    queryFn: () => base44.entities.CashFlowForecast.list('-month', 24),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const netCashflow = data.expected_inflow - data.expected_outflow;
      const closingBalance = data.opening_balance + netCashflow;
      const riskLevel = closingBalance < 0 ? 'critical' : closingBalance < 100000 ? 'high' : closingBalance < 500000 ? 'medium' : 'low';
      
      return base44.entities.CashFlowForecast.create({
        ...data,
        net_cashflow: netCashflow,
        closing_balance: closingBalance,
        risk_level: riskLevel
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecasts'] });
      setDialogOpen(false);
      resetForm();
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const resetForm = () => {
    setFormData({
      month: format(addMonths(new Date(), 1), 'yyyy-MM'),
      opening_balance: 0,
      expected_inflow: 0,
      expected_outflow: 0
    });
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Cash Flow Forecast
          </h1>
          <p className="text-slate-600 mt-1">Plan and predict future cash positions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Forecast
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Cash Flow Forecast</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Input
                    type="month"
                    value={formData.month}
                    onChange={(e) => setFormData({...formData, month: e.target.value})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Opening Balance</Label>
                  <Input
                    type="number"
                    value={formData.opening_balance}
                    onChange={(e) => setFormData({...formData, opening_balance: parseFloat(e.target.value)})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expected Inflow</Label>
                  <Input
                    type="number"
                    value={formData.expected_inflow}
                    onChange={(e) => setFormData({...formData, expected_inflow: parseFloat(e.target.value)})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expected Outflow</Label>
                  <Input
                    type="number"
                    value={formData.expected_outflow}
                    onChange={(e) => setFormData({...formData, expected_outflow: parseFloat(e.target.value)})}
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Net Cash Flow:</span>
                    <p className="text-lg font-bold text-slate-900">
                      ₹{((formData.expected_inflow - formData.expected_outflow) / 100000).toFixed(2)}L
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-600">Closing Balance:</span>
                    <p className="text-lg font-bold text-slate-900">
                      ₹{((formData.opening_balance + formData.expected_inflow - formData.expected_outflow) / 100000).toFixed(2)}L
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                  Create Forecast
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-white/10 backdrop-blur-md border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Monthly Forecasts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Opening</TableHead>
                <TableHead>Inflow</TableHead>
                <TableHead>Outflow</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Closing</TableHead>
                <TableHead>Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecasts.map((forecast) => (
                <TableRow key={forecast.id}>
                  <TableCell className="font-medium">{forecast.month}</TableCell>
                  <TableCell>₹{((forecast.opening_balance || 0) / 100000).toFixed(2)}L</TableCell>
                  <TableCell className="text-green-600">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      ₹{((forecast.expected_inflow || 0) / 100000).toFixed(2)}L
                    </div>
                  </TableCell>
                  <TableCell className="text-red-600">
                    <div className="flex items-center gap-1">
                      <TrendingDown className="w-4 h-4" />
                      ₹{((forecast.expected_outflow || 0) / 100000).toFixed(2)}L
                    </div>
                  </TableCell>
                  <TableCell className={forecast.net_cashflow >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ₹{((forecast.net_cashflow || 0) / 100000).toFixed(2)}L
                  </TableCell>
                  <TableCell className="font-semibold">₹{((forecast.closing_balance || 0) / 100000).toFixed(2)}L</TableCell>
                  <TableCell>
                    <Badge className={getRiskColor(forecast.risk_level)}>
                      {forecast.risk_level}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {forecasts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    No forecasts yet. Create your first forecast.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}