// @ts-nocheck
import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function FilterChips({ filters, onRemoveFilter, onClearAll, moduleConfig }) {
  const getFilterLabel = (field, value) => {
    const filterConfig = moduleConfig?.filters?.find(f => f.field === field);
    if (!filterConfig) return `${field}: ${value}`;

    // Handle different value types
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      if (value.length === 1) {
        if (filterConfig.type === 'assignee' || filterConfig.type === 'user_select') {
          return `${filterConfig.label}: ${value[0]}`;
        }
        const option = filterConfig.options?.find(o => o.value === value[0]);
        return `${filterConfig.label}: ${option?.label || value[0]}`;
      }
      return `${filterConfig.label}: ${value.length} selected`;
    }

    if (typeof value === 'object' && value !== null) {
      if (value.start && value.end) {
        return `${filterConfig.label}: ${value.start} to ${value.end}`;
      }
      if (value.min !== undefined || value.max !== undefined) {
        return `${filterConfig.label}: ${value.min || '0'} - ${value.max || '∞'}`;
      }
    }

    if (filterConfig.type === 'date_preset') {
      return `${filterConfig.label}: ${value}`;
    }

    return `${filterConfig.label}: ${value}`;
  };

  const activeFilters = Object.entries(filters).map(([field, value]) => {
    const label = getFilterLabel(field, value);
    if (!label) return null;

    return {
      field,
      label,
      value
    };
  }).filter(Boolean);

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-slate-600">Active filters:</span>
      {activeFilters.map(({ field, label }) => (
        <Badge key={field} variant="secondary" className="flex items-center gap-1">
          {label}
          <button
            onClick={() => onRemoveFilter(field)}
            className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="text-slate-600 hover:text-slate-900 h-6 px-2 text-xs"
      >
        Clear all
      </Button>
    </div>
  );
}