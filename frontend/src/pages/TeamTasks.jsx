import React from 'react';
import TeamTasksView from '@/components/tasks/TeamTasksView';
import { Users, Sparkles, Target } from 'lucide-react';

export default function TeamTasks() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-3">
          <Users className="w-10 h-10 text-indigo-600" />
          Tasks
        </h1>
        <p className="text-slate-600 mt-2 flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-500" />
          Comprehensive overview of all tasks and workload distribution
        </p>
      </div>
      <TeamTasksView />
    </div>
  );
}