import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LeaveBalanceManager() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingBalance, setEditingBalance] = useState(null);
  const [editForm, setEditForm] = useState({ total_allocated: 0, available: 0 });

  const { data: users = [] } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      let activeUsers = [];
      let invitedUsers = [];

      try {
        const response = await base44.functions.invoke('getDashboardUsers');
        console.log('LeaveBalanceManager: getDashboardUsers raw response', response);

        let usersList = [];
        let invList = [];

        // Handle various response structures (Axios wrap + Backend wrap)
        // 1. Double nested: response.data.data.users
        if (response.data?.data?.users) {
          usersList = response.data.data.users;
          invList = response.data.data.invitations || [];
        }
        // 2. Single nested: response.data.users
        else if (response.data?.users) {
          usersList = response.data.users;
          invList = response.data.invitations || [];
        }
        // 3. Direct: response.users
        else if (response.users) {
          usersList = response.users;
          invList = response.invitations || [];
        }

        console.log('LeaveBalanceManager: Extracted users:', usersList.length);

        activeUsers = usersList.map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name || u.email.split('@')[0],
          role: u.role,
          department_id: u.department_id
        }));

        invitedUsers = invList.map(i => ({
          id: `invite-${i.id}`,
          email: i.email,
          full_name: i.email.split('@')[0] + ' (Invited)',
          role: i.role,
          department_id: i.department_id,
          is_invited: true
        }));

      } catch (e) {
        console.error('LeaveBalanceManager: getDashboardUsers failed', e);
      }

      // Fallback if no users found via function
      if (activeUsers.length === 0) {
        console.warn('LeaveBalanceManager: No users from function, falling back to Entity API');
        try {
          const directUsers = await base44.entities.User.list();
          activeUsers = directUsers.map(u => ({
            id: u.id,
            email: u.email,
            full_name: u.full_name || u.email.split('@')[0],
            role: u.role,
            department_id: u.department_id
          }));
        } catch (e) {
          console.error('LeaveBalanceManager: User.list failed', e);
        }
      }

      return [...activeUsers, ...invitedUsers]
        .filter(u => u.email !== 'admin@saas.com' && u.email !== 'system@saas.com')
        .sort((a, b) => a.full_name.localeCompare(b.full_name));
    },
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const types = await base44.entities.LeaveType.list();
      return types.filter(t => t.is_active !== false);
    },
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['all-leave-balances', selectedYear],
    queryFn: () => base44.entities.LeaveBalance.filter({ year: selectedYear }),
  });

  const initializeBalancesMutation = useMutation({
    mutationFn: async () => {
      // users is now directly available from the query hook scope or we can use queryClient.getQueryData
      // But simpler to just rely on the 'users' variable that is in scope from the useQuery destructuring
      // However, inside mutationFn, we should probably access the data passed or use the state. 
      // Actually, 'users' from line 15 is available in closure scope.
      // But query might not be fresh. Better to use the users variable we defined.

      const created = [];

      for (const user of users) {
        for (const leaveType of leaveTypes) {
          const existing = balances.find(
            b => b.user_email === user.email && b.leave_type_id === leaveType.id
          );

          if (!existing) {
            await base44.entities.LeaveBalance.create({
              user_email: user.email,
              leave_type_id: leaveType.id,
              year: selectedYear,
              total_allocated: leaveType.days_allowed,
              used: 0,
              pending: 0,
              available: leaveType.days_allowed,
              carried_forward: 0
            });
            created.push({ user: user.email, type: leaveType.name });
          }
        }
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries(['all-leave-balances']);
      toast.success(`Initialized ${created.length} balances`);
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async (data) => {
      console.log('Mutating balance...', { editingBalance, data });
      const allocated = parseInt(data.total_allocated || 0);
      const available = parseInt(data.available || 0);

      if (editingBalance.id) {
        return await base44.entities.LeaveBalance.update(editingBalance.id, {
          total_allocated: allocated,
          available: available
        });
      } else {
        return await base44.entities.LeaveBalance.create({
          user_email: editingBalance.user_email,
          leave_type_id: editingBalance.leave_type_id,
          year: selectedYear,
          total_allocated: allocated,
          used: 0,
          pending: 0,
          available: available,
          carried_forward: 0
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['all-leave-balances']);
      setEditingBalance(null);
      toast.success('Balance updated successfully');
    },
    onError: (e) => {
      console.error('Update failed:', e);
      toast.error('Failed to update balance: ' + e.message);
    }
  });

  const handleEditClick = (balance, user, type) => {
    console.log('Editing balance:', { balance, user, type });
    const initial = balance || {
      user_email: user.email,
      leave_type_id: type.id,
      total_allocated: type.days_allowed || 0,
      available: type.days_allowed || 0,
      used: 0
    };
    setEditingBalance(initial);
    setEditForm({
      total_allocated: initial.total_allocated || 0,
      available: initial.available || 0
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={() => initializeBalancesMutation.mutate()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Initialize Default Balances
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Employee</TableHead>
              {leaveTypes.map(type => (
                <TableHead key={type.id}>{type.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.email}>
                <TableCell>
                  <div>
                    <p className="font-medium">{user.full_name}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                </TableCell>
                {leaveTypes.map(type => {
                  const balance = balances.find(
                    b => b.user_email === user.email && b.leave_type_id === type.id
                  );

                  return (
                    <TableCell key={type.id} className="relative group p-4 border-l border-slate-50">
                      {balance ? (
                        <div className="text-sm">
                          <p className="font-bold text-slate-700">{balance.available} <span className="text-slate-400 font-normal">/ {balance.total_allocated}</span></p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">
                            Used: {balance.used}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 font-normal">Not Set</Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 h-6 w-6 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        onClick={() => handleEditClick(balance, user, type)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingBalance} onOpenChange={(open) => !open && setEditingBalance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Leave Balance</DialogTitle>
          </DialogHeader>
          {editingBalance && (
            <div className="space-y-4 py-4">
              <div className="text-sm text-slate-500 mb-4">
                Editing balance for <span className="font-semibold text-slate-900">{editingBalance.user_email}</span>
              </div>

              <div className="grid gap-2">
                <Label>Total Allocated Quota</Label>
                <Input
                  type="number"
                  value={editForm.total_allocated}
                  onChange={(e) => setEditForm({ ...editForm, total_allocated: e.target.value })}
                />
                <p className="text-xs text-slate-500">Total days allowed for the year.</p>
              </div>

              <div className="grid gap-2">
                <Label>Currently Available</Label>
                <Input
                  type="number"
                  value={editForm.available}
                  onChange={(e) => setEditForm({ ...editForm, available: e.target.value })}
                />
                <p className="text-xs text-slate-500">
                  Remaining days they can take.
                  (Used: {editingBalance.used || 0})
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBalance(null)}>Cancel</Button>
            <Button onClick={() => updateBalanceMutation.mutate(editForm)}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}