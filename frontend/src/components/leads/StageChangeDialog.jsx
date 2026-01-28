import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STAGES = [
  { key: 'new', label: 'New', color: 'bg-slate-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { key: 'screening', label: 'Screening', color: 'bg-indigo-500' },
  { key: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { key: 'proposal', label: 'Proposal', color: 'bg-violet-500' },
  { key: 'negotiation', label: 'Negotiation', color: 'bg-amber-500' },
  { key: 'site_visit', label: 'Site Visit', color: 'bg-orange-500' },
  { key: 'agreement', label: 'Agreement', color: 'bg-emerald-500' },
  { key: 'payment', label: 'Payment', color: 'bg-green-600' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-green-700' }
];
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRight, XCircle, Snowflake, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STAGE_REQUIREMENTS = {
  contacted: [],
  screening: ['budget', 'requirement', 'location', 'timeline'],
  qualified: ['verified_budget'],
  proposal: ['proposal_sent'],
  negotiation: ['negotiation_notes'],
  site_visit: ['visit_date'],
  agreement: ['agreement_signed'],
  payment: ['payment_amount', 'payment_date'],
  closed_won: ['final_amount'],
};

export default function StageChangeDialog({ open, onOpenChange, lead, targetStage, onSuccess, onMarkAsLost, onMarkAsCold }) {
  const [formData, setFormData] = useState({
    budget: lead?.budget || '',
    requirement: lead?.requirement || '',
    location: lead?.location || '',
    timeline: lead?.timeline || '',
    verified_budget: lead?.verified_budget || '',
    proposal_sent: lead?.proposal_sent || false,
    negotiation_notes: lead?.negotiation_notes || '',
    visit_date: lead?.visit_date || '',
    agreement_signed: lead?.agreement_signed || false,
    payment_amount: lead?.payment_amount || '',
    payment_date: lead?.payment_date || '',
    final_amount: lead?.final_amount || '',
    stage_notes: '',
  });
  const [errors, setErrors] = useState({});

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      console.log('🔄 Mutation function started with data:', data);
      const currentStageLabel = STAGES.find(s => s.key === lead.status)?.label || 'Unknown';
      const targetStageLabel = targetStage?.label || 'Unknown';

      console.log('📝 Updating lead in database...');
      await base44.entities.Lead.update(lead.id, data);
      console.log('✅ Lead updated successfully');

      // Add incentive bonus when lead is closed won
      if (targetStage.key === 'closed_won' && data.final_amount) {
        const bonusRecipient = lead.assigned_to || lead.created_by; // Use assigned user or lead creator
        if (!bonusRecipient) return;

        const bonusAmount = parseFloat(data.final_amount) * 0.0025; // 0.25%
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        console.log(`💰 Adding incentive bonus of ${bonusAmount} for ${bonusRecipient}`);
        await base44.entities.SalaryAdjustment.create({
          employee_email: bonusRecipient,
          month: currentMonth,
          adjustment_type: 'incentive',
          amount: bonusAmount,
          status: 'approved',
          description: `Deal closed with ${lead.lead_name || lead.name || 'Client'} - Lead closure incentive bonus`
        });
        console.log('✅ Incentive bonus added');

        // 1% to Accounts
        try {
          const accountAmount = parseFloat(data.final_amount) * 0.01;
          const accountName = "Sales Revenue";

          // Find or Create Revenue Account
          const accounts = await base44.entities.ChartOfAccount.filter({ name: accountName });
          let accountId;

          if (accounts && accounts.length > 0) {
            accountId = accounts[0].id;
          } else {
            console.log('Creating Sales Revenue account...');
            const newAccount = await base44.entities.ChartOfAccount.create({
              code: '4000', // Standard revenue code
              name: accountName,
              type: 'Income',
              balance: 0,
              is_active: true
            });
            accountId = newAccount.id;
          }

          if (accountId) {
            console.log(`💰 Adding 1% transaction of ${accountAmount} to Accounts`);
            await base44.entities.Transaction.create({
              date: new Date().toISOString(),
              description: `1% Share from Lead: ${lead.lead_name || 'Unknown'}`,
              reference_id: lead.id,
              reference_type: 'payment',
              account_id: accountId,
              type: 'credit', // Income
              amount: accountAmount,
              created_by: lead.assigned_to || 'system'
            });
            console.log('✅ Transaction added');
          }
        } catch (accErr) {
          console.error('❌ Failed to add accounting transaction:', accErr);
        }
      }

      // Check for duplicate log within last 5 seconds
      const recentActivities = await base44.entities.RELeadActivity.filter(
        { lead_id: lead.id },
        '-created_date',
        5
      );

      const isDuplicate = recentActivities.some(activity => {
        if (activity.activity_type !== 'Stage Change') return false;
        const timeDiff = Date.now() - new Date(activity.created_date).getTime();
        return timeDiff < 5000 && activity.description?.includes(`${currentStageLabel} → ${targetStageLabel}`);
      });

      // Log activity only if not duplicate
      if (!isDuplicate) {
        console.log('📝 Creating activity log...');
        await base44.entities.RELeadActivity.create({
          lead_id: lead.id,
          activity_type: 'Stage Change',
          description: `Stage Updated: ${currentStageLabel} → ${targetStageLabel}`,
          actor_email: lead.assigned_to || lead.created_by,
          metadata: {
            from: lead.status,
            to: targetStage.key,
            stageDetails: {
              budget: data.budget,
              requirements: data.requirement,
              location: data.location,
              timeline: data.timeline,
              verified_budget: data.verified_budget,
              proposal_sent: data.proposal_sent,
              negotiation_notes: data.negotiation_notes,
              visit_date: data.visit_date,
              agreement_signed: data.agreement_signed,
              payment_amount: data.payment_amount,
              payment_date: data.payment_date,
              final_amount: data.final_amount,
              notes: data.stage_notes
            }
          }
        });
        console.log('✅ Activity log created');
      } else {
        console.log('⏭️ Skipping duplicate activity log');
      }

      return { ...lead, ...data };
    },
    onSuccess: (updatedLead) => {
      console.log('✅ onSuccess callback triggered');
      queryClient.invalidateQueries({ queryKey: ['leads-management'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-detail'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities'] });
      onSuccess?.(updatedLead);
      setFormData({});
      setErrors({});
    },
    onError: (error) => {
      console.error('❌ Mutation error:', error);
    }
  });

  const requiredFields = STAGE_REQUIREMENTS[targetStage?.key] || [];

  const validate = () => {
    const newErrors = {};

    requiredFields.forEach(field => {
      if (!formData[field]) {
        newErrors[field] = 'This field is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log('=== Stage Change Submission ===');
    console.log('Form data:', formData);
    console.log('Target stage:', targetStage);
    console.log('Validation result:', validate());

    if (!validate()) {
      console.log('❌ Validation failed');
      return;
    }

    console.log('✅ Validation passed, submitting...');
    try {
      const updateData = {
        ...formData,
        status: targetStage.key,
      };

      // Auto-update contact_status to "connected" when stage is "contacted"
      if (targetStage.key === 'contacted') {
        updateData.contact_status = 'connected';
        if (!lead.contacted_date) {
          updateData.contacted_date = new Date().toISOString();
        }
      }

      await updateMutation.mutateAsync(updateData);
      console.log('✅ Mutation completed');
      onOpenChange(false);
    } catch (err) {
      console.error('❌ Mutation error:', err);
    }
  };

  if (!targetStage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move to: {targetStage.label}</DialogTitle>
          <DialogDescription>
            Complete the required information to proceed to the next stage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {requiredFields.includes('budget') && (
            <div className="space-y-2">
              <Label>Budget *</Label>
              <Input
                placeholder="e.g., 50L - 75L"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              />
              {errors.budget && <p className="text-xs text-red-600">{errors.budget}</p>}
            </div>
          )}

          {requiredFields.includes('requirement') && (
            <div className="space-y-2">
              <Label>Requirement *</Label>
              <Select
                value={formData.requirement || undefined}
                onValueChange={(value) => setFormData({ ...formData, requirement: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select requirement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2bhk">2 BHK</SelectItem>
                  <SelectItem value="3bhk">3 BHK</SelectItem>
                  <SelectItem value="4bhk">4 BHK</SelectItem>
                  <SelectItem value="villa">Villa</SelectItem>
                  <SelectItem value="plot">Plot</SelectItem>
                </SelectContent>
              </Select>
              {errors.requirement && <p className="text-xs text-red-600">{errors.requirement}</p>}
            </div>
          )}

          {requiredFields.includes('location') && (
            <div className="space-y-2">
              <Label>Preferred Location *</Label>
              <Input
                placeholder="e.g., Sector 82, Gurgaon"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
              {errors.location && <p className="text-xs text-red-600">{errors.location}</p>}
            </div>
          )}

          {requiredFields.includes('timeline') && (
            <div className="space-y-2">
              <Label>Timeline *</Label>
              <Select
                value={formData.timeline || undefined}
                onValueChange={(value) => setFormData({ ...formData, timeline: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Immediate (0-1 month)</SelectItem>
                  <SelectItem value="short">1-3 months</SelectItem>
                  <SelectItem value="medium">3-6 months</SelectItem>
                  <SelectItem value="long">6+ months</SelectItem>
                </SelectContent>
              </Select>
              {errors.timeline && <p className="text-xs text-red-600">{errors.timeline}</p>}
            </div>
          )}

          {requiredFields.includes('verified_budget') && (
            <div className="space-y-2">
              <Label>Verified Budget *</Label>
              <Input
                placeholder="Confirmed budget amount"
                value={formData.verified_budget}
                onChange={(e) => setFormData({ ...formData, verified_budget: e.target.value })}
              />
              {errors.verified_budget && <p className="text-xs text-red-600">{errors.verified_budget}</p>}
            </div>
          )}

          {requiredFields.includes('proposal_sent') && (
            <div className="space-y-2">
              <Label>Proposal Details *</Label>
              <Textarea
                placeholder="Describe the proposal sent to the client..."
                value={formData.proposal_sent}
                onChange={(e) => setFormData({ ...formData, proposal_sent: e.target.value })}
                rows={3}
              />
              {errors.proposal_sent && <p className="text-xs text-red-600">{errors.proposal_sent}</p>}
            </div>
          )}

          {requiredFields.includes('negotiation_notes') && (
            <div className="space-y-2">
              <Label>Negotiation Notes *</Label>
              <Textarea
                placeholder="Key discussion points..."
                value={formData.negotiation_notes}
                onChange={(e) => setFormData({ ...formData, negotiation_notes: e.target.value })}
              />
              {errors.negotiation_notes && <p className="text-xs text-red-600">{errors.negotiation_notes}</p>}
            </div>
          )}

          {requiredFields.includes('visit_date') && (
            <div className="space-y-2">
              <Label>Site Visit Date *</Label>
              <Input
                type="date"
                value={formData.visit_date}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
              />
              {errors.visit_date && <p className="text-xs text-red-600">{errors.visit_date}</p>}
            </div>
          )}

          {requiredFields.includes('agreement_signed') && (
            <div className="space-y-2">
              <Label>Agreement Details *</Label>
              <Textarea
                placeholder="Agreement reference and signing details..."
                value={formData.agreement_signed}
                onChange={(e) => setFormData({ ...formData, agreement_signed: e.target.value })}
                rows={2}
              />
              {errors.agreement_signed && <p className="text-xs text-red-600">{errors.agreement_signed}</p>}
            </div>
          )}

          {requiredFields.includes('payment_amount') && (
            <div className="space-y-2">
              <Label>Payment Amount *</Label>
              <Input
                placeholder="Amount received"
                value={formData.payment_amount}
                onChange={(e) => setFormData({ ...formData, payment_amount: e.target.value })}
              />
              {errors.payment_amount && <p className="text-xs text-red-600">{errors.payment_amount}</p>}
            </div>
          )}

          {requiredFields.includes('payment_date') && (
            <div className="space-y-2">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
              {errors.payment_date && <p className="text-xs text-red-600">{errors.payment_date}</p>}
            </div>
          )}

          {requiredFields.includes('final_amount') && (
            <div className="space-y-2">
              <Label>Final Deal Amount *</Label>
              <Input
                placeholder="Total amount"
                value={formData.final_amount}
                onChange={(e) => setFormData({ ...formData, final_amount: e.target.value })}
              />
              {errors.final_amount && <p className="text-xs text-red-600">{errors.final_amount}</p>}
            </div>
          )}

          {/* Always show notes field */}
          <div className="space-y-2">
            <Label>Additional Notes (Optional)</Label>
            <Textarea
              placeholder="Add any additional notes about this stage transition..."
              value={formData.stage_notes}
              onChange={(e) => setFormData({ ...formData, stage_notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={updateMutation.isPending}>
                Mark
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => {
                  onOpenChange(false);
                  onMarkAsLost?.();
                }}
                className="text-red-600 cursor-pointer"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Mark as Lost
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  onOpenChange(false);
                  onMarkAsCold?.();
                }}
                className="text-blue-600 cursor-pointer"
              >
                <Snowflake className="w-4 h-4 mr-2" />
                Mark as Cold
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Save & Move
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}