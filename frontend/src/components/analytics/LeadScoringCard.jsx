import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, TrendingUp, Target, RefreshCw } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function LeadScoringCard({ leads }) {
  const [scoredLeads, setScoredLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    scoreLeads();
  }, [leads]);

  const scoreLeads = async () => {
    setLoading(true);
    try {
      // Calculate lead scores
      const scored = leads.map(lead => {
        let score = 50; // Base score
        
        // Budget factor
        const budget = parseInt(lead.budget) || 0;
        if (budget > 10000000) score += 25;
        else if (budget > 5000000) score += 20;
        else if (budget > 2000000) score += 15;
        else if (budget > 1000000) score += 10;
        
        // Timeline urgency
        if (lead.timeline === 'immediate') score += 20;
        else if (lead.timeline === '1-3 months') score += 15;
        else if (lead.timeline === '3-6 months') score += 10;
        
        // Source quality
        if (lead.lead_source === 'referral') score += 15;
        else if (lead.lead_source === 'website') score += 10;
        else if (lead.lead_source === 'facebook') score += 8;
        
        // Engagement
        if (lead.requirements && lead.requirements.length > 100) score += 10;
        if (lead.location && lead.property_interest) score += 5;
        
        // Response time bonus
        if (lead.contacted_date) {
          const responseTime = (new Date(lead.contacted_date) - new Date(lead.created_date)) / (1000 * 60 * 60);
          if (responseTime < 1) score += 15;
          else if (responseTime < 6) score += 10;
          else if (responseTime < 24) score += 5;
        }
        
        // Temperature
        if (lead.lead_temperature === 'hot') score += 10;
        else if (lead.lead_temperature === 'warm') score += 5;
        
        // Penalties
        if (lead.status === 'lost') score = 0;
        if (lead.is_cold) score -= 20;
        if (!lead.assigned_to) score -= 10;
        
        return {
          ...lead,
          aiScore: Math.max(0, Math.min(100, score)),
          conversionProbability: Math.max(0, Math.min(100, score * 0.95))
        };
      });

      // Sort by score
      const sorted = scored.sort((a, b) => b.aiScore - a.aiScore);
      setScoredLeads(sorted);

      // Get AI prediction for top leads
      if (sorted.length > 0) {
        const topLeads = sorted.slice(0, 5);
        await generatePredictions(topLeads);
      }
    } catch (error) {
      console.error('Lead scoring failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePredictions = async (topLeads) => {
    try {
      const leadData = topLeads.map(l => ({
        name: l.lead_name,
        source: l.lead_source,
        budget: l.budget,
        timeline: l.timeline,
        score: l.aiScore,
        status: l.status
      }));

      const prompt = `As a predictive analytics expert, analyze these top 5 leads and provide quick conversion predictions:

${leadData.map((l, i) => `${i+1}. ${l.name} - Score: ${l.score}, Source: ${l.source}, Budget: ${l.budget}, Timeline: ${l.timeline}, Status: ${l.status}`).join('\n')}

For each lead, provide:
- Conversion probability (%)
- Expected close timeframe
- Main risk factor
- Recommended next action

Keep it concise - one line per lead.`;

      await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: false
      });
    } catch (error) {
      console.error('Prediction generation failed:', error);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-700 border-green-300';
    if (score >= 60) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Hot Lead';
    if (score >= 60) return 'Warm Lead';
    if (score >= 40) return 'Medium Priority';
    return 'Low Priority';
  };

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Lead Scoring & Predictions
            </CardTitle>
            <CardDescription className="mt-1">
              Top leads most likely to convert
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={scoreLeads}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {scoredLeads.slice(0, 10).map((lead, idx) => (
            <div 
              key={lead.id}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              onClick={() => window.location.href = createPageUrl(`LeadDetail?id=${lead.id}`)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-700">
                    {idx + 1}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{lead.lead_name}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    {lead.lead_source} • {lead.location || 'No location'} • {lead.budget ? `₹${(lead.budget/100000).toFixed(1)}L` : 'No budget'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600">{lead.aiScore}</div>
                  <div className="text-xs text-slate-500">score</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-green-600">{lead.conversionProbability}%</div>
                  <div className="text-xs text-slate-500">likely</div>
                </div>
                <Badge className={getScoreColor(lead.aiScore)}>
                  {getScoreLabel(lead.aiScore)}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {scoredLeads.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            No leads to score
          </div>
        )}
      </CardContent>
    </Card>
  );
}