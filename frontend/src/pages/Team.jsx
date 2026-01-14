import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Search,
  UserPlus,
  Users,
  Mail,
  Shield,
  MoreHorizontal,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Send,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const roleColors = {
  admin: 'bg-purple-100 text-purple-700',
  user: 'bg-blue-100 text-blue-700',
  'team member': 'bg-blue-100 text-blue-700'
};

export default function Team() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Add Member Form State
  const [newMember, setNewMember] = useState({
    full_name: '',
    email: '',
    role: 'user',
    department_id: '',
    job_title: ''
  });

  // Manual Link Fallback
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setCurrentUser(userData);
      } catch (e) { }
    };
    fetchUser();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setInviteSending(true);
    setInviteError('');

    try {
      const link = `${window.location.origin}/Register?invite=${encodeURIComponent(inviteEmail)}`;

      // Send invitation email
      await base44.integrations.Core.SendEmail({
        to: inviteEmail,
        subject: 'You have been invited to join the team',
        body: `Hello,

You have been invited to join our project management platform.

Please click the link below to accept the invitation and create your account:
${link}

You have been assigned the role: ${inviteRole}

Best regards,
${currentUser?.full_name || 'The Team'}`
      });

      setInviteSuccess(true);
      setInviteEmail('');
      setInviteRole('user');

      setTimeout(() => {
        setInviteDialogOpen(false);
        setInviteSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err);
      setInviteError('Could not send email. System restriction.');
      setGeneratedLink(`${window.location.origin}/Register?invite=${encodeURIComponent(inviteEmail)}`);
      setShowLinkDialog(true);
      setInviteDialogOpen(false);
    } finally {
      setInviteSending(false);
    }
  };

  const { data: teamData, isLoading: usersLoading } = useQuery({
    queryKey: ['team-data'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getDashboardUsers');
      return response.data;
    },
  });

  const users = teamData?.users || [];
  const invitations = teamData?.invitations || [];
  const invitationsLoading = usersLoading;

  const { data: tasks = [] } = useQuery({
    queryKey: ['all-tasks-team'],
    queryFn: () => base44.entities.Task.list('-updated_date', 2000),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list('priority'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list(),
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
      setEditingUser(null);
      toast.success('User updated successfully');
    },
  });

  const updateInvitationDataMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.UserInvitation.update(id, {
        role_id: data.role_id,
        department_id: data.department_id,
        project_ids: data.project_ids,
        status: data.active ? 'accepted' : 'revoked'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setEditingUser(null);
      toast.success('Invitation updated successfully');
    },
  });

  const toggleUserActiveMutation = useMutation({
    mutationFn: async ({ userId, active, user }) => {
      await base44.entities.User.update(userId, { active, status: active ? 'active' : 'inactive' });
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
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'dashboard'] });
      toast.success(active ? 'User activated' : 'User deactivated');
    },
  });

  const toggleInvitationActiveMutation = useMutation({
    mutationFn: async ({ id, active }) => {
      const newStatus = active ? 'accepted' : 'revoked';
      await base44.entities.UserInvitation.update(id, { status: newStatus });
    },
    onSuccess: (_, { active }) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast.success(active ? 'Invitation accepted (activated)' : 'Invitation revoked');
    },
  });

  const createInvitationMutation = useMutation({
    mutationFn: (data) => base44.entities.UserInvitation.create(data),
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setAddMemberDialogOpen(false);
      setNewMember({ full_name: '', email: '', role: 'user', department_id: '', job_title: '' });

      const link = `${window.location.origin}/Register?token=${variables.token}`;

      try {
        // Send email
        await base44.integrations.Core.SendEmail({
          to: variables.email,
          subject: 'You have been added to the team',
          body: `Hello ${variables.full_name},
          
You have been added to our project management platform as a ${variables.job_title || 'member'}.

Please click the link below to set up your account:
${link}

Best regards,
${currentUser?.full_name || 'The Team'}`
        });
      } catch (error) {
        console.error("Failed to send email:", error);
        setGeneratedLink(link);
        setShowLinkDialog(true);
      }
    }
  });

  const handleAddMember = () => {
    if (!newMember.email || !newMember.full_name) return;

    createInvitationMutation.mutate({
      email: newMember.email,
      full_name: newMember.full_name,
      role_id: newMember.role,
      department_id: newMember.department_id,
      job_title: newMember.job_title,
      invited_by: currentUser?.email,
      status: 'pending',
      token: Math.random().toString(36).substring(7)
    });
  };

  const allMembers = [
    ...users.map(u => ({ ...u, type: 'user' })),
    ...invitations
      .filter(i => !users.some(u => u.email === i.email))
      .map(i => ({
        ...i,
        type: 'invitation',
        id: i.id,
        full_name: i.full_name || i.email.split('@')[0],
        role: i.status === 'accepted' ? 'active' : 'pending',
        department_id: i.department_id
      }))
  ];

  const filteredUsers = allMembers.filter(member => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (member.full_name?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query));
    }
    return true;
  });

  const getUserStats = (email) => {
    const userTasks = tasks.filter(t => t.assignee_email === email);
    return {
      total: userTasks.length,
      completed: userTasks.filter(t => t.status === 'done').length,
      inProgress: userTasks.filter(t => t.status === 'in_progress').length,
      overdue: userTasks.filter(t =>
        t.due_date &&
        new Date(t.due_date) < new Date() &&
        t.status !== 'done'
      ).length
    };
  };

  const getInitials = (name, email) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || '?';
  };

  if (usersLoading || invitationsLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Team</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">{users.length} team members</p>
        </div>
        {currentUser?.role === 'admin' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setInviteDialogOpen(true);
                setInviteEmail('');
                setInviteRole('user');
                setInviteError('');
                setInviteSuccess(false);
              }}
            >
              <Mail className="w-4 h-4 mr-2" />
              Invite via Email
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => setAddMemberDialogOpen(true)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search team members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Groups</h2>
          <div className="flex gap-3 flex-wrap">
            {groups.map((group) => (
              <div
                key={group.id || group._id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${group.color || '#6366F1'}20` }}
                >
                  <Users className="w-5 h-5" style={{ color: group.color || '#6366F1' }} />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{group.name}</h3>
                  <p className="text-xs text-slate-500">{(group.members || []).length} members</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="space-y-3 sm:space-y-4">
        <h2 className="text-base sm:text-lg font-semibold text-slate-900">Members</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredUsers.map((user) => {
            const stats = getUserStats(user.email);

            return (
              <div
                key={user.id || user._id}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="text-lg bg-indigo-100 text-indigo-600 font-medium">
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-slate-900">{user.full_name || 'Unnamed'}</h3>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="w-8 h-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="w-4 h-4 mr-2" />
                        View Tasks
                      </DropdownMenuItem>
                      {currentUser?.role === 'admin' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            <Shield className="w-4 h-4 mr-2" />
                            Edit User & Role
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                  {user.type === 'invitation' && (
                    <Badge className={cn("text-xs",
                      (roles.find(r => r.id === user.role_id)?.name || 'team member').toLowerCase() === 'admin' ? roleColors.admin : roleColors['team member']
                    )}>
                      <Shield className="w-3 h-3 mr-1" />
                      {roles.find(r => r.id === user.role_id)?.name || 'Team Member'}
                    </Badge>
                  )}

                  <Badge className={cn("text-xs",
                    user.type === 'invitation'
                      ? (user.role === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')
                      : (user.active === false ? 'bg-slate-100 text-slate-500' : (roleColors[(roles.find(r => r.id === user.role_id)?.name || user.role || 'user').toLowerCase()] || roleColors.user))
                  )}>
                    {user.type === 'invitation' ? (
                      user.role === 'active' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Accepted
                        </>
                      ) : 'Pending'
                    ) : (
                      <>
                        {user.active === false ? (
                          <>
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Inactive
                          </>
                        ) : (
                          <>
                            <Shield className="w-3 h-3 mr-1" />
                            {roles.find(r => r.id === user.role_id)?.name || (user.role === 'admin' ? 'Admin' : 'Team Member')}
                          </>
                        )}
                      </>
                    )}
                  </Badge>
                  {user.department_id && (
                    <Badge variant="outline" className="text-xs">
                      {departments.find(d => d.id === user.department_id)?.name || 'Department'}
                    </Badge>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="font-semibold">{stats.completed}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Done</span>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-semibold">{stats.inProgress}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Active</span>
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      "flex items-center justify-center gap-1",
                      stats.overdue > 0 ? "text-red-600" : "text-slate-400"
                    )}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span className="font-semibold">{stats.overdue}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Overdue</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 bg-slate-50 rounded-2xl">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No members found</h3>
            <p className="text-slate-500">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Team Member</DialogTitle>
            <DialogDescription>
              Manually add a member to the team. They will receive an email to claim their account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="John Doe"
                value={newMember.full_name}
                onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                placeholder="john@example.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newMember.role} onValueChange={(val) => setNewMember({ ...newMember, role: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={newMember.department_id} onValueChange={(val) => setNewMember({ ...newMember, department_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Job Title (Optional)</Label>
              <Input
                placeholder="e.g. Senior Developer"
                value={newMember.job_title}
                onChange={(e) => setNewMember({ ...newMember, job_title: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!newMember.email || !newMember.full_name || createInvitationMutation.isPending}
            >
              {createInvitationMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitation Link</DialogTitle>
            <DialogDescription>
              We couldn't send the email directly due to system restrictions. Please copy this link and send it to the member manually.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg mt-2">
            <code className="flex-1 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
              {generatedLink}
            </code>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard.writeText(generatedLink);
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowLinkDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Role Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto scrollbar-thin">
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
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label className="text-base">Account Active</Label>
                <p className="text-sm text-slate-500">User can login when active</p>
              </div>
              <Switch
                checked={editingUser?.active !== false}
                onCheckedChange={(checked) => setEditingUser(u => ({ ...u, active: checked, status: checked ? 'active' : 'inactive' }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingUser.type === 'invitation') {
                  updateInvitationDataMutation.mutate({
                    id: editingUser.id,
                    data: {
                      role_id: editingUser.role_id,
                      department_id: editingUser.department_id,
                      project_ids: editingUser.project_ids || [],
                      active: editingUser.active
                    }
                  });
                } else {
                  const originalUser = users.find(u => u.id === editingUser.id);
                  updateUserMutation.mutate({
                    userId: editingUser.id,
                    data: {
                      role_id: editingUser.role_id,
                      department_id: editingUser.department_id,
                      active: editingUser.active,
                      status: editingUser.active ? 'active' : 'inactive',
                      project_ids: editingUser.project_ids || []
                    },
                    oldUser: originalUser
                  });
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new member to your team.
            </DialogDescription>
          </DialogHeader>

          {inviteSuccess ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-900">Invitation Sent!</p>
              <p className="text-sm text-slate-500 mt-1">An email has been sent to {inviteEmail}</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inviteError && (
                  <p className="text-sm text-red-600">{inviteError}</p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={inviteSending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {inviteSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}