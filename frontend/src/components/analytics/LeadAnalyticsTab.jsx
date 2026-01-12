import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import LeadScoringCard from './LeadScoringCard';

export default function LeadAnalyticsTab({ leads, dateRange, isLoading }) {
  const [aiInsights, setAiInsights] = useState('');
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    generateLeadInsights();
  }, [leads]);

  const generateLeadInsights = async () => {
    if (leads.length === 0) return;
    
    setInsightLoading(true);
    try {
      const sourceConversion = {};
      const sources = [...new Set(leads.map(l => l.lead_source))];
      
      sources.forEach(source => {
        const sourceLeads = leads.filter(l => l.lead_source === source);
        const converted = sourceLeads.filter(l => l.status === 'closed_won').length;
        const avgDealValue = sourceLeads.filter(l => l.deal_value).reduce((sum, l) => sum + (l.deal_value || 0), 0) / sourceLeads.length || 0;
        sourceConversion[source] = {
          total: sourceLeads.length,
          converted,
          rate: ((converted / sourceLeads.length) * 100).toFixed(1),
          avgDealValue: avgDealValue.toFixed(0)
        };
      });

      const statusBreakdown = {};
      const dropOffPoints = {};
      leads.forEach(l => {
        statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1;
        if (l.status === 'lost' && l.lost_reason) {
          dropOffPoints[l.lost_reason] = (dropOffPoints[l.lost_reason] || 0) + 1;
        }
      });

      // Lead quality scoring
      const leadQualityScores = leads.map(l => {
        let score = 50; // Base score
        if (l.budget && parseInt(l.budget) > 5000000) score += 20;
        if (l.timeline === 'immediate' || l.timeline === '1-3 months') score += 15;
        if (l.lead_source === 'referral') score += 10;
        if (l.requirements && l.requirements.length > 50) score += 5;
        if (l.contacted_date) {
          const responseTime = (new Date(l.contacted_date) - new Date(l.created_date)) / (1000 * 60 * 60);
          if (responseTime < 1) score += 10;
        }
        return score;
      });
      const avgLeadQuality = (leadQualityScores.reduce((a, b) => a + b, 0) / leadQualityScores.length).toFixed(0);

      // Response time impact analysis
      const quickResponseLeads = leads.filter(l => {
        if (!l.contacted_date) return false;
        const responseTime = (new Date(l.contacted_date) - new Date(l.created_date)) / (1000 * 60 * 60);
        return responseTime < 1;
      });
      const quickResponseConversion = ((quickResponseLeads.filter(l => l.status === 'closed_won').length / quickResponseLeads.length) * 100).toFixed(1);

      const slowResponseLeads = leads.filter(l => {
        if (!l.contacted_date) return false;
        const responseTime = (new Date(l.contacted_date) - new Date(l.created_date)) / (1000 * 60 * 60);
        return responseTime > 24;
      });
      const slowResponseConversion = slowResponseLeads.length > 0 
        ? ((slowResponseLeads.filter(l => l.status === 'closed_won').length / slowResponseLeads.length) * 100).toFixed(1)
        : 0;

      const prompt = `As a lead conversion expert specializing in real estate CRM, analyze this comprehensive lead data and provide specific, actionable insights.

LEAD SOURCES & ROI:
${Object.entries(sourceConversion).map(([source, data]) => 
  `${source}: ${data.total} leads, ${data.rate}% conversion, Avg Deal: ₹${data.avgDealValue}`
).join('\n')}

STATUS DISTRIBUTION:
${Object.entries(statusBreakdown).map(([status, count]) => `${status}: ${count}`).join(', ')}

DROP-OFF REASONS:
${Object.entries(dropOffPoints).length > 0 ? Object.entries(dropOffPoints).map(([reason, count]) => `${reason}: ${count}`).join(', ') : 'Not enough data'}

LEAD QUALITY:
Average Lead Quality Score: ${avgLeadQuality}/100

RESPONSE TIME IMPACT:
- <1 hour response: ${quickResponseConversion}% conversion
- >24 hour response: ${slowResponseConversion}% conversion
- Impact: ${(quickResponseConversion - slowResponseConversion).toFixed(1)}% difference

Provide insights on:
1. Which lead sources deliver the highest ROI and why (be specific with numbers)
2. Main drop-off stages and root causes with solutions
3. Lead quality improvement recommendations
4. Response time optimization strategy
5. Predictive insight: Which current leads are most likely to convert

Be specific, data-driven, and provide real estate industry context.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true
      });

      setAiInsights(response);
    } catch (error) {
      console.error('Lead insights failed:', error);
      setAiInsights('Unable to generate insights.');
    } finally {
      setInsightLoading(false);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  // Calculate metrics
  const sourceData = {};
  const statusData = {};
  
  leads.forEach(lead => {
    const source = lead.lead_source || 'unknown';
    const status = lead.status || 'unknown';
    
    if (!sourceData[source]) sourceData[source] = { total: 0, converted: 0 };
    if (!statusData[status]) statusData[status] = 0;
    
    sourceData[source].total++;
    statusData[status]++;
    
    if (lead.status === 'closed_won') {
      sourceData[source].converted++;
    }
  });

  const conversionBySource = Object.entries(sourceData).map(([source, data]) => ({
    source,
    total: data.total,
    converted: data.converted,
    rate: ((data.converted / data.total) * 100).toFixed(1)
  }));

  const statusBreakdown = Object.entries(statusData).map(([status, count]) => ({
    status,
    count
  }));

  // Average response time calculation
  const avgResponseTime = leads.filter(l => l.contacted_date).reduce((acc, lead) => {
    const created = new Date(lead.created_date);
    const contacted = new Date(lead.contacted_date);
    const hours = (contacted - created) / (1000 * 60 * 60);
    return acc + hours;
  }, 0) / leads.filter(l => l.contacted_date).length || 0;

  return (
    <div className="space-y-6">
      {/* AI Insights */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-blue-600" />
            AI Lead Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insightLoading ? (
            <div className="text-slate-500">Analyzing lead patterns...</div>
          ) : (
            <p className="text-slate-700 leading-relaxed whitespace-pre-line">{aiInsights}</p>
          )}
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Best Converting Source
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 capitalize">
              {conversionBySource.sort((a, b) => b.rate - a.rate)[0]?.source || 'N/A'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {conversionBySource.sort((a, b) => b.rate - a.rate)[0]?.rate || 0}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {avgResponseTime.toFixed(1)}h
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Time to first contact
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Drop-off Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {((statusData.lost || 0) / leads.length * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {statusData.lost || 0} leads lost
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversion by Source</CardTitle>
            <CardDescription>Which channels perform best</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={conversionBySource}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="source" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" fill="#94a3b8" name="Total Leads" />
                <Bar dataKey="converted" fill="#10b981" name="Converted" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead Status Distribution</CardTitle>
            <CardDescription>Where leads are in the pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" angle={-15} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* AI Lead Scoring */}
      <LeadScoringCard leads={leads} />

      {/* Detailed Source Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detailed Source Performance</CardTitle>
          <CardDescription>Complete breakdown by lead source</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {conversionBySource
              .sort((a, b) => b.rate - a.rate)
              .map(source => (
                <div key={source.source} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium capitalize text-slate-900">{source.source}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {source.total} leads • {source.converted} converted
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{source.rate}%</div>
                    <div className="text-xs text-slate-500">conversion</div>
                  </div>
                  <div className="ml-4">
                    <Badge variant={source.rate > 10 ? 'default' : source.rate > 5 ? 'secondary' : 'destructive'}>
                      {source.rate > 10 ? 'High' : source.rate > 5 ? 'Medium' : 'Low'}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}