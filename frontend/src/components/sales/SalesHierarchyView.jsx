import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  ChevronRight, ChevronDown, User, Users, TrendingUp, DollarSign, 
  Download, Filter, Calendar, Network, List, TrendingDown, Award, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import { getCategoryLabel } from '@/components/utils/userDisplay';

const CATEGORY_CONFIG = {
  internal: { label: 'Internal Team', color: 'bg-blue-100 text-blue-700', icon: Users },
  realtor: { label: 'Realtor', color: 'bg-purple-100 text-purple-700', icon: User },
  cp: { label: 'Channel Partner', color: 'bg-green-100 text-green-700', icon: TrendingUp },
  acp: { label: 'Associate CP', color: 'bg-amber-100 text-amber-700', icon: Award },
  rm: { label: 'Relationship Manager', color: 'bg-pink-100 text-pink-700', icon: Network }
};

const HierarchyRow = ({ node, level = 0, targets = {} }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasSubordinates = node.subordinates && node.subordinates.length > 0;
  
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
  
  const userTarget = targets[node.user.email] || { walkin_target: 30, booking_count_target: 3 };
  const walkInProgress = userTarget.walkin_target > 0 ? Math.min(100, (node.self_metrics.walk_ins / userTarget.walkin_target) * 100) : 0;
  const closureProgress = userTarget.booking_count_target > 0 ? Math.min(100, (node.self_metrics.closures / userTarget.booking_count_target) * 100) : 0;
  
  const avgProgress = (walkInProgress + closureProgress) / 2;
  
  const getRankingBadge = () => {
    if (avgProgress >= 100) return { label: 'Top Performer', color: 'bg-green-100 text-green-700', icon: Award };
    if (avgProgress >= 80) return { label: 'Improving', color: 'bg-blue-100 text-blue-700', icon: TrendingUp };
    if (avgProgress >= 50) return null;
    if (avgProgress >= 30) return { label: 'Declining', color: 'bg-amber-100 text-amber-700', icon: TrendingDown };
    return { label: 'Underperforming', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
  };

  const ranking = getRankingBadge();
  const userCategory = node.user.user_category || 'internal';
  const category = CATEGORY_CONFIG[userCategory];

  return (
    <>
      <TableRow className="hover:bg-slate-50/50">
        <TableCell className="py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
            {hasSubordinates ? (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0 text-slate-400 hover:text-slate-600"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <div className="w-6 h-6 shrink-0" />
            )}
            
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarFallback className="bg-indigo-50 text-indigo-600 text-xs">
                  {getInitials(node.user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm text-slate-900 truncate">
                    {node.user.full_name} — ({getCategoryLabel(node.user)})
                  </p>
                  {ranking && (
                    <Badge className={`text-[10px] h-4 px-1.5 py-0 ${ranking.color} flex items-center gap-0.5`}>
                      <ranking.icon className="w-2.5 h-2.5" />
                      {ranking.label}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{node.user.email}</span>
                  {node.user.territory && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
                      {node.user.territory}
                    </Badge>
                  )}
                </div>
                {avgProgress > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <Progress value={avgProgress} className="h-1.5 flex-1" />
                    <span className="text-[10px] font-medium text-slate-600 min-w-[35px]">{Math.round(avgProgress)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        
        <TableCell className="text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-medium text-slate-700">{node.self_metrics.walk_ins}</span>
            <span className="text-[10px] text-slate-400">/ {userTarget.walkin_target}</span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-medium text-emerald-600">{node.self_metrics.closures}</span>
            <span className="text-[10px] text-slate-400">/ {userTarget.booking_count_target}</span>
          </div>
        </TableCell>
        
        <TableCell className="text-right bg-slate-50/50">
           <div className="flex flex-col items-end gap-0.5">
             <span className="font-medium text-blue-700">{node.team_metrics.walk_ins}</span>
             {hasSubordinates && (
               <span className="text-[10px] text-slate-400">
                 (Self: {node.self_metrics.walk_ins})
               </span>
             )}
           </div>
        </TableCell>
        <TableCell className="text-right bg-slate-50/50">
           <div className="flex flex-col items-end gap-0.5">
             <span className="font-medium text-emerald-700">{node.team_metrics.closures}</span>
             {hasSubordinates && (
               <span className="text-[10px] text-slate-400">
                 (Self: {node.self_metrics.closures})
               </span>
             )}
           </div>
        </TableCell>
      </TableRow>
      
      {isExpanded && hasSubordinates && (
        node.subordinates.map(sub => (
          <HierarchyRow key={sub.user.id} node={sub} level={level + 1} targets={targets} />
        ))
      )}
    </>
  );
};

export default function SalesHierarchyView() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('table');
  const [filterTerritory, setFilterTerritory] = useState('all');
  const [filterPerformance, setFilterPerformance] = useState('all');
  const [dateRange, setDateRange] = useState('month');
  const [showFilters, setShowFilters] = useState(false);
  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setCurrentUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-hierarchy'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getHierarchySalesData');
      return res.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['sales-targets-hierarchy'],
    queryFn: () => base44.entities.SalesTarget.filter({ month: format(new Date(), 'yyyy-MM') }),
  });

  const targetsByUser = useMemo(() => {
    const map = {};
    targets.forEach(t => {
      if (t.user_email) map[t.user_email] = t;
    });
    return map;
  }, [targets]);

  const allNodes = useMemo(() => {
    if (!data?.hierarchy) return [];
    const nodes = [];
    const traverse = (node) => {
      nodes.push(node);
      if (node.subordinates) node.subordinates.forEach(traverse);
    };
    data.hierarchy.forEach(traverse);
    return nodes;
  }, [data]);

  const filteredHierarchy = useMemo(() => {
    if (!data?.hierarchy) return [];
    
    // Sales Manager: only show themselves + their direct reports
    const isSalesMgr = currentUser?.job_title === 'Sales Manager';
    const allowedEmails = new Set();
    
    if (isSalesMgr && currentUser) {
      // Add self
      allowedEmails.add(currentUser.email?.toLowerCase());
      
      // Collect all direct reports from hierarchy
      const collectReports = (node) => {
        if (node.user.reports_to?.toLowerCase() === currentUser.email?.toLowerCase()) {
          allowedEmails.add(node.user.email?.toLowerCase());
        }
        if (node.subordinates) {
          node.subordinates.forEach(collectReports);
        }
      };
      data.hierarchy.forEach(collectReports);
    }
    
    const filterNode = (node) => {
      // Sales Manager restriction
      if (isSalesMgr && currentUser && !allowedEmails.has(node.user.email?.toLowerCase())) {
        return null;
      }
      
      const userCategory = node.user.user_category || 'internal';
      const categoryMatch = selectedCategory === 'all' || userCategory === selectedCategory;
      const territoryMatch = filterTerritory === 'all' || node.user.territory === filterTerritory;
      
      let performanceMatch = true;
      if (filterPerformance !== 'all') {
        const target = targetsByUser[node.user.email] || { walkin_target: 30, booking_count_target: 3 };
        const walkInProg = target.walkin_target > 0 ? (node.self_metrics.walk_ins / target.walkin_target) * 100 : 0;
        const closureProg = target.booking_count_target > 0 ? (node.self_metrics.closures / target.booking_count_target) * 100 : 0;
        const avg = (walkInProg + closureProg) / 2;
        
        if (filterPerformance === 'top' && avg < 100) performanceMatch = false;
        if (filterPerformance === 'improving' && (avg < 80 || avg >= 100)) performanceMatch = false;
        if (filterPerformance === 'declining' && (avg < 30 || avg >= 50)) performanceMatch = false;
        if (filterPerformance === 'underperforming' && avg >= 30) performanceMatch = false;
      }
      
      const matches = categoryMatch && territoryMatch && performanceMatch;
      
      const filteredSubs = node.subordinates ? node.subordinates.map(filterNode).filter(Boolean) : [];
      
      if (matches || filteredSubs.length > 0) {
        return { ...node, subordinates: filteredSubs };
      }
      
      return null;
    };
    
    return data.hierarchy.map(filterNode).filter(Boolean);
  }, [data, selectedCategory, filterTerritory, filterPerformance, targetsByUser, currentUser]);

  const territories = useMemo(() => {
    const terrs = new Set();
    allNodes.forEach(n => { if (n.user.territory) terrs.add(n.user.territory); });
    return Array.from(terrs);
  }, [allNodes]);

  const summaryStats = useMemo(() => {
    let totalWalkIns = 0, totalClosures = 0, topPerformers = 0, underperformers = 0;
    allNodes.forEach(n => {
      totalWalkIns += n.self_metrics.walk_ins || 0;
      totalClosures += n.self_metrics.closures || 0;
      const target = targetsByUser[n.user.email] || { walkin_target: 30, booking_count_target: 3 };
      const avg = ((n.self_metrics.walk_ins / target.walkin_target + n.self_metrics.closures / target.booking_count_target) / 2) * 100;
      if (avg >= 100) topPerformers++;
      if (avg < 30) underperformers++;
    });
    return { totalWalkIns, totalClosures, topPerformers, underperformers, totalMembers: allNodes.length };
  }, [allNodes, targetsByUser]);

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Team Hierarchy Performance Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 28);
    doc.text(`Total Members: ${summaryStats.totalMembers} | Total Walk-Ins: ${summaryStats.totalWalkIns} | Total Closures: ${summaryStats.totalClosures}`, 14, 35);
    
    let yPos = 45;
    doc.setFontSize(9);
    allNodes.forEach((n, idx) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      const cat = CATEGORY_CONFIG[n.user.user_category || 'internal'].label;
      doc.text(`${n.user.full_name} (${cat}) - Walk-Ins: ${n.self_metrics.walk_ins}, Closures: ${n.self_metrics.closures}`, 14, yPos);
      yPos += 6;
    });
    
    doc.save('hierarchy-performance.pdf');
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-red-500">Failed to load hierarchy data</div>;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Team Hierarchy Performance</h3>
              <p className="text-sm text-slate-500">Monitor individual and aggregated team KPIs across the reporting structure</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Popover open={showFilters} onOpenChange={setShowFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-2 block">Territory</label>
                    <Select value={filterTerritory} onValueChange={setFilterTerritory}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Territories</SelectItem>
                        {territories.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs font-medium text-slate-700 mb-2 block">Performance Level</label>
                    <Select value={filterPerformance} onValueChange={setFilterPerformance}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="top">Top Performers (≥100%)</SelectItem>
                        <SelectItem value="improving">Improving (80-99%)</SelectItem>
                        <SelectItem value="declining">Declining (30-49%)</SelectItem>
                        <SelectItem value="underperforming">Underperforming (&lt;30%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button variant="outline" size="sm" onClick={exportToPDF}>
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">{summaryStats.totalMembers}</p>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium">Total Walk-Ins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">{summaryStats.totalWalkIns}</p>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <Award className="w-3 h-3 text-green-600" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{summaryStats.topPerformers}</p>
            </CardContent>
          </Card>
          
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                Underperformers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{summaryStats.underperformers}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="p-4">
        <TabsList className="grid grid-cols-6 w-fit">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="internal">Internal Team</TabsTrigger>
          <TabsTrigger value="realtor">Realtors</TabsTrigger>
          <TabsTrigger value="cp">CP</TabsTrigger>
          <TabsTrigger value="acp">ACP</TabsTrigger>
          <TabsTrigger value="rm">RM</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
            <TableHead className="w-[45%] pl-6">Member</TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-slate-500">
              Walk-Ins
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-slate-500">
              Closures
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-slate-700 bg-slate-100/50">
              Team Walk-Ins
            </TableHead>
            <TableHead className="text-right text-xs uppercase tracking-wider font-semibold text-slate-700 bg-slate-100/50">
              Team Closures
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredHierarchy.length > 0 ? (
            filteredHierarchy.map(rootNode => (
              <HierarchyRow key={rootNode.user.id} node={rootNode} targets={targetsByUser} />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                No data matching current filters. Try adjusting your filter criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}