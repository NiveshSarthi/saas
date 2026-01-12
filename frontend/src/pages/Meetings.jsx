import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Calendar,
  Clock,
  Users,
  Video,
  MoreHorizontal,
  ExternalLink,
  FolderOpen,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { MEETING_FILTERS } from '@/components/filters/filterConfigs';

export default function Meetings() {
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const { can } = usePermissions();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {}
    };
    fetchUser();
  }, []);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => base44.entities.Meeting.list('-start_date', 1000),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'meetings'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'meetings' }),
    enabled: !!user,
  });

  const canSchedule = can('calendar', 'create');

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  };

  const applyAdvancedFilters = (meeting) => {
    // Status filter
    if (advancedFilters.status?.length > 0 && !advancedFilters.status.includes(meeting.status)) {
      return false;
    }
    // Participants filter
    if (advancedFilters.participants?.length > 0) {
      if (!advancedFilters.participants.some(email => meeting.participants?.includes(email))) {
        return false;
      }
    }
    // Project filter
    if (advancedFilters.project_id && meeting.project_id !== advancedFilters.project_id) {
      return false;
    }
    return true;
  };

  const filteredMeetings = meetings.filter(meeting => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(meeting)) return false;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (!meeting.title.toLowerCase().includes(searchLower) &&
          !(meeting.description || '').toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Tab filter
    const now = new Date();
    const startDate = parseISO(meeting.start_date);
    
    switch (activeTab) {
      case 'created':
        return meeting.created_by === user?.email;
      case 'invited':
        return meeting.participants?.includes(user?.email) && meeting.created_by !== user?.email;
      case 'past':
        return isPast(startDate) && meeting.status !== 'in_progress';
      case 'all':
      default:
        return !isPast(startDate) || meeting.status === 'in_progress';
    }
  });

  const handleSaveFilter = async (filterData) => {
    await base44.entities.SavedFilter.create({
      ...filterData,
      created_by: user?.email,
      is_global: user?.role === 'admin'
    });
  };

  const handleLoadFilter = (savedFilter) => {
    setAdvancedFilters(savedFilter.filters);
  };

  const handleDeleteFilter = async (filterId) => {
    await base44.entities.SavedFilter.delete(filterId);
  };

  const handleRemoveFilter = (field) => {
    setAdvancedFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[field];
      return newFilters;
    });
  };

  const handleClearAllFilters = () => {
    setAdvancedFilters({});
  };

  const getDateLabel = (dateStr) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d, yyyy');
  };

  const getInitials = (email) => {
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Meetings</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Schedule and manage meetings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAdvancedFilter(true)}>
            <Filter className="w-4 h-4 mr-2" />
            Advanced Filters
          </Button>
          {canSchedule && (
            <Link to={createPageUrl('ScheduleMeeting')}>
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      {Object.keys(advancedFilters).length > 0 && (
        <FilterChips
          filters={advancedFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAllFilters}
          moduleConfig={MEETING_FILTERS}
        />
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search meetings..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100">
          <TabsTrigger value="all">Upcoming</TabsTrigger>
          <TabsTrigger value="created">Created by me</TabsTrigger>
          <TabsTrigger value="invited">Invited</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-4">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl">
              <Video className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No meetings found</h3>
              <p className="text-slate-500 mb-6">
                {activeTab === 'past' ? "No past meetings" : "Schedule a meeting to get started"}
              </p>
              {canSchedule && activeTab !== 'past' && (
                <Link to={createPageUrl('ScheduleMeeting')}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Meeting
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            filteredMeetings.map((meeting) => {
              const startDate = parseISO(meeting.start_date);
              const endDate = parseISO(meeting.end_date);
              const isUpcoming = !isPast(startDate);

              return (
                <Link 
                  key={meeting.id} 
                  to={createPageUrl(`MeetingRoom?id=${meeting.id}`)}
                  className="block"
                >
                  <div className={cn(
                    "bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-4 md:p-5 hover:shadow-md transition-shadow",
                    meeting.status === 'in_progress' && "border-green-300 bg-green-50/50"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-900">{meeting.title}</h3>
                          {meeting.status === 'in_progress' && (
                            <Badge className="bg-green-100 text-green-700">In Progress</Badge>
                          )}
                          {meeting.status === 'cancelled' && (
                            <Badge variant="destructive">Cancelled</Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {getDateLabel(meeting.start_date)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {format(startDate, 'HH:mm')} - {format(endDate, 'HH:mm')}
                          </div>
                          {meeting.project_id && (
                            <div className="flex items-center gap-1">
                              <FolderOpen className="w-4 h-4" />
                              {getProjectName(meeting.project_id)}
                            </div>
                          )}
                        </div>

                        {meeting.description && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-1">
                            {meeting.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Participants */}
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <div className="flex -space-x-2">
                            {(meeting.participants || []).slice(0, 4).map((email, i) => (
                              <Avatar key={i} className="w-7 h-7 border-2 border-white">
                                <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-600">
                                  {getInitials(email)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {(meeting.participants || []).length > 4 && (
                              <div className="w-7 h-7 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-600">
                                +{meeting.participants.length - 4}
                              </div>
                            )}
                          </div>
                        </div>

                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Join
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Tabs>

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        filters={advancedFilters}
        onApplyFilters={setAdvancedFilters}
        moduleConfig={MEETING_FILTERS}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />
    </div>
  );
}