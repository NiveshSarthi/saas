import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AIAssigneeSuggestions({ 
  taskData, 
  teamMembers, 
  tasks, 
  onSelectAssignee,
  selectedAssignees = []
}) {
  const [suggestions, setSuggestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getSuggestions = async () => {
    if (!taskData.title || teamMembers.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('aiTaskAssistant', {
        action: 'suggest_assignees',
        taskData,
        teamMembers,
        tasks
      });
      
      setSuggestions(response.data.suggestions);
    } catch (err) {
      setError('Failed to get AI suggestions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!taskData.title) {
    return (
      <div className="text-sm text-slate-500 italic">
        Enter a task title to get AI assignee suggestions
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-slate-700">AI Suggestions</span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={getSuggestions}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              Get Suggestions
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((suggestion, idx) => {
            const isSelected = selectedAssignees.includes(suggestion.email);
            return (
              <div
                key={idx}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                  isSelected ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"
                )}
                onClick={() => onSelectAssignee(suggestion.email)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                      <span className="font-medium text-slate-900">{suggestion.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.confidence} confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{suggestion.reason}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}