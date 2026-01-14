import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Repeat, Calendar, Info } from 'lucide-react';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
];

const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, i) => i + 1);

export default function RecurringTaskForm({ formData, setFormData, isEditing = false }) {
  const handleRecurringChange = (checked) => {
    setFormData(prev => ({
      ...prev,
      is_recurring: checked,
      recurrence_type: checked ? 'daily' : null,
      recurrence_day_of_week: null,
      recurrence_day_of_month: null
    }));
  };

  const handleRecurrenceTypeChange = (type) => {
    setFormData(prev => ({
      ...prev,
      recurrence_type: type,
      recurrence_day_of_week: type === 'weekly' ? 1 : null,
      recurrence_day_of_month: type === 'monthly' ? 1 : null
    }));
  };

  if (isEditing && formData.is_recurring_instance) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">This is a recurring task instance</p>
            <p className="text-xs text-amber-700 mt-1">
              This task is part of a recurring series. Changes will only apply to this instance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg">
            <Repeat className="w-5 h-5 text-white" />
          </div>
          <div>
            <Label className="text-base font-semibold text-indigo-900">Recurring Task</Label>
            <p className="text-xs text-indigo-700 mt-0.5">
              Task will automatically regenerate based on schedule
            </p>
          </div>
        </div>
        <Switch
          checked={formData.is_recurring || false}
          onCheckedChange={handleRecurringChange}
        />
      </div>

      {formData.is_recurring && (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-slate-900">Recurrence Pattern</Label>
            <Select 
              value={formData.recurrence_type || 'daily'} 
              onValueChange={handleRecurrenceTypeChange}
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Daily - Repeats every day
                  </div>
                </SelectItem>
                <SelectItem value="weekly">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    Weekly - Repeats on specific weekday
                  </div>
                </SelectItem>
                <SelectItem value="monthly">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-500" />
                    Monthly - Repeats on specific date
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.recurrence_type === 'weekly' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-900">Day of Week</Label>
              <Select 
                value={String(formData.recurrence_day_of_week || 1)} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, recurrence_day_of_week: parseInt(val) }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={String(day.value)}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.recurrence_type === 'monthly' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-900">Day of Month</Label>
              <Select 
                value={String(formData.recurrence_day_of_month || 1)} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, recurrence_day_of_month: parseInt(val) }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_MONTH.map(day => (
                    <SelectItem key={day} value={String(day)}>
                      {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="p-3 bg-white rounded-lg border border-indigo-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-slate-700">
                <p className="font-medium text-slate-900 mb-1">How it works:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Task will appear as active on scheduled days</li>
                  <li>Marking done completes only that instance</li>
                  <li>Next occurrence automatically regenerates</li>
                  <li>View completion history in task details</li>
                </ul>
              </div>
            </div>
          </div>

          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-300">
            <Repeat className="w-3 h-3 mr-1" />
            {formData.recurrence_type === 'daily' && 'Recurring: Daily'}
            {formData.recurrence_type === 'weekly' && `Recurring: Weekly (${DAYS_OF_WEEK.find(d => d.value === formData.recurrence_day_of_week)?.label || 'Monday'})`}
            {formData.recurrence_type === 'monthly' && `Recurring: Monthly (${formData.recurrence_day_of_month || 1}${formData.recurrence_day_of_month === 1 ? 'st' : formData.recurrence_day_of_month === 2 ? 'nd' : formData.recurrence_day_of_month === 3 ? 'rd' : 'th'})`}
          </Badge>
        </>
      )}
    </div>
  );
}