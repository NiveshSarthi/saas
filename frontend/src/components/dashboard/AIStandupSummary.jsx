import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, CheckCircle2, Wrench, AlertCircle, ArrowRight, Lightbulb, Users } from 'lucide-react';

export default function AIStandupSummary({ user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'team'

  const { data: myTasks = [] } = useQuery({
    queryKey: ['my-tasks-standup', user?.email],
    queryFn: async () => {
      const tasks = await base44.entities.Task.filter({
        assignees: user?.email
      }, '-updated_date', 50);
      return tasks;
    },
    enabled: !!user?.email
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['team-tasks-standup'],
    queryFn: async () => {
      const tasks = await base44.entities.Task.list('-updated_date', 100);
      return tasks;
    },
    enabled: viewMode === 'team'
  });

  const { data: teamData } = useQuery({
    queryKey: ['team-members-standup'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
    enabled: viewMode === 'team'
  });

  const teamMembers = [
    ...(teamData?.users || []),
    ...(teamData?.invitations || [])
      .filter(inv => inv.status === 'accepted')
      .map(inv => ({
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0]
      }))
  ];

  const generateSummary = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('aiTaskAssistant', {
        action: viewMode === 'personal' ? 'generate_standup' : 'generate_team_standup',
        tasks: viewMode === 'personal' ? myTasks : allTasks,
        teamMembers: viewMode === 'team' ? teamMembers : undefined
      });
      
      setSummary(response.data);
    } catch (err) {
      console.error('Failed to generate standup:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <CardTitle className="text-lg">AI Daily Standup</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'personal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('personal');
                setSummary(null);
              }}
            >
              My Tasks
            </Button>
            <Button
              variant={viewMode === 'team' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setViewMode('team');
                setSummary(null);
              }}
            >
              <Users className="w-3 h-3 mr-1" />
              Team
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary ? (
          <div className="text-center py-8">
            <p className="text-slate-600 mb-4">
              {viewMode === 'personal' 
                ? 'Generate an AI-powered summary of your daily tasks'
                : 'Generate a team-wide standup summary with insights'}
            </p>
            <Button onClick={generateSummary} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Standup Summary
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {viewMode === 'personal' ? (
              <div className="space-y-4">
                {summary.completed && (
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-slate-900">Completed</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{summary.completed}</p>
                  </div>
                )}

                {summary.in_progress && (
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-slate-900">In Progress</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{summary.in_progress}</p>
                  </div>
                )}

                {summary.blockers && summary.blockers !== 'None' && (
                  <div className="bg-white rounded-lg p-3 border-l-4 border-red-500">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="font-medium text-slate-900">Blockers</span>
                    </div>
                    <p className="text-sm text-red-600 whitespace-pre-line">{summary.blockers}</p>
                  </div>
                )}

                {summary.next && (
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRight className="w-4 h-4 text-indigo-600" />
                      <span className="font-medium text-slate-900">Next Up</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{summary.next}</p>
                  </div>
                )}

                {summary.notes && (
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span className="font-medium text-slate-900">Notes</span>
                    </div>
                    <p className="text-sm text-slate-600 whitespace-pre-line">{summary.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-2">Team Summary</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{summary.summary}</p>
                </div>

                {summary.achievements && summary.achievements.length > 0 && (
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Team Achievements
                    </h4>
                    <ul className="space-y-1">
                      {summary.achievements.map((achievement, idx) => (
                        <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span>{achievement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.blockers && Array.isArray(summary.blockers) && summary.blockers.length > 0 && (
                  <div className="bg-white rounded-lg p-4 border-l-4 border-red-500">
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      Team Blockers
                    </h4>
                    <ul className="space-y-1">
                      {summary.blockers.map((blocker, idx) => (
                        <li key={idx} className="text-sm text-red-600 flex items-start gap-2">
                          <span>⚠️</span>
                          <span>{blocker}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.health_score && (
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-2">Team Health</h4>
                    <p className="text-sm text-slate-600">{summary.health_score}</p>
                  </div>
                )}

                {summary.action_items && summary.action_items.length > 0 && (
                  <div className="bg-white rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-indigo-600" />
                      Action Items
                    </h4>
                    <ul className="space-y-1">
                      {summary.action_items.map((item, idx) => (
                        <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                          <span className="text-indigo-600">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateSummary}
              className="w-full mt-4"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Regenerate
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}