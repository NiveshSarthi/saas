import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Award, TrendingDown, Clock, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function SalesTeamAnalyticsTab({ leads, activities, users, dateRange, isLoading }) {
  const [aiInsights, setAiInsights] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    generateTeamInsights();
  }, [leads, activities, users]);

  const generateTeamInsights = async () => {
    if (leads.length === 0 || users.length === 0) return;
    
    setInsightLoading(true);
    try {
      const teamPerformance = users.map(user => {
        const userLeads = leads.filter(l => l.assigned_to === user.email);
        const converted = userLeads.filter(l => l.status === 'closed_won').length;
        const userActivities = activities.filter(a => a.sales_member === user.email).length;
        return {
          name: user.full_name || user.email,
          leads: userLeads.length,
          converted,
          activities: userActivities,
          rate: userLeads.length > 0 ? ((converted / userLeads.length) * 100).toFixed(1) : 0
        };
      }).filter(u => u.leads > 0).sort((a, b) => b.rate - a.rate);

      const topPerformer = teamPerformance[0];
      const avgConversionRate = (teamPerformance.reduce((sum, u) => sum + parseFloat(u.rate), 0) / teamPerformance.length).toFixed(1);

      const prompt = `As a sales manager, analyze this team performance data:

Team Size: ${teamPerformance.length} active members
Avg Conversion Rate: ${avgConversionRate}%
Top Performer: ${topPerformer?.name} (${topPerformer?.rate}% conversion, ${topPerformer?.activities} activities)
Total Activities: ${activities.length}

Top 3 Performers:
${teamPerformance.slice(0, 3).map((u, i) => `${i+1}. ${u.name}: ${u.rate}% (${u.leads} leads, ${u.converted} closed)`).join('\n')}

Provide insights on:
1. What top performers are doing differently
2. Areas where the team needs improvement
3. Specific coaching recommendations

Be specific and actionable in 3-4 sentences.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      setAiInsights(response);
    } catch (error) {
      console.error('Team insights failed:', error);
      setAiInsights('Unable to generate team insights.');
    } finally {
      setInsightLoading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Calculate team metrics
  const teamData = users.map(user => {
    const userLeads = leads.filter(l => l.assigned_to === user.email);
    const converted = userLeads.filter(l => l.status === 'closed_won').length;
    const userActivities = activities.filter(a => a.sales_member === user.email);
    
    return {
      name: user.full_name || user.email,
      email: user.email,
      totalLeads: userLeads.length,
      converted,
      activities: userActivities.length,
      conversionRate: userLeads.length > 0 ? ((converted / userLeads.length) * 100).toFixed(1) : 0
    };
  }).filter(u => u.totalLeads > 0);

  const topPerformers = [...teamData].sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate)).slice(0, 3);
  const underperformers = [...teamData].sort((a, b) => parseFloat(a.conversionRate) - parseFloat(b.conversionRate)).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-green-600" />
            AI Team Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insightLoading ? (
            <div className="text-slate-500">Analyzing team performance...</div>
          ) : (
            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{aiInsights}</p>
          )}
        </CardContent>
      </Card>

      {/* Top Performers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {topPerformers.map((performer, idx) => (
          <Card key={performer.email} className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" />
                #{idx + 1} Performer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-semibold text-slate-900">{performer.name}</div>
              <div className="text-2xl font-bold text-green-600 mt-2">{performer.conversionRate}%</div>
              <div className="text-xs text-slate-500 mt-1">
                {performer.converted}/{performer.totalLeads} converted • {performer.activities} activities
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Performance Comparison</CardTitle>
          <CardDescription>Conversion rates and activity levels</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={teamData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-15} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalLeads" fill="#94a3b8" name="Total Leads" />
              <Bar dataKey="converted" fill="#10b981" name="Converted" />
              <Bar dataKey="activities" fill="#6366f1" name="Activities" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Team Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Team Metrics</CardTitle>
          <CardDescription>Complete performance breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {teamData
              .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))
              .map(member => (
                <div key={member.email} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{member.name}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {member.totalLeads} leads • {member.converted} converted • {member.activities} activities
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-xl font-bold text-slate-900">{member.conversionRate}%</div>
                    <div className="text-xs text-slate-500">conversion rate</div>
                  </div>
                  <Badge variant={member.conversionRate > 15 ? 'default' : member.conversionRate > 8 ? 'secondary' : 'destructive'}>
                    {member.conversionRate > 15 ? 'Excellent' : member.conversionRate > 8 ? 'Good' : 'Needs Coaching'}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Underperformers - Needs Attention */}
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-red-900">
            <TrendingDown className="w-4 h-4" />
            Needs Coaching & Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {underperformers.map(member => (
              <div key={member.email} className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div>
                  <div className="font-medium text-slate-900">{member.name}</div>
                  <div className="text-xs text-slate-500">
                    {member.conversionRate}% conversion • {member.activities} activities
                  </div>
                </div>
                <Badge variant="destructive">Action Required</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}