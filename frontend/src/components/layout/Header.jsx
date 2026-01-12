import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import NotificationPanel from '@/components/collaboration/NotificationPanel';
import {
  Menu,
  Search,
  Bell,
  Plus,
  ChevronDown,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Command as CommandIcon,
  Keyboard,
  Home,
  CheckSquare,
  LayoutDashboard,
  FileText,
  CheckCircle
} from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import DarkModeToggle from '@/components/common/DarkModeToggle';
import FontSizeControl from '@/components/common/FontSizeControl';
import moment from 'moment';

export default function Header({ user, onToggleSidebar }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['user-notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter(
      { user_email: user?.email },
      '-created_date',
      20
    ),
    enabled: !!user?.email,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId) => {
    await base44.entities.Notification.update(notificationId, { read: true });
  };

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: searchTasks = [] } = useQuery({
    queryKey: ['search-tasks'],
    queryFn: () => base44.entities.Task.list('-updated_date', 500),
    enabled: searchOpen,
  });

  const { data: searchProjects = [] } = useQuery({
    queryKey: ['search-projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 500),
    enabled: searchOpen,
  });

  const { data: searchUsers = [] } = useQuery({
    queryKey: ['search-users'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getDashboardUsers');
      return res.data?.users || [];
    },
    enabled: searchOpen,
  });

  const { data: searchDepts = [] } = useQuery({
    queryKey: ['search-depts'],
    queryFn: () => base44.entities.Department.list('name'),
    enabled: searchOpen,
  });

  const { data: searchGroups = [] } = useQuery({
    queryKey: ['search-groups'],
    queryFn: () => base44.entities.Group.list('name'),
    enabled: searchOpen,
  });

  const filteredResults = React.useMemo(() => {
    if (!searchQuery.trim()) return { tasks: [], projects: [], users: [], depts: [], groups: [] };

    const query = searchQuery.toLowerCase();
    return {
      tasks: searchTasks.filter(t =>
        t.title.toLowerCase().includes(query) ||
        (t.description || '').toLowerCase().includes(query)
      ).slice(0, 5),
      projects: searchProjects.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query)
      ).slice(0, 3),
      users: searchUsers.filter(u =>
        (u.full_name || '').toLowerCase().includes(query) ||
        (u.email || '').toLowerCase().includes(query)
      ).slice(0, 3),
      depts: searchDepts.filter(d =>
        d.name.toLowerCase().includes(query)
      ).slice(0, 3),
      groups: searchGroups.filter(g =>
        g.name.toLowerCase().includes(query)
      ).slice(0, 3),
    };
  }, [searchQuery, searchTasks, searchProjects, searchUsers, searchDepts, searchGroups]);



  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  return (
    <>
      <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 lg:px-6 sticky top-0 z-30 w-full overflow-x-hidden">
        {/* Left Section */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-shrink">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="text-slate-600 hover:text-slate-900 flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>

          {/* Search */}
          <div className="hidden md:flex items-center">
            <Button
              variant="outline"
              onClick={() => setSearchOpen(true)}
              className="w-48 lg:w-64 justify-start text-slate-500 font-normal text-sm"
            >
              <Search className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Search...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-600 flex-shrink-0">
                <CommandIcon className="w-3 h-3" />K
              </kbd>
            </Button>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Quick Add */}
          <Link to={createPageUrl('NewTask')}>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 hidden lg:flex h-8">
              <Plus className="w-4 h-4 mr-1" />
              <span className="text-sm">New Task</span>
            </Button>
          </Link>
          <Link to={createPageUrl('NewTask')} className="lg:hidden">
            <Button size="icon" className="bg-indigo-600 hover:bg-indigo-700 w-8 h-8 sm:w-9 sm:h-9">
              <Plus className="w-4 h-4" />
            </Button>
          </Link>

          {/* Mobile Search */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="md:hidden text-slate-600 w-8 h-8 sm:w-9 sm:h-9"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>

          {/* Font Size Control */}
          <div className="hidden lg:block">
            <FontSizeControl />
          </div>

          {/* Dark Mode Toggle - Hide on small screens */}
          <div className="hidden sm:block">
            <DarkModeToggle />
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative w-8 h-8 sm:w-9 sm:h-9"
            onClick={() => setNotificationPanelOpen(true)}
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 sm:w-5 sm:h-5 bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative hidden">
                <Bell className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Badge variant="secondary">{unreadCount} new</Badge>
                )}
              </div>
              <ScrollArea className="h-96">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-3 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.read ? 'bg-blue-50' : ''
                          }`}
                        onClick={() => {
                          markAsRead(notif.id);
                          if (notif.link) {
                            navigate(createPageUrl(notif.link));
                            setNotificationsOpen(false);
                          }
                        }}
                      >
                        <div className="flex gap-2">
                          <div className="flex-shrink-0 mt-1">
                            {notif.type === 'task_assigned' && <CheckSquare className="w-4 h-4 text-blue-600" />}
                            {notif.type === 'status_changed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {notif.type === 'comment_added' && <FileText className="w-4 h-4 text-slate-600" />}
                            {notif.type === 'mentioned' && <User className="w-4 h-4 text-indigo-600" />}
                            {!['task_assigned', 'status_changed', 'comment_added', 'mentioned'].includes(notif.type) && (
                              <Bell className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-xs text-slate-400 mt-1">{moment(notif.created_date).fromNow()}</p>
                          </div>
                          {!notif.read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              {notifications.length > 0 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => {
                      navigate(createPageUrl('Notifications'));
                      setNotificationsOpen(false);
                    }}
                  >
                    View all notifications
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-1 sm:gap-2 px-1 sm:px-2 h-8 sm:h-9">
                <Avatar className="w-7 h-7 sm:w-8 sm:h-8">
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs sm:text-sm font-medium">
                    {getInitials(user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden xl:block font-medium text-sm text-slate-700 truncate max-w-[120px]">
                  {user?.full_name || 'User'}
                </span>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 hidden xl:block flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span>{user?.full_name}</span>
                  <span className="text-xs font-normal text-slate-500">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={createPageUrl('Profile')} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={createPageUrl('Settings')} className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="w-4 h-4 mr-2" />
                Help & Support
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                const event = new KeyboardEvent('keydown', { key: '?', shiftKey: true });
                window.dispatchEvent(event);
              }}>
                <Keyboard className="w-4 h-4 mr-2" />
                Keyboard Shortcuts
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="p-0 overflow-hidden shadow-2xl max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh]">
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-slate-500 dark:[&_[cmdk-group-heading]]:text-slate-400 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput
              placeholder="Type to search tasks, projects, or people..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                  <Search className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm">No results found for "{searchQuery}"</p>
                </div>
              </CommandEmpty>

              {!searchQuery && (
                <CommandGroup heading="Quick Actions">
                  <CommandItem onSelect={() => { navigate(createPageUrl('Dashboard')); setSearchOpen(false); }}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { navigate(createPageUrl('NewTask')); setSearchOpen(false); }}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>New Task</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { navigate(createPageUrl('MyTasks')); setSearchOpen(false); }}>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    <span>My Tasks</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { navigate(createPageUrl('Projects')); setSearchOpen(false); }}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Projects</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {filteredResults.projects.length > 0 && (
                <CommandGroup heading="Projects">
                  {filteredResults.projects.map(p => (
                    <CommandItem
                      key={p.id}
                      value={`project-${p.id}-${p.name}`}
                      onSelect={() => {
                        navigate(createPageUrl(`ProjectBoard?id=${p.id}`));
                        setSearchOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 text-indigo-600">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 truncate">{p.name}</div>
                          <div className="text-xs text-slate-500 truncate">{p.description || 'No description'}</div>
                        </div>
                        <CommandShortcut>↵</CommandShortcut>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredResults.tasks.length > 0 && (
                <CommandGroup heading="Tasks">
                  {filteredResults.tasks.map(t => (
                    <CommandItem
                      key={t.id}
                      value={`task-${t.id}-${t.title}`}
                      onSelect={() => {
                        navigate(createPageUrl(`TaskDetail?id=${t.id || t._id}`));
                        setSearchOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                          {t.status === 'done' ? <Settings className="w-4 h-4" /> : <CommandIcon className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900 truncate">{t.title}</span>
                            {t.priority === 'high' || t.priority === 'critical' ? (
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 font-normal text-slate-500">{t.status}</Badge>
                            <span className="text-xs text-slate-400 truncate max-w-[200px]">{t.description || 'No description'}</span>
                          </div>
                        </div>
                        <CommandShortcut>↵</CommandShortcut>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredResults.users.length > 0 && (
                <CommandGroup heading="People">
                  {filteredResults.users.map(u => (
                    <CommandItem
                      key={u.id}
                      value={`user-${u.id}-${u.full_name}`}
                      onSelect={() => {
                        navigate(createPageUrl('Team'));
                        setSearchOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Avatar className="w-8 h-8 flex-shrink-0">
                          <AvatarImage src={u.avatar_url} />
                          <AvatarFallback className="bg-slate-100 text-slate-600">{getInitials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm text-slate-900 truncate">{u.full_name}</div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredResults.depts.length > 0 && (
                <CommandGroup heading="Departments">
                  {filteredResults.depts.map(d => (
                    <CommandItem
                      key={d.id}
                      value={`dept-${d.id}-${d.name}`}
                      onSelect={() => {
                        navigate(createPageUrl('UserManagement'));
                        setSearchOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Settings className="w-4 h-4 text-slate-400" />
                        <div className="font-medium text-sm text-slate-700">{d.name}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {filteredResults.groups.length > 0 && (
                <CommandGroup heading="Groups">
                  {filteredResults.groups.map(g => (
                    <CommandItem
                      key={g.id}
                      value={`group-${g.id}-${g.name}`}
                      onSelect={() => {
                        navigate(createPageUrl('GroupManagement'));
                        setSearchOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <User className="w-4 h-4 text-slate-400" />
                        <div className="font-medium text-sm text-slate-700">{g.name}</div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={notificationPanelOpen}
        onClose={() => setNotificationPanelOpen(false)}
        user={user}
      />
    </>
  );
}