import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const PermissionsContext = createContext(null);

// Default permissions structure
export const MODULES = [
  'project', 'tasks', 'subtasks', 'sprints', 'calendar',
  'dashboard', 'comments', 'gantt', 'time_tracking',
  'worklog', 'backlog', 'reports', 'files', 'users', 'groups',
  'finance_dashboard', 'receivables', 'payables', 'cash_flow',
  'financial_reports', 'marketing_expenses', 'salary_management',
  'timesheet_approval', 'freelancer_reports',
  'marketing_category', 'video_workflow', 'leads', 'admin'  // Added admin module
];


export const ACTIONS = ['create', 'read', 'update', 'delete', 'assign', 'manage_password'];

export const DEFAULT_ROLES = {
  super_admin: {
    name: 'Super Admin',
    description: 'Full access to all features',
    is_system: true,
    priority: 100,
    permissions: MODULES.reduce((acc, mod) => {
      acc[mod] = ACTIONS.reduce((a, act) => ({ ...a, [act]: true }), {});
      return acc;
    }, {})
  },
  admin: {
    name: 'Admin',
    description: 'Administrative access',
    is_system: true,
    priority: 90,
    permissions: MODULES.reduce((acc, mod) => {
      acc[mod] = ACTIONS.reduce((a, act) => ({ ...a, [act]: true }), {});
      return acc;
    }, {})
  },
  project_manager: {
    name: 'Project Manager',
    description: 'Manage projects and team members',
    is_system: true,
    priority: 70,
    permissions: {
      project: { create: true, read: true, update: true, delete: false, assign: true },
      tasks: { create: true, read: true, update: true, delete: true, assign: true },
      subtasks: { create: true, read: true, update: true, delete: true, assign: true },
      sprints: { create: true, read: true, update: true, delete: true, assign: true },
      calendar: { create: true, read: true, update: true, delete: true, assign: false },
      dashboard: { create: false, read: true, update: false, delete: false, assign: false },
      comments: { create: true, read: true, update: true, delete: true, assign: false },
      gantt: { create: false, read: true, update: true, delete: false, assign: false },
      time_tracking: { create: true, read: true, update: true, delete: true, assign: false },
      worklog: { create: true, read: true, update: true, delete: true, assign: false },
      backlog: { create: true, read: true, update: true, delete: true, assign: true },
      reports: { create: true, read: true, update: false, delete: false, assign: false },
      files: { create: true, read: true, update: true, delete: true, assign: false },
      users: { create: false, read: true, update: false, delete: false, assign: true },
      groups: { create: true, read: true, update: true, delete: true, assign: true },
      finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
      receivables: { create: false, read: false, update: false, delete: false, assign: false },
      payables: { create: false, read: false, update: false, delete: false, assign: false },
      cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
      financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
      marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
      salary_management: { create: false, read: false, update: false, delete: false, assign: false }
    }
  },
  team_member: {
    name: 'Team Member',
    description: 'Regular team member',
    is_system: true,
    priority: 50,
    permissions: {
      project: { create: false, read: true, update: false, delete: false, assign: false },
      tasks: { create: true, read: true, update: true, delete: false, assign: false },
      subtasks: { create: true, read: true, update: true, delete: false, assign: false },
      sprints: { create: false, read: true, update: false, delete: false, assign: false },
      calendar: { create: true, read: true, update: true, delete: true, assign: false },
      dashboard: { create: false, read: true, update: false, delete: false, assign: false },
      comments: { create: true, read: true, update: true, delete: true, assign: false },
      gantt: { create: false, read: true, update: false, delete: false, assign: false },
      time_tracking: { create: true, read: true, update: true, delete: false, assign: false },
      worklog: { create: true, read: true, update: true, delete: false, assign: false },
      backlog: { create: false, read: true, update: false, delete: false, assign: false },
      reports: { create: false, read: true, update: false, delete: false, assign: false },
      files: { create: true, read: true, update: false, delete: false, assign: false },
      users: { create: false, read: false, update: false, delete: false, assign: false },
      groups: { create: false, read: true, update: false, delete: false, assign: false },
      finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
      receivables: { create: false, read: false, update: false, delete: false, assign: false },
      payables: { create: false, read: false, update: false, delete: false, assign: false },
      cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
      financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
      marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
      salary_management: { create: false, read: false, update: false, delete: false, assign: false }
    }
  },
  client: {
    name: 'Client',
    description: 'Read-only access',
    is_system: true,
    priority: 10,
    restrict_project_visibility: true,
    permissions: {
      project: { create: false, read: true, update: false, delete: false, assign: false },
      tasks: { create: false, read: true, update: false, delete: false, assign: false },
      subtasks: { create: false, read: true, update: false, delete: false, assign: false },
      sprints: { create: false, read: true, update: false, delete: false, assign: false },
      calendar: { create: false, read: true, update: false, delete: false, assign: false },
      dashboard: { create: false, read: true, update: false, delete: false, assign: false },
      comments: { create: true, read: true, update: false, delete: false, assign: false },
      gantt: { create: false, read: true, update: false, delete: false, assign: false },
      time_tracking: { create: false, read: true, update: false, delete: false, assign: false },
      worklog: { create: false, read: true, update: false, delete: false, assign: false },
      backlog: { create: false, read: true, update: false, delete: false, assign: false },
      reports: { create: false, read: true, update: false, delete: false, assign: false },
      files: { create: false, read: true, update: false, delete: false, assign: false },
      users: { create: false, read: false, update: false, delete: false, assign: false },
      groups: { create: false, read: false, update: false, delete: false, assign: false },
      finance_dashboard: { create: false, read: false, update: false, delete: false, assign: false },
      receivables: { create: false, read: false, update: false, delete: false, assign: false },
      payables: { create: false, read: false, update: false, delete: false, assign: false },
      cash_flow: { create: false, read: false, update: false, delete: false, assign: false },
      financial_reports: { create: false, read: false, update: false, delete: false, assign: false },
      marketing_expenses: { create: false, read: false, update: false, delete: false, assign: false },
      salary_management: { create: false, read: false, update: false, delete: false, assign: false }
    }
  }
};

