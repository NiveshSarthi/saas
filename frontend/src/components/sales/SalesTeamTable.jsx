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
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Check, X, AlertTriangle, Award, User } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

export default function SalesTeamTable({ userStats, trackingPeriod }) {
  const [sortConfig, setSortConfig] = useState({ key: 'walkInCompliance', direction: 'desc' });

  const sortedStats = [...userStats].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  const getDailyStatusColor = (status) => {
    if (status === 'met') return 'bg-emerald-500';
    if (status === 'partial') return 'bg-amber-500';
    return 'bg-slate-200';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Team Leaderboard</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Member</TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('walkInsCount')}>
                <div className="flex items-center justify-center gap-2">
                  Walk-Ins
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-center">Daily Trend</TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('closuresCount')}>
                <div className="flex items-center justify-center gap-2">
                  Closures
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('closureCompliance')}>
                <div className="flex items-center justify-center gap-2">
                  Closure Perf.
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
              <TableHead className="text-center cursor-pointer hover:bg-slate-50" onClick={() => requestSort('walkInCompliance')}>
                <div className="flex items-center justify-center gap-2">
                  Walk-In Perf.
                  <ArrowUpDown className="w-4 h-4" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedStats.map((stat, index) => (
              <TableRow key={stat.user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="w-9 h-9 border-2 border-white shadow-sm">
                        <AvatarFallback className="bg-indigo-100 text-indigo-600 font-medium">
                          {getInitials(stat.user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && (
                        <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-0.5 border border-white shadow-sm">
                          <Award className="w-3 h-3 text-yellow-900" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900 flex items-center gap-2">
                        {stat.user.full_name}
                        {stat.user.type === 'invitation' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">Invited</Badge>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">{stat.user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="font-bold text-slate-900">{stat.walkInsCount}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-1">
                    <TooltipProvider>
                      {stat.dailyProgress.slice(-7).map((day, i) => (
                        <Tooltip key={i}>
                          <TooltipTrigger>
                            <div 
                              className={`w-3 h-8 rounded-sm ${getDailyStatusColor(day.status)} transition-all hover:opacity-80`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{format(new Date(day.date), 'MMM d')}</p>
                            <p className="text-xs">{day.count} Walk-ins</p>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="font-bold text-slate-900">{stat.closuresCount}</div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    {stat.targets.closureTarget > 0 ? (
                      <Badge 
                        className={
                          stat.closureCompliance >= 100 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                            : stat.closureCompliance >= 80 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                              : 'bg-red-100 text-red-700 hover:bg-red-100'
                        }
                      >
                        {stat.closureCompliance}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 bg-slate-50">
                        {stat.closuresCount > 0 ? 'Bonus' : '-'}
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-500">of Closure Target</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    {stat.targets.walkInTarget > 0 ? (
                      <Badge 
                        className={
                          stat.walkInCompliance >= 100 
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' 
                            : stat.walkInCompliance >= 80 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                              : 'bg-red-100 text-red-700 hover:bg-red-100'
                        }
                      >
                        {stat.walkInCompliance}%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 bg-slate-50">
                        {stat.walkInsCount > 0 ? 'Bonus' : '-'}
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-500">of Walk-in Target</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}