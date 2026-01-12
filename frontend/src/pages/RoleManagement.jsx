import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Plus,
  Shield,
  Copy,
  Edit,
  Trash2,
  MoreHorizontal,
  Users,
  Lock,
  ChevronRight,
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import RolePermissionsEditor from '@/components/rbac/RolePermissionsEditor';
import { DEFAULT_ROLES, MODULES, ACTIONS } from '@/components/rbac/PermissionsContext';
import ProtectedRoute from '@/components/rbac/ProtectedRoute';

export default function RoleManagement() {
  const [selectedRole, setSelectedRole] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deletingRole, setDeletingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: {},
    max_storage_mb: 1024,
    restrict_project_visibility: false
  });

  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => base44.entities.Role.list('priority'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data) => {
      const role = await base44.entities.Role.create(data);
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'role_created',
        target_type: 'role',
        target_id: role.id,
        target_name: data.name,
        new_value: data
      });
      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowCreateDialog(false);
      resetForm();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data, oldRole }) => {
      const role = await base44.entities.Role.update(id, data);
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'role_updated',
        target_type: 'role',
        target_id: id,
        target_name: data.name,
        old_value: oldRole,
        new_value: data
      });
      return role;
    },
    onSuccess: (updatedRole) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setEditingRole(null);
      setSelectedRole(updatedRole);
      resetForm();
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (role) => {
      await base44.entities.Role.delete(role.id);
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'role_deleted',
        target_type: 'role',
        target_id: role.id,
        target_name: role.name,
        old_value: role
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeletingRole(null);
      if (selectedRole?.id === deletingRole?.id) {
        setSelectedRole(null);
      }
    },
  });

  const duplicateRoleMutation = useMutation({
    mutationFn: async (role) => {
      const newRole = await base44.entities.Role.create({
        name: `${role.name} (Copy)`,
        description: role.description,
        permissions: role.permissions,
        max_storage_mb: role.max_storage_mb,
        restrict_project_visibility: role.restrict_project_visibility,
        is_system: false,
        priority: role.priority - 1
      });
      await base44.entities.AuditLog.create({
        user_email: currentUser?.email,
        action: 'role_duplicated',
        target_type: 'role',
        target_id: newRole.id,
        target_name: newRole.name,
        metadata: { source_role_id: role.id, source_role_name: role.name }
      });
      return newRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: {},
      max_storage_mb: 1024,
      restrict_project_visibility: false
    });
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {},
      max_storage_mb: role.max_storage_mb || 1024,
      restrict_project_visibility: role.restrict_project_visibility || false
    });
  };

  const handleSave = () => {
    if (editingRole) {
      updateRoleMutation.mutate({ 
        id: editingRole.id, 
        data: formData,
        oldRole: editingRole
      });
    } else {
      createRoleMutation.mutate(formData);
    }
  };

  const getUserCountForRole = (roleId) => {
    return users.filter(u => u.role_id === roleId).length;
  };

  const initializeDefaultRoles = async () => {
    for (const [key, roleData] of Object.entries(DEFAULT_ROLES)) {
      await base44.entities.Role.create(roleData);
    }
    queryClient.invalidateQueries({ queryKey: ['roles'] });
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 lg:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute module="users" action="update">
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Role Management</h1>
            <p className="text-slate-500">Configure roles and permissions</p>
          </div>
          <div className="flex gap-2">
            {roles.length === 0 && (
              <Button variant="outline" onClick={initializeDefaultRoles}>
                Initialize Default Roles
              </Button>
            )}
            <Button 
              onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Role
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Roles</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {roles.filter((role, index, self) => 
                index === self.findIndex(r => r.id === role.id)
              ).map(role => {
                const permissions = role.permissions || {};
                const enabledModules = Object.entries(permissions)
                  .filter(([_, perms]) => Object.values(perms || {}).some(v => v === true))
                  .map(([mod]) => mod);

                return (
                  <div
                    key={role.id}
                    className={cn(
                      "p-4 cursor-pointer hover:bg-slate-50 transition-colors",
                      selectedRole?.id === role.id && "bg-indigo-50 border-l-2 border-l-indigo-600"
                    )}
                    onClick={() => setSelectedRole(role)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                          role.is_system ? "bg-amber-100" : "bg-indigo-100"
                        )}>
                          {role.is_system ? (
                            <Lock className="w-5 h-5 text-amber-600" />
                          ) : (
                            <Shield className="w-5 h-5 text-indigo-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{role.name}</span>
                            {role.is_system && (
                              <Badge variant="secondary" className="text-xs">System</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <Users className="w-3 h-3" />
                            {getUserCountForRole(role.id)} users
                          </div>
                          {enabledModules.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {enabledModules.slice(0, 4).map(mod => (
                                <Badge key={mod} variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                                  {mod.replace('_', ' ')}
                                </Badge>
                              ))}
                              {enabledModules.length > 4 && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                                  +{enabledModules.length - 4}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(role)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateRoleMutation.mutate(role)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {!role.is_system && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => setDeletingRole(role)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Role Details / Editor */}
          <div className="lg:col-span-2">
            {selectedRole || editingRole ? (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">
                    {editingRole ? `Edit: ${editingRole.name}` : selectedRole?.name}
                  </h3>
                  {editingRole ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => {
                        setEditingRole(null);
                        resetForm();
                      }}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleEdit(selectedRole)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>

                <Tabs defaultValue="permissions" className="p-4">
                  <TabsList>
                    <TabsTrigger value="permissions">Permissions</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="users">Users ({getUserCountForRole(selectedRole?.id || editingRole?.id)})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="permissions" className="mt-4">
                    <RolePermissionsEditor
                      permissions={editingRole ? formData.permissions : selectedRole?.permissions}
                      onChange={(perms) => setFormData(p => ({ ...p, permissions: perms }))}
                      readonly={!editingRole}
                    />
                  </TabsContent>

                  <TabsContent value="settings" className="mt-4 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Role Name</Label>
                        <Input
                          value={editingRole ? formData.name : selectedRole?.name}
                          onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                          disabled={!editingRole || selectedRole?.is_system}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Storage (MB)</Label>
                        <Input
                          type="number"
                          value={editingRole ? formData.max_storage_mb : selectedRole?.max_storage_mb}
                          onChange={(e) => setFormData(p => ({ ...p, max_storage_mb: parseInt(e.target.value) }))}
                          disabled={!editingRole}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editingRole ? formData.description : selectedRole?.description}
                        onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                        disabled={!editingRole}
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">Restrict Project Visibility</p>
                        <p className="text-sm text-slate-500">Users can only see projects they're assigned to</p>
                      </div>
                      <Switch
                        checked={editingRole ? formData.restrict_project_visibility : selectedRole?.restrict_project_visibility}
                        onCheckedChange={(checked) => setFormData(p => ({ ...p, restrict_project_visibility: checked }))}
                        disabled={!editingRole}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="users" className="mt-4">
                    <div className="space-y-2">
                      {users
                        .filter(u => u.role_id === (selectedRole?.id || editingRole?.id))
                        .map(user => (
                          <div key={user.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">
                                {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">{user.full_name || user.email}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      {users.filter(u => u.role_id === (selectedRole?.id || editingRole?.id)).length === 0 && (
                        <p className="text-center text-slate-500 py-8">No users assigned to this role</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 h-full min-h-[400px] flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Select a role to view or edit permissions</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Role Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Role Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Storage (MB)</Label>
                  <Input
                    type="number"
                    value={formData.max_storage_mb}
                    onChange={(e) => setFormData(p => ({ ...p, max_storage_mb: parseInt(e.target.value) }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Role description..."
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900">Restrict Project Visibility</p>
                  <p className="text-sm text-slate-500">Users can only see projects they're assigned to</p>
                </div>
                <Switch
                  checked={formData.restrict_project_visibility}
                  onCheckedChange={(checked) => setFormData(p => ({ ...p, restrict_project_visibility: checked }))}
                />
              </div>

              <div>
                <Label className="mb-3 block">Permissions</Label>
                <RolePermissionsEditor
                  permissions={formData.permissions}
                  onChange={(perms) => setFormData(p => ({ ...p, permissions: perms }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave}
                disabled={!formData.name}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingRole} onOpenChange={() => setDeletingRole(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingRole?.name}"? 
                {getUserCountForRole(deletingRole?.id) > 0 && (
                  <span className="block mt-2 text-red-600">
                    Warning: {getUserCountForRole(deletingRole?.id)} users have this role assigned.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteRoleMutation.mutate(deletingRole)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}