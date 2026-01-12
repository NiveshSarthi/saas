import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { User, Phone, Mail, AlertCircle, Calendar, TrendingUp, Edit, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LeadDetailDialog from '@/components/leads/LeadDetailDialog';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';

export default function AssignedLeadsSection({ user, allUsers }) {
  const [viewingLead, setViewingLead] = useState(null);

  const { data: leads = [] } = useQuery({
    queryKey: ['assigned-leads', user?.email],
    queryFn: async () => {
      if (!user) return [];
      
      // Get subordinate emails if user is a reporting officer
      const subordinateEmails = allUsers
        .filter(u => u.reports_to?.toLowerCase() === user.email?.toLowerCase())
        .map(u => u.email);
      
      // Fetch leads assigned to user or their subordinates
      const allLeads = await base44.entities.Lead.list('-created_date', 1000);
      
      return allLeads.filter(lead => 
        lead.assigned_to === user.email || subordinateEmails.includes(lead.assigned_to)
      );
    },
    enabled: !!user,
  });

  const stats = {
    total: leads.length,
    notContacted: leads.filter(l => l.contact_status === 'not_contacted').length,
    contacted: leads.filter(l => l.contact_status === 'contacted').length,
    interested: leads.filter(l => l.contact_status === 'interested').length,
    followUpScheduled: leads.filter(l => l.contact_status === 'follow_up_scheduled').length,
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  const getUserName = (email) => getUserDisplayByEmail(email, allUsers);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Assigned Leads</h2>
          <p className="text-sm text-slate-500">Track and manage your lead pipeline</p>
        </div>
        <Link to={createPageUrl('Leads')}>
          <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 cursor-pointer">
            View All Leads →
          </Badge>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500">Total Leads</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.notContacted}</div>
            <div className="text-xs text-slate-500">Not Contacted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.contacted}</div>
            <div className="text-xs text-slate-500">Contacted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.interested}</div>
            <div className="text-xs text-slate-500">Interested</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">{stats.followUpScheduled}</div>
            <div className="text-xs text-slate-500">Follow-ups</div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Contact Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Follow-up Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                    No leads assigned yet
                  </TableCell>
                </TableRow>
              ) : (
                leads.slice(0, 10).map(lead => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                            {getInitials(lead.lead_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{lead.lead_name}</p>
                          {lead.company && <p className="text-xs text-slate-500">{lead.company}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone}</span>
                        </div>
                        {lead.email && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Mail className="w-3 h-3" />
                            <span className="text-xs">{lead.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        lead.contact_status === 'not_contacted' ? 'bg-red-100 text-red-700' :
                        lead.contact_status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                        lead.contact_status === 'interested' ? 'bg-green-100 text-green-700' :
                        lead.contact_status === 'not_interested' ? 'bg-slate-100 text-slate-700' :
                        'bg-amber-100 text-amber-700'
                      }>
                        {lead.contact_status?.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback className="text-xs">
                            {getInitials(getUserName(lead.assigned_to))}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{getUserName(lead.assigned_to)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {lead.follow_up_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {format(new Date(lead.follow_up_date), 'MMM d')}
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      {format(new Date(lead.created_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setViewingLead(lead)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setViewingLead(lead)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LeadDetailDialog
        lead={viewingLead}
        open={!!viewingLead}
        onOpenChange={(open) => !open && setViewingLead(null)}
        salesUsers={allUsers}
      />
    </div>
  );
}