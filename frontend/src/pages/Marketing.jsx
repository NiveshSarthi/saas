import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  LayoutGrid, 
  List as ListIcon, 
  Search, 
  Filter,
  Video,
  AlertTriangle,
  Calendar as CalendarIcon,
  BarChart3,
  Target,
  TrendingUp,
  FileText
} from 'lucide-react';
import MarketingKanban from '@/components/marketing/MarketingKanban';
import MarketingList from '@/components/marketing/MarketingList';
import MarketingCalendar from '@/components/marketing/MarketingCalendar';
import MarketingStats from '@/components/marketing/MarketingStats';
import MarketingTaskModal from '@/components/marketing/MarketingTaskModal';
import MarketingKPIManager from '@/components/marketing/MarketingKPIManager';
import MarketingDailyLogger from '@/components/marketing/MarketingDailyLogger';
import MarketingKPIDashboard from '@/components/marketing/MarketingKPIDashboard';
import MarketingReports from '@/components/marketing/MarketingReports';
import AdvancedFilterPanel from '@/components/filters/AdvancedFilterPanel';
import FilterChips from '@/components/filters/FilterChips';
import { MARKETING_FILTERS } from '@/components/filters/filterConfigs';

export default function MarketingPage() {
  const [viewMode, setViewMode] = useState('kanban');
  const [activeTab, setActiveTab] = useState('workflow');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [advancedFilters, setAdvancedFilters] = useState({});
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [bulkMoveStage, setBulkMoveStage] = useState('');

  // Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        
        // Check if admin or marketing department
        if (currentUser.role === 'admin') {
          setIsAuthorized(true);
        } else {
          // Fetch departments to check if user's department is Marketing or IT
          const departments = await base44.entities.Department.list();
          const marketingDept = departments.find(d => d.name.toLowerCase().includes('marketing'));
          const itDept = departments.find(d => d.name.toLowerCase().includes('it'));
          if ((marketingDept && currentUser.department_id === marketingDept.id) ||
              (itDept && currentUser.department_id === itDept.id)) {
            setIsAuthorized(true);
          }
        }
      } catch (error) {
        console.error("Auth check failed", error);
      } finally {
        setIsLoadingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const { data: tasks = [], refetch } = useQuery({
    queryKey: ['marketing-tasks'],
    queryFn: () => base44.entities.MarketingTask.list('-updated_date', 100),
    enabled: isAuthorized
  });

  // Send notifications for overdue/due tasks
  useEffect(() => {
    if (isAuthorized && user) {
      base44.functions.invoke('notifyMarketingTasksDue', {}).catch(err => {
        console.error('Failed to send task notifications:', err);
      });
    }
  }, [isAuthorized, user]);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
    enabled: isAuthorized,
  });

  const { data: usersFromEntity = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
    enabled: isAuthorized,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
    enabled: isAuthorized,
  });

  const { data: savedFilters = [] } = useQuery({
    queryKey: ['saved-filters', 'marketing'],
    queryFn: () => base44.entities.SavedFilter.filter({ module: 'marketing' }),
    enabled: !!user,
  });

  const allUsers = [
    ...usersFromEntity,
    ...invitations
      .filter(inv => !usersFromEntity.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ];

  const marketingDeptIds = departments.filter(d => d.name?.toLowerCase().includes('marketing')).map(d => d.id);
  const marketingUsers = allUsers.filter(u => u.department_id && marketingDeptIds.includes(u.department_id));
  
  // Get unique assignees who have marketing tasks
  const assignedUserEmails = [...new Set(tasks.map(t => t.assignee_email).filter(Boolean))];
  const assignedUsers = allUsers.filter(u => assignedUserEmails.includes(u.email));

  // Get unique tags from all tasks
  const allTags = React.useMemo(() => {
    const tagSet = new Set();
    tasks.forEach(task => {
      if (task.tags && Array.isArray(task.tags)) {
        task.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const applyAdvancedFilters = (task) => {
    // Status filter
    if (advancedFilters.status?.length > 0 && !advancedFilters.status.includes(task.status)) {
      return false;
    }
    // Task type filter
    if (advancedFilters.task_type?.length > 0 && !advancedFilters.task_type.includes(task.task_type)) {
      return false;
    }
    // Video subcategory filter
    if (advancedFilters.video_subcategory?.length > 0 && !advancedFilters.video_subcategory.includes(task.video_subcategory)) {
      return false;
    }
    // Assignee filter
    if (advancedFilters.assignee_email?.length > 0 && !advancedFilters.assignee_email.includes(task.assignee_email)) {
      return false;
    }
    // Reviewer filter
    if (advancedFilters.reviewer_email?.length > 0 && !advancedFilters.reviewer_email.includes(task.reviewer_email)) {
      return false;
    }
    // Platforms filter
    if (advancedFilters.platforms?.length > 0) {
      if (!task.platforms || !advancedFilters.platforms.some(platform => task.platforms.includes(platform))) {
        return false;
      }
    }
    // Tags filter
    if (advancedFilters.tags?.length > 0) {
      if (!task.tags || !advancedFilters.tags.some(tag => task.tags.includes(tag))) {
        return false;
      }
    }
    return true;
  };

  const filteredTasks = tasks.filter(task => {
    // Apply advanced filters first
    if (!applyAdvancedFilters(task)) return false;

    // Status filter with special overdue handling
    if (statusFilter === 'overdue') {
      const now = new Date();
      const isOverdue = task.due_date && 
        new Date(task.due_date) < now && 
        !['closed', 'published', 'tracking'].includes(task.status);
      if (!isOverdue) return false;
    } else if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }

    // Assignee filter
    if (assigneeFilter !== 'all' && task.assignee_email !== assigneeFilter) return false;

    // Tag filter
    if (tagFilter !== 'all') {
      if (!task.tags || !task.tags.includes(tagFilter)) return false;
    }

    // Search filter
    return task.campaign_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           task.description?.toLowerCase().includes(searchQuery.toLowerCase());
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

  const handleCreateTask = () => {
    setSelectedTask(null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
    refetch();
  };

  const handleBulkMoveToStage = async () => {
    if (selectedTasks.length === 0 || !bulkMoveStage) return;
    
    try {
      const updates = selectedTasks.map(taskId => {
        return base44.entities.MarketingTask.update(taskId, { status: bulkMoveStage });
      });

      await Promise.all(updates);
      
      setSelectedTasks([]);
      setBulkMoveStage('');
      refetch();
      const toast = await import('sonner');
      toast.toast.success(`Moved ${selectedTasks.length} tasks to ${bulkMoveStage}`);
    } catch (error) {
      const toast = await import('sonner');
      toast.toast.error('Failed to move tasks');
    }
  };

  if (isLoadingAuth) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <AlertTriangle className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
        <p className="text-slate-500 max-w-md">
          This module is restricted to the Marketing and IT Departments, and Administrators only. 
          Please contact your administrator if you believe you should have access.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 w-full max-w-[1800px] mx-auto min-h-[calc(100vh-64px)] flex flex-col bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 overflow-x-hidden">
      {/* Enhanced Header with Gradient Background */}
      <div className="relative mb-4 sm:mb-6 md:mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl -z-10" />
        <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:gap-5 md:gap-6">
            {/* Title Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                    Marketing Collateral
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5 hidden sm:block">Content creation • Performance tracking • Team collaboration</p>
                </div>
              </div>
            </div>
            
            {/* Action Buttons Section */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {activeTab === 'workflow' && (
                <>
                  <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <Input 
                      placeholder="Search collateral..." 
                      className="pl-9 sm:pl-10 h-10 sm:h-11 bg-white/90 backdrop-blur-sm border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 rounded-lg sm:rounded-xl shadow-sm transition-all text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <Button 
                    variant="outline" 
                    onClick={() => setShowAdvancedFilter(true)}
                    className="h-10 sm:h-11 px-3 sm:px-4 border-slate-200 hover:bg-slate-50 text-sm"
                  >
                    <Filter className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Filters</span>
                  </Button>
                  
                  <div className="flex items-center bg-white/90 backdrop-blur-sm rounded-lg sm:rounded-xl border border-slate-200 p-0.5 sm:p-1 shadow-sm">
                    <Button 
                      variant={viewMode === 'kanban' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('kanban')}
                      className={`h-8 sm:h-9 px-2 sm:px-3 rounded-md sm:rounded-lg transition-all text-xs sm:text-sm ${viewMode === 'kanban' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'hover:bg-slate-100'}`}
                    >
                      <LayoutGrid className="w-4 h-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Board</span>
                    </Button>
                    <Button 
                      variant={viewMode === 'list' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('list')}
                      className={`h-8 sm:h-9 px-2 sm:px-3 rounded-md sm:rounded-lg transition-all text-xs sm:text-sm ${viewMode === 'list' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'hover:bg-slate-100'}`}
                    >
                      <ListIcon className="w-4 h-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">List</span>
                    </Button>
                    <Button 
                      variant={viewMode === 'calendar' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setViewMode('calendar')}
                      className={`h-8 sm:h-9 px-2 sm:px-3 rounded-md sm:rounded-lg transition-all text-xs sm:text-sm ${viewMode === 'calendar' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' : 'hover:bg-slate-100'}`}
                    >
                      <CalendarIcon className="w-4 h-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">Calendar</span>
                    </Button>
                  </div>

                  <Button 
                    onClick={handleCreateTask} 
                    className="h-10 sm:h-11 px-4 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all rounded-lg sm:rounded-xl font-semibold text-sm whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                    <span className="hidden sm:inline">Create Collateral</span>
                    <span className="sm:hidden">Create</span>
                  </Button>
                </>
              )}
              {activeTab === 'kpi' && (
                <MarketingDailyLogger user={user} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col pb-6">
        <TabsList className="mb-4 sm:mb-6 bg-white/80 backdrop-blur-xl rounded-lg sm:rounded-xl p-1 sm:p-1.5 border border-slate-200 shadow-sm inline-flex w-full sm:w-fit overflow-x-auto">
          <TabsTrigger 
            value="workflow"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/30 rounded-md sm:rounded-lg px-3 sm:px-6 py-2 sm:py-2.5 font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
          >
            <Video className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Content Workflow</span>
            <span className="sm:hidden">Workflow</span>
          </TabsTrigger>
          <TabsTrigger 
            value="kpi"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/30 rounded-md sm:rounded-lg px-3 sm:px-6 py-2 sm:py-2.5 font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
          >
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Performance KPIs</span>
            <span className="sm:hidden">KPIs</span>
          </TabsTrigger>
          {user?.role === 'admin' && (
            <TabsTrigger 
              value="settings"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/30 rounded-md sm:rounded-lg px-3 sm:px-6 py-2 sm:py-2.5 font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
            >
              <Target className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Target Settings</span>
              <span className="sm:hidden">Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="workflow" className="flex-1 flex flex-col data-[state=active]:flex mt-0 space-y-3 sm:space-y-4 md:space-y-6">
          {/* Basic Filters */}
          <div className="flex flex-wrap gap-2 sm:gap-3 bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px] md:w-[180px] bg-white text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="overdue">⚠️ Overdue</SelectItem>
                <SelectItem value="editing">Editing</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="revision">Revision</SelectItem>
                <SelectItem value="compliance">Compliance</SelectItem>
                <SelectItem value="compliance_revision">Compliance Revision</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="tracking">Tracking</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="trash">Trash</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full sm:w-[180px] md:w-[200px] bg-white text-sm">
                <SelectValue placeholder="Team Member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {assignedUsers.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full sm:w-[160px] md:w-[180px] bg-white text-sm">
                <SelectValue placeholder="Filter by Tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Chips */}
          {Object.keys(advancedFilters).length > 0 && (
            <FilterChips
              filters={advancedFilters}
              onRemoveFilter={handleRemoveFilter}
              onClearAll={handleClearAllFilters}
              moduleConfig={MARKETING_FILTERS}
            />
          )}

          {/* Bulk Actions Bar */}
          {selectedTasks.length > 0 && (
            <div className="bg-indigo-600 text-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-semibold text-sm sm:text-base">{selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} selected</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedTasks([])}
                  className="text-xs sm:text-sm"
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select value={bulkMoveStage} onValueChange={setBulkMoveStage}>
                  <SelectTrigger className="w-[180px] bg-white text-indigo-600">
                    <SelectValue placeholder="Select stage..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editing">Editing</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="revision">Revision</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="compliance_revision">Compliance Revision</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="tracking">Tracking</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="trash">Trash</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="secondary"
                  onClick={handleBulkMoveToStage}
                  disabled={!bulkMoveStage}
                  className="bg-white text-indigo-600 hover:bg-indigo-50 text-sm"
                >
                  Move to Stage
                </Button>
              </div>
            </div>
          )}

          {/* Stats */}
          <MarketingStats tasks={tasks} />

          {/* Content with Enhanced Container */}
          <div className={`flex-1 min-h-[500px] transition-all ${viewMode === 'calendar' ? 'p-0' : 'bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-lg p-3 sm:p-4 md:p-6'}`}>
            {viewMode === 'kanban' && (
              <MarketingKanban 
                tasks={filteredTasks} 
                onEditTask={handleEditTask}
                user={user}
                refetch={refetch}
                selectedTasks={selectedTasks}
                onSelectTask={(taskId) => {
                  setSelectedTasks(prev => 
                    prev.includes(taskId) 
                      ? prev.filter(id => id !== taskId)
                      : [...prev, taskId]
                  );
                }}
              />
            )}
            {viewMode === 'list' && (
              <MarketingList 
                tasks={filteredTasks} 
                onEditTask={handleEditTask}
                user={user}
                selectedTasks={selectedTasks}
                onSelectTask={(taskId) => {
                  setSelectedTasks(prev => 
                    prev.includes(taskId) 
                      ? prev.filter(id => id !== taskId)
                      : [...prev, taskId]
                  );
                }}
              />
            )}
            {viewMode === 'calendar' && (
              <MarketingCalendar 
                tasks={filteredTasks} 
                onEditTask={handleEditTask} 
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="kpi" className="mt-0 data-[state=active]:block pb-6">
          <MarketingKPIDashboard users={allUsers} departments={departments} />
        </TabsContent>

        {user?.role === 'admin' && (
          <TabsContent value="settings" className="mt-0 data-[state=active]:block pb-6">
            <MarketingKPIManager />
          </TabsContent>
        )}
      </Tabs>

      {/* Task Modal */}
      {isModalOpen && (
        <MarketingTaskModal 
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          task={selectedTask}
          user={user}
        />
      )}

      {/* Advanced Filter Panel */}
      <AdvancedFilterPanel
        isOpen={showAdvancedFilter}
        onClose={() => setShowAdvancedFilter(false)}
        filters={advancedFilters}
        onApplyFilters={setAdvancedFilters}
        moduleConfig={MARKETING_FILTERS}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
      />
    </div>
  );
}