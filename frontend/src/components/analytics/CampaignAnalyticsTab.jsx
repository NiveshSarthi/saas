import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Facebook, TrendingUp, DollarSign, Target, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function CampaignAnalyticsTab({ leads, fbPages, dateRange, isLoading }) {
  const [aiInsights, setAiInsights] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    generateCampaignInsights();
  }, [leads, fbPages]);

  const generateCampaignInsights = async () => {
    if (leads.length === 0) return;
    
    setInsightLoading(true);
    try {
      const fbLeads = leads.filter(l => l.lead_source === 'facebook' || l.lead_source === 'instagram');
      const conversionRate = ((fbLeads.filter(l => l.status === 'closed_won').length / fbLeads.length) * 100).toFixed(1);

      const prompt = `As a digital marketing analyst, analyze Facebook campaign performance:

Total FB Leads: ${fbLeads.length}
Conversion Rate: ${conversionRate}%
Active Pages: ${fbPages.length}
Total Forms: ${fbPages.reduce((sum, p) => sum + (p.lead_forms?.length || 0), 0)}

Provide insights on:
1. Campaign performance trends
2. Which pages/forms perform best
3. Specific recommendations to improve ROI

Be specific and actionable in 3-4 sentences.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });

      setAiInsights(response);
    } catch (error) {
      console.error('Campaign insights failed:', error);
      setAiInsights('Unable to generate campaign insights.');
    } finally {
      setInsightLoading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const fbLeads = leads.filter(l => l.lead_source === 'facebook' || l.lead_source === 'instagram');
  const totalFbLeads = fbLeads.length;
  const convertedFbLeads = fbLeads.filter(l => l.status === 'closed_won').length;
  const conversionRate = totalFbLeads > 0 ? ((convertedFbLeads / totalFbLeads) * 100).toFixed(1) : 0;

  // Page performance
  const pagePerformance = fbPages.map(page => {
    const pageLeads = fbLeads.filter(l => l.notes?.includes(`Page: ${page.page_name}`));
    const converted = pageLeads.filter(l => l.status === 'closed_won').length;
    return {
      page: page.page_name,
      leads: pageLeads.length,
      converted,
      rate: pageLeads.length > 0 ? ((converted / pageLeads.length) * 100).toFixed(1) : 0,
      forms: page.lead_forms?.length || 0
    };
  });

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Campaign Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insightLoading ? (
            <div className="text-slate-500">Analyzing campaign data...</div>
          ) : (
            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{aiInsights}</p>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Facebook className="w-4 h-4 text-blue-600" />
              FB/IG Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalFbLeads}</div>
            <p className="text-xs text-slate-500 mt-1">Total social media leads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{conversionRate}%</div>
            <p className="text-xs text-slate-500 mt-1">{convertedFbLeads} conversions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Active Pages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{fbPages.length}</div>
            <p className="text-xs text-slate-500 mt-1">Connected Facebook pages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Forms
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-600">
              {fbPages.reduce((sum, p) => sum + (p.lead_forms?.length || 0), 0)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Lead generation forms</p>
          </CardContent>
        </Card>
      </div>

      {/* Page Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Page Performance</CardTitle>
          <CardDescription>Lead generation by Facebook page</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={pagePerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="page" angle={-15} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="leads" fill="#3b82f6" name="Total Leads" />
              <Bar dataKey="converted" fill="#10b981" name="Converted" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Page Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Page Analysis</CardTitle>
          <CardDescription>Performance metrics for each connected page</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pagePerformance
              .sort((a, b) => b.leads - a.leads)
              .map(page => (
                <div key={page.page} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{page.page}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {page.leads} leads • {page.converted} converted • {page.forms} forms
                    </div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-xl font-bold text-slate-900">{page.rate}%</div>
                    <div className="text-xs text-slate-500">conversion</div>
                  </div>
                  <Badge variant={page.rate > 10 ? 'default' : 'secondary'}>
                    {page.rate > 10 ? 'High Performer' : 'Needs Attention'}
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Campaign Optimization Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>• Focus budget on pages with conversion rates above {conversionRate}%</li>
            <li>• Review low-performing forms for messaging and targeting issues</li>
            <li>• Set up A/B tests on creative elements for underperforming campaigns</li>
            <li>• Ensure follow-up time is under 1 hour for Facebook leads</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}