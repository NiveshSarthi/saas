import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function CreateLeadDialog({ open, onOpenChange, currentUser }) {
  const [formData, setFormData] = useState({
    lead_name: '',
    phone: '',
    email: '',
    company: '',
    location: '',
    budget: '',
    property_interest: '',
    timeline: '',
    lead_source: 'manual',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();

  const createLeadMutation = useMutation({
    mutationFn: (data) => base44.entities.Lead.create(data),
    onSuccess: (newLead) => {
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      onOpenChange(false);
      resetForm();
      toast.success('Lead created successfully');
    },
    onError: () => {
      toast.error('Failed to create lead');
    },
  });

  const resetForm = () => {
    setFormData({
      lead_name: '',
      phone: '',
      email: '',
      company: '',
      location: '',
      budget: '',
      property_interest: '',
      timeline: '',
      lead_source: 'manual',
      notes: '',
    });
    setErrors({});
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.lead_name?.trim()) {
      newErrors.lead_name = 'Name is required';
    }
    if (!formData.phone?.trim()) {
      newErrors.phone = 'Phone is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    createLeadMutation.mutate({
      ...formData,
      status: 'new',
      assigned_to: currentUser?.email,
      created_by: currentUser?.email,
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
          <DialogDescription>
            Add a new lead manually to your pipeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lead_name">Name *</Label>
              <Input
                id="lead_name"
                value={formData.lead_name}
                onChange={(e) => handleChange('lead_name', e.target.value)}
                placeholder="Lead name"
                className={errors.lead_name ? 'border-red-500' : ''}
              />
              {errors.lead_name && (
                <p className="text-xs text-red-600 mt-1">{errors.lead_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="Phone number"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && (
                <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="Email address"
              />
            </div>

            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
                placeholder="Company name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Location"
              />
            </div>

            <div>
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                value={formData.budget}
                onChange={(e) => handleChange('budget', e.target.value)}
                placeholder="Budget"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="property_interest">Property Interest</Label>
              <Input
                id="property_interest"
                value={formData.property_interest}
                onChange={(e) => handleChange('property_interest', e.target.value)}
                placeholder="Property interest"
              />
            </div>

            <div>
              <Label htmlFor="timeline">Timeline</Label>
              <Select
                value={formData.timeline}
                onValueChange={(value) => handleChange('timeline', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate</SelectItem>
                  <SelectItem value="1_month">Within 1 Month</SelectItem>
                  <SelectItem value="3_months">Within 3 Months</SelectItem>
                  <SelectItem value="6_months">Within 6 Months</SelectItem>
                  <SelectItem value="long_term">Long Term</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="lead_source">Lead Source</Label>
            <Select
              value={formData.lead_source}
              onValueChange={(value) => handleChange('lead_source', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="walkin">Walk-in</SelectItem>
                <SelectItem value="call">Call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createLeadMutation.isPending}
          >
            {createLeadMutation.isPending ? 'Creating...' : 'Create Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}