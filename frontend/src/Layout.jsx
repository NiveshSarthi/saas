import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { PermissionsProvider } from '@/components/rbac/PermissionsContext';
import AuthGuard from '@/components/auth/AuthGuard';
import KeyboardShortcuts from '@/components/common/KeyboardShortcuts';
import { FontSizeProvider } from '@/components/common/FontSizeControl';

export default function Layout({ children, currentPageName }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not authenticated');
      }
    };
    fetchUser();
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 20),
    enabled: !!user,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['user-notifications', user?.email],
    queryFn: () => base44.entities.Notification.filter(
      { user_email: user?.email },
      '-created_date',
      20
    ),
    enabled: !!user?.email,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
    enabled: !!user,
  });

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  // Pages that should not have layout
  const noLayoutPages = ['Login', 'Register', 'ForgotPassword', 'PrivacyPolicy'];
  if (noLayoutPages.includes(currentPageName)) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <FontSizeProvider>
        <PermissionsProvider>
          <KeyboardShortcuts>
            <div className="h-screen bg-slate-50 flex dark:bg-slate-900 overflow-hidden relative">
              <Sidebar 
              projects={projects} 
              currentPage={currentPageName} 
              user={user}
              collapsed={sidebarCollapsed}
              onToggle={toggleSidebar}
              departments={departments}
            />
            
            <div className="flex-1 flex flex-col min-h-0 w-full overflow-x-hidden">
              <Header 
                user={user} 
                onToggleSidebar={toggleSidebar}
              />
              
              <main className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full">
                <div className="h-fit w-full">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </KeyboardShortcuts>
      </PermissionsProvider>
    </FontSizeProvider>
  </AuthGuard>
);
}