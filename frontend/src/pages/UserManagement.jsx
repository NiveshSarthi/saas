import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Mail,
  UserPlus,
  MoreHorizontal,
  Edit,
  Trash2,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Copy,
  Power,
  PowerOff,
  Filter,
  Download,
  Users,
  FolderOpen,
  Loader2,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import ProtectedRoute from '@/components/rbac/ProtectedRoute';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { getUserDisplayName } from '@/components/utils/userDisplay';
import { SALES_JOB_TITLES, isSalesUser } from '@/components/utils/salesPermissions';

export default function UserManagement() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [inviteData, setInviteData] = useState({ email: '', role_id: '', department_id: '', project_ids: [], reports_to: '', user_category: 'internal', territory: '' });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [memberData, setMemberData] = useState({ email: '', full_name: '', password: '', role_id: '', department_id: '', project_ids: [], reports_to: '', user_category: 'internal', territory: '', job_title: '' });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const queryClient = useQueryClient();
  const { can, isAdmin, user: permissionsUser } = usePermissions();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const isHRDept = currentUser?.department_name?.toLowerCase().includes('hr') ||
    currentUser?.department_id === 'dept_hr';
  const isAdminDept = currentUser?.department_name?.toLowerCase().includes('admin') ||
    currentUser?.department_id === 'dept_hr';

  // Permission checks
  const canCreateUsers = can('users', 'create') || isAdmin() || isHRDept || isAdminDept;
  const canManagePassword = can('users', 'manage_password') || isAdmin() || isHRDept || isAdminDept;
  const hasAccess = can('users', 'read') || isAdmin() || isHRDept || isAdminDept;

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
    enabled: !!hasAccess
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list('priority'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: builders = [] } = useQuery({
    queryKey: ['builders'],
    queryFn: () => base44.entities.Builder.filter({ is_active: true }, 'builder_name'),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => base44.entities.UserInvitation.list('-created_date', 1000),
  });



  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data, oldUser }) => {
      await base44.entities.User.update(userId, data);
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'user_role_changed',
        target_type: 'user',
        target_id: userId,
        target_name: oldUser.email,
        old_value: { role_id: oldUser.role_id, active: oldUser.active },
        new_value: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['team-data'] });
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      setEditingUser(null);
      toast.success('Member updated successfully');
    },
  });

  const updateInvitationDataMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const updatePayload = {
        role_id: data.role_id,
        department_id: data.department_id,
        project_ids: data.project_ids,
        reports_to: data.reports_to || null,
        status: data.active ? 'accepted' : 'revoked',
        full_name: data.full_name
      };

      await base44.entities.UserInvitation.update(id, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['team-data'] });
      setEditingUser(null);
      toast.success('Member updated successfully');
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ userId, active, user }) => {
      console.log('Toggling user:', userId, 'to active:', active);
      await base44.entities.User.update(userId, {
        active,
        is_active: active, // Update DB schema field
        status: active ? 'active' : 'inactive' // Update status string
      });
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'user_role_changed',
        target_type: 'user',
        target_id: userId,
        target_name: user.email,
        old_value: { active: !active },
        new_value: { active }
      });
    },
    onSuccess: (_, { active }) => {
      console.log('Toggle success, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['team-data'] });
      toast.success(active ? 'User activated' : 'User deactivated');
    },
    onError: (error) => {
      console.error('Toggle error:', error);
      toast.error('Failed to update user status: ' + error.message);
    }
  });

  const toggleInvitationActiveMutation = useMutation({
    mutationFn: async ({ id, active }) => {
      // active -> 'pending' (Invited/Active), inactive -> 'revoked'
      const newStatus = active ? 'pending' : 'revoked';
      await base44.entities.UserInvitation.update(id, { status: newStatus });
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success(active ? 'Invitation activated' : 'Invitation revoked');
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data) => {
      const token = Math.random().toString(36).substring(2, 15);
      const invitation = await base44.entities.UserInvitation.create({
        ...data,
        reports_to: data.reports_to || null,
        invited_by: currentUser?.email,
        token,
        expires_at: addDays(new Date(), 7).toISOString()
      });

      // Send invitation email
      await base44.integrations.Core.SendEmail({
        to: data.email,
        subject: 'You have been invited to join the platform',
        body: `
          <h2>You've been invited!</h2>
          <p>You have been invited to join our project management platform.</p>
          <p>Click the link below to accept your invitation:</p>
          <p><a href="${window.location.origin}?invitation=${token}">Accept Invitation</a></p>
          <p>This invitation expires in 7 days.</p>
        `
      });

      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'user_invited',
        target_type: 'user',
        target_name: data.email,
        new_value: data
      });

      return invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setShowInviteDialog(false);
      setInviteData({ email: '', role_id: '', department_id: '', project_ids: [], reports_to: '', user_category: 'internal', territory: '' });
      toast.success('Invitation sent successfully');
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: (id) => base44.entities.UserInvitation.update(id, { status: 'revoked' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success('Invitation revoked');
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitation) => {
      await base44.integrations.Core.SendEmail({
        to: invitation.email,
        subject: 'Reminder: You have been invited to join the platform',
        body: `
          <h2>Invitation Reminder</h2>
          <p>This is a reminder that you have been invited to join our project management platform.</p>
          <p>Click the link below to accept your invitation:</p>
          <p><a href="${window.location.origin}?invitation=${invitation.token}">Accept Invitation</a></p>
        `
      });
    },
    onSuccess: () => {
      toast.success('Invitation resent');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ user }) => {
      try {
        // Remove user from all groups first
        const allGroups = await base44.entities.Group.list();
        for (const group of allGroups) {
          if (group.members?.includes(user.email)) {
            await base44.entities.Group.update(group.id, {
              members: group.members.filter(m => m !== user.email)
            });
          }
        }

        // Then delete the user
        if (user.type === 'invitation') {
          await base44.entities.UserInvitation.delete(user.id);
        } else {
          await base44.entities.User.delete(user.id);
        }
        await base44.entities.AuditLog.create({
          user_email: currentUser?.email,
          action: 'user_removed',
          target_type: 'user',
          target_id: user.id,
          target_name: user.email,
          old_value: { email: user.email, role_id: user.role_id }
        });
      } catch (error) {
        throw new Error(`Failed to delete user: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['team-data'] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast.success('User deleted successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete user');
    },
  });

  const handleBulkDelete = async () => {
    let successCount = 0;
    const allGroups = await base44.entities.Group.list();

    for (const userId of selectedUsers) {
      const user = allUsers.find(u => u.id === userId);
      if (user && user.id !== currentUser?.id) {
        try {
          // Remove user from all groups first
          for (const group of allGroups) {
            if (group.members?.includes(user.email)) {
              await base44.entities.Group.update(group.id, {
                members: group.members.filter(m => m !== user.email)
              });
            }
          }

          // Then delete the user
          if (user.type === 'invitation') {
            await base44.entities.UserInvitation.delete(user.id);
          } else {
            await base44.entities.User.delete(user.id);
          }
          await base44.entities.AuditLog.create({
            user_email: currentUser?.email,
            action: 'user_removed',
            target_type: 'user',
            target_id: user.id,
            target_name: user.email,
            old_value: { email: user.email, role_id: user.role_id }
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to delete user ${user.email}:`, error);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['invitations'] });
    queryClient.invalidateQueries({ queryKey: ['team-data'] });
    setSelectedUsers([]);
    setBulkDeleteDialogOpen(false);
    toast.success(`${successCount} user(s) deleted successfully`);
  };

  const addMemberMutation = useMutation({
    mutationFn: async (data) => {
      // Directly create a User (not an invitation) via the users API
      const user = await base44.entities.User.create({
        email: data.email,
        full_name: data.full_name,
        password: data.password, // Password will be hashed by backend
        role_id: data.role_id || 'team_member',
        department_id: data.department_id || null,
        project_ids: data.project_ids || [],
        job_title: data.job_title || null,
        joining_date: data.joining_date || null
      });

      // Send welcome email (optional)
      await base44.integrations.Core.SendEmail({
        to: data.email,
        subject: 'Welcome to the platform',
        body: `
          <h2>Welcome aboard!</h2>
          <p>You have been added to our project management platform.</p>
          <p>Your account has been created as: <strong>${data.full_name}</strong></p>
          <p>You can now login using your email address and the password provided to you.</p>
        `
      });

      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'user_created',
        target_type: 'user',
        target_name: data.email,
        new_value: { email: data.email, full_name: data.full_name, role_id: data.role_id }
      });

      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      queryClient.invalidateQueries({ queryKey: ['team-data'] });
      setShowAddMemberDialog(false);
      setMemberData({ email: '', full_name: '', password: '', role_id: '', department_id: '', project_ids: [], reports_to: '', user_category: 'internal', territory: '', job_title: '', joining_date: '' });
      toast.success('Member added successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add member');
    }
  });

  const getRoleName = (roleId) => {
    return roles.find(r => r.id === roleId)?.name || 'Team Member';
  };

  const getDepartmentName = (deptId) => {
    return departments.find(d => d.id === deptId)?.name || 'No Department';
  };

  // Helper function to check if user is active (handles both active and status fields)
  const isUserActive = (user) => {
    if (!user) return false;
    return user.active === true || user.status === 'active';
  };

  const allUsers = [
    ...users.map(u => ({ ...u, id: u.id || u._id, type: 'user' })),
    ...invitations
      .filter(i => !users.some(u => u.email === i.email))
      .map(i => ({
        ...i,
        type: 'invitation',
        id: i.id,
        active: i.status !== 'revoked',
        status: i.status === 'accepted' ? 'active' : (i.status === 'revoked' ? 'inactive' : 'invited'),
        last_login: null
      }))
  ];

  const filteredUsers = allUsers.filter(user => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (!user.full_name?.toLowerCase().includes(searchLower) &&
        !user.email?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    // Role filter
    if (roleFilter !== 'all' && user.role_id !== roleFilter) return false;
    // Status filter
    if (statusFilter === 'active' && !isUserActive(user)) return false;
    if (statusFilter === 'inactive' && isUserActive(user)) return false;
    return true;
  });

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId, checked) => {
    if (checked) {
      setSelectedUsers(prev => [...prev, userId]);
    } else {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  const handleBulkActivate = async () => {
    for (const userId of selectedUsers) {
      const user = users.find(u => u.id === userId);
      if (user && user.active === false) {
        await toggleUserActiveMutation.mutateAsync({ userId, active: true, user });
      }
    }
    setSelectedUsers([]);
    toast.success(`${selectedUsers.length} users activated`);
  };

  const handleBulkDeactivate = async () => {
    for (const userId of selectedUsers) {
      const user = users.find(u => u.id === userId);
      if (user && user.active !== false && user.id !== currentUser?.id) {
        await toggleUserActiveMutation.mutateAsync({ userId, active: false, user });
      }
    }
    setSelectedUsers([]);
    toast.success(`${selectedUsers.length} users deactivated`);
  };

  const activateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('bulkActivateUsers', {});
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(data.message || 'All inactive users activated');
    },
    onError: () => {
      toast.error('Failed to activate users');
    }
  });

  const exportUsers = () => {
    const csv = [
      ['Name', 'Email', 'Role', 'Status', 'Projects', 'Last Login'].join(','),
      ...filteredUsers.map(u => [
        u.full_name || 'No Name',
        u.email,
        getRoleName(u.role_id),
        isUserActive(u) ? 'Active' : 'Inactive',
        u.project_ids?.length || 0,
        u.last_login || 'Never'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
  };

  const pendingInvitations = invitations.filter(i => i.status === 'pending');

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!hasAccess && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <Shield className="w-10 h-10 text-red-600" />
        </div>
        <div className="max-w-md">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-500 mb-6">
            You don't have permission to access User Management.
            This page is restricted to HR and Administration departments.
          </p>
          <Link to={createPageUrl('Dashboard')}>
            <Button variant="default">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">{allUsers.length} members</p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => activateAllMutation.mutate()}
            disabled={activateAllMutation.isPending}
          >
            <Power className="w-4 h-4 mr-2" />
            Activate All Inactive
          </Button>
          {canCreateUsers && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowAddMemberDialog(true)}
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">All Members ({allUsers.length})</TabsTrigger>
          <TabsTrigger value="invitations">
            Pending Invitations ({pendingInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <Shield className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map(role => (
                  <SelectItem key={role.id || role._id} value={role.id || role._id}>{role.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportUsers}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
              <span className="text-sm font-medium text-indigo-700">
                {selectedUsers.length} selected
              </span>
              <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                <Power className="w-3 h-3 mr-1" />
                Activate
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" onClick={handleBulkDeactivate}>
                <PowerOff className="w-3 h-3 mr-1" />
                Deactivate
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:bg-red-50 border-red-300"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedUsers([])}>
                Clear
              </Button>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin -webkit-overflow-scrolling-touch">
              <table className="w-full min-w-[900px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Joining Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Job Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Reports To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Projects</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map(user => (
                    <tr key={user.id || user._id} className={cn("hover:bg-slate-50", selectedUsers.includes(user.id || user._id) && "bg-indigo-50")}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => handleSelectUser(user.id, checked)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm">
                              {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900">{getUserDisplayName(user)}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Shield className="w-3 h-3" />
                          {getRoleName(user.role_id)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {user.joining_date ? format(new Date(user.joining_date), 'MMM d, yyyy') : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {getDepartmentName(user.department_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {user.job_title || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {user.reports_to ? (allUsers.find(u => u.email?.toLowerCase() === user.reports_to?.toLowerCase())?.full_name || user.reports_to) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isUserActive(user)}
                            onCheckedChange={(checked) => {
                              if (user.type === 'invitation') {
                                toggleInvitationActiveMutation.mutate({ id: user.id, active: checked });
                              } else {
                                toggleUserActiveMutation.mutate({
                                  userId: user.id,
                                  active: checked,
                                  user
                                });
                              }
                            }}
                            disabled={user.id === currentUser?.id}
                          />
                          <Badge className={cn(
                            "text-xs",
                            isUserActive(user)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          )}>
                            {user.type === 'invitation'
                              ? (user.status === 'active' ? 'Active' : (user.status === 'inactive' ? 'Revoked' : 'Invited'))
                              : (isUserActive(user) ? 'Active' : 'Inactive')
                            }
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">
                          {user.project_ids?.length || 0} projects
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">
                          {user.last_login
                            ? format(new Date(user.last_login), 'MMM d, yyyy')
                            : 'Never'
                          }
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingUser({ ...user, reports_to: user.reports_to || '' })}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Member
                            </DropdownMenuItem>

                            {user.type === 'invitation' && user.status === 'invited' && (
                              <DropdownMenuItem onClick={() => resendInvitationMutation.mutate(user)}>
                                <Send className="w-4 h-4 mr-2" />
                                Resend Invite
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />
                            {isUserActive(user) ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (user.type === 'invitation') {
                                    toggleInvitationActiveMutation.mutate({ id: user.id, active: false });
                                  } else {
                                    toggleUserActiveMutation.mutate({
                                      userId: user.id,
                                      active: false,
                                      user
                                    });
                                  }
                                }}
                                disabled={user.id === currentUser?.id}
                                className="text-red-600"
                              >
                                <PowerOff className="w-4 h-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (user.type === 'invitation') {
                                    toggleInvitationActiveMutation.mutate({ id: user.id, active: true });
                                  } else {
                                    toggleUserActiveMutation.mutate({
                                      userId: user.id,
                                      active: true,
                                      user
                                    });
                                  }
                                }}
                                className="text-emerald-600"
                              >
                                <Power className="w-4 h-4 mr-2" />
                                Activate
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={user.id === currentUser?.id}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="invitations" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {pendingInvitations.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Mail className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No pending invitations</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Invited By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Expires</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingInvitations.map(invitation => (
                    <tr key={invitation.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{invitation.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {getRoleName(invitation.role_id)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {invitation.invited_by}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Clock className="w-3 h-3" />
                          {invitation.expires_at
                            ? format(new Date(invitation.expires_at), 'MMM d, yyyy')
                            : 'No expiry'
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendInvitationMutation.mutate(invitation)}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => revokeInvitationMutation.mutate(invitation.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Revoke
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite User Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData(p => ({ ...p, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Department (Optional)</Label>
              <Select
                value={inviteData.department_id}
                onValueChange={(v) => setInviteData(p => ({ ...p, department_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={inviteData.role_id}
                onValueChange={(v) => setInviteData(p => ({ ...p, role_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </>
                  ) : (
                    roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>User Category</Label>
                <Select
                  value={inviteData.user_category}
                  onValueChange={(v) => setInviteData(p => ({ ...p, user_category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Team</SelectItem>
                    <SelectItem value="realtor">Realtor</SelectItem>
                    <SelectItem value="cp">Channel Partner (CP)</SelectItem>
                    <SelectItem value="acp">Associate CP (ACP)</SelectItem>
                    <SelectItem value="rm">Relationship Manager (RM)</SelectItem>
                    <SelectItem value="external">External Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Territory (Optional)</Label>
                <Input
                  value={inviteData.territory || ''}
                  onChange={(e) => setInviteData(p => ({ ...p, territory: e.target.value }))}
                  placeholder="e.g. North Zone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reports To (Optional)</Label>
              <Select
                value={inviteData.reports_to || 'none'}
                onValueChange={(v) => setInviteData(p => ({ ...p, reports_to: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Manager</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.email}>
                      {getUserDisplayName(u)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assign to Projects (Optional)</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500">No projects available</p>
                ) : (
                  projects.map(project => (
                    <div key={project.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={inviteData.project_ids.includes(project.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setInviteData(p => ({ ...p, project_ids: [...p.project_ids, project.id] }));
                          } else {
                            setInviteData(p => ({ ...p, project_ids: p.project_ids.filter(id => id !== project.id) }));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`project-${project.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color || '#6366F1' }}
                        />
                        {project.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {inviteData.project_ids.length > 0 && (
                <p className="text-xs text-slate-500">{inviteData.project_ids.length} project(s) selected</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => inviteUserMutation.mutate(inviteData)}
              disabled={!inviteData.email || !inviteData.role_id}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-indigo-100 text-indigo-600">
                  {editingUser?.full_name?.[0] || editingUser?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-slate-900">{editingUser?.full_name || 'No Name'}</p>
                <p className="text-sm text-slate-500">{editingUser?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Full Name {currentUser?.role !== 'admin' && <span className="text-xs text-slate-400 font-normal">(Admin Only)</span>}</Label>
              <Input
                value={editingUser?.full_name || ''}
                onChange={(e) => setEditingUser(u => ({ ...u, full_name: e.target.value }))}
                placeholder="Enter full name"
                disabled={currentUser?.role !== 'admin'}
              />
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={editingUser?.department_id || ''}
                onValueChange={(v) => setEditingUser(u => ({ ...u, department_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={editingUser?.role_id || ''}
                onValueChange={(v) => setEditingUser(u => ({ ...u, role_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    <>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          User
                        </div>
                      </SelectItem>
                    </>
                  ) : (
                    roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          {role.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Job Title</Label>
                {isSalesUser({ department_id: editingUser?.department_id }, departments) ? (
                  <Select
                    value={editingUser?.job_title || ''}
                    onValueChange={(v) => setEditingUser(u => ({ ...u, job_title: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sales role" />
                    </SelectTrigger>
                    <SelectContent>
                      {SALES_JOB_TITLES.map(title => (
                        <SelectItem key={title} value={title}>{title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="e.g. HR Manager"
                    value={editingUser?.job_title || ''}
                    onChange={(e) => setEditingUser(u => ({ ...u, job_title: e.target.value }))}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Reports To {currentUser?.role !== 'admin' && <span className="text-xs text-slate-400 font-normal">(Admin Only)</span>}</Label>
                <Select
                  value={editingUser?.reports_to || 'none'}
                  onValueChange={(v) => setEditingUser(u => ({ ...u, reports_to: v === 'none' ? '' : v }))}
                  disabled={currentUser?.role !== 'admin'}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {allUsers
                      .filter(u => u.email !== editingUser?.email) // Prevent selecting self
                      .map(u => (
                        <SelectItem key={u.id} value={u.email}>
                          {getUserDisplayName(u)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>User Category</Label>
                <Select
                  value={editingUser?.user_category || 'internal'}
                  onValueChange={(v) => setEditingUser(u => ({ ...u, user_category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Team</SelectItem>
                    <SelectItem value="realtor">Realtor</SelectItem>
                    <SelectItem value="cp">Channel Partner (CP)</SelectItem>
                    <SelectItem value="acp">Associate CP (ACP)</SelectItem>
                    <SelectItem value="rm">Relationship Manager (RM)</SelectItem>
                    <SelectItem value="external">External Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Territory (Optional)</Label>
                <Input
                  value={editingUser?.territory || ''}
                  onChange={(e) => setEditingUser(u => ({ ...u, territory: e.target.value }))}
                  placeholder="e.g. North Zone"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assign to Projects (Optional)</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500">No projects available</p>
                ) : (
                  projects.map(project => (
                    <div key={project.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-project-${project.id}`}
                        checked={(editingUser?.project_ids || []).includes(project.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditingUser(u => ({ ...u, project_ids: [...(u.project_ids || []), project.id] }));
                          } else {
                            setEditingUser(u => ({ ...u, project_ids: (u.project_ids || []).filter(id => id !== project.id) }));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`edit-project-${project.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color || '#6366F1' }}
                        />
                        {project.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {(editingUser?.project_ids || []).length > 0 && (
                <p className="text-xs text-slate-500">{editingUser.project_ids.length} project(s) assigned</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Date of Joining {currentUser?.role !== 'admin' && <span className="text-xs text-slate-400 font-normal">(Admin Only)</span>}</Label>
              <Input
                type="date"
                value={editingUser?.joining_date ? format(new Date(editingUser.joining_date), 'yyyy-MM-dd') : ''}
                onChange={(e) => setEditingUser(u => ({ ...u, joining_date: e.target.value }))}
                disabled={currentUser?.role !== 'admin'}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-base">Account Active</Label>
                <p className="text-sm text-slate-500">User can login when active</p>
              </div>
              <Switch
                checked={isUserActive(editingUser)}
                onCheckedChange={(checked) => setEditingUser(u => ({ ...u, active: checked, status: checked ? 'active' : 'inactive' }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!editingUser) return;

                if (editingUser.type === 'invitation') {
                  const updateData = {
                    role_id: editingUser.role_id,
                    department_id: editingUser.department_id,
                    project_ids: editingUser.project_ids || [],
                    reports_to: editingUser.reports_to,
                    active: editingUser.active,
                    user_category: editingUser.user_category || 'internal',
                    territory: editingUser.territory || '',
                    full_name: editingUser.full_name
                  };

                  updateInvitationDataMutation.mutate({
                    id: editingUser.id,
                    data: updateData
                  });
                } else {
                  const originalUser = users.find(u => u.id === editingUser.id);

                  // Update name via backend if changed and user is admin
                  if (currentUser?.role === 'admin' && editingUser.full_name !== originalUser?.full_name) {
                    try {
                      const response = await base44.functions.invoke('updateUserName', {
                        email: editingUser.email,
                        full_name: editingUser.full_name
                      });

                      if (response.data?.error) {
                        toast.error('Failed to update name: ' + response.data.error);
                        return;
                      }
                    } catch (error) {
                      toast.error('Failed to update name: ' + error.message);
                      return;
                    }
                  }

                  updateUserMutation.mutate({
                    userId: editingUser.id,
                    data: {
                      role_id: editingUser.role_id,
                      department_id: editingUser.department_id,
                      active: editingUser.active,
                      status: editingUser.active ? 'active' : 'inactive',
                      project_ids: editingUser.project_ids || [],
                      job_title: editingUser.job_title,
                      reports_to: editingUser.reports_to || null,
                      user_category: editingUser.user_category || 'internal',
                      territory: editingUser.territory || '',
                      joining_date: editingUser.joining_date || null
                    },
                    oldUser: originalUser
                  });
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={updateUserMutation.isPending || updateInvitationDataMutation.isPending}
            >
              {(updateUserMutation.isPending || updateInvitationDataMutation.isPending) ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.full_name || userToDelete?.email}</strong>?
              <br /><br />
              This action cannot be undone. All user data, assignments, and permissions will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserMutation.mutate({ user: userToDelete })}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Users</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedUsers.length} user(s)</strong>?
              <br /><br />
              This action cannot be undone. All selected users' data, assignments, and permissions will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete {selectedUsers.length} User(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Member Dialog (Direct - No Invitation) */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Add Member Directly</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                value={memberData.email}
                onChange={(e) => setMemberData(p => ({ ...p, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={memberData.full_name}
                onChange={(e) => setMemberData(p => ({ ...p, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={memberData.password}
                onChange={(e) => setMemberData(p => ({ ...p, password: e.target.value }))}
                placeholder="Minimum 6 characters"
              />
              <p className="text-xs text-slate-500">Password must be at least 6 characters</p>
            </div>

            <div className="space-y-2">
              <Label>Department (Optional)</Label>
              <Select
                value={memberData.department_id}
                onValueChange={(v) => setMemberData(p => ({ ...p, department_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select
                value={memberData.role_id}
                onValueChange={(v) => setMemberData(p => ({ ...p, role_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.length === 0 ? (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </>
                  ) : (
                    roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>User Category</Label>
                <Select
                  value={memberData.user_category}
                  onValueChange={(v) => setMemberData(p => ({ ...p, user_category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal Team</SelectItem>
                    <SelectItem value="realtor">Realtor</SelectItem>
                    <SelectItem value="cp">Channel Partner (CP)</SelectItem>
                    <SelectItem value="acp">Associate CP (ACP)</SelectItem>
                    <SelectItem value="rm">Relationship Manager (RM)</SelectItem>
                    <SelectItem value="external">External Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Job Title (Optional)</Label>
                <Input
                  value={memberData.job_title || ''}
                  onChange={(e) => setMemberData(p => ({ ...p, job_title: e.target.value }))}
                  placeholder="e.g. Sales Manager"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Territory (Optional)</Label>
                <Input
                  value={memberData.territory || ''}
                  onChange={(e) => setMemberData(p => ({ ...p, territory: e.target.value }))}
                  placeholder="e.g. North Zone"
                />
              </div>

              <div className="space-y-2">
                <Label>Reports To (Optional)</Label>
                <Select
                  value={memberData.reports_to || 'none'}
                  onValueChange={(v) => setMemberData(p => ({ ...p, reports_to: v === 'none' ? '' : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Manager</SelectItem>
                    {allUsers.map(u => (
                      <SelectItem key={u.id} value={u.email}>
                        {getUserDisplayName(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date of Joining (Optional)</Label>
              <Input
                type="date"
                value={memberData.joining_date || ''}
                onChange={(e) => setMemberData(p => ({ ...p, joining_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Assign to Projects (Optional)</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {projects.length === 0 ? (
                  <p className="text-sm text-slate-500">No projects available</p>
                ) : (
                  projects.map(project => (
                    <div key={project.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`member-project-${project.id}`}
                        checked={memberData.project_ids.includes(project.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setMemberData(p => ({ ...p, project_ids: [...p.project_ids, project.id] }));
                          } else {
                            setMemberData(p => ({ ...p, project_ids: p.project_ids.filter(id => id !== project.id) }));
                          }
                        }}
                      />
                      <Label
                        htmlFor={`member-project-${project.id}`}
                        className="text-sm font-normal cursor-pointer flex items-center gap-2"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: project.color || '#6366F1' }}
                        />
                        {project.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
              {memberData.project_ids.length > 0 && (
                <p className="text-xs text-slate-500">{memberData.project_ids.length} project(s) selected</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMemberMutation.mutate(memberData)}
              disabled={
                !memberData.email ||
                !memberData.full_name ||
                !memberData.password ||
                memberData.password.length < 6 ||
                !memberData.role_id ||
                addMemberMutation.isPending
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {addMemberMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}