import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Facebook,
  Sparkles,
  Download,
  Calendar,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Send
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import OverviewTab from '@/components/analytics/OverviewTab';
import LeadAnalyticsTab from '@/components/analytics/LeadAnalyticsTab';
import CampaignAnalyticsTab from '@/components/analytics/CampaignAnalyticsTab';
import SalesTeamAnalyticsTab from '@/components/analytics/SalesTeamAnalyticsTab';
import AIRecommendationsTab from '@/components/analytics/AIRecommendationsTab';
import AskAI from '@/components/analytics/AskAI';
import ExportDialog from '@/components/analytics/ExportDialog';

export default function Analytics() {
  const [user, setUser] = useState(null);
  const [dateRange, setDateRange] = useState('this_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [salesMemberFilter, setSalesMemberFilter] = useState('all');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };
    fetchUser();
  }, []);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (dateRange) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday':
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case 'this_week':
        start = startOfWeek(now);
        end = endOfWeek(now);
        break;
      case 'last_7_days':
        start = subDays(now, 7);
        end = now;
        break;
      case 'this_month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'last_30_days':
        start = subDays(now, 30);
        end = now;
        break;
      case 'custom':
        start = customStartDate ? new Date(customStartDate) : subDays(now, 30);
        end = customEndDate ? new Date(customEndDate) : now;
        break;
      default:
        start = startOfWeek(now);
        end = endOfWeek(now);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const { start, end } = getDateRange();

  // Fetch all leads
  const { data: allLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['analytics-leads', start, end],
    queryFn: async () => {
      const leads = await base44.entities.Lead.list('-created_date', 1000);
      return leads.filter(lead => {
        const createdDate = new Date(lead.created_date);
        return createdDate >= new Date(start) && createdDate <= new Date(end);
      });
    },
    enabled: !!user
  });

  // Fetch sales activities
  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: ['analytics-activities', start, end],
    queryFn: async () => {
      const acts = await base44.entities.SalesActivity.list('-created_date', 1000);
      return acts.filter(act => {
        const actDate = new Date(act.created_date);
        return actDate >= new Date(start) && actDate <= new Date(end);
      });
    },
    enabled: !!user
  });

  // Fetch Facebook pages
  const { data: fbPages = [], isLoading: fbPagesLoading } = useQuery({
    queryKey: ['analytics-fb-pages'],
    queryFn: () => base44.entities.FacebookPageConnection.list(),
    enabled: !!user
  });

  // Fetch users for team analytics
  const { data: users = [] } = useQuery({
    queryKey: ['analytics-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Apply filters
  const filteredLeads = allLeads.filter(lead => {
    const sourceMatch = sourceFilter === 'all' || lead.lead_source === sourceFilter;
    const salesMatch = salesMemberFilter === 'all' || lead.assigned_to === salesMemberFilter;
    return sourceMatch && salesMatch;
  });

  const filteredActivities = activities.filter(act => {
    const salesMatch = salesMemberFilter === 'all' || act.sales_member === salesMemberFilter;
    return salesMatch;
  });

  // Role-based access check
  const isAdmin = user?.role === 'admin';
  const isSalesHead = user?.job_title?.toLowerCase().includes('head') || 
                      user?.job_title?.toLowerCase().includes('manager');

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Skeleton className="h-8 w-48 mx-auto mb-4" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>
    );
  }

  const isLoading = leadsLoading || activitiesLoading || fbPagesLoading;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              Analytics
            </h1>
            <p className="text-slate-600 mt-1">AI-powered insights from your CRM and Facebook data</p>
          </div>
          <div className="flex gap-2">
            <ExportDialog
              leads={filteredLeads}
              activities={filteredActivities}
              fbPages={fbPages}
              users={users}
              dateRange={{ start, end }}
            />
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dateRange === 'custom' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">End Date</Label>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Lead Source</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(isAdmin || isSalesHead) && (
                <div className="space-y-2">
                  <Label className="text-xs">Sales Member</Label>
                  <Select value={salesMemberFilter} onValueChange={setSalesMemberFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Members</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.email} value={u.email}>
                          {u.full_name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <Target className="w-4 h-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2">
              <Facebook className="w-4 h-4" />
              Campaigns
            </TabsTrigger>
            {(isAdmin || isSalesHead) && (
              <TabsTrigger value="team" className="gap-2">
                <Users className="w-4 h-4" />
                Team
              </TabsTrigger>
            )}
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="w-4 h-4" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab
              leads={filteredLeads}
              activities={filteredActivities}
              fbPages={fbPages}
              dateRange={{ start, end }}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <LeadAnalyticsTab
              leads={filteredLeads}
              dateRange={{ start, end }}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <CampaignAnalyticsTab
              leads={filteredLeads}
              fbPages={fbPages}
              dateRange={{ start, end }}
              isLoading={isLoading}
            />
          </TabsContent>

          {(isAdmin || isSalesHead) && (
            <TabsContent value="team" className="space-y-4">
              <SalesTeamAnalyticsTab
                leads={filteredLeads}
                activities={filteredActivities}
                users={users}
                dateRange={{ start, end }}
                isLoading={isLoading}
              />
            </TabsContent>
          )}

          <TabsContent value="ai" className="space-y-4">
            <AIRecommendationsTab
              leads={filteredLeads}
              activities={filteredActivities}
              fbPages={fbPages}
              users={users}
              dateRange={{ start, end }}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>

        {/* Ask AI */}
        <AskAI
          leads={filteredLeads}
          activities={filteredActivities}
          fbPages={fbPages}
          users={users}
          dateRange={{ start, end }}
        />
      </div>
    </div>
  );
}