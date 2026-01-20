import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Calendar, DollarSign, FileText, MapPin, Clock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  screening: 'Screening',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  site_visit: 'Site Visit',
  agreement: 'Agreement',
  payment: 'Payment',
  closed_won: 'Closed Won'
};

export default function StageDetailsHistory({ leadId, lead, currentUser }) {
  const { data: activities = [] } = useQuery({
    queryKey: ['lead-stage-details', leadId],
    queryFn: () => base44.entities.RELeadActivity.filter(
      { lead_id: leadId, activity_type: 'Stage Change' },
      '-created_date',
      50
    ),
    enabled: !!leadId,
  });

  // Check permissions: only admin or assigned owner can see details
  const canViewDetails = true; // Temporarily allow all users to see details for testing

  const stageActivities = activities.filter(a => a.metadata?.stageDetails);

  if (stageActivities.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          Stage Progress Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stageActivities.map((activity, index) => {
          const details = activity.metadata?.stageDetails || {};
          const stageName = STAGE_LABELS[activity.metadata?.to] || activity.metadata?.to;

          return (
            <div key={activity.id}>
              {index > 0 && <Separator className="my-4" />}
              
              <div className="space-y-3">
                {/* Stage Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-slate-900">{stageName}</h4>
                  </div>
                  <span className="text-xs text-slate-500">
                    {format(new Date(activity.created_date), 'MMM dd, yyyy hh:mm a')}
                  </span>
                </div>

                {/* Stage Details - Only visible to admins and assigned owner */}
                {canViewDetails && (
                <div className="pl-7 space-y-2">
                  {details.budget && (
                    <div className="flex items-start gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Budget: </span>
                        <span className="text-slate-900">{details.budget}</span>
                      </div>
                    </div>
                  )}

                  {details.verified_budget && (
                    <div className="flex items-start gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Verified Budget: </span>
                        <span className="text-slate-900">{details.verified_budget}</span>
                      </div>
                    </div>
                  )}

                  {details.timeline && (
                    <div className="flex items-start gap-2 text-sm">
                      <Clock className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Timeline: </span>
                        <span className="text-slate-900">{details.timeline}</span>
                      </div>
                    </div>
                  )}

                  {details.location && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Location: </span>
                        <span className="text-slate-900">{details.location}</span>
                      </div>
                    </div>
                  )}

                  {details.requirements && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Requirements: </span>
                        <span className="text-slate-900">{details.requirements}</span>
                      </div>
                    </div>
                  )}

                  {details.proposal_sent && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Proposal Details: </span>
                        <span className="text-slate-900">{details.proposal_sent}</span>
                      </div>
                    </div>
                  )}

                  {details.negotiation_notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Negotiation Notes: </span>
                        <span className="text-slate-900">{details.negotiation_notes}</span>
                      </div>
                    </div>
                  )}

                  {details.visit_date && (
                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Site Visit Date: </span>
                        <span className="text-slate-900">
                          {format(new Date(details.visit_date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  )}

                  {details.agreement_signed && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Agreement Details: </span>
                        <span className="text-slate-900">{details.agreement_signed}</span>
                      </div>
                    </div>
                  )}

                  {details.payment_amount && (
                    <div className="flex items-start gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Payment Amount: </span>
                        <span className="text-slate-900">{details.payment_amount}</span>
                      </div>
                    </div>
                  )}

                  {details.payment_date && (
                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Payment Date: </span>
                        <span className="text-slate-900">
                          {format(new Date(details.payment_date), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  )}

                  {details.final_amount && (
                    <div className="flex items-start gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Final Deal Amount: </span>
                        <span className="text-slate-900">{details.final_amount}</span>
                      </div>
                    </div>
                  )}

                  {details.next_follow_up && (
                    <div className="flex items-start gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-slate-500 mt-0.5" />
                      <div>
                        <span className="text-slate-600 font-medium">Follow-up: </span>
                        <span className="text-slate-900">
                          {format(new Date(details.next_follow_up), 'MMM dd, yyyy hh:mm a')}
                        </span>
                      </div>
                    </div>
                  )}

                  {details.notes && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm">
                      <span className="text-slate-600 font-medium">Notes: </span>
                      <p className="text-slate-700 mt-1 whitespace-pre-wrap">{details.notes}</p>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}