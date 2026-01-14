import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export default function TimeTracker({ 
  taskId, 
  estimatedHours = 0, 
  actualHours = 0, 
  onLogTime,
  subtasks = []
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const intervalRef = useRef(null);
  const startTimeRef = useRef(null);

  // Load saved timer state from localStorage
  useEffect(() => {
    const savedTimer = localStorage.getItem(`timer_${taskId}`);
    if (savedTimer) {
      const { startTime, accumulated } = JSON.parse(savedTimer);
      if (startTime) {
        startTimeRef.current = startTime;
        const elapsed = Math.floor((Date.now() - startTime) / 1000) + (accumulated || 0);
        setElapsedSeconds(elapsed);
        setIsRunning(true);
      } else if (accumulated) {
        setElapsedSeconds(accumulated);
      }
    }
  }, [taskId]);

  // Timer interval
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const savedTimer = localStorage.getItem(`timer_${taskId}`);
          const accumulated = savedTimer ? JSON.parse(savedTimer).accumulated || 0 : 0;
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulated;
          setElapsedSeconds(elapsed);
        }
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }

    return () => clearInterval(intervalRef.current);
  }, [isRunning, taskId]);

  const handleStart = () => {
    startTimeRef.current = Date.now();
    const savedTimer = localStorage.getItem(`timer_${taskId}`);
    const accumulated = savedTimer ? JSON.parse(savedTimer).accumulated || 0 : elapsedSeconds;
    
    localStorage.setItem(`timer_${taskId}`, JSON.stringify({
      startTime: startTimeRef.current,
      accumulated
    }));
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    localStorage.setItem(`timer_${taskId}`, JSON.stringify({
      startTime: null,
      accumulated: elapsedSeconds
    }));
    startTimeRef.current = null;
  };

  const handleStop = () => {
    setIsRunning(false);
    if (elapsedSeconds > 0) {
      setShowLogDialog(true);
    }
  };

  const handleLogTime = () => {
    const hours = elapsedSeconds / 3600;
    const newActual = actualHours + hours;
    onLogTime?.(parseFloat(newActual.toFixed(2)));
    
    // Reset timer
    setElapsedSeconds(0);
    localStorage.removeItem(`timer_${taskId}`);
    startTimeRef.current = null;
    setShowLogDialog(false);
  };

  const handleManualLog = () => {
    const hours = (parseFloat(manualHours) || 0) + (parseFloat(manualMinutes) || 0) / 60;
    if (hours > 0) {
      const newActual = actualHours + hours;
      onLogTime?.(parseFloat(newActual.toFixed(2)));
      setManualHours('');
      setManualMinutes('');
    }
  };

  const handleDiscard = () => {
    setElapsedSeconds(0);
    localStorage.removeItem(`timer_${taskId}`);
    startTimeRef.current = null;
    setShowLogDialog(false);
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate total subtask time (in hours)
  const subtaskHours = subtasks.reduce((total, subtask) => {
    return total + ((subtask.subtask_time_tracked || 0) / 60); // Convert minutes to hours
  }, 0);

  const totalLoggedHours = actualHours + subtaskHours;

  const progress = estimatedHours > 0 
    ? Math.min(((totalLoggedHours + elapsedSeconds / 3600) / estimatedHours) * 100, 100)
    : 0;

  const isOverEstimate = estimatedHours > 0 && (totalLoggedHours + elapsedSeconds / 3600) > estimatedHours;

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-600">Time Tracker</span>
          <div className={cn(
            "font-mono text-2xl font-bold",
            isRunning ? "text-emerald-600" : "text-slate-700"
          )}>
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="flex gap-2">
          {!isRunning ? (
            <Button 
              size="sm" 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleStart}
            >
              <Play className="w-4 h-4 mr-1" />
              Start
            </Button>
          ) : (
            <Button 
              size="sm" 
              variant="secondary"
              className="flex-1"
              onClick={handlePause}
            >
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleStop}
            disabled={elapsedSeconds === 0}
          >
            <Square className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Time Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Estimated</span>
          <span className="font-medium">{estimatedHours ? `${estimatedHours}h` : '-'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Logged</span>
          <div className="text-right">
            <span className={cn("font-medium block", isOverEstimate && "text-red-600")}>
              {totalLoggedHours > 0 ? `${totalLoggedHours.toFixed(1)}h` : '0h'}
            </span>
            {subtaskHours > 0 && (
              <span className="text-xs text-slate-400">
                ({actualHours.toFixed(1)}h task + {subtaskHours.toFixed(1)}h subtasks)
              </span>
            )}
          </div>
        </div>

        {estimatedHours > 0 && (
          <div className="space-y-1">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all",
                  isOverEstimate ? "bg-red-500" : "bg-indigo-500"
                )}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 text-right">
              {Math.round(progress)}% of estimate
            </div>
          </div>
        )}
      </div>

      {/* Manual Time Entry */}
      <div className="border-t pt-4">
        <span className="text-sm font-medium text-slate-600 block mb-2">Log Time Manually</span>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              min="0"
              placeholder="Hours"
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="flex-1">
            <Input
              type="number"
              min="0"
              max="59"
              placeholder="Minutes"
              value={manualMinutes}
              onChange={(e) => setManualMinutes(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleManualLog}
            disabled={!manualHours && !manualMinutes}
          >
            Log
          </Button>
        </div>
      </div>

      {/* Log Time Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center">
            <div className="text-4xl font-mono font-bold text-slate-900 mb-2">
              {formatTime(elapsedSeconds)}
            </div>
            <p className="text-slate-500">
              {(elapsedSeconds / 3600).toFixed(2)} hours will be logged
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleDiscard}>
              Discard
            </Button>
            <Button onClick={handleLogTime} className="bg-indigo-600 hover:bg-indigo-700">
              Log Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}