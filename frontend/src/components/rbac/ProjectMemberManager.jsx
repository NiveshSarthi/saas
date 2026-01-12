import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  X,
  UserPlus,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { usePermissions } from './PermissionsContext';

export default function ProjectMemberManager({ projectId, members = [], onMembersChange }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [search, setSearch] = useState('');
  
  const { can, isAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const addMemberMutation = useMutation({
    mutationFn: async (userEmail) => {
      const user = users.find(u => u.email === userEmail);
      if (!user) return;

      const updatedProjectIds = [...(user.project_ids || []), projectId];
      await base44.entities.User.update(user.id, { project_ids: updatedProjectIds });
      
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'project_member_added',
        target_type: 'project',
        target_id: projectId,
        target_name: userEmail,
        new_value: { project_id: projectId, user_email: userEmail }
      });

      return userEmail;
    },
    onSuccess: (userEmail) => {
      onMembersChange?.([...members, userEmail]);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddDialog(false);
      setSelectedUser('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userEmail) => {
      const user = users.find(u => u.email === userEmail);
      if (!user) return;

      const updatedProjectIds = (user.project_ids || []).filter(id => id !== projectId);
      await base44.entities.User.update(user.id, { project_ids: updatedProjectIds });

      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'project_member_removed',
        target_type: 'project',
        target_id: projectId,
        target_name: userEmail,
        old_value: { project_id: projectId, user_email: userEmail }
      });

      return userEmail;
    },
    onSuccess: (userEmail) => {
      onMembersChange?.(members.filter(m => m !== userEmail));
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const getRoleName = (user) => {
    return roles.find(r => r.id === user.role_id)?.name || 'No Role';
  };

  const canManageMembers = can('project', 'assign') || isAdmin();
  const availableUsers = users.filter(u => !members.includes(u.email));
  const memberUsers = users.filter(u => members.includes(u.email));

  const filteredAvailableUsers = availableUsers.filter(u => {
    if (!search) return true;
    return u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
           u.email?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Project Members ({members.length})</Label>
        {canManageMembers && (
          <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Add Member
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {memberUsers.map(user => (
          <div 
            key={user.id}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm">
                  {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm text-slate-900">{user.full_name || user.email}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    <Shield className="w-3 h-3 mr-1" />
                    {getRoleName(user)}
                  </Badge>
                </div>
              </div>
            </div>
            {canManageMembers && user.email !== currentUser?.email && (
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-slate-400 hover:text-red-600"
                onClick={() => removeMemberMutation.mutate(user.email)}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}

        {members.length === 0 && (
          <div className="text-center py-6 text-slate-500 text-sm">
            No members assigned to this project
          </div>
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project Member</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredAvailableUsers.map(user => (
                <div
                  key={user.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                    selectedUser === user.email
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                  onClick={() => setSelectedUser(user.email)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-indigo-100 text-indigo-600 text-sm">
                        {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{user.full_name || user.email}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getRoleName(user)}
                  </Badge>
                </div>
              ))}

              {filteredAvailableUsers.length === 0 && (
                <p className="text-center text-slate-500 py-4">No users available to add</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMemberMutation.mutate(selectedUser)}
              disabled={!selectedUser}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}