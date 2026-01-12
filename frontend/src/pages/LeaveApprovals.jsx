import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Shield, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PendingLeaveApprovals from '@/components/leave/PendingLeaveApprovals';
import LeaveHistory from '@/components/leave/LeaveHistory';

export default function LeaveApprovalsPage() {
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

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.list(),
  });

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ['pending-leave-requests'],
    queryFn: () => base44.entities.LeaveRequest.filter({ status: 'pending' }, '-created_date'),
    enabled: isAdmin,
  });

  const { data: allRequests = [] } = useQuery({
    queryKey: ['all-leave-requests'],
    queryFn: () => base44.entities.LeaveRequest.list('-created_date', 100),
    enabled: isAdmin,
  });

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
        <p className="text-slate-500 mb-4">Only admins and HR can approve leave requests.</p>
        <Link to={createPageUrl('LeaveManagement')}>
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Leave Management
          </Button>
        </Link>
      </div>
    );
  }

  const approvedCount = allRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link to={createPageUrl('LeaveManagement')}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-indigo-600" />
              Leave Approvals
            </h1>
            <p className="text-slate-500 mt-1">Review and approve leave requests</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600">Pending</p>
                <p className="text-2xl font-bold text-amber-900">{pendingRequests.length}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600">Approved</p>
                <p className="text-2xl font-bold text-green-900">{approvedCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600">Rejected</p>
                <p className="text-2xl font-bold text-red-900">{rejectedCount}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending ({pendingRequests.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-6">
          <PendingLeaveApprovals
            requests={pendingRequests}
            leaveTypes={leaveTypes}
            currentUser={user}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <LeaveHistory
            requests={allRequests.filter(r => r.status !== 'pending')}
            leaveTypes={leaveTypes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}