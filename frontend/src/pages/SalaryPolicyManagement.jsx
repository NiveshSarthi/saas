import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, DollarSign, AlertCircle } from 'lucide-react';
import SalaryPolicyForm from '@/components/salary/SalaryPolicyForm';
import { toast } from 'sonner';

export default function SalaryPolicyManagement() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
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

  const { data: policies = [] } = useQuery({
    queryKey: ['salary-policies'],
    queryFn: () => base44.entities.SalaryPolicy.list('-updated_date'),
    enabled: isAdmin,
  });

  const { data: teamData } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
    enabled: isAdmin,
  });

  const usersFromEntity = teamData?.users || [];
  const invitations = teamData?.invitations || [];

  const allUsers = [
    ...usersFromEntity,
    ...invitations
      .filter(inv => inv.status === 'accepted')
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
      }))
  ];

  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingPolicy(null);
    setFormOpen(true);
  };

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
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
        <p className="text-slate-500">Only admin and HR users can manage salary policies.</p>
      </div>
    );
  }

  const usersWithPolicy = new Set(policies.map(p => p.user_email));
  const usersWithoutPolicy = allUsers.filter(u => !usersWithPolicy.has(u.email));

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-white/20 backdrop-blur-lg rounded-2xl">
                  <DollarSign className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Salary Policy Management</h1>
                  <p className="text-white/80 mt-1">Configure salary calculation rules for employees</p>
                </div>
              </div>
            </div>
            <Button onClick={handleCreate} className="bg-white text-emerald-600 hover:bg-white/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Policy
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Total Employees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allUsers.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">With Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{policies.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-600">Without Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{usersWithoutPolicy.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Policies List */}
        <Card>
          <CardHeader>
            <CardTitle>Salary Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {policies.map(policy => {
                const user = allUsers.find(u => u.email === policy.user_email);
                return (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">
                        {user?.full_name || policy.user_email}
                      </div>
                      <div className="text-sm text-slate-500">{policy.user_email}</div>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {policy.salary_type === 'per_day' ? 'Per Day' : 
                           policy.salary_type === 'fixed_monthly' ? 'Fixed Monthly' : 'Per Hour'}
                        </Badge>
                        {policy.salary_type === 'per_day' && (
                          <span className="text-sm text-slate-600">₹{policy.per_day_salary}/day</span>
                        )}
                        {policy.salary_type === 'fixed_monthly' && (
                          <span className="text-sm text-slate-600">₹{policy.monthly_salary}/month</span>
                        )}
                        {policy.late_penalty_enabled && (
                          <Badge className="bg-orange-100 text-orange-700">
                            Late Penalty: ₹{policy.late_penalty_per_minute}/min
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button onClick={() => handleEdit(policy)} variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                );
              })}

              {policies.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No salary policies configured</p>
                  <p className="text-sm mt-2">Click "Add Policy" to create one</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users Without Policy */}
        {usersWithoutPolicy.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-orange-600">Employees Without Salary Policy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {usersWithoutPolicy.map(user => (
                  <div
                    key={user.email}
                    className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </div>
                    <Button
                      onClick={() => {
                        setEditingPolicy({ user_email: user.email });
                        setFormOpen(true);
                      }}
                      size="sm"
                      variant="outline"
                      className="text-orange-600 border-orange-300"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Form Dialog */}
      <SalaryPolicyForm
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingPolicy(null);
        }}
        policy={editingPolicy}
        allUsers={allUsers}
      />
    </div>
  );
}