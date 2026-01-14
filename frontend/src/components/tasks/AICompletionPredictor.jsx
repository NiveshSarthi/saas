import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Clock, AlertTriangle } from 'lucide-react';

export default function AICompletionPredictor({ taskData, tasks }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPrediction = async () => {
    if (!taskData.title) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('aiTaskAssistant', {
        action: 'predict_completion',
        taskData,
        tasks
      });
      
      setPrediction(response.data);
    } catch (err) {
      setError('Failed to predict completion time');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-slate-700">AI Completion Prediction</span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={getPrediction}
          disabled={loading || !taskData.title}
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              Predict Time
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {prediction && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-600">Predicted Completion Time</div>
              <div className="text-2xl font-bold text-indigo-900">
                {prediction.predicted_hours} hours
              </div>
            </div>
            <Badge 
              variant={prediction.confidence === 'high' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {prediction.confidence} confidence
            </Badge>
          </div>

          {prediction.factors && prediction.factors.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-700 mb-1">Key Factors:</div>
              <ul className="space-y-1">
                {prediction.factors.map((factor, idx) => (
                  <li key={idx} className="text-xs text-slate-600 flex items-start gap-1">
                    <span className="text-indigo-600 mt-0.5">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prediction.risks && prediction.risks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-orange-700 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Risk Factors:
              </div>
              <ul className="space-y-1">
                {prediction.risks.map((risk, idx) => (
                  <li key={idx} className="text-xs text-orange-600 flex items-start gap-1">
                    <span className="mt-0.5">⚠️</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}