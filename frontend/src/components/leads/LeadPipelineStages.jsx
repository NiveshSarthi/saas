import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Lock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function LeadPipelineStages({ stages, currentStage, onStageClick, isLost, onMarkAsLost, onMarkAsCold }) {
  const currentIndex = stages.findIndex(s => s.key === currentStage);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 flex-wrap pb-2">
        {stages.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isNext = index === currentIndex + 1;
          const isLocked = index > currentIndex + 1;
          const canClick = isNext && !isLost;

          return (
            <TooltipProvider key={stage.key}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => canClick && onStageClick(stage)}
                    disabled={!canClick || isLost}
                    className={cn(
                      "flex-1 min-w-[100px] relative px-4 py-3 rounded-xl border-2 transition-all",
                      "flex flex-col items-center justify-center gap-2",
                      isCompleted && "bg-green-50 border-green-500",
                      isCurrent && "bg-blue-50 border-blue-500 ring-2 ring-blue-200",
                      !isCompleted && !isCurrent && "bg-slate-50 border-slate-200",
                      canClick && "hover:border-blue-400 hover:bg-blue-50 cursor-pointer",
                      isLocked && "opacity-50 cursor-not-allowed",
                      isLost && "opacity-30 cursor-not-allowed"
                    )}
                  >
                    {/* Stage Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        isCompleted && "bg-green-500 text-white",
                        isCurrent && "bg-blue-500 text-white",
                        !isCompleted && !isCurrent && "bg-slate-300 text-slate-600",
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <span className="text-xs font-bold">{index + 1}</span>
                      )}
                    </div>

                    {/* Stage Label */}
                    <div className="text-center">
                      <div
                        className={cn(
                          "text-xs font-medium",
                          isCompleted && "text-green-700",
                          isCurrent && "text-blue-700",
                          !isCompleted && !isCurrent && "text-slate-600"
                        )}
                      >
                        {stage.label}
                      </div>
                    </div>

                    {/* Current Indicator */}
                    {isCurrent && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isLocked ? (
                    <p>Complete previous stages to unlock</p>
                  ) : canClick ? (
                    <p>Click to move to {stage.label}</p>
                  ) : isCompleted ? (
                    <p>Completed ✓</p>
                  ) : isCurrent ? (
                    <p>Current stage</p>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}