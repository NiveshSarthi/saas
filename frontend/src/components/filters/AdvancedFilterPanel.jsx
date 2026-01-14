import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  X,
  Filter,
  Search,
  Calendar,
  User,
  Tag,
  CheckSquare,
  RefreshCw,
  Save,
  Star,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last 7 Days', value: 'last_7_days' },
  { label: 'Last 30 Days', value: 'last_30_days' },
  { label: 'Custom Range', value: 'custom' }
];

export default function AdvancedFilterPanel({ 
  isOpen, 
  onClose, 
  filters = {},
  onApplyFilters,
  moduleConfig,
  savedFilters = [],
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter
}) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [searchTerms, setSearchTerms] = useState({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const allUsers = await base44.entities.User.list();
      return allUsers.filter(u => u.active !== false && u.status !== 'inactive');
    },
    enabled: moduleConfig?.filters?.some(f => f.type === 'user_select' || f.type === 'assignee'),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: moduleConfig?.filters?.some(f => f.field === 'department_id'),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
    enabled: moduleConfig?.filters?.some(f => f.field === 'project_id'),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: builders = [] } = useQuery({
    queryKey: ['builders'],
    queryFn: () => base44.entities.Builder.list(),
    enabled: moduleConfig?.filters?.some(f => f.field === 'builder_id'),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handleFilterChange = (field, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMultiSelectChange = (field, option, checked) => {
    setLocalFilters(prev => {
      const current = prev[field] || [];
      if (checked) {
        return { ...prev, [field]: [...current, option] };
      } else {
        return { ...prev, [field]: current.filter(v => v !== option) };
      }
    });
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    setLocalFilters({});
    onApplyFilters({});
  };

  const handleSave = () => {
    if (filterName.trim()) {
      onSaveFilter?.({
        name: filterName,
        filters: localFilters,
        module: moduleConfig.module
      });
      setFilterName('');
      setShowSaveDialog(false);
    }
  };

  const renderFilterField = (filterConfig) => {
    const { field, label, type, options } = filterConfig;
    const value = localFilters[field];

    switch (type) {
      case 'date_preset':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || ''} onValueChange={(v) => handleFilterChange(field, v)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Time</SelectItem>
                {DATE_PRESETS.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'date_range':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left">
                    <Calendar className="w-4 h-4 mr-2" />
                    {value?.start ? format(new Date(value.start), 'MMM d') : 'Start'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={value?.start ? new Date(value.start) : undefined}
                    onSelect={(date) => handleFilterChange(field, { ...value, start: date ? format(date, 'yyyy-MM-dd') : null })}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left">
                    <Calendar className="w-4 h-4 mr-2" />
                    {value?.end ? format(new Date(value.end), 'MMM d') : 'End'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={value?.end ? new Date(value.end) : undefined}
                    onSelect={(date) => handleFilterChange(field, { ...value, end: date ? format(date, 'yyyy-MM-dd') : null })}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      case 'multi_select':
        const selectedValues = value || [];
        const searchTerm = searchTerms[field] || '';
        const filteredOptions = options.filter(opt => 
          opt.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, [field]: e.target.value }))}
                className="mb-2"
              />
              {filteredOptions.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field}-${option.value}`}
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={(checked) => handleMultiSelectChange(field, option.value, checked)}
                  />
                  <label
                    htmlFor={`${field}-${option.value}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedValues.map(val => {
                  const opt = options.find(o => o.value === val);
                  return opt ? (
                    <Badge key={val} variant="secondary" className="text-xs">
                      {opt.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>
        );

      case 'user_select':
      case 'assignee':
        const selectedUsers = value || [];
        const userSearchTerm = searchTerms[field] || '';
        const filteredUsers = users.filter(u => 
          (u.full_name || u.email).toLowerCase().includes(userSearchTerm.toLowerCase())
        );
        
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-64 overflow-y-auto">
              <Input
                placeholder="Search users..."
                value={userSearchTerm}
                onChange={(e) => setSearchTerms(prev => ({ ...prev, [field]: e.target.value }))}
                className="mb-2"
              />
              {filteredUsers.map(u => (
                <div key={u.email} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field}-${u.email}`}
                    checked={selectedUsers.includes(u.email)}
                    onCheckedChange={(checked) => handleMultiSelectChange(field, u.email, checked)}
                  />
                  <label
                    htmlFor={`${field}-${u.email}`}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {u.full_name || u.email}
                  </label>
                </div>
              ))}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || ''} onValueChange={(v) => handleFilterChange(field, v)}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All</SelectItem>
                {options.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'department':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || ''} onValueChange={(v) => handleFilterChange(field, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Departments</SelectItem>
                {departments.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'project':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || ''} onValueChange={(v) => handleFilterChange(field, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Projects</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'builder':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || ''} onValueChange={(v) => handleFilterChange(field, v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select builder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Builders</SelectItem>
                {builders.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'number_range':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={value?.min || ''}
                onChange={(e) => handleFilterChange(field, { ...value, min: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Max"
                value={value?.max || ''}
                onChange={(e) => handleFilterChange(field, { ...value, max: e.target.value })}
              />
            </div>
          </div>
        );

      case 'text':
        return (
          <div key={field} className="space-y-2">
            <Label>{label}</Label>
            <Input
              value={value || ''}
              onChange={(e) => handleFilterChange(field, e.target.value)}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-[500px] bg-white shadow-2xl z-50 transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Filter className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Advanced Filters</h2>
              <p className="text-xs text-slate-500">{moduleConfig?.title || 'Filter Results'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Saved Filters */}
        {savedFilters?.length > 0 && (
          <div className="p-4 border-b bg-slate-50">
            <Label className="text-xs text-slate-600 mb-2 block">Saved Filters</Label>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map(saved => (
                <div key={saved.id} className="group relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onLoadFilter?.(saved)}
                    className="pr-8"
                  >
                    <Star className="w-3 h-3 mr-1" />
                    {saved.name}
                  </Button>
                  {(user?.role === 'admin' || saved.created_by === user?.email) && (
                    <button
                      onClick={() => onDeleteFilter?.(saved.id)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {moduleConfig?.filters?.map(filterConfig => renderFilterField(filterConfig))}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t bg-slate-50 space-y-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClear}
              className="flex-1"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear All
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
          
          {showSaveDialog && (
            <div className="flex gap-2">
              <Input
                placeholder="Filter name..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
          )}

          <Button
            onClick={handleApply}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </>
  );
}