import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Building2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  PieChart,
  Users,
  ArrowRight,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/components/rbac/PermissionsContext';

export default function FinanceOverview() {
  const financeModules = [
    {
      title: 'Financial Dashboard',
      description: 'Real-time financial overview with key metrics, alerts, and quick actions',
      icon: Building2,
      color: 'indigo',
      path: 'FinanceDashboard',
      features: [
        'Current balance and cash position',
        'Total received vs paid amounts',
        'Monthly inflow/outflow tracking',
        'Active financial alerts',
        'Marketing spend overview'
      ]
    },
    {
      title: 'Receivables',
      description: 'Manage incoming payments from bookings, installments, and commissions',
      icon: TrendingUp,
      color: 'green',
      path: 'Receivables',
      features: [
        'Track booking payments',
        'Manage installments',
        'Record commission income',
        'Monitor pending amounts',
        'Handle overdue receivables'
      ]
    },
    {
      title: 'Payables',
      description: 'Track and manage all outgoing payments and expenses',
      icon: TrendingDown,
      color: 'red',
      path: 'Payables',
      features: [
        'Salary payments',
        'Marketing expenses',
        'Operational costs',
        'IT & Tech expenses',
        'Statutory payments'
      ]
    },
    {
      title: 'Cash Flow Forecast',
      description: 'Project future cash positions and identify potential shortfalls',
      icon: BarChart3,
      color: 'blue',
      path: 'CashFlowForecast',
      features: [
        'Monthly cash flow projections',
        'Inflow/outflow breakdown',
        'Risk level assessment',
        'Opening/closing balance tracking',
        'Forecast vs actual comparison'
      ]
    },
    {
      title: 'Financial Reports',
      description: 'Generate comprehensive financial summaries and export data',
      icon: FileText,
      color: 'purple',
      path: 'FinancialReports',
      features: [
        'Total income vs expenses',
        'Net position summary',
        'Category-wise breakdown',
        'Pending amounts report',
        'CSV export functionality'
      ]
    },
    {
      title: 'Marketing Expenses',
      description: 'Track marketing campaigns, budgets, and ROI',
      icon: PieChart,
      color: 'pink',
      path: 'MarketingExpenses',
      features: [
        'Campaign budget management',
        'Spend vs allocation tracking',
        'Lead generation metrics',
        'CPL and ROI calculation',
        'Platform-wise spend analysis'
      ]
    },
    {
      title: 'Salary Management',
      description: 'Process and track employee salary payments',
      icon: Users,
      color: 'amber',
      path: 'SalaryManagement',
      features: [
        'Monthly salary records',
        'Gross and net salary calculation',
        'Deductions management (PF, ESI, TDS)',
        'Incentive and bonus tracking',
        'Payment status monitoring'
      ]
    }
  ];

  const workflow = [
    {
      step: 1,
      title: 'Record Income',
      description: 'Add receivables for bookings, installments, and commissions',
      module: 'Receivables',
      icon: DollarSign
    },
    {
      step: 2,
      title: 'Record Expenses',
      description: 'Add payables for salaries, marketing, and operational costs',
      module: 'Payables',
      icon: CreditCard
    },
    {
      step: 3,
      title: 'Track Campaigns',
      description: 'Monitor marketing spend and campaign performance',
      module: 'Marketing Expenses',
      icon: PieChart
    },
    {
      step: 4,
      title: 'Process Salaries',
      description: 'Calculate and record monthly salary payments',
      module: 'Salary Management',
      icon: Users
    },
    {
      step: 5,
      title: 'Forecast Cash Flow',
      description: 'Project future cash positions and identify risks',
      module: 'Cash Flow Forecast',
      icon: Calendar
    },
    {
      step: 6,
      title: 'Generate Reports',
      description: 'Review financial summaries and export data',
      module: 'Financial Reports',
      icon: FileText
    }
  ];

  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
    amber: 'from-amber-500 to-amber-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-slate-900">
            Finance Management System
          </h1>
          <p className="text-xl text-slate-600">
            Complete financial tracking and forecasting for real estate businesses
          </p>
          <Link to={createPageUrl('FinanceDashboard')}>
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 mt-4">
              <Building2 className="w-5 h-5 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
        </div>

        {/* Workflow Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Recommended Workflow</CardTitle>
            <CardDescription>Follow this process for efficient financial management</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflow.map((item) => (
                <div key={item.step} className="relative">
                  <div className="flex items-start gap-3 p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <span className="font-bold text-indigo-600">{item.step}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {item.module}
                      </Badge>
                    </div>
                    <item.icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modules Grid */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Available Modules</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {financeModules.map((module) => {
              const Icon = module.icon;
              return (
                <Card key={module.path} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[module.color]} flex items-center justify-center`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <Link to={createPageUrl(module.path)}>
                        <Button variant="ghost" size="sm">
                          Open
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                    <CardTitle className="text-xl mt-3">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700 mb-2">Key Features:</p>
                      {module.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Integration Info */}
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200">
          <CardHeader>
            <CardTitle className="text-xl">Data Integration</CardTitle>
            <CardDescription>How the modules work together</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2" />
              <p className="text-slate-700">
                <strong>Dashboard</strong> aggregates data from all modules to show real-time financial position
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2" />
              <p className="text-slate-700">
                <strong>Receivables & Payables</strong> feed into cash flow calculations and net position
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
              <p className="text-slate-700">
                <strong>Marketing & Salaries</strong> are tracked separately but contribute to total payables
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full mt-2" />
              <p className="text-slate-700">
                <strong>Cash Flow Forecast</strong> uses historical data to project future financial positions
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-pink-500 rounded-full mt-2" />
              <p className="text-slate-700">
                <strong>Financial Reports</strong> provides exportable summaries of all financial data
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-indigo-600">7</p>
              <p className="text-sm text-slate-600">Finance Modules</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">100%</p>
              <p className="text-sm text-slate-600">Real-time Data</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">∞</p>
              <p className="text-sm text-slate-600">Records Supported</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">CSV</p>
              <p className="text-sm text-slate-600">Export Available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}