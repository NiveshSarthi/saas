import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';
import { format } from 'date-fns';

export default function FilterChips({ filters = {}, onRemoveFilter, onClearAll, moduleConfig }) {
  const getFilterLabel = (field, value) => {
    const filterConfig = moduleConfig?.filters?.find(f => f.field === field);
    if (!filterConfig) return null;

    if (Array.isArray(value) && value.length === 0) return null;
    if (!value) return null;

    let displayValue = value;

    // Handle different value types
    if (Array.isArray(value)) {
      if (filterConfig.type === 'user_select' || filterConfig.type === 'assignee') {
        displayValue = `${value.length} user${value.length > 1 ? 's' : ''}`;
      } else if (filterConfig.options) {
        const labels = value.map(v => {
          const opt = filterConfig.options.find(o => o.value === v);
          return opt?.label || v;
        }).join(', ');
        displayValue = labels.length > 30 ? `${value.length} selected` : labels;
      } else {
        displayValue = value.join(', ');
      }
    } else if (typeof value === 'object' && value !== null) {
      // Handle date range or number range
      if (value.start && value.end) {
        displayValue = `${format(new Date(value.start), 'MMM d')} - ${format(new Date(value.end), 'MMM d')}`;
      } else if (value.min || value.max) {
        displayValue = `${value.min || '0'} - ${value.max || '∞'}`;
      }
    } else if (filterConfig.options) {
      const opt = filterConfig.options.find(o => o.value === value);
      displayValue = opt?.label || value;
    }

    return {
      label: filterConfig.label,
      value: displayValue
    };
  };

  const activeFilters = Object.entries(filters).filter(([_, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v);
    }
    return value !== '' && value !== null && value !== undefined;
  });

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-1 text-sm text-blue-900 font-medium">
        <Filter className="w-4 h-4" />
        <span>Filters:</span>
      </div>
      {activeFilters.map(([field, value]) => {
        const filterInfo = getFilterLabel(field, value);
        if (!filterInfo) return null;

        return (
          <Badge
            key={field}
            variant="secondary"
            className="gap-1 bg-white border-blue-200 text-blue-900"
          >
            <span className="font-medium">{filterInfo.label}:</span>
            <span>{filterInfo.value}</span>
            <button
              onClick={() => onRemoveFilter(field)}
              className="ml-1 hover:bg-blue-100 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        );
      })}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearAll}
        className="h-7 text-blue-700 hover:text-blue-900 hover:bg-blue-100"
      >
        Clear All
      </Button>
    </div>
  );
}