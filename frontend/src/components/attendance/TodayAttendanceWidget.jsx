import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import CheckInOutWidget from './CheckInOutWidget';

export default function TodayAttendanceWidget({ user }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: attendance } = useQuery({
    queryKey: ['today-attendance', user?.email, today],
    queryFn: () => base44.entities.Attendance.filter({
      user_email: user?.email,
      date: today
    }),
    enabled: !!user?.email,
    refetchInterval: 30000
  });

  const todayRecord = attendance?.[0];

  return (
    <CheckInOutWidget
      user={user}
      todayRecord={todayRecord}
      onUpdate={() => {
        queryClient.invalidateQueries({ queryKey: ['today-attendance'] });
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
      }}
    />
  );
}