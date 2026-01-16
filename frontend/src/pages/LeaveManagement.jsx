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
import UpcomingHolidays from '@/components/leave/UpcomingHolidays';

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

  const { data: workDays = [] } = useQuery({
    queryKey: ['work-days-list'],
    queryFn: () => base44.entities.WorkDay.list()
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-leave-requests-count'],
    queryFn: () => base44.entities.LeaveRequest.filter({ status: 'pending' }),
    enabled: isAdmin,
    refetchInterval: 30000
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#F8F9FC]">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 pb-32">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-soft-light"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black/10"></div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-12">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-black text-white tracking-tight">Leave Management</h1>
                  <p className="text-emerald-100 font-medium">Plan your time off & approvals</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {isAdmin && (
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 mr-2">
                  <Link to={createPageUrl('LeaveApprovals')}>
                    <Button variant="ghost" className="text-white hover:bg-white/20 h-10 rounded-xl px-4 relative">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approvals
                      {pendingRequests.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-emerald-600">
                          {pendingRequests.length}
                        </span>
                      )}
                    </Button>
                  </Link>
                  <div className="w-[1px] h-5 bg-white/20"></div>
                  <Link to={createPageUrl('LeaveSettings')}>
                    <Button variant="ghost" className="text-white hover:bg-white/20 h-10 rounded-xl px-4">
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                  </Link>
                </div>
              )}

              <Button
                onClick={() => setShowRequestForm(true)}
                className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-xl shadow-emerald-900/20 rounded-xl h-12 px-6 border-0 font-bold transition-transform hover:scale-105 active:scale-95"
              >
                <Plus className="w-5 h-5 mr-2" />
                Request Leave
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 -mt-20 relative z-10 pb-12">
        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <LeaveBalanceWidget
              balances={myBalances}
              leaveTypes={leaveTypes}
              userEmail={user.email}
              currentYear={currentYear}
            />
          </div>
          <div>
            <UpcomingHolidays workDays={workDays} />
          </div>
        </div>

        {/* Tabs Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <Tabs defaultValue="my-requests" className="p-1">
            <div className="border-b border-slate-100 px-6 pt-4">
              <TabsList className="bg-slate-100/50 p-1 rounded-2xl inline-flex mb-4">
                <TabsTrigger
                  value="my-requests"
                  className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  My Requests
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Team Calendar
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-6 bg-slate-50/30 min-h-[400px]">
              <TabsContent value="my-requests" className="mt-0 focus-visible:ring-0">
                <MyLeaveRequests
                  requests={myRequests}
                  leaveTypes={leaveTypes}
                />
              </TabsContent>

              <TabsContent value="calendar" className="mt-0 focus-visible:ring-0">
                <LeaveCalendar
                  approvedLeaves={allApprovedLeaves}
                  leaveTypes={leaveTypes}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

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