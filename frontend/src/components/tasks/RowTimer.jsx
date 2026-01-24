import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function RowTimer({
    uniqueKey,
    onSave,
    disabled = false,
    initialSeconds = 0
}) {
    const [isRunning, setIsRunning] = useState(false);
    const [seconds, setSeconds] = useState(initialSeconds);
    const intervalRef = useRef(null);
    const startTimeRef = useRef(null);

    // Load saved state from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(`row_timer_${uniqueKey}`);
        if (saved) {
            const { startTime, accumulated } = JSON.parse(saved);
            if (startTime) {
                startTimeRef.current = startTime;
                const elapsed = Math.floor((Date.now() - startTime) / 1000) + (accumulated || 0);
                setSeconds(elapsed);
                setIsRunning(true);
            } else if (accumulated) {
                setSeconds(accumulated);
            }
        }
    }, [uniqueKey]);

    // Timer interval logic
    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                if (startTimeRef.current) {
                    const saved = localStorage.getItem(`row_timer_${uniqueKey}`);
                    const accumulated = saved ? JSON.parse(saved).accumulated || 0 : 0;
                    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + accumulated;
                    setSeconds(elapsed);
                }
            }, 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, uniqueKey]);

    const handleToggle = (e) => {
        e.stopPropagation();
        if (isRunning) {
            // Pause
            setIsRunning(false);
            localStorage.setItem(`row_timer_${uniqueKey}`, JSON.stringify({
                startTime: null,
                accumulated: seconds
            }));
            startTimeRef.current = null;
        } else {
            // Start
            startTimeRef.current = Date.now();
            const saved = localStorage.getItem(`row_timer_${uniqueKey}`);
            const accumulated = saved ? JSON.parse(saved).accumulated || 0 : seconds;

            localStorage.setItem(`row_timer_${uniqueKey}`, JSON.stringify({
                startTime: startTimeRef.current,
                accumulated
            }));
            setIsRunning(true);
        }
    };

    const handleReset = (e) => {
        e.stopPropagation();
        setIsRunning(false);
        setSeconds(0);
        localStorage.removeItem(`row_timer_${uniqueKey}`);
        startTimeRef.current = null;
    };

    const handleSave = (e) => {
        e.stopPropagation();
        if (seconds < 60) {
            toast.error('Minimum 1 minute is required to log time.');
            return;
        }

        const hours = parseFloat((seconds / 3600).toFixed(2));
        onSave?.(hours);

        // Clear timer after save
        handleReset(e);
    };

    const formatTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    if (disabled) return null;

    return (
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-sm group/timer">
            <div className={cn(
                "font-mono text-sm font-bold min-w-[65px] text-center",
                isRunning ? "text-indigo-600 animate-pulse" : "text-slate-500"
            )}>
                {formatTime(seconds)}
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 pl-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-7 w-7 rounded-full",
                        isRunning ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50"
                    )}
                    onClick={handleToggle}
                    title={isRunning ? "Pause" : "Start"}
                >
                    {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </Button>

                {seconds > 0 && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50"
                            onClick={handleSave}
                            title="Save to Timesheet"
                        >
                            <Save className="w-4 h-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover/timer:opacity-100 transition-opacity"
                            onClick={handleReset}
                            title="Reset"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
