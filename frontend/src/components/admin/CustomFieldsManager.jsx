import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Plus,
  GripVertical,
  Edit,
  Trash2,
  MoreHorizontal,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  Link as LinkIcon,
  Mail,
  File,
  X,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const fieldTypeIcons = {
  text: Type,
  number: Hash,
  date: Calendar,
  dropdown: List,
  multi_select: List,
  checkbox: CheckSquare,
  url: LinkIcon,
  email: Mail,
  file: File
};

const fieldTypeLabels = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  dropdown: 'Dropdown',
  multi_select: 'Multi-select',
  checkbox: 'Checkbox',
  url: 'URL',
  email: 'Email',
  file: 'File'
};

export default function CustomFieldsManager() {
  const [editingField, setEditingField] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    field_key: '',
    field_type: 'text',
    options: [],
    required: false,
    domain: 'all'
  });

  const queryClient = useQueryClient();
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

  const { data: customFields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => base44.entities.CustomField.list('order'),
  });

  const createFieldMutation = useMutation({
    mutationFn: (data) => base44.entities.CustomField.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CustomField.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      resetForm();
      setIsDialogOpen(false);
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomField.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      field_key: '',
      field_type: 'text',
      options: [],
      required: false,
      domain: 'all'
    });
    setEditingField(null);
  };

  const handleEdit = (field) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      field_key: field.field_key,
      field_type: field.field_type,
      options: field.options || [],
      required: field.required || false,
      domain: field.domain || 'all'
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    const fieldKey = formData.field_key || formData.name.toLowerCase().replace(/\s+/g, '_');
    const data = { ...formData, field_key: fieldKey };
    
    if (editingField) {
      updateFieldMutation.mutate({ id: editingField.id, data });
    } else {
      createFieldMutation.mutate(data);
    }
  };

  const addOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()]
      }));
      setNewOption('');
    }
  };

  const removeOption = (option) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter(o => o !== option)
    }));
  };

  const needsOptions = ['dropdown', 'multi_select'].includes(formData.field_type);
  
  // Note: We assume the parent component checks for admin role
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-slate-900">Manage Fields</h3>
          <p className="text-sm text-slate-500">Define custom fields for your tasks</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Field
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Field Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Sprint Number"
                />
              </div>

              <div className="space-y-2">
                <Label>Field Type</Label>
                <Select 
                  value={formData.field_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, field_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(fieldTypeLabels).map(([key, label]) => {
                      const Icon = fieldTypeIcons[key];
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {needsOptions && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="Add option"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.options.map((option, i) => (
                      <Badge key={i} variant="secondary" className="gap-1">
                        {option}
                        <X className="w-3 h-3 cursor-pointer" onClick={() => removeOption(option)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Domain</Label>
                <Select 
                  value={formData.domain}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, domain: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Domains</SelectItem>
                    <SelectItem value="it">IT Only</SelectItem>
                    <SelectItem value="real_estate">Real Estate Only</SelectItem>
                    <SelectItem value="generic">Generic Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label>Required Field</Label>
                <Switch
                  checked={formData.required}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, required: checked }))}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!formData.name}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingField ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Fields List */}
      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {customFields.map((field) => {
          const Icon = fieldTypeIcons[field.field_type] || Type;
          
          return (
            <div key={field.id} className="flex items-center gap-4 p-4">
              <GripVertical className="w-5 h-5 text-slate-300 cursor-grab" />
              
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-600" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-slate-900">{field.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {fieldTypeLabels[field.field_type]}
                  </Badge>
                  {field.required && (
                    <Badge className="text-xs bg-red-100 text-red-700">Required</Badge>
                  )}
                  {field.domain !== 'all' && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {field.domain}
                    </Badge>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(field)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-red-600"
                    onClick={() => deleteFieldMutation.mutate(field.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}

        {customFields.length === 0 && (
          <div className="text-center py-12">
            <Type className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-medium text-slate-900 mb-2">No custom fields yet</h3>
            <p className="text-slate-500 text-sm">Create fields to capture additional task data</p>
          </div>
        )}
      </div>
    </div>
  );
}