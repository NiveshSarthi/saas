import React from 'react';
import { AlertCircle, Phone, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function NextActionSuggestion({ lead }) {
  const getNextAction = () => {
    if (lead.status === 'lost') return null;
    if (lead.status === 'closed_won') {
      return { text: 'Deal Won! 🎉', icon: CheckCircle2, color: 'bg-green-50 text-green-700 border-green-200' };
    }
    
    // Check follow-up
    if (lead.next_follow_up) {
      const followUpDate = new Date(lead.next_follow_up);
      const today = new Date();
      const isOverdue = followUpDate < today;
      const isToday = followUpDate.toDateString() === today.toDateString();
      
      if (isOverdue) {
        return { text: 'Follow-up Overdue!', icon: AlertCircle, color: 'bg-red-50 text-red-700 border-red-200', urgent: true };
      }
      if (isToday) {
        return { text: 'Follow-up Today', icon: Calendar, color: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
    }
    
    // Check last contact
    if (!lead.last_contact_date && lead.status === 'new') {
      return { text: 'Make First Contact', icon: Phone, color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    
    if (lead.last_activity) {
      const daysSince = (new Date() - new Date(lead.last_activity)) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        return { text: 'Re-engage (7+ days)', icon: AlertCircle, color: 'bg-orange-50 text-orange-700 border-orange-200' };
      }
    }
    
    // Stage-based suggestions
    if (lead.status === 'contacted') {
      return { text: 'Move to Screening', icon: ArrowRight, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    if (lead.status === 'screening') {
      return { text: 'Qualify Lead', icon: ArrowRight, color: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    
    return { text: 'Continue Pipeline', icon: ArrowRight, color: 'bg-slate-50 text-slate-700 border-slate-200' };
  };
  
  const action = getNextAction();
  if (!action) return null;
  
  const Icon = action.icon;
  
  return (
    <Badge 
      variant="outline"
      className={cn(
        "text-xs font-medium flex items-center gap-1",
        action.color,
        action.urgent && "animate-pulse"
      )}
    >
      <Icon className="w-3 h-3" />
      {action.text}
    </Badge>
  );
}