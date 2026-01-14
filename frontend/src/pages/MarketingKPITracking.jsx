import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingKPIManager from '@/components/marketing/MarketingKPIManager';
import MarketingDailyLogger from '@/components/marketing/MarketingDailyLogger';
import MarketingKPIDashboard from '@/components/marketing/MarketingKPIDashboard';
import { Target, TrendingUp, Settings } from 'lucide-react';

export default function MarketingKPITracking() {
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

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: usersFromEntity = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const allUsers = [
    ...usersFromEntity,
    ...invitations
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ];

  const marketingDeptIds = departments.filter(d => d.name?.toLowerCase().includes('marketing')).map(d => d.id);
  const isMarketingUser = user?.department_id && marketingDeptIds.includes(user.department_id);
  const isAdmin = user?.role === 'admin';

  if (user && !isMarketingUser && !isAdmin) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only marketing team members and administrators can access this page.</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketing KPI Tracking</h1>
          <p className="text-slate-500 mt-1">Track content output, social growth, and team performance</p>
        </div>
        <MarketingDailyLogger user={user} />
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">
            <TrendingUp className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          {user.role === 'admin' && (
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              KPI Settings
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dashboard">
          <MarketingKPIDashboard users={allUsers} departments={departments} />
        </TabsContent>

        {user.role === 'admin' && (
          <TabsContent value="settings">
            <MarketingKPIManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}