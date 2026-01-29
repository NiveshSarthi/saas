import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import TicketDetailDialog from './TicketDetailDialog';

const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  waiting_for_user: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-slate-100 text-slate-800',
  reopened: 'bg-red-100 text-red-800',
  pending_approval: 'bg-orange-100 text-orange-800',
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function TeamTickets({ user, isAdmin, isITHead }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['it-tickets'],
    queryFn: () => base44.entities.ITTicket.list('-created_date', 500),
  });

  const { data: itUsers = [] } = useQuery({
    queryKey: ['it-users'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data?.users?.filter(u => u.department_id === user?.department_id) || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ ticketId, assignToEmail, assignToName }) => {
      await base44.entities.ITTicket.update(ticketId, {
        assigned_to_email: assignToEmail,
        assigned_to_name: assignToName,
        status: 'assigned',
      });

      await base44.entities.ITTicketActivity.create({
        ticket_id: ticketId,
        action: 'assigned',
        new_value: assignToName,
        performed_by: user?.email,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['it-tickets'] });
      toast.success('Ticket assigned successfully');
    },
  });

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const prioritySort = { critical: 4, high: 3, medium: 2, low: 1 };
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    if (a.sla_breached && !b.sla_breached) return -1;
    if (!a.sla_breached && b.sla_breached) return 1;
    return prioritySort[b.priority] - prioritySort[a.priority];
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading tickets...</div>;
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <div className="grid gap-4">
        {sortedTickets.map(ticket => (
          <Card
            key={ticket.id}
            className={cn(
              "cursor-pointer hover:shadow-md transition-shadow",
              ticket.sla_breached && "border-red-300 bg-red-50/30",
              ticket.priority === 'critical' && !ticket.sla_breached && "border-red-200"
            )}
            onClick={() => setSelectedTicket(ticket)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-mono text-slate-600">{ticket.ticket_id}</span>
                  <Badge className={STATUS_COLORS[ticket.status]}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>
                    {ticket.priority}
                  </Badge>
                  {ticket.sla_breached && (
                    <Badge className="bg-red-100 text-red-700">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      SLA Breached
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-semibold mb-2">{ticket.title}</h3>
              <p className="text-sm text-slate-600 line-clamp-2 mb-3">{ticket.description}</p>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Created by: {ticket.created_by_name}</span>
                {ticket.assigned_to_name ? (
                  <span>Assigned to: {ticket.assigned_to_name}</span>
                ) : (
                  <span className="text-orange-600">Unassigned</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {sortedTickets.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            No tickets found
          </div>
        )}
      </div>

      {/* Ticket Detail Dialog */}
      {selectedTicket && (
        <TicketDetailDialog
          ticket={selectedTicket}
          open={!!selectedTicket}
          onOpenChange={(open) => !open && setSelectedTicket(null)}
          user={user}
          isITMember={true}
          isITHead={isITHead}
          itUsers={itUsers}
        />
      )}
    </div>
  );
}