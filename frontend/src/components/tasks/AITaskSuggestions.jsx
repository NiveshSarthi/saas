import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AITaskSuggestions({ 
  projectData, 
  currentTitle, 
  currentDescription,
  currentTags = [],
  onApplyTitle, 
  onApplyDescription,
  onApplyTag,
  existingTasks = []
}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('aiTaskAssistant', {
        action: 'suggest_task_details',
        project_name: projectData?.name,
        project_domain: projectData?.domain,
        current_title: currentTitle,
        current_description: currentDescription,
        current_tags: currentTags,
        existing_tasks: existingTasks.slice(0, 10).map(t => ({
          title: t.title,
          description: t.description,
          tags: t.tags
        }))
      });

      if (response.data?.suggestions) {
        setSuggestions(response.data.suggestions);
        setExpanded(true);
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!suggestions && !loading) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <div>
              <h4 className="font-medium text-purple-900">AI Task Assistant</h4>
              <p className="text-sm text-purple-600">Get intelligent suggestions for your task</p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={fetchSuggestions}
            className="bg-white hover:bg-purple-50 border-purple-200"
            disabled={loading}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Get Suggestions
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-purple-600 animate-spin" />
          <span className="text-sm text-purple-700">AI is analyzing your project and generating suggestions...</span>
        </div>
      </div>
    );
  }

  if (!suggestions) return null;

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <span className="font-medium text-purple-900">AI Suggestions Available</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-purple-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-purple-600" />
        )}
      </button>

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Title Suggestions */}
          {suggestions.titles && suggestions.titles.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-purple-900 mb-2">Suggested Titles</h5>
              <div className="space-y-2">
                {suggestions.titles.map((title, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-200 hover:border-purple-300 transition-colors"
                  >
                    <span className="text-sm text-slate-700 flex-1">{title}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onApplyTitle(title);
                        setExpanded(false);
                      }}
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description Suggestions */}
          {suggestions.descriptions && suggestions.descriptions.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-purple-900 mb-2">Suggested Descriptions</h5>
              <div className="space-y-2">
                {suggestions.descriptions.map((desc, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col bg-white rounded-lg p-3 border border-purple-200 hover:border-purple-300 transition-colors"
                  >
                    <p className="text-sm text-slate-700 mb-2 flex-1">{desc}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onApplyDescription(desc);
                        setExpanded(false);
                      }}
                      className="self-end text-purple-600 hover:text-purple-700 hover:bg-purple-100"
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tag Suggestions */}
          {suggestions.tags && suggestions.tags.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-purple-900 mb-2">Suggested Tags</h5>
              <div className="flex flex-wrap gap-2">
                {suggestions.tags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className={cn(
                      "cursor-pointer hover:bg-purple-100 transition-colors",
                      currentTags.includes(tag) 
                        ? "bg-purple-100 border-purple-300 text-purple-700" 
                        : "bg-white border-purple-200 text-slate-700"
                    )}
                    onClick={() => {
                      if (!currentTags.includes(tag)) {
                        onApplyTag(tag);
                      }
                    }}
                  >
                    {tag}
                    {!currentTags.includes(tag) && (
                      <Sparkles className="w-3 h-3 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning */}
          {suggestions.reasoning && (
            <div className="text-xs text-purple-600 bg-purple-50 rounded p-2 border border-purple-100">
              <span className="font-medium">AI Insight: </span>
              {suggestions.reasoning}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchSuggestions}
            className="w-full text-purple-600 hover:text-purple-700 hover:bg-purple-100"
          >
            <Sparkles className="w-3 h-3 mr-2" />
            Refresh Suggestions
          </Button>
        </div>
      )}
    </div>
  );
}