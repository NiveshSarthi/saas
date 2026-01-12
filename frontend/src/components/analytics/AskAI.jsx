import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Loader2 } from 'lucide-react';

export default function AskAI({ leads, activities, fbPages, users, dateRange }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [recentQuestions] = useState([
    'Why are conversions down this week?',
    'Which Facebook campaign should we scale?',
    'Who are my top 3 performing sales reps?',
    'What is the best time to contact leads?',
    'Which lead source has the highest ROI?',
    'Predict next month conversions',
    'What budget should I allocate to Facebook ads?'
  ]);

  const handleAsk = async (q = question) => {
    if (!q.trim()) return;
    
    setLoading(true);
    
    // Add to conversation history
    const newHistory = [...conversationHistory, { role: 'user', content: q }];
    
    try {
      // Prepare comprehensive context data
      const totalLeads = leads.length;
      const converted = leads.filter(l => l.status === 'closed_won').length;
      const conversionRate = ((converted / totalLeads) * 100).toFixed(1);
      
      const sourceData = {};
      const sourceRevenue = {};
      leads.forEach(l => {
        sourceData[l.lead_source] = (sourceData[l.lead_source] || 0) + 1;
        if (l.status === 'closed_won' && l.deal_value) {
          sourceRevenue[l.lead_source] = (sourceRevenue[l.lead_source] || 0) + l.deal_value;
        }
      });

      const teamData = users.map(user => {
        const userLeads = leads.filter(l => l.assigned_to === user.email);
        const userConverted = userLeads.filter(l => l.status === 'closed_won').length;
        const userRevenue = userConverted.reduce((sum, l) => sum + (l.deal_value || 0), 0);
        return {
          name: user.full_name || user.email,
          leads: userLeads.length,
          converted: userConverted,
          rate: userLeads.length > 0 ? ((userConverted / userLeads.length) * 100).toFixed(1) : 0,
          revenue: userRevenue
        };
      }).filter(u => u.leads > 0);

      // Calculate response time impact
      const quickResponseLeads = leads.filter(l => {
        if (!l.contacted_date) return false;
        const responseTime = (new Date(l.contacted_date) - new Date(l.created_date)) / (1000 * 60 * 60);
        return responseTime < 1;
      });
      const quickResponseRate = quickResponseLeads.length > 0
        ? ((quickResponseLeads.filter(l => l.status === 'closed_won').length / quickResponseLeads.length) * 100).toFixed(1)
        : 0;

      // Predict next period
      const avgLeadsPerDay = totalLeads / ((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));
      const predictedNextMonthLeads = Math.round(avgLeadsPerDay * 30);
      const predictedConversions = Math.round(predictedNextMonthLeads * (conversionRate / 100));

      // Conversation context
      const contextPrompt = newHistory.length > 1 
        ? `\n\nPREVIOUS CONVERSATION:\n${newHistory.slice(-3, -1).map(h => `${h.role}: ${h.content}`).join('\n')}\n`
        : '';

      const prompt = `You are an expert CRM analytics AI with predictive capabilities and real estate industry knowledge. Answer this question with specific data, insights, and actionable recommendations.

CURRENT QUESTION: ${q}
${contextPrompt}

COMPREHENSIVE DATA:
Period: ${new Date(dateRange.start).toLocaleDateString()} to ${new Date(dateRange.end).toLocaleDateString()}
Total Leads: ${totalLeads}
Conversions: ${converted} (${conversionRate}% rate)
Activities: ${activities.length}
Avg Leads/Day: ${avgLeadsPerDay.toFixed(1)}

LEAD SOURCES & ROI:
${Object.entries(sourceData).map(([source, count]) => {
  const revenue = sourceRevenue[source] || 0;
  const roi = revenue / count;
  return `${source}: ${count} leads, Revenue: ₹${(revenue/100000).toFixed(1)}L, ROI/Lead: ₹${(roi/100000).toFixed(1)}L`;
}).join('\n')}

TEAM PERFORMANCE:
${teamData.sort((a, b) => parseFloat(b.rate) - parseFloat(a.rate)).slice(0, 5).map((u, i) => 
  `${i+1}. ${u.name}: ${u.rate}% conversion (${u.leads} leads, ${u.converted} closed, ₹${(u.revenue/100000).toFixed(1)}L revenue)`
).join('\n')}

RESPONSE TIME IMPACT:
<1 hour response: ${quickResponseRate}% conversion rate
Quick response leads: ${quickResponseLeads.length}

FACEBOOK CAMPAIGNS:
Active Pages: ${fbPages.length}
Total Forms: ${fbPages.reduce((sum, p) => sum + (p.lead_forms?.length || 0), 0)}
FB Leads: ${leads.filter(l => l.lead_source === 'facebook').length}

PREDICTIONS:
Next Month Estimated Leads: ${predictedNextMonthLeads}
Expected Conversions: ${predictedConversions}
Expected Revenue: ₹${((predictedConversions * (sourceRevenue['facebook'] || 1000000) / converted)/100000).toFixed(1)}L

Provide:
1. Direct answer with specific numbers
2. Relevant context and comparison
3. Immediate action item
4. Optional: Prediction or trend if relevant

Be specific, use numbers, reference industry standards, and provide actionable next steps. If this is a follow-up question, acknowledge the previous context.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true
      });

      setAnswer(response);
      setConversationHistory([...newHistory, { role: 'assistant', content: response }]);
      setQuestion('');
    } catch (error) {
      console.error('Ask AI failed:', error);
      setAnswer('I apologize, but I encountered an error processing your question. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="w-6 h-6 text-purple-600" />
          Ask AI Anything
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question about your data..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={() => handleAsk()}
            disabled={!question.trim() || loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Quick Questions */}
        <div className="flex flex-wrap gap-2">
          {recentQuestions.map((q, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={() => handleAsk(q)}
            >
              {q}
            </Badge>
          ))}
        </div>

        {/* Conversation History */}
        {conversationHistory.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {conversationHistory.slice(-6).map((msg, idx) => (
              <div 
                key={idx}
                className={msg.role === 'user' 
                  ? "bg-indigo-50 rounded-lg p-3 border-l-4 border-l-indigo-500" 
                  : "bg-white rounded-lg p-4 border-l-4 border-l-purple-500"
                }
              >
                {msg.role === 'user' ? (
                  <div className="flex items-start gap-2">
                    <div className="font-semibold text-indigo-900 text-sm">You:</div>
                    <p className="text-slate-700 text-sm">{msg.content}</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-lg p-4 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing your data...</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}