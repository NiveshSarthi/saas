import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Link as LinkIcon, Mail, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

export default function CustomFieldsForm({ 
  fields = [], 
  values = {}, 
  onChange,
  taskStatus 
}) {
  const handleFieldChange = (fieldKey, value) => {
    onChange({ ...values, [fieldKey]: value });
  };

  const renderField = (field) => {
    const value = values[field.field_key];
    const isRequired = field.required || field.required_in_states?.includes(taskStatus);

    switch (field.field_type) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Input
              value={value || ''}
              onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
              placeholder={`Enter ${field.name.toLowerCase()}`}
              required={isRequired}
            />
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => handleFieldChange(field.field_key, parseFloat(e.target.value) || '')}
              placeholder={`Enter ${field.name.toLowerCase()}`}
              required={isRequired}
            />
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !value && "text-slate-500"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {value ? format(new Date(value), 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={value ? new Date(value) : undefined}
                  onSelect={(date) => handleFieldChange(field.field_key, date ? format(date, 'yyyy-MM-dd') : '')}
                />
              </PopoverContent>
            </Popover>
          </div>
        );

      case 'dropdown':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Select 
              value={value || ''} 
              onValueChange={(v) => handleFieldChange(field.field_key, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(field.options || []).map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'multi_select':
        const selectedValues = value || [];
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <div className="flex flex-wrap gap-2 p-2 border rounded-lg min-h-[42px]">
              {selectedValues.map((v, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {v}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => handleFieldChange(
                      field.field_key, 
                      selectedValues.filter((_, idx) => idx !== i)
                    )}
                  />
                </Badge>
              ))}
              <Select 
                value="" 
                onValueChange={(v) => {
                  if (!selectedValues.includes(v)) {
                    handleFieldChange(field.field_key, [...selectedValues, v]);
                  }
                }}
              >
                <SelectTrigger className="w-auto border-0 shadow-none h-7 p-0 pl-2">
                  <Plus className="w-4 h-4 text-slate-400" />
                </SelectTrigger>
                <SelectContent>
                  {(field.options || [])
                    .filter(opt => !selectedValues.includes(opt))
                    .map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center gap-3">
            <Checkbox
              id={field.field_key}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.field_key, checked)}
            />
            <Label htmlFor={field.field_key} className="text-sm font-medium cursor-pointer">
              {field.name}
            </Label>
          </div>
        );

      case 'url':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="url"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                placeholder="https://example.com"
                className="pl-10"
                required={isRequired}
              />
            </div>
          </div>
        );

      case 'email':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="text-sm font-medium">
              {field.name} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="email"
                value={value || ''}
                onChange={(e) => handleFieldChange(field.field_key, e.target.value)}
                placeholder="email@example.com"
                className="pl-10"
                required={isRequired}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Custom Fields</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map(renderField)}
      </div>
    </div>
  );
}