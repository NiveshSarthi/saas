import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { PieChart, BarChart3, TrendingUp, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'react-hot-toast';

export default function BudgetComparison() {
  const { data: payables = [] } = useQuery({
    queryKey: ['payables-budget'],
    queryFn: () => base44.entities.PaymentPayable.list('-created_date', 1000),
  });

  const { data: marketingExpenses = [] } = useQuery({
    queryKey: ['marketing-budget'],
    queryFn: () => base44.entities.MarketingExpense.list('-created_date', 500),
  });

  const { data: salaries = [] } = useQuery({
    queryKey: ['salaries-budget'],
    queryFn: () => base44.entities.SalaryRecord.list('-month', 500),
  });

  const { data: pettyCashBudgets = [] } = useQuery({
    queryKey: ['pettycash-budgets'],
    queryFn: () => base44.entities.PettyCashBudget.list('budget_name', 100),
  });

  const budgetAnalysis = useMemo(() => {
    const categories = {
      marketing: {
        name: 'Marketing',
        budget: marketingExpenses.reduce((sum, m) => sum + (m.allocated_budget || 0), 0),
        spent: marketingExpenses.reduce((sum, m) => sum + (m.spent_amount || 0), 0)
      },
      salary: {
        name: 'Salaries',
        budget: salaries.reduce((sum, s) => sum + (s.gross_salary || 0), 0),
        spent: salaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.net_salary || 0), 0)
      },
      operational: {
        name: 'Operational',
        budget: 0,
        spent: payables.filter(p => p.category === 'operational').reduce((sum, p) => sum + (p.amount || 0), 0)
      },
      it_tech: {
        name: 'IT & Tech',
        budget: 0,
        spent: payables.filter(p => p.category === 'it_tech').reduce((sum, p) => sum + (p.amount || 0), 0)
      },
      statutory: {
        name: 'Statutory',
        budget: 0,
        spent: payables.filter(p => p.category === 'statutory').reduce((sum, p) => sum + (p.amount || 0), 0)
      },
      petty_cash: {
        name: 'Petty Cash',
        budget: pettyCashBudgets.reduce((sum, b) => sum + (b.monthly_limit || 0), 0),
        spent: pettyCashBudgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0)
      }
    };

    return Object.entries(categories).map(([key, data]) => {
      const utilizationPct = data.budget > 0 ? (data.spent / data.budget * 100) : 0;
      const remaining = data.budget - data.spent;
      const status = utilizationPct > 100 ? 'over' : utilizationPct > 80 ? 'warning' : 'ok';

      return {
        key,
        ...data,
        utilizationPct,
        remaining,
        status
      };
    }).sort((a, b) => b.spent - a.spent);
  }, [payables, marketingExpenses, salaries, pettyCashBudgets]);

  const totals = useMemo(() => {
    return budgetAnalysis.reduce((acc, cat) => ({
      budget: acc.budget + cat.budget,
      spent: acc.spent + cat.spent,
      remaining: acc.remaining + cat.remaining
    }), { budget: 0, spent: 0, remaining: 0 });
  }, [budgetAnalysis]);

  const handleExport = async () => {
    try {
      const response = await base44.functions.invoke('exportBudgetComparison', {});
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget_comparison_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      toast.success('Report exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'over': return 'bg-red-100 text-red-700';
      case 'warning': return 'bg-orange-100 text-orange-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-indigo-600" />
            Budget vs Actual
          </h1>
          <p className="text-slate-600 mt-1">Comprehensive expense and budget comparison</p>
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
                <p className="text-sm text-slate-600">Total Budget</p>
                <p className="text-2xl font-bold text-slate-900">₹{(totals.budget / 100000).toFixed(2)}L</p>
              </div>
              <PieChart className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Spent</p>
                <p className="text-2xl font-bold text-red-600">₹{(totals.spent / 100000).toFixed(2)}L</p>
              </div>
              <TrendingUp className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Remaining</p>
                <p className={`text-2xl font-bold ${totals.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{(totals.remaining / 100000).toFixed(2)}L
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Spent</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {budgetAnalysis.map(cat => (
                <TableRow key={cat.key}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell>₹{(cat.budget / 1000).toFixed(0)}K</TableCell>
                  <TableCell>₹{(cat.spent / 1000).toFixed(0)}K</TableCell>
                  <TableCell className={cat.remaining >= 0 ? 'text-green-700' : 'text-red-700'}>
                    ₹{(cat.remaining / 1000).toFixed(0)}K
                  </TableCell>
                  <TableCell>{cat.utilizationPct.toFixed(1)}%</TableCell>
                  <TableCell>
                    <div className="w-32">
                      <Progress 
                        value={Math.min(cat.utilizationPct, 100)} 
                        className={cat.status === 'over' ? 'bg-red-200' : cat.status === 'warning' ? 'bg-orange-200' : 'bg-green-200'}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(cat.status)}>
                      {cat.status === 'over' ? 'Over Budget' : cat.status === 'warning' ? 'Warning' : 'On Track'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {budgetAnalysis.filter(c => c.status === 'over' || c.status === 'warning').map(cat => (
          <Card key={cat.key} className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 mt-0.5 ${cat.status === 'over' ? 'text-red-600' : 'text-orange-600'}`} />
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                  <p className="text-sm text-slate-600">
                    {cat.status === 'over' 
                      ? `Over budget by ₹${(Math.abs(cat.remaining) / 1000).toFixed(0)}K`
                      : `Approaching limit: ${cat.utilizationPct.toFixed(1)}% utilized`
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}