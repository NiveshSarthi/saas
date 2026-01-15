import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Users,
  BarChart3,
  Settings,
  Plus,
  ChevronDown,
  ChevronRight,
  Layers,
  Calendar,
  Target,
  Building2,
  Code2,
  Home,
  Menu,
  X,
  Bell,
  Sliders,
  Zap,
  List,
  Shield,
  History,
  Video,
  TrendingUp,
  TrendingDown,
  Database,
  UserCheck,
  Wallet,
  MessageSquare,
  DollarSign,
  HeadphonesIcon,
  Clock,
  UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { isSalesExecutive, isSalesManager, canAccessReportsAndProjects } from '@/components/utils/salesPermissions';
import { usePermissions } from '@/components/rbac/PermissionsContext';

const domainIcons = {
  it: Code2,
  real_estate: Building2,
  generic: Layers
};

export default function Sidebar({ projects = [], currentPage, user, collapsed, onToggle, departments = [] }) {
  const { can, isAdmin: isAdminFunc } = usePermissions();
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [salesOpen, setSalesOpen] = useState(true);
  const [leadsOpen, setLeadsOpen] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [marketingOpen, setMarketingOpen] = useState(true);

  // Check if user is in a sales department
  const salesDeptIds = Array.isArray(departments)
    ? departments
      .filter(d => d && d.name && d.name.toLowerCase().includes('sales'))
      .map(d => d.id || d._id)
    : [];
  const isSalesUser = (user?.department_id && salesDeptIds.includes(user.department_id)) ||
    (user?.job_title && ['Sales Executive', 'Sales Manager', 'Sales Head'].includes(user.job_title));

  const marketingDeptIds = departments
    .filter(d => d.name?.toLowerCase().includes('marketing'))
    .map(d => d.id || d._id);
  const isMarketingUser = user?.department_id && marketingDeptIds.includes(user.department_id);

  const itDeptIds = departments
    .filter(d => {
      const name = d.name?.toLowerCase() || '';
      return name.includes('it') || name.includes('information technology') || name.includes('tech');
    })
    .map(d => d.id || d._id);
  const isITUser = user?.department_id && itDeptIds.includes(user.department_id);

  const hrDeptIds = departments
    .filter(d => d.name?.toLowerCase().includes('hr') || d.name?.toLowerCase().includes('human resource'))
    .map(d => d.id || d._id);
  const isHRUser = user?.department_id && hrDeptIds.includes(user.department_id);

  const isFreelancer = user?.role_id === 'freelancer' || user?.role === 'freelancer';

  const isSalesExec = isSalesExecutive(user);
  const isSalesMgr = isSalesManager(user);
  const canAccessReportsProjects = canAccessReportsAndProjects(user, departments);

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
    { name: 'Timesheet', icon: Clock, page: 'Timesheet', freelancerOnly: true },
    { name: 'HR Dashboard', icon: UserCheck, page: 'HRDashboard', hrOnly: true },
    { name: 'Recruitment', icon: UserPlus, page: 'Recruitment', hrOnly: true },
    { name: 'Inventory Bucket', icon: Database, page: 'MasterData', salesOnly: true },
    { name: 'Marketing Collateral', icon: Video, page: 'Marketing', marketingOnly: true },
    { name: 'Finance', icon: Wallet, page: 'FinanceDashboard', financeOnly: true },
    { name: 'Petty Cash', icon: Wallet, page: 'PettyCashReimbursement', hrOnly: true },
    { name: 'Attendance', icon: UserCheck, page: 'Attendance' },
    { name: 'Leave', icon: Calendar, page: 'LeaveManagement', adminOnly: true },
    { name: 'Salary', icon: DollarSign, page: 'Salary', hrOnly: true },
    { name: 'Backlog', icon: Layers, page: 'Backlog' },
    { name: 'Calendar', icon: Calendar, page: 'TaskCalendar' },
    { name: 'Meetings', icon: Video, page: 'Meetings' },
    { name: 'Sprints', icon: Zap, page: 'Sprints' },
    { name: 'Reports', icon: BarChart3, page: 'Reports', hiddenForSalesExec: true },
  ];

  const adminItems = [
    { name: 'Timesheet Approval', icon: Clock, page: 'TimesheetApproval' },
    { name: 'Freelancer Reports', icon: BarChart3, page: 'FreelancerReports' },
    { name: 'Roles', icon: Shield, page: 'RoleManagement' },
    { name: 'Users', icon: Users, page: 'UserManagement' },
    { name: 'Builders', icon: Building2, page: 'BuilderManagement' },
    { name: 'Groups', icon: Users, page: 'GroupManagement' },
    { name: 'Audit Logs', icon: History, page: 'AuditLogs' },
  ];

  const bottomItems = [
    { name: 'Task List', icon: List, page: 'TaskList' },
    { name: 'Team', icon: Users, page: 'Team' },
    { name: 'Analytics', icon: BarChart3, page: 'Analytics', salesOrAdmin: true },
    { name: 'Support', icon: HeadphonesIcon, page: 'ITSupport' },
    { name: 'Settings', icon: Settings, page: 'Settings' },
  ];

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside className={cn(
        "fixed lg:relative z-50 h-full bg-slate-900 text-white transition-all duration-300 flex flex-col",
        collapsed ? "-translate-x-full lg:translate-x-0 lg:w-20" : "translate-x-0 w-full sm:w-72 lg:w-72"
      )}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">Sarthi</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Task Tracker</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4">
          {/* Main Navigation - Dashboard */}
          <div className="px-3 space-y-1">
            <Link
              to={createPageUrl('Dashboard')}
              onClick={() => window.innerWidth < 1024 && onToggle()}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                currentPage === 'Dashboard'
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">Dashboard</span>}
            </Link>
          </div>

          {/* Tasks Section */}
          {!collapsed && (
            <div className="mt-6 px-3">
              <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full">
                    {tasksOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Tasks
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1">
                  <Link
                    to={createPageUrl('TeamTasks')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'TeamTasks'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <CheckSquare className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Tasks</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Sales Section */}
          {!collapsed && (isSalesUser || isAdmin) && (
            <div className="mt-6 px-3">
              <Collapsible open={salesOpen} onOpenChange={setSalesOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full">
                    {salesOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Sales
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1">
                  <Link
                    to={createPageUrl('MyActivity')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'MyActivity'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Target className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Sales Activity</span>
                  </Link>
                  <Link
                    to={createPageUrl('SalesPerformance')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'SalesPerformance'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <TrendingUp className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Sales Performance</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Leads Section */}
          {!collapsed && (isSalesUser || isAdmin) && (
            <div className="mt-6 px-3">
              <Collapsible open={leadsOpen} onOpenChange={setLeadsOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full">
                    {leadsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Leads
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1">
                  <Link
                    to={createPageUrl('LeadManagement')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'LeadManagement'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <UserCheck className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Lead Management</span>
                  </Link>
                  <Link
                    to={createPageUrl('Leads')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'Leads'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Users className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Leads</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Marketing Section */}
          {!collapsed && (isMarketingUser || isITUser || isAdmin) && (
            <div className="mt-6 px-3">
              <Collapsible open={marketingOpen} onOpenChange={setMarketingOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full">
                    {marketingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Marketing
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1">
                  <Link
                    to={createPageUrl('Marketing')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'Marketing'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Video className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Video Workflow</span>
                  </Link>
                  <Link
                    to={createPageUrl('MarketingCalendarPage')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'MarketingCalendarPage'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Calendar className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Marketing Calendar</span>
                  </Link>
                  {(can('marketing_category', 'read') || isAdmin) && (
                    <Link
                      to={createPageUrl('MarketingCategories')}
                      onClick={() => window.innerWidth < 1024 && onToggle()}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                        currentPage === 'MarketingCategories'
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      )}
                    >
                      <Layers className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">Categories</span>
                    </Link>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Accounts Section */}
          {!collapsed && isAdmin && (
            <div className="mt-6 px-3">
              <Collapsible open={accountsOpen} onOpenChange={setAccountsOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full">
                    {accountsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Accounts
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1">
                  <Link
                    to={createPageUrl('Accounts')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'Accounts'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Wallet className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Overview</span>
                  </Link>
                  <Link
                    to={createPageUrl('Receivables')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'Receivables'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <TrendingUp className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Receivables</span>
                  </Link>
                  <Link
                    to={createPageUrl('Payables')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'Payables'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <TrendingDown className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Payables</span>
                  </Link>
                  <Link
                    to={createPageUrl('MarketingExpenses')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'MarketingExpenses'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <Target className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Marketing Expenses</span>
                  </Link>
                  <Link
                    to={createPageUrl('CashFlowForecast')}
                    onClick={() => window.innerWidth < 1024 && onToggle()}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                      currentPage === 'CashFlowForecast'
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                  >
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">Cash Flow Forecast</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Other Navigation */}
          <div className="mt-6 px-3 space-y-1">
            {navItems.slice(1).map((item) => {
              // Skip sales-only items for non-sales users (unless admin), except Inventory Bucket (accessible to all)
              if (item.salesOnly && !isSalesUser && !isAdmin && item.name !== 'Inventory Bucket') return null;
              // Skip marketing-only items for non-marketing/IT users (unless admin)
              if (item.marketingOnly && !isMarketingUser && !isITUser && !isAdmin) return null;
              // Skip admin-only items for non-admins
              if (item.adminOnly && !isAdmin) return null;
              // Skip finance items if user doesn't have permission
              if (item.financeOnly && !can('finance_dashboard', 'read')) return null;
              // Skip HR-only items for non-HR users (unless admin)
              if (item.hrOnly && user?.role_id !== 'hr' && !isAdmin) return null;
              // Show timesheet only for freelancers
              if (item.freelancerOnly && !isFreelancer) return null;
              // Hide items from Sales Executives
              if (item.hiddenForSalesExec && isSalesExec) return null;
              // Hide Reports and Projects from Sales Managers and Executives
              if ((item.name === 'Reports' || item.name === 'Projects') && !canAccessReportsProjects) return null;

              const Icon = item.icon;
              const isActive = currentPage === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => window.innerWidth < 1024 && onToggle()}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              );
            })}
          </div>

          {/* Admin Section */}
          {(isAdmin || user?.role_id === 'hr' || isHRUser) && !collapsed && (
            <div className="mt-6 px-3">
              <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 w-full">
                    {adminOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Administration
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="space-y-1">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPage === item.page;
                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.page)}
                        onClick={() => window.innerWidth < 1024 && onToggle()}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                          isActive
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                            : "text-slate-400 hover:text-white hover:bg-slate-800"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          {/* Projects Section - Hidden for Sales Executives and Sales Managers */}
          {!collapsed && canAccessReportsProjects && (
            <div className="mt-6 px-3">
              <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
                <div className="flex items-center justify-between mb-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                    {projectsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Projects
                  </CollapsibleTrigger>
                  <Link to={createPageUrl('NewProject')}>
                    <Button size="icon" variant="ghost" className="w-6 h-6 text-slate-400 hover:text-white hover:bg-slate-800">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
                <CollapsibleContent className="space-y-1">
                  {projects.slice(0, 5).map((project) => {
                    const DomainIcon = domainIcons[project.domain] || Layers;
                    return (
                      <Link
                        key={project.id || project._id}
                        to={createPageUrl(`ProjectBoard?id=${project.id || project._id}`)}
                        onClick={() => window.innerWidth < 1024 && onToggle()}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.color || '#6366F1' }}
                        />
                        <span className="truncate text-sm">{project.name}</span>
                      </Link>
                    );
                  })}
                  {projects.length > 5 && (
                    <Link
                      to={createPageUrl('Projects')}
                      className="flex items-center gap-3 px-3 py-2 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      View all ({projects.length})
                    </Link>
                  )}
                  {projects.length === 0 && (
                    <p className="px-3 py-2 text-sm text-slate-500">No projects yet</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            if (item.adminOnly && !isAdmin) return null;
            // Analytics visible to sales users and admins
            if (item.salesOrAdmin && !isSalesUser && !isAdmin) return null;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.page)}
                onClick={() => window.innerWidth < 1024 && onToggle()}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </aside>
    </>
  );
}