import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import TicketDetailDialog from './TicketDetailDialog';

const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-800',
  assigned: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-indigo-100 text-indigo-800',
  waiting_for_user: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-slate-100 text-slate-800',
  reopened: 'bg-red-100 text-red-800',
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

export default function MyTickets({ user, isITMember, isAdmin, itUsers = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['my-tickets', user?.email],
    queryFn: async () => {
      const [created, assigned] = await Promise.all([
        base44.entities.ITTicket.filter({ created_by_email: user?.email }, '-created_at'),
        base44.entities.ITTicket.filter({ assigned_to: user?.email }, '-created_at')
      ]);

      // Merge and remove duplicates
      const all = [...created, ...assigned];
      const unique = all.filter((t, index, self) =>
        index === self.findIndex((temp) => temp.id === t.id)
      );

      // Sort by date descending
      return unique.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    enabled: !!user?.email,
  });

  const filteredTickets = tickets.filter(ticket =>
    ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticket_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    breached: tickets.filter(t => t.sla_breached).length,
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading tickets...</div>;
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-slate-600">Total Tickets</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
            <div className="text-sm text-slate-600">Open</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            <div className="text-sm text-slate-600">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.breached}</div>
            <div className="text-sm text-slate-600">SLA Breached</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tickets List */}
      <div className="grid gap-4">
        {filteredTickets.map(ticket => (
          <Card
            key={ticket.id}
            className={cn(
              "cursor-pointer hover:shadow-md transition-shadow",
              ticket.sla_breached && "border-red-300"
            )}
            onClick={() => setSelectedTicket(ticket)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-slate-600">{ticket.ticket_id}</span>
                  <Badge className={STATUS_COLORS[ticket.status]}>
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                  <Badge className={PRIORITY_COLORS[ticket.priority]}>
                    {ticket.priority}
                  </Badge>
                  {ticket.sla_breached && (
                    <Badge className="bg-red-100 text-red-700">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      SLA Breached
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(ticket.created_at).toLocaleDateString()}
                </span>
              </div>
              <CardTitle className="text-lg mt-2">{ticket.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 line-clamp-2">{ticket.description}</p>
              {ticket.assigned_to_name && (
                <div className="mt-3 text-xs text-slate-500">
                  Assigned to: {ticket.assigned_to_name}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredTickets.length === 0 && (
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
          isITMember={isITMember}
          isAdmin={isAdmin}
          itUsers={itUsers}
        />
      )}
    </div>
  );
}