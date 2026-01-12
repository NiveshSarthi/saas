import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Wallet, Calendar } from 'lucide-react';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

export default function PettyCashAnalytics({ transactions }) {
  const analytics = useMemo(() => {
    // Category breakdown
    const categoryData = {};
    transactions.forEach(t => {
      const cat = t.category || 'other';
      categoryData[cat] = (categoryData[cat] || 0) + (t.amount || 0);
    });

    const categoryChart = Object.entries(categoryData).map(([name, value]) => ({
      name: name.replace('_', ' '),
      value: Math.round(value)
    }));

    // Employee spending
    const employeeData = {};
    transactions.forEach(t => {
      const emp = t.employee_name || 'Unknown';
      employeeData[emp] = (employeeData[emp] || 0) + (t.amount || 0);
    });

    const topEmployees = Object.entries(employeeData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

    // Monthly trend
    const monthlyData = {};
    transactions.forEach(t => {
      if (t.expense_date) {
        const month = t.expense_date.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + (t.amount || 0);
      }
    });

    const monthlyTrend = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, amount]) => ({ month, amount: Math.round(amount) }));

    // Department breakdown
    const deptData = {};
    transactions.forEach(t => {
      const dept = t.department || 'Unassigned';
      deptData[dept] = (deptData[dept] || 0) + (t.amount || 0);
    });

    const departmentChart = Object.entries(deptData).map(([name, value]) => ({
      name,
      value: Math.round(value)
    }));

    // Stats
    const totalSpent = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const avgTransaction = transactions.length > 0 ? totalSpent / transactions.length : 0;
    const uniqueEmployees = new Set(transactions.map(t => t.employee_email)).size;

    return {
      categoryChart,
      topEmployees,
      monthlyTrend,
      departmentChart,
      totalSpent,
      avgTransaction,
      uniqueEmployees
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Spent</p>
                <p className="text-2xl font-bold">₹{(analytics.totalSpent / 1000).toFixed(1)}K</p>
              </div>
              <Wallet className="w-8 h-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg Transaction</p>
                <p className="text-2xl font-bold">₹{Math.round(analytics.avgTransaction)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Employees</p>
                <p className="text-2xl font-bold">{analytics.uniqueEmployees}</p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Transactions</p>
                <p className="text-2xl font-bold">{transactions.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.categoryChart}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.categoryChart.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Employees by Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.topEmployees}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Spending Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.departmentChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#ec4899" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}