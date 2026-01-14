import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Building2, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'react-hot-toast';

export default function ProjectPnL() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-pnl'],
    queryFn: () => base44.entities.Project.list('name', 500),
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables-pnl'],
    queryFn: () => base44.entities.PaymentReceivable.list('-created_date', 1000),
  });

  const { data: payables = [] } = useQuery({
    queryKey: ['payables-pnl'],
    queryFn: () => base44.entities.PaymentPayable.list('-created_date', 1000),
  });

  const { data: marketingExpenses = [] } = useQuery({
    queryKey: ['marketing-pnl'],
    queryFn: () => base44.entities.MarketingExpense.list('-created_date', 500),
  });

  const projectPnL = useMemo(() => {
    return projects.map(project => {
      // Revenue
      const projectReceivables = receivables.filter(r => r.project_id === project.id);
      const totalRevenue = projectReceivables.reduce((sum, r) => sum + (r.amount || 0), 0);
      const receivedRevenue = projectReceivables.reduce((sum, r) => sum + (r.received_amount || 0), 0);

      // Costs
      const projectPayables = payables.filter(p => p.project_id === project.id);
      const directCosts = projectPayables.reduce((sum, p) => sum + (p.amount || 0), 0);
      
      const projectMarketing = marketingExpenses.filter(m => m.project_id === project.id);
      const marketingCosts = projectMarketing.reduce((sum, m) => sum + (m.spent_amount || 0), 0);

      const totalCosts = directCosts + marketingCosts;
      const grossProfit = totalRevenue - totalCosts;
      const netProfit = receivedRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;
      const roi = totalCosts > 0 ? ((grossProfit / totalCosts) * 100) : 0;

      return {
        project,
        totalRevenue,
        receivedRevenue,
        directCosts,
        marketingCosts,
        totalCosts,
        grossProfit,
        netProfit,
        profitMargin,
        roi,
        leadsGenerated: projectMarketing.reduce((sum, m) => sum + (m.leads_generated || 0), 0)
      };
    }).sort((a, b) => b.grossProfit - a.grossProfit);
  }, [projects, receivables, payables, marketingExpenses]);

  const totals = useMemo(() => {
    return projectPnL.reduce((acc, p) => ({
      totalRevenue: acc.totalRevenue + p.totalRevenue,
      receivedRevenue: acc.receivedRevenue + p.receivedRevenue,
      totalCosts: acc.totalCosts + p.totalCosts,
      grossProfit: acc.grossProfit + p.grossProfit,
      netProfit: acc.netProfit + p.netProfit
    }), { totalRevenue: 0, receivedRevenue: 0, totalCosts: 0, grossProfit: 0, netProfit: 0 });
  }, [projectPnL]);

  const handleExport = async () => {
    try {
      const response = await base44.functions.invoke('exportProjectPnL', {});
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project_pnl_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('P&L exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-600" />
            Project-wise P&L
          </h1>
          <p className="text-slate-600 mt-1">Profit & Loss analysis by project</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">₹{(totals.totalRevenue / 100000).toFixed(2)}L</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Costs</p>
                <p className="text-2xl font-bold text-red-600">₹{(totals.totalCosts / 100000).toFixed(2)}L</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Gross Profit</p>
                <p className={`text-2xl font-bold ${totals.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{(totals.grossProfit / 100000).toFixed(2)}L
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Net Profit</p>
                <p className={`text-2xl font-bold ${totals.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{(totals.netProfit / 100000).toFixed(2)}L
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Total Revenue</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Direct Costs</TableHead>
                <TableHead>Marketing</TableHead>
                <TableHead>Total Costs</TableHead>
                <TableHead>Gross Profit</TableHead>
                <TableHead>Net Profit</TableHead>
                <TableHead>Margin %</TableHead>
                <TableHead>ROI %</TableHead>
                <TableHead>Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectPnL.map(p => (
                <TableRow key={p.project.id}>
                  <TableCell className="font-medium">{p.project.name}</TableCell>
                  <TableCell>₹{(p.totalRevenue / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(p.receivedRevenue / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(p.directCosts / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(p.marketingCosts / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(p.totalCosts / 1000).toFixed(0)}K</TableCell>
                  <TableCell>
                    <Badge className={p.grossProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      ₹{(p.grossProfit / 1000).toFixed(0)}K
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={p.netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      ₹{(p.netProfit / 1000).toFixed(0)}K
                    </Badge>
                  </TableCell>
                  <TableCell>{p.profitMargin.toFixed(1)}%</TableCell>
                  <TableCell className={p.roi >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {p.roi.toFixed(1)}%
                  </TableCell>
                  <TableCell>{p.leadsGenerated}</TableCell>
                </TableRow>
              ))}
              {projectPnL.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-slate-500">
                    No project data available
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