import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, TrendingUp, Target, Clock, DollarSign, RefreshCw, Lightbulb } from 'lucide-react';

export default function AIRecommendationsTab({ leads, activities, fbPages, users, dateRange, isLoading }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateRecommendations();
  }, [leads, activities, fbPages, users]);

  const generateRecommendations = async () => {
    if (leads.length === 0) return;
    
    setLoading(true);
    try {
      // Prepare comprehensive data for AI analysis
      const totalLeads = leads.length;
      const converted = leads.filter(l => l.status === 'closed_won').length;
      const conversionRate = ((converted / totalLeads) * 100).toFixed(1);
      
      const sourcePerformance = {};
      ['facebook', 'instagram', 'website', 'walkin', 'call', 'referral'].forEach(source => {
        const sourceLeads = leads.filter(l => l.lead_source === source);
        const sourceConverted = sourceLeads.filter(l => l.status === 'closed_won').length;
        sourcePerformance[source] = {
          leads: sourceLeads.length,
          converted: sourceConverted,
          rate: sourceLeads.length > 0 ? ((sourceConverted / sourceLeads.length) * 100).toFixed(1) : 0
        };
      });

      const avgResponseTime = leads.filter(l => l.contacted_date).reduce((acc, lead) => {
        const created = new Date(lead.created_date);
        const contacted = new Date(lead.contacted_date);
        return acc + ((contacted - created) / (1000 * 60 * 60));
      }, 0) / leads.filter(l => l.contacted_date).length || 0;

      const teamPerformance = users.map(user => {
        const userLeads = leads.filter(l => l.assigned_to === user.email);
        const userConverted = userLeads.filter(l => l.status === 'closed_won').length;
        return {
          name: user.full_name || user.email,
          leads: userLeads.length,
          converted: userConverted,
          rate: userLeads.length > 0 ? ((userConverted / userLeads.length) * 100).toFixed(1) : 0
        };
      }).filter(u => u.leads > 0);

      const prompt = `As a senior business consultant analyzing CRM and marketing data, provide 5 specific, actionable recommendations to improve business performance.

DATA SUMMARY:
Total Leads: ${totalLeads}
Overall Conversion Rate: ${conversionRate}%
Avg Response Time: ${avgResponseTime.toFixed(1)} hours
Activities Logged: ${activities.length}

SOURCE PERFORMANCE:
${Object.entries(sourcePerformance).map(([source, data]) => 
  `${source}: ${data.leads} leads, ${data.rate}% conversion`
).join('\n')}

TEAM PERFORMANCE:
${teamPerformance.slice(0, 3).map(u => 
  `${u.name}: ${u.leads} leads, ${u.rate}% conversion`
).join('\n')}

Provide recommendations in this JSON format:
{
  "recommendations": [
    {
      "title": "Brief recommendation title",
      "description": "Detailed explanation",
      "impact": "high|medium|low",
      "category": "lead_quality|sales_process|campaign_optimization|team_performance|budget_allocation",
      "action": "Specific next step"
    }
  ]
}

Focus on:
1. Best time to contact leads
2. Best performing channels to scale
3. Budget reallocation suggestions
4. Underperforming areas to fix
5. Sales process improvements`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false,
        response_json_schema: {
          type: "object",
          properties: {
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  impact: { type: "string" },
                  category: { type: "string" },
                  action: { type: "string" }
                }
              }
            }
          }
        }
      });

      setRecommendations(response.recommendations || []);
    } catch (error) {
      console.error('Recommendations failed:', error);
      setRecommendations([{
        title: 'Unable to generate recommendations',
        description: 'Please try again or contact support',
        impact: 'low',
        category: 'system',
        action: 'Refresh the page'
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const getImpactColor = (impact) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'lead_quality': return <Target className="w-5 h-5" />;
      case 'sales_process': return <TrendingUp className="w-5 h-5" />;
      case 'campaign_optimization': return <Sparkles className="w-5 h-5" />;
      case 'team_performance': return <TrendingUp className="w-5 h-5" />;
      case 'budget_allocation': return <DollarSign className="w-5 h-5" />;
      default: return <Lightbulb className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI-Powered Recommendations</h2>
          <p className="text-slate-600 text-sm mt-1">Actionable insights to improve performance</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateRecommendations}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        {recommendations.map((rec, idx) => (
          <Card key={idx} className={`border-l-4 ${getImpactColor(rec.impact)}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getImpactColor(rec.impact)}`}>
                    {getCategoryIcon(rec.category)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{rec.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="capitalize text-xs">
                        {rec.category.replace('_', ' ')}
                      </Badge>
                      <Badge className={`capitalize text-xs ${getImpactColor(rec.impact)}`}>
                        {rec.impact} impact
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-slate-700">{rec.description}</p>
              <div className="bg-slate-50 rounded-lg p-3 border-l-4 border-indigo-500">
                <div className="text-xs font-semibold text-slate-600 mb-1">📋 NEXT STEP:</div>
                <div className="text-sm text-slate-900">{rec.action}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {recommendations.length === 0 && !loading && (
        <Card className="text-center py-12">
          <CardContent>
            <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No Recommendations Yet</h3>
            <p className="text-sm text-slate-500">
              Generate AI recommendations based on your current data
            </p>
            <Button
              onClick={generateRecommendations}
              className="mt-4 gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Generate Recommendations
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}