export function PermissionsProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserPermissions();
  }, []);

  const loadUserPermissions = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      if (!userData) {
        console.warn('PermissionsProvider: No user data found');
        return;
      }

      let fetchedRole = null;
      let isAdministrationDept = false;

      // Fetch Department Info to check for "Administration"
      if (userData.department_id) {
        try {
          // Attempt to fetch department details
          // We use filter because get might not be available or consistent for all adapters
          const depts = await base44.entities.Department.filter({ id: userData.department_id });
          if (depts && depts.length > 0) {
            const deptName = depts[0].name.toLowerCase();
            // Check for Administration, Administrator, or exact match Admin
            if (deptName.includes('administration') || deptName.includes('administrator') || deptName === 'admin') {
              isAdministrationDept = true;
            }
          }
        } catch (deptErr) {
          console.warn('Failed to fetch department info', deptErr);
        }
      }

      if (userData.role_id) {
        const roles = await base44.entities.Role.filter({ id: userData.role_id });
        fetchedRole = roles[0];
      }

      if (fetchedRole) {
        setRole(fetchedRole);
        setPermissions(fetchedRole.permissions || {});
      } else if (
        userData.role === 'admin' ||
        userData.role_id === 'admin' ||
        userData.role_id === 'super_admin' ||
        isAdministrationDept || // Grant Admin access to Administration/Administrator department
        userData.email?.toLowerCase() === 'heena@niveshsarthi.com' // Explicit override for Heena
      ) {
        // Fallback for admin users without role_id or if role lookup failed
        setRole({ name: 'Admin', permissions: DEFAULT_ROLES.admin.permissions });
        setPermissions(DEFAULT_ROLES.admin.permissions);
      } else {
        setRole({ name: 'Team Member', permissions: DEFAULT_ROLES.team_member.permissions });
        setPermissions(DEFAULT_ROLES.team_member.permissions);
      }
    } catch (e) {
      console.log('User not authenticated');
    } finally {
      setLoading(false);
    }
  };

  const can = (module, action) => {
    // Super admins can do everything
    if (user?.role_id === 'super_admin') return true;

    if (!permissions || !permissions[module]) return false;
    return !!permissions[module][action];
  };

  const canAny = (module, actions) => {
    return actions.some(action => can(module, action));
  };

  const canAll = (module, actions) => {
    return actions.every(action => can(module, action));
  };

  const isAdmin = () => {
    return user?.role === 'admin' || role?.name === 'Super Admin' || role?.name === 'Admin';
  };

  const isSuperAdmin = () => {
    return role?.name === 'Super Admin';
  };

  const canAccessProject = (projectId) => {
    if (isAdmin()) return true;
    if (!role?.restrict_project_visibility) return true;
    return user?.project_ids?.includes(projectId);
  };

  const refreshPermissions = () => {
    loadUserPermissions();
  };

  return (
    <PermissionsContext.Provider value={{
      user,
      role,
      permissions,
      loading,
      can,
      canAny,
      canAll,
      isAdmin,
      isSuperAdmin,
      canAccessProject,
      refreshPermissions
    }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

// HOC for protected components
export function withPermission(Component, module, action) {
  return function ProtectedComponent(props) {
    const { can } = usePermissions();

    if (!can(module, action)) {
      return null;
    }

    return <Component {...props} />;
  };
}