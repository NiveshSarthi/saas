import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function LeaveBalanceManager() {
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: teamData } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => base44.entities.LeaveType.filter({ is_active: true }),
  });

  const { data: balances = [] } = useQuery({
    queryKey: ['all-leave-balances', selectedYear],
    queryFn: () => base44.entities.LeaveBalance.filter({ year: selectedYear }),
  });

  const initializeBalancesMutation = useMutation({
    mutationFn: async () => {
      const users = teamData?.users || [];
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
              total_allocated: leaveType.annual_quota,
              used: 0,
              pending: 0,
              available: leaveType.annual_quota,
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

  const users = teamData?.users || [];

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
          Initialize Balances
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
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
                    <TableCell key={type.id}>
                      {balance ? (
                        <div className="text-sm">
                          <p className="font-medium">{balance.available} / {balance.total_allocated}</p>
                          <p className="text-xs text-slate-500">
                            Used: {balance.used} | Pending: {balance.pending}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="secondary">Not Set</Badge>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}