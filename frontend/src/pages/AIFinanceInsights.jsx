import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import {
  Brain,
  TrendingUp,
  MessageSquare,
  FileText,
  AlertTriangle,
  Sparkles,
  Send,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AIFinanceInsights() {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [reportType, setReportType] = useState('monthly');
  const [reportAudience, setReportAudience] = useState('cfo');

  // AI Q&A Mutation
  const askAIMutation = useMutation({
    mutationFn: async (q) => {
      const response = await base44.functions.invoke('askFinanceAI', { question: q });
      return response.data;
    },
    onSuccess: (data) => {
      setChatHistory([...chatHistory, 
        { role: 'user', content: question },
        { role: 'ai', content: data.answer }
      ]);
      setQuestion('');
    }
  });

  // Cash Flow Prediction
  const predictMutation = useMutation({
    mutationFn: async (months) => {
      const response = await base44.functions.invoke('predictCashFlow', { months });
      return response.data;
    }
  });

  // Narrative Report
  const narrativeMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateFinancialNarrative', { 
        report_type: reportType,
        target_audience: reportAudience 
      });
      return response.data;
    }
  });

  // Anomaly Detection
  const anomalyMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('detectAnomalies', {});
      return response.data;
    }
  });

  const handleAskQuestion = () => {
    if (question.trim()) {
      askAIMutation.mutate(question);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      low: 'bg-blue-100 text-blue-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return colors[severity] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Brain className="w-10 h-10 text-purple-600" />
            <h1 className="text-4xl font-bold text-slate-900">AI Finance Insights</h1>
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
          <p className="text-lg text-slate-600">
            AI-powered forecasting, analysis, and decision support for your finances
          </p>
        </div>

        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="chat">
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask AI
            </TabsTrigger>
            <TabsTrigger value="forecast">
              <TrendingUp className="w-4 h-4 mr-2" />
              Forecast
            </TabsTrigger>
            <TabsTrigger value="report">
              <FileText className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="anomalies">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Anomalies
            </TabsTrigger>
          </TabsList>

          {/* AI Chat */}
          <TabsContent value="chat">
            <Card>
              <CardHeader>
                <CardTitle>Ask Your CFO Copilot</CardTitle>
                <CardDescription>Get instant answers using live financial data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-96 p-4 border rounded-lg bg-white">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>Start a conversation with your AI finance assistant</p>
                      <div className="mt-6 space-y-2 text-sm text-left max-w-md mx-auto">
                        <p className="font-medium text-slate-700">Try asking:</p>
                        <button 
                          onClick={() => setQuestion("Can we increase Meta Ads by ₹2L next month?")}
                          className="block w-full text-left p-2 hover:bg-slate-50 rounded"
                        >
                          • Can we increase Meta Ads by ₹2L next month?
                        </button>
                        <button 
                          onClick={() => setQuestion("Which team is least profitable?")}
                          className="block w-full text-left p-2 hover:bg-slate-50 rounded"
                        >
                          • Which team is least profitable?
                        </button>
                        <button 
                          onClick={() => setQuestion("What happens if we delay salaries by 10 days?")}
                          className="block w-full text-left p-2 hover:bg-slate-50 rounded"
                        >
                          • What happens if we delay salaries by 10 days?
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-2xl rounded-lg p-3 ${
                            msg.role === 'user' 
                              ? 'bg-indigo-600 text-white' 
                              : 'bg-slate-100 text-slate-900'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                      {askAIMutation.isPending && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Analyzing...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
                    placeholder="Ask a financial question..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                  />
                  <Button 
                    onClick={handleAskQuestion}
                    disabled={!question.trim() || askAIMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cash Flow Forecast */}
          <TabsContent value="forecast">
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Cash Flow Forecast</CardTitle>
                <CardDescription>Predict future cash positions using historical patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Forecast Period</label>
                    <Select value={forecastMonths.toString()} onValueChange={(v) => setForecastMonths(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 Months</SelectItem>
                        <SelectItem value="6">6 Months</SelectItem>
                        <SelectItem value="12">12 Months</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={() => predictMutation.mutate(forecastMonths)}
                    disabled={predictMutation.isPending}
                  >
                    {predictMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <TrendingUp className="w-4 h-4 mr-2" />}
                    Generate Forecast
                  </Button>
                </div>

                {predictMutation.data?.prediction && (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600">Confidence Score</p>
                          <p className="text-2xl font-bold text-indigo-600">
                            {predictMutation.data.prediction.confidence_score}%
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Monthly Projections</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {predictMutation.data.prediction.forecast_months?.map((month, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div className="flex-1">
                                <p className="font-medium">{month.month}</p>
                                <p className="text-sm text-slate-600">Net: ₹{(month.net_cashflow / 100000).toFixed(2)}L</p>
                              </div>
                              <Badge className={getSeverityColor(month.risk_level)}>
                                {month.risk_level}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Key Insights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {predictMutation.data.prediction.key_insights?.map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Sparkles className="w-4 h-4 text-amber-500 mt-1 flex-shrink-0" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {predictMutation.data.prediction.recommendations?.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <TrendingUp className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Narrative Reports */}
          <TabsContent value="report">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Financial Narratives</CardTitle>
                <CardDescription>Convert numbers into executive-ready reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Report Type</label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Target Audience</label>
                    <Select value={reportAudience} onValueChange={setReportAudience}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cfo">CFO</SelectItem>
                        <SelectItem value="board">Board of Directors</SelectItem>
                        <SelectItem value="investor">Investors</SelectItem>
                        <SelectItem value="management">Management Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={() => narrativeMutation.mutate()}
                  disabled={narrativeMutation.isPending}
                  className="w-full"
                >
                  {narrativeMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  Generate Report
                </Button>

                {narrativeMutation.data?.report && (
                  <div className="space-y-4 mt-6">
                    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50">
                      <CardHeader>
                        <CardTitle>Executive Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-700 leading-relaxed">
                          {narrativeMutation.data.report.executive_summary}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Financial Highlights</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="font-medium text-slate-900 mb-1">Income</p>
                          <p className="text-slate-700">{narrativeMutation.data.report.financial_highlights?.income_summary}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 mb-1">Expenses</p>
                          <p className="text-slate-700">{narrativeMutation.data.report.financial_highlights?.expense_summary}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 mb-1">Net Position</p>
                          <p className="text-slate-700">{narrativeMutation.data.report.financial_highlights?.net_position_summary}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Detailed Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {narrativeMutation.data.report.detailed_analysis}
                        </p>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Concerns & Risks</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {narrativeMutation.data.report.concerns_and_risks?.map((concern, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-orange-500 mt-1 flex-shrink-0" />
                                <span className="text-sm">{concern}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Opportunities</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="space-y-2">
                            {narrativeMutation.data.report.opportunities?.map((opp, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-green-500 mt-1 flex-shrink-0" />
                                <span className="text-sm">{opp}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {narrativeMutation.data.report.recommendations?.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <TrendingUp className="w-4 h-4 text-indigo-500 mt-1 flex-shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Outlook</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-slate-700 leading-relaxed">
                          {narrativeMutation.data.report.outlook}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Anomaly Detection */}
          <TabsContent value="anomalies">
            <Card>
              <CardHeader>
                <CardTitle>AI Anomaly Detection</CardTitle>
                <CardDescription>Automatically identify unusual patterns and risks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => anomalyMutation.mutate()}
                  disabled={anomalyMutation.isPending}
                  className="w-full"
                >
                  {anomalyMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                  Scan for Anomalies
                </Button>

                {anomalyMutation.data?.detection && (
                  <div className="space-y-4 mt-6">
                    <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-red-900">Overall Risk Score</p>
                            <p className="text-3xl font-bold text-red-600">
                              {anomalyMutation.data.detection.overall_risk_score}/100
                            </p>
                          </div>
                          <AlertTriangle className="w-12 h-12 text-red-500" />
                        </div>
                        <p className="text-sm text-red-800 mt-2">
                          {anomalyMutation.data.detection.summary}
                        </p>
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      {anomalyMutation.data.detection.anomalies?.map((anomaly, idx) => (
                        <Card key={idx} className="border-l-4" style={{ borderLeftColor: 
                          anomaly.severity === 'critical' ? '#DC2626' : 
                          anomaly.severity === 'high' ? '#EA580C' : 
                          anomaly.severity === 'medium' ? '#F59E0B' : '#3B82F6'
                        }}>
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{anomaly.title}</CardTitle>
                                <CardDescription>{anomaly.type}</CardDescription>
                              </div>
                              <Badge className={getSeverityColor(anomaly.severity)}>
                                {anomaly.severity}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-slate-900">Description</p>
                              <p className="text-sm text-slate-700">{anomaly.description}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-900">Impact</p>
                              <p className="text-sm text-slate-700">{anomaly.impact}</p>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg">
                              <p className="text-sm font-medium text-blue-900">Recommended Action</p>
                              <p className="text-sm text-blue-800">{anomaly.recommended_action}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}