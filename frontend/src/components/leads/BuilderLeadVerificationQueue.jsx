import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, Eye, XCircle, Phone, Mail, Building } from 'lucide-react';
import { toast } from 'sonner';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';

export default function BuilderLeadVerificationQueue({ user, allUsers }) {
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-pending-builder'],
    queryFn: () => base44.entities.Lead.filter({ approval_status: 'pending_builder' }),
  });

  const { data: builders = [] } = useQuery({
    queryKey: ['builders'],
    queryFn: () => base44.entities.Builder.list(),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ lead, action, note }) => {
      const workflowLogs = [...(lead.workflow_logs || [])];
      let updates = {};

      if (action === 'approve') {
        // Check if assigned user has a reporting officer
        const assignedUser = allUsers.find(u => u.email?.toLowerCase() === lead.assigned_to?.toLowerCase());
        const hasManager = assignedUser?.reports_to && assignedUser.reports_to !== '';

        workflowLogs.push({
          action: 'builder_approved',
          actor_email: user.email,
          timestamp: new Date().toISOString(),
          note: 'Builder verified the lead'
        });

        updates = {
          approval_status: hasManager ? 'pending_officer' : 'approved',
          builder_approval_status: 'approved',
          builder_reviewed_by: user.email,
          builder_reviewed_at: new Date().toISOString(),
          workflow_logs: workflowLogs
        };

        // Notify reporting officer if exists
        if (hasManager) {
          await base44.entities.Notification.create({
            user_email: assignedUser.reports_to,
            type: 'review_requested',
            title: 'Lead Verified by Builder - Approval Required',
            message: `Lead ${lead.lead_name} has been verified by the builder and awaits your approval.`,
            read: false
          });
        }

        // Notify sales member
        await base44.entities.Notification.create({
          user_email: lead.assigned_to,
          type: 'status_changed',
          title: 'Builder Approved Your Lead',
          message: `Your lead ${lead.lead_name} has been verified by the builder${hasManager ? ' and sent to your manager for final approval' : ' and is now active'}.`,
          read: false
        });

      } else if (action === 'reject') {
        workflowLogs.push({
          action: 'builder_rejected',
          actor_email: user.email,
          timestamp: new Date().toISOString(),
          note: note || 'Rejected by builder'
        });

        updates = {
          approval_status: 'rejected',
          builder_approval_status: 'rejected',
          builder_reviewed_by: user.email,
          builder_reviewed_at: new Date().toISOString(),
          builder_note: note,
          workflow_logs: workflowLogs
        };

        // Notify sales member
        await base44.entities.Notification.create({
          user_email: lead.assigned_to,
          type: 'status_changed',
          title: 'Builder Rejected Your Lead',
          message: `Builder rejected lead ${lead.lead_name}. Reason: ${note}. Please review and update.`,
          read: false
        });
      }

      await base44.entities.Lead.update(lead.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-pending-builder'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['assigned-leads'] });
      toast.success('Lead verification completed');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to process verification');
    }
  });

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const getUserName = (email) => getUserDisplayByEmail(email, allUsers);
  const getBuilderName = (email) => builders.find(b => b.email === email)?.builder_name || email;

  // Filter leads for current user
  const visibleLeads = leads.filter(lead => {
    if (user.role === 'admin') return true;
    return lead.builder_email?.toLowerCase() === user.email?.toLowerCase();
  });

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        Builder Verification Queue (Leads)
      </h2>
      <p className="text-sm text-slate-500 mb-4">
        Leads requiring builder verification before reporting officer approval
      </p>
      
      <Card className="border-orange-200 bg-orange-50/30">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sales Member</TableHead>
                <TableHead>Lead Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Property Interest</TableHead>
                <TableHead>Builder</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLeads.length > 0 ? (
                visibleLeads.map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(getUserName(lead.assigned_to))}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {getUserName(lead.assigned_to)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{lead.lead_name}</p>
                        {lead.company && (
                          <p className="text-xs text-slate-500">{lead.company}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Mail className="w-3 h-3" />
                            <span>{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-1 max-w-xs">
                        <Building className="w-4 h-4 text-slate-400 mt-0.5" />
                        <span className="text-sm line-clamp-2">
                          {lead.property_interest || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="bg-orange-100 text-orange-600 text-xs">
                            {getBuilderName(lead.builder_email)[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{getBuilderName(lead.builder_email)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {format(new Date(lead.created_date), 'MMM d, yyyy')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-8"
                          onClick={() => approveMutation.mutate({ lead, action: 'approve' })}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          onClick={() => {
                            const note = prompt('Enter reason for rejection:');
                            if (note) {
                              approveMutation.mutate({ lead, action: 'reject', note });
                            }
                          }}
                          disabled={approveMutation.isPending}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    No leads pending builder verification
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}