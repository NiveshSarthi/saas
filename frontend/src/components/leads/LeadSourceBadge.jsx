import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Globe, Facebook, Instagram, Phone, Users, Building } from 'lucide-react';

const SOURCE_CONFIG = {
  website: { icon: Globe, label: 'Website', color: 'bg-blue-100 text-blue-700' },
  facebook: { icon: Facebook, label: 'Facebook', color: 'bg-blue-600 text-white' },
  instagram: { icon: Instagram, label: 'Instagram', color: 'bg-pink-500 text-white' },
  referral: { icon: Users, label: 'Referral', color: 'bg-green-100 text-green-700' },
  walkin: { icon: Building, label: 'Walk-in', color: 'bg-purple-100 text-purple-700' },
  call: { icon: Phone, label: 'Phone Call', color: 'bg-amber-100 text-amber-700' },
};

export default function LeadSourceBadge({ source }) {
  if (!source) return null;
  
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG.website;
  const Icon = config.icon;
  
  return (
    <Badge variant="outline" className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}