import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import MyTickets from '@/components/itsupport/MyTickets';
import TeamTickets from '@/components/itsupport/TeamTickets';
import TicketAnalytics from '@/components/itsupport/TicketAnalytics';
import ITSettings from '@/components/itsupport/ITSettings';
import CreateTicketDialog from '@/components/itsupport/CreateTicketDialog';

export default function ITSupport() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('my-tickets');

  const { data: user } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const itDepts = departments.filter(d => {
    const name = d.name?.toLowerCase() || '';
    return name.includes('it') || name.includes('information technology') || name.includes('tech');
  });
  const itDeptIds = itDepts.map(d => d.id);

  const isITMember = user?.department_id && itDeptIds.includes(user.department_id);
  const isAdmin = user?.role === 'admin';
  const isITHead = itDepts.some(d => d.manager_email === user?.email);
  const isITOrAdmin = isITMember || isAdmin || isITHead;

  const { data: itUsers = [] } = useQuery({
    queryKey: ['it-users', itDeptIds],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data?.users?.filter(u => itDeptIds.includes(u.department_id)) || [];
    },
    enabled: itDeptIds.length > 0,
  });

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">IT Support</h1>
            <p className="text-slate-600 mt-1">Track and manage IT support tickets</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="my-tickets">My Tickets</TabsTrigger>
            {isITOrAdmin && <TabsTrigger value="team-tickets">Team Tickets</TabsTrigger>}
            {isITOrAdmin && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
            {isAdmin && <TabsTrigger value="settings">Settings</TabsTrigger>}
          </TabsList>

          <TabsContent value="my-tickets">
            <MyTickets user={user} isITMember={isITMember} isAdmin={isAdmin} itUsers={itUsers} />
          </TabsContent>

          {isITOrAdmin && (
            <TabsContent value="team-tickets">
              <TeamTickets user={user} isAdmin={isAdmin} isITHead={isITHead} itUsers={itUsers} />
            </TabsContent>
          )}

          {isITOrAdmin && (
            <TabsContent value="analytics">
              <TicketAnalytics />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="settings">
              <ITSettings />
            </TabsContent>
          )}
        </Tabs>

        {/* Create Ticket Dialog */}
        <CreateTicketDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          user={user}
        />
      </div>
    </div>
  );
}