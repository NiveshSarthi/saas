import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Flame, Droplet, Snowflake } from 'lucide-react';

export function calculateLeadScore(lead) {
  let score = 0;
  
  // Budget score
  if (lead.budget) {
    const budgetNum = parseInt(lead.budget.replace(/\D/g, ''));
    if (budgetNum > 7000000) score += 25;
    else if (budgetNum > 5000000) score += 20;
    else if (budgetNum > 3000000) score += 15;
    else score += 10;
  }
  
  // Timeline urgency
  if (lead.timeline === 'immediate') score += 25;
  else if (lead.timeline === 'short') score += 20;
  else if (lead.timeline === 'medium') score += 10;
  
  // Engagement
  if (lead.last_contact_date) score += 15;
  if (lead.status && lead.status !== 'new') score += 15;
  
  // Activity recency
  if (lead.last_activity) {
    const daysSince = (new Date() - new Date(lead.last_activity)) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) score += 10;
    else if (daysSince < 3) score += 5;
  }
  
  // Penalties
  if (lead.is_cold) score -= 30;
  if (lead.status === 'lost') score = 0;
  
  return Math.max(0, Math.min(100, score));
}

export function getLeadTemperature(score) {
  if (score >= 70) return { label: 'Hot', color: 'bg-red-500', icon: Flame, textColor: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
  if (score >= 40) return { label: 'Warm', color: 'bg-amber-500', icon: Droplet, textColor: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' };
  return { label: 'Cold', color: 'bg-blue-400', icon: Snowflake, textColor: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' };
}

export default function LeadScoreBadge({ lead, showLabel = false }) {
  const score = calculateLeadScore(lead);
  const temp = getLeadTemperature(score);
  const Icon = temp.icon;
  
  return (
    <Badge 
      variant="outline"
      className={cn("text-xs font-medium", temp.bgColor, temp.textColor, temp.borderColor)}
    >
      <Icon className="w-3 h-3 mr-1" />
      {showLabel && temp.label}
      {score}
    </Badge>
  );
}