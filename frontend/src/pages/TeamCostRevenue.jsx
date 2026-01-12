import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Users, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'react-hot-toast';

export default function TeamCostRevenue() {
  const { data: users = [] } = useQuery({
    queryKey: ['users-team'],
    queryFn: () => base44.entities.User.list('full_name', 500),
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ['receivables-team'],
    queryFn: () => base44.entities.PaymentReceivable.list('-created_date', 1000),
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries-team'],
    queryFn: () => base44.entities.SalaryRecord.list('-month', 500),
  });

  const { data: pettyCash = [] } = useQuery({
    queryKey: ['pettycash-team'],
    queryFn: () => base44.entities.PettyCashReimbursement.list('-created_date', 500),
  });

  const { data: salesActivities = [] } = useQuery({
    queryKey: ['sales-activities-team'],
    queryFn: () => base44.entities.SalesActivity.list('-created_date', 1000),
  });

  const teamAnalysis = useMemo(() => {
    return users.map(user => {
      // Revenue attribution (using cp_email or created_by)
      const userReceivables = receivables.filter(r => 
        r.cp_email === user.email || r.created_by === user.email
      );
      const totalRevenue = userReceivables.reduce((sum, r) => sum + (r.received_amount || 0), 0);

      // Costs
      const userSalaries = salaries.filter(s => s.employee_email === user.email);
      const salaryPaid = userSalaries.reduce((sum, s) => sum + (s.net_salary || 0), 0);
      
      const userPettyCash = pettyCash.filter(p => p.employee_email === user.email && p.status === 'paid');
      const pettyCashPaid = userPettyCash.reduce((sum, p) => sum + (p.amount || 0), 0);

      const totalCost = salaryPaid + pettyCashPaid;
      const netContribution = totalRevenue - totalCost;
      const roi = totalCost > 0 ? ((netContribution / totalCost) * 100) : 0;

      // Performance metrics
      const userSales = salesActivities.filter(a => a.employee_email === user.email);
      const leadsHandled = userSales.filter(a => a.activity_type === 'lead_assigned').length;
      const conversions = userSales.filter(a => a.activity_type === 'conversion').length;

      return {
        user,
        totalRevenue,
        salaryPaid,
        pettyCashPaid,
        totalCost,
        netContribution,
        roi,
        leadsHandled,
        conversions,
        conversionRate: leadsHandled > 0 ? (conversions / leadsHandled * 100) : 0
      };
    }).sort((a, b) => b.netContribution - a.netContribution);
  }, [users, receivables, salaries, pettyCash, salesActivities]);

  const totals = useMemo(() => {
    return teamAnalysis.reduce((acc, t) => ({
      totalRevenue: acc.totalRevenue + t.totalRevenue,
      totalCost: acc.totalCost + t.totalCost,
      netContribution: acc.netContribution + t.netContribution
    }), { totalRevenue: 0, totalCost: 0, netContribution: 0 });
  }, [teamAnalysis]);

  const handleExport = async () => {
    try {
      const response = await base44.functions.invoke('exportTeamCostRevenue', {});
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team_cost_revenue_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Report exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            Team Cost vs Revenue
          </h1>
          <p className="text-slate-600 mt-1">Employee-wise cost and revenue contribution analysis</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Team Revenue</p>
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
                <p className="text-sm text-slate-600">Total Team Cost</p>
                <p className="text-2xl font-bold text-red-600">₹{(totals.totalCost / 100000).toFixed(2)}L</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Net Contribution</p>
                <p className={`text-2xl font-bold ${totals.netContribution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{(totals.netContribution / 100000).toFixed(2)}L
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Member Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Revenue Generated</TableHead>
                <TableHead>Salary Paid</TableHead>
                <TableHead>Expenses</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Net Contribution</TableHead>
                <TableHead>ROI %</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Conversions</TableHead>
                <TableHead>Conv. Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamAnalysis.map(t => (
                <TableRow key={t.user.id}>
                  <TableCell className="font-medium">{t.user.full_name || t.user.email}</TableCell>
                  <TableCell>₹{(t.totalRevenue / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(t.salaryPaid / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(t.pettyCashPaid / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(t.totalCost / 1000).toFixed(0)}K</TableCell>
                  <TableCell>
                    <Badge className={t.netContribution >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      ₹{(t.netContribution / 1000).toFixed(0)}K
                    </Badge>
                  </TableCell>
                  <TableCell className={t.roi >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {t.roi.toFixed(1)}%
                  </TableCell>
                  <TableCell>{t.leadsHandled}</TableCell>
                  <TableCell>{t.conversions}</TableCell>
                  <TableCell>{t.conversionRate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {teamAnalysis.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-slate-500">
                    No team data available
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