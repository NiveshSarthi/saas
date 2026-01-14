import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LeaveTypeManager from '@/components/leave/LeaveTypeManager';
import LeaveBalanceManager from '@/components/leave/LeaveBalanceManager';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function LeaveSettingsPage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.error('Failed to fetch user', e);
      }
    };
    fetchUser();
  }, []);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
    enabled: !!user,
  });

  useEffect(() => {
    if (user && departments.length > 0) {
      const hrDept = departments.find(d => d.name?.toLowerCase().includes('hr'));
      const isHR = user.department_id && hrDept && user.department_id === hrDept.id;
      setIsAdmin(user.role === 'admin' || isHR);
    }
  }, [user, departments]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <Shield className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
        <p className="text-slate-500 mb-4">Only admins and HR can manage leave settings.</p>
        <Link to={createPageUrl('LeaveManagement')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leave Management
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('LeaveManagement')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Leave Settings</h1>
            <p className="text-slate-500 mt-1">Configure leave types and balances</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
          <TabsTrigger value="balances">User Balances</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-6">
          <LeaveTypeManager />
        </TabsContent>

        <TabsContent value="balances" className="mt-6">
          <LeaveBalanceManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}