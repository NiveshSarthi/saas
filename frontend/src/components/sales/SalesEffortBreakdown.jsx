import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';

export default function SalesEffortBreakdown({ userStats }) {
  const [sortConfig, setSortConfig] = useState({ key: 'walkInsCount', direction: 'desc' });

  const sortedStats = [...userStats].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <Card className="mt-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Efforts Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Member</TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('walkInsCount')}>
                <div className="flex items-center justify-center gap-2">Walk-Ins <ArrowUpDown className="w-4 h-4" /></div>
              </TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('meetingsCount')}>
                <div className="flex items-center justify-center gap-2">Meetings <ArrowUpDown className="w-4 h-4" /></div>
              </TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('siteVisitsCount')}>
                <div className="flex items-center justify-center gap-2">Site Visits <ArrowUpDown className="w-4 h-4" /></div>
              </TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('bookingsCount')}>
                <div className="flex items-center justify-center gap-2">Closures <ArrowUpDown className="w-4 h-4" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map((stat) => (
              <TableRow key={stat.email}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-indigo-100 text-indigo-600">{getInitials(stat.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm text-slate-900">{stat.name}</p>
                      <p className="text-xs text-slate-500">{stat.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                   <div className="font-medium">{stat.walkInsCount}</div>
                   {stat.targets.walkins > 0 && <div className="text-[10px] text-slate-400">Target: {stat.targets.walkins}</div>}
                </TableCell>
                <TableCell className="text-center">
                   <div className="font-medium">{stat.meetingsCount}</div>
                   {stat.targets.meetings > 0 && <div className="text-[10px] text-slate-400">Target: {stat.targets.meetings}</div>}
                </TableCell>
                <TableCell className="text-center">
                   <div className="font-medium">{stat.siteVisitsCount}</div>
                   {stat.targets.site_visits > 0 && <div className="text-[10px] text-slate-400">Target: {stat.targets.site_visits}</div>}
                </TableCell>
                <TableCell className="text-center">
                   <div className="font-medium text-emerald-600">{stat.bookingsCount}</div>
                   {stat.targets.bookings > 0 && <div className="text-[10px] text-slate-400">Target: {stat.targets.bookings}</div>}
                </TableCell>
              </TableRow>
            ))}
            {sortedStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">No data for this period</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}