import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Plus, Clock, CheckCircle2, XCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import LeaveRequestForm from '@/components/leave/LeaveRequestForm';
import LeaveBalanceWidget from '@/components/leave/LeaveBalanceWidget';
import MyLeaveRequests from '@/components/leave/MyLeaveRequests';
import LeaveCalendar from '@/components/leave/LeaveCalendar';

export default function LeaveManagementPage() {
  const [user, setUser] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const queryClient = useQueryClient();

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

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.filter({ is_active: true }),
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-leave-requests', user?.email],
    queryFn: () => base44.entities.LeaveRequest.filter(
      { user_email: user?.email },
      '-created_date'
    ),
    enabled: !!user,
  });

  const { data: allApprovedLeaves = [] } = useQuery({
    queryKey: ['approved-leaves'],
    queryFn: () => base44.entities.LeaveRequest.filter({ status: 'approved' }),
  });

  const currentYear = new Date().getFullYear();

  const { data: myBalances = [] } = useQuery({
    queryKey: ['my-leave-balances', user?.email, currentYear],
    queryFn: () => base44.entities.LeaveBalance.filter({
      user_email: user?.email,
      year: currentYear
    }),
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Calendar className="w-8 h-8 text-indigo-600" />
              Leave Management
            </h1>
            <p className="text-slate-500 mt-1">Request and track your leaves</p>
          </div>

          <div className="flex gap-3">
            {isAdmin && (
              <Link to={createPageUrl('LeaveApprovals')}>
                <Button variant="outline" size="lg">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approvals
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Link to={createPageUrl('LeaveSettings')}>
                <Button variant="outline" size="lg">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
            )}
            <Button onClick={() => setShowRequestForm(true)} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Request Leave
            </Button>
          </div>
        </div>
      </div>

      {/* Leave Balance */}
      <div className="mb-6">
        <LeaveBalanceWidget
          balances={myBalances}
          leaveTypes={leaveTypes}
          userEmail={user.email}
          currentYear={currentYear}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="my-requests" className="mt-6">
        <TabsList>
          <TabsTrigger value="my-requests">
            <Clock className="w-4 h-4 mr-2" />
            My Requests
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Team Calendar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-requests" className="mt-6">
          <MyLeaveRequests
            requests={myRequests}
            leaveTypes={leaveTypes}
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <LeaveCalendar
            approvedLeaves={allApprovedLeaves}
            leaveTypes={leaveTypes}
          />
        </TabsContent>
      </Tabs>

      {/* Request Form Dialog */}
      <LeaveRequestForm
        isOpen={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        leaveTypes={leaveTypes}
        balances={myBalances}
        currentUser={user}
      />
    </div>
  );
}