// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { sendAssignmentNotification, MODULES } from '@/components/utils/notificationService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
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
  TrendingUp,
  Target,
  Info,
  HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import VideoKanban from '@/components/marketing/VideoKanban';
import VideoListView from '@/components/marketing/VideoListView';
import AddVideoModal from '@/components/marketing/AddVideoModal';
import VideoDetailModal from '@/components/marketing/VideoDetailModal';
import MarketingKPIManager from '@/components/marketing/MarketingKPIManager';
import MarketingDailyLogger from '@/components/marketing/MarketingDailyLogger';
import MarketingKPIDashboard from '@/components/marketing/MarketingKPIDashboard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function MarketingPage() {
  const { isAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('kanban');
  const [activeTab, setActiveTab] = useState('workflow');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Auth Check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);

        // Use permissions context for super_admin bypass
        if (currentUser.role_id === 'super_admin' || currentUser.role === 'admin') {
          setIsAuthorized(true);
        } else {
          // Check for specific departments only if not super_admin
          const depts = await base44.entities.Department.list();
          const marketingDept = depts.find(d => d.name.toLowerCase().includes('marketing'));
          const itDept = depts.find(d => d.name.toLowerCase().includes('it'));

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

  // Fetch videos
  const { data: videos = [], refetch: refetchVideos } = useQuery({
    queryKey: ['videos'],
    queryFn: () => base44.entities.Video.list('-created_at', 500),
    enabled: isAuthorized
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['marketing-categories'],
    queryFn: () => base44.entities.MarketingCategory.list('name', 100),
    enabled: isAuthorized
  });

  // Fetch departments and users
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
    enabled: isAuthorized
  });

  const { data: usersFromEntity = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_at', 2000),
    enabled: isAuthorized
  });

  // Create video mutation
  const createVideoMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.Video.create(data);
      // Log activity
      await base44.entities.VideoLog.create({
        video_id: result.id || result._id,
        action: 'created',
        user_email: user?.email,
        user_name: user?.full_name || user?.email,
      });

      // Send notifications to assigned team members
      const roles = [
        { key: 'assigned_director', label: 'Director' },
        { key: 'assigned_cameraman', label: 'Cameraman' },
        { key: 'assigned_editor', label: 'Editor' },
        { key: 'assigned_manager', label: 'Manager' }
      ];

      for (const role of roles) {
        if (data[role.key]) {
          await sendAssignmentNotification({
            assignedTo: data[role.key],
            assignedBy: user?.email,
            assignedByName: user?.full_name || user?.email,
            module: MODULES.MARKETING_TASK, // Using Marketing Task module
            itemName: data.title,
            itemId: result.id || result._id,
            description: `Role: ${role.label}`,
            link: `/Marketing?video=${result.id || result._id}`, // Assuming this link structure, or just /Marketing
            metadata: {}
          });
        }
      }

      return result;
    },
    onSuccess: () => {
      toast.success('Video created successfully');
      refetchVideos();
      setIsAddModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create video');
    }
  });

  // Filter videos
  const filteredVideos = useMemo(() => {
    return videos.filter(video => {
      // Don't show deleted videos
      if (video.is_deleted) return false;

      // Category filter
      if (categoryFilter !== 'all' && video.category_id !== categoryFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && video.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          video.title?.toLowerCase().includes(search) ||
          video.description?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [videos, categoryFilter, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const activeVideos = videos.filter(v => !v.is_deleted);
    return {
      total: activeVideos.length,
      shoot: activeVideos.filter(v => v.status === 'shoot').length,
      editing: activeVideos.filter(v => v.status === 'editing').length,
      review: activeVideos.filter(v => v.status === 'review').length,
      posted: activeVideos.filter(v => v.status === 'posted').length
    };
  }, [videos]);

  const handleEditVideo = (video) => {
    setSelectedVideo(video);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedVideo(null);
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

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
      {/* Header */}
      <div className="relative mb-4 sm:mb-6 md:mb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl -z-10" />
        <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:gap-5 md:gap-6">
            {/* Title Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Video className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent truncate">
                    Marketing Collateral
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 mt-0.5 hidden sm:block">
                    Video production workflow • Content management • Team collaboration
                  </p>
                </div>
              </div>

              {/* Help Tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="hidden md:flex">
                      <HelpCircle className="w-5 h-5 text-slate-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Video Workflow Guide</p>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        <li><strong>Shoot</strong>: Video planning stage</li>
                        <li><strong>Editing</strong>: Requires Raw File URL</li>
                        <li><strong>Review</strong>: Requires Revision URL</li>
                        <li><strong>Approval</strong>: Requires Final URL</li>
                        <li><strong>Posting/Posted</strong>: Publication stages</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Action Buttons Section */}
            {activeTab === 'workflow' && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <Input
                    placeholder="Search videos..."
                    className="pl-9 sm:pl-10 h-10 sm:h-11 bg-white/90 backdrop-blur-sm border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 rounded-lg sm:rounded-xl shadow-sm transition-all text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

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
                </div>

                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-10 sm:h-11 px-4 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all rounded-lg sm:rounded-xl font-semibold text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-2" />
                  <span className="hidden sm:inline">Add Video</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            )}

            {activeTab === 'kpi' && (
              <MarketingDailyLogger user={user} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col pb-6">
        <TabsList className="mb-4 sm:mb-6 bg-white/80 backdrop-blur-xl rounded-lg sm:rounded-xl p-1 sm:p-1.5 border border-slate-200 shadow-sm inline-flex w-full sm:w-fit overflow-x-auto">
          <TabsTrigger
            value="workflow"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/30 rounded-md sm:rounded-lg px-3 sm:px-6 py-2 sm:py-2.5 font-medium transition-all text-xs sm:text-sm whitespace-nowrap flex-1 sm:flex-none"
          >
            <Video className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
            <span className="hidden sm:inline">Video Workflow</span>
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
          {/* Stats Bar */}
          <div className="flex flex-wrap gap-3 bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
              <span className="text-sm text-slate-500">Total:</span>
              <span className="font-semibold text-slate-800">{stats.total}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
              <span className="text-sm text-amber-600">Shoot:</span>
              <span className="font-semibold text-amber-700">{stats.shoot}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-600">Editing:</span>
              <span className="font-semibold text-blue-700">{stats.editing}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
              <span className="text-sm text-purple-600">Review:</span>
              <span className="font-semibold text-purple-700">{stats.review}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
              <span className="text-sm text-emerald-600">Posted:</span>
              <span className="font-semibold text-emerald-700">{stats.posted}</span>
            </div>

            {/* Filters */}
            <div className="flex-1" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px] bg-white text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id || cat._id} value={cat.id || cat._id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Onboarding tip for new users */}
          {videos.length === 0 && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-indigo-800">Welcome to Video Workflow!</p>
                <p className="text-sm text-indigo-600 mt-1">
                  Click "Add Video" to create your first video. Videos will move through stages:
                  <span className="font-medium"> Shoot → Editing → Review → Revision → Approval → Posting → Posted</span>.
                  Each transition may require specific URLs (Raw File, Revision, or Final URLs).
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-h-[500px] bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/20 shadow-lg p-3 sm:p-4 md:p-6">
            {viewMode === 'kanban' && (
              <VideoKanban
                videos={filteredVideos}
                categories={categories}
                users={usersFromEntity}
                onEditVideo={handleEditVideo}
                user={user}
                refetch={refetchVideos}
                isAdmin={isAdmin()}
              />
            )}
            {viewMode === 'list' && (
              <VideoListView
                videos={filteredVideos}
                categories={categories}
                users={usersFromEntity}
                onEditVideo={handleEditVideo}
                isAdmin={isAdmin()}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="kpi" className="mt-0 data-[state=active]:block pb-6">
          <MarketingKPIDashboard users={usersFromEntity} departments={departments} />
        </TabsContent>

        {user?.role === 'admin' && (
          <TabsContent value="settings" className="mt-0 data-[state=active]:block pb-6">
            <MarketingKPIManager />
          </TabsContent>
        )}
      </Tabs>

      {/* Add Video Modal */}
      <AddVideoModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={createVideoMutation.mutate}
        categories={categories}
        users={usersFromEntity}
        currentUser={user}
      />

      {/* Video Detail Modal */}
      <VideoDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        video={selectedVideo}
        categories={categories}
        users={usersFromEntity}
        currentUser={user}
        isAdmin={isAdmin()}
        onRefetch={refetchVideos}
      />
    </div>
  );
}