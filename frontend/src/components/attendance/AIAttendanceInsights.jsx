import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Clock, 
  Calendar,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function AIAttendanceInsights({ records, selectedMonth, allUsers, isAdmin }) {
  const [analyzing, setAnalyzing] = useState(false);

  const { data: insights, refetch, isLoading } = useQuery({
    queryKey: ['ai-attendance-insights', format(selectedMonth, 'yyyy-MM')],
    queryFn: async () => {
      setAnalyzing(true);
      try {
        // Prepare data for analysis
        const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
        const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
        
        // Calculate statistics
        const totalRecords = records.length;
        const lateArrivals = records.filter(r => r.is_late).length;
        const earlyCheckouts = records.filter(r => r.is_early_checkout).length;
        const absentCount = records.filter(r => r.status === 'absent').length;
        const leaveCount = records.filter(r => r.status === 'leave' || r.status === 'sick_leave' || r.status === 'casual_leave').length;
        
        // User-level analysis
        const userStats = {};
        records.forEach(record => {
          if (!userStats[record.user_email]) {
            userStats[record.user_email] = {
              email: record.user_email,
              name: record.user_name || record.user_email,
              totalDays: 0,
              presentDays: 0,
              lateDays: 0,
              earlyCheckouts: 0,
              totalHours: 0,
              absentDays: 0,
              leaveDays: 0
            };
          }
          
          const user = userStats[record.user_email];
          user.totalDays++;
          
          if (record.status === 'present' || record.status === 'checked_out') {
            user.presentDays++;
          }
          if (record.status === 'absent') {
            user.absentDays++;
          }
          if (record.status === 'leave' || record.status === 'sick_leave' || record.status === 'casual_leave') {
            user.leaveDays++;
          }
          if (record.is_late) {
            user.lateDays++;
          }
          if (record.is_early_checkout) {
            user.earlyCheckouts++;
          }
          if (record.total_hours) {
            user.totalHours += record.total_hours;
          }
        });

        const userArray = Object.values(userStats);
        
        // Identify concerning patterns
        const frequentLateArrivers = userArray
          .filter(u => u.lateDays >= 3)
          .map(u => ({ name: u.name, lateDays: u.lateDays }));
        
        const frequentAbsentees = userArray
          .filter(u => u.absentDays >= 2)
          .map(u => ({ name: u.name, absentDays: u.absentDays }));
        
        const lowWorkHours = userArray
          .filter(u => u.presentDays > 0 && (u.totalHours / u.presentDays) < 7)
          .map(u => ({ name: u.name, avgHours: (u.totalHours / u.presentDays).toFixed(1) }));

        // Call LLM for insights
        const prompt = `Analyze this attendance data for ${format(selectedMonth, 'MMMM yyyy')} and provide actionable insights:

Period: ${monthStart} to ${monthEnd}
Total Records: ${totalRecords}
Late Arrivals: ${lateArrivals}
Early Checkouts: ${earlyCheckouts}
Absences: ${absentCount}
Leave Days: ${leaveCount}

Team Members: ${allUsers.length}
Attendance Records: ${records.length}

Patterns Detected:
- Frequent Late Arrivers: ${frequentLateArrivers.length} employees (${frequentLateArrivers.map(u => `${u.name}: ${u.lateDays} times`).join(', ')})
- Frequent Absentees: ${frequentAbsentees.length} employees (${frequentAbsentees.map(u => `${u.name}: ${u.absentDays} days`).join(', ')})
- Low Average Hours: ${lowWorkHours.length} employees (${lowWorkHours.map(u => `${u.name}: ${u.avgHours}h/day`).join(', ')})

Provide:
1. Key patterns and trends
2. Potential attendance issues to watch
3. Predictions for next month
4. Team punctuality score (0-100)
5. Productivity score (0-100)
6. 3 specific recommendations`;

        const response = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              patterns: {
                type: "array",
                items: { type: "string" },
                description: "Key patterns identified in attendance"
              },
              issues: {
                type: "array",
                items: { type: "string" },
                description: "Potential issues to watch"
              },
              predictions: {
                type: "array",
                items: { type: "string" },
                description: "Predictions for next month"
              },
              punctuality_score: {
                type: "number",
                description: "Team punctuality score 0-100"
              },
              productivity_score: {
                type: "number",
                description: "Team productivity score 0-100"
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "Specific actionable recommendations"
              }
            }
          }
        });

        return {
          ...response,
          statistics: {
            totalRecords,
            lateArrivals,
            earlyCheckouts,
            absentCount,
            leaveCount,
            frequentLateArrivers,
            frequentAbsentees,
            lowWorkHours
          }
        };
      } finally {
        setAnalyzing(false);
      }
    },
    enabled: isAdmin && records.length > 0,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  const handleRefresh = () => {
    refetch();
  };

  if (!isAdmin) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreIcon = (score) => {
    if (score >= 80) return <CheckCircle2 className="w-5 h-5" />;
    if (score >= 60) return <AlertTriangle className="w-5 h-5" />;
    return <XCircle className="w-5 h-5" />;
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            <span>AI Attendance Insights</span>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              <Sparkles className="w-3 h-3 mr-1" />
              Powered by AI
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={analyzing || isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${(analyzing || isLoading) ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {(analyzing || isLoading) && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Analyzing attendance data...</p>
            </div>
          </div>
        )}

        {!analyzing && !isLoading && insights && (
          <>
            {/* Scores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg border ${getScoreColor(insights.punctuality_score)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold">Punctuality Score</span>
                  </div>
                  {getScoreIcon(insights.punctuality_score)}
                </div>
                <div className="text-3xl font-bold">{insights.punctuality_score}/100</div>
              </div>

              <div className={`p-4 rounded-lg border ${getScoreColor(insights.productivity_score)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">Productivity Score</span>
                  </div>
                  {getScoreIcon(insights.productivity_score)}
                </div>
                <div className="text-3xl font-bold">{insights.productivity_score}/100</div>
              </div>
            </div>

            {/* Patterns */}
            {insights.patterns && insights.patterns.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Attendance Patterns</span>
                </div>
                <ul className="space-y-2">
                  {insights.patterns.map((pattern, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues to Watch */}
            {insights.issues && insights.issues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span>Issues to Watch</span>
                </div>
                <ul className="space-y-2">
                  {insights.issues.map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-orange-50 p-2 rounded border border-orange-200">
                      <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Predictions */}
            {insights.predictions && insights.predictions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span>Next Month Predictions</span>
                </div>
                <ul className="space-y-2">
                  {insights.predictions.map((prediction, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-blue-50 p-2 rounded border border-blue-200">
                      <span className="text-blue-600 mt-0.5">→</span>
                      <span>{prediction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {insights.recommendations && insights.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Recommended Actions</span>
                </div>
                <ul className="space-y-2">
                  {insights.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 bg-purple-50 p-3 rounded border border-purple-200">
                      <span className="bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Statistics Summary */}
            {insights.statistics && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t">
                <div className="text-center p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Late Arrivals</div>
                  <div className="text-xl font-bold text-slate-900">{insights.statistics.lateArrivals}</div>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Early Checkouts</div>
                  <div className="text-xl font-bold text-slate-900">{insights.statistics.earlyCheckouts}</div>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded">
                  <div className="text-xs text-slate-500">Absences</div>
                  <div className="text-xl font-bold text-slate-900">{insights.statistics.absentCount}</div>
                </div>
              </div>
            )}
          </>
        )}

        {!analyzing && !isLoading && !insights && records.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-2 text-slate-400" />
            <p>No attendance data available for analysis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}