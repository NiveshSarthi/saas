import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Plus, Edit, Trash2, Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import UserMultiSelect from '@/components/common/UserMultiSelect';
import { getUserDisplayByEmail } from '@/components/utils/userDisplay';

export default function BuilderManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBuilder, setEditingBuilder] = useState(null);
  const [formData, setFormData] = useState({
    builder_name: '',
    location: '',
    contact_person_name: '',
    phone: '',
    email: '',
    assigned_users: []
  });

  const queryClient = useQueryClient();

  const { data: builders = [], isLoading } = useQuery({
    queryKey: ['builders'],
    queryFn: () => base44.entities.Builder.filter({ is_active: true }, 'builder_name'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 2000),
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['user-invitations'],
    queryFn: () => base44.entities.UserInvitation.filter({ status: 'accepted' }, '-created_date', 500),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list(),
  });

  const allUsers = [
    ...users,
    ...invitations
      .filter(inv => !users.some(u => u.email?.toLowerCase() === inv.email?.toLowerCase()))
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        full_name: inv.full_name || inv.email?.split('@')[0],
        department_id: inv.department_id,
      }))
  ];

  const salesDeptIds = departments.filter(d => d.name?.toLowerCase().includes('sales')).map(d => d.id);
  const salesUsers = allUsers.filter(u => u.department_id && salesDeptIds.includes(u.department_id));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Builder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builders'] });
      toast.success('Builder created successfully');
      handleCloseDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Builder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builders'] });
      toast.success('Builder updated successfully');
      handleCloseDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Builder.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['builders'] });
      toast.success('Builder deactivated successfully');
      setDeleteDialogOpen(false);
      setEditingBuilder(null);
    },
  });

  const handleOpenDialog = (builder = null) => {
    if (builder) {
      setEditingBuilder(builder);
      setFormData({
        builder_name: builder.builder_name || '',
        location: builder.location || '',
        contact_person_name: builder.contact_person_name || '',
        phone: builder.phone || '',
        email: builder.email || '',
        assigned_users: builder.assigned_users || []
      });
    } else {
      setEditingBuilder(null);
      setFormData({
        builder_name: '',
        location: '',
        contact_person_name: '',
        phone: '',
        email: '',
        assigned_users: []
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBuilder(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingBuilder) {
      updateMutation.mutate({ id: editingBuilder.id, data: formData });
    } else {
      createMutation.mutate({ ...formData, is_active: true });
    }
  };

  const getUserName = (email) => getUserDisplayByEmail(email, allUsers);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Manage builders and their assigned sales team members</p>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Builder
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Builder Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Contact Info</TableHead>
              <TableHead>Assigned Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {builders.length > 0 ? (
              builders.map(builder => (
                <TableRow key={builder.id}>
                  <TableCell className="font-medium">{builder.builder_name}</TableCell>
                  <TableCell>
                    {builder.location ? (
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <MapPin className="w-3 h-3" />
                        {builder.location}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{builder.contact_person_name || '-'}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {builder.email && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Mail className="w-3 h-3" />
                          {builder.email}
                        </div>
                      )}
                      {builder.phone && (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <Phone className="w-3 h-3" />
                          {builder.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {builder.assigned_users && builder.assigned_users.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {builder.assigned_users.slice(0, 2).map(email => (
                          <Badge key={email} variant="outline" className="text-xs">
                            {getUserName(email)}
                          </Badge>
                        ))}
                        {builder.assigned_users.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{builder.assigned_users.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(builder)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => {
                          setEditingBuilder(builder);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  No builders added yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBuilder ? 'Edit Builder' : 'Add New Builder'}</DialogTitle>
            <DialogDescription>
              {editingBuilder ? 'Update builder details and assign users' : 'Create a new builder and assign sales team members'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Builder Name *</Label>
                <Input
                  required
                  value={formData.builder_name}
                  onChange={(e) => setFormData({ ...formData, builder_name: e.target.value })}
                  placeholder="Enter builder name"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter location"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Contact Person Name</Label>
              <Input
                value={formData.contact_person_name}
                onChange={(e) => setFormData({ ...formData, contact_person_name: e.target.value })}
                placeholder="Enter contact person name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assigned Users</Label>
              <UserMultiSelect
                users={salesUsers}
                selectedUsers={formData.assigned_users}
                onChange={(users) => setFormData({ ...formData, assigned_users: users })}
                placeholder="Select sales team members..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingBuilder ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Builder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate this builder? This will hide it from all dropdowns and reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(editingBuilder?.id)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}