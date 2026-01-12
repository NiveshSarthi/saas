import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const colorOptions = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#0EA5E9', '#6B7280'
];

export default function GroupManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    members: []
  });
  const [memberEmail, setMemberEmail] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [addMode, setAddMode] = useState('member');

  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => base44.entities.Group.list('-created_date', 1000),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const allUsers = await base44.entities.User.list('-created_date', 1000);
      return allUsers.filter(u => {
        // Always include teamsocialscrapers@gmail.com
        if (u.email === 'teamsocialscrapers@gmail.com') return true;
        return u.active !== false && u.status !== 'inactive' && u.status !== 'revoked';
      });
    },
  });

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => base44.entities.UserInvitation.list('-created_date', 1000),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => base44.entities.Department.list('name'),
  });

  // Combine users and accepted invitations only
  const allMembers = React.useMemo(() => {
    const members = [...users];
    invitations.forEach(inv => {
      // Only include accepted invitations that haven't become users yet
      if (!members.some(u => u.email === inv.email) && inv.status === 'accepted') {
        members.push({
          id: inv.id,
          email: inv.email,
          full_name: inv.full_name || inv.email,
          department_id: inv.department_id,
        });
      }
    });
    return members;
  }, [users, invitations]);

  // Get active members for a group (filter out deleted/inactive users)
  const getActiveMembers = (groupMembers) => {
    if (!groupMembers) return [];
    const activeMemberEmails = allMembers.map(m => m.email);
    return groupMembers.filter(email => activeMemberEmails.includes(email));
  };

  const createGroupMutation = useMutation({
    mutationFn: (data) => base44.entities.Group.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      handleCloseDialog();
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Group.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      handleCloseDialog();
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.Group.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  const handleOpenDialog = (group = null) => {
    if (group) {
      setEditingGroup(group);
      // Filter out inactive members when opening for edit
      const activeGroupMembers = getActiveMembers(group.members || []);
      setFormData({
        name: group.name || '',
        description: group.description || '',
        color: group.color || '#6366F1',
        members: activeGroupMembers
      });
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
        description: '',
        color: '#6366F1',
        members: []
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingGroup(null);
    setFormData({ name: '', description: '', color: '#6366F1', members: [] });
    setMemberEmail('');
  };

  const handleSubmit = () => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: formData });
    } else {
      createGroupMutation.mutate(formData);
    }
  };

  const handleAddMember = () => {
    if (memberEmail && !formData.members.includes(memberEmail)) {
      setFormData(prev => ({ ...prev, members: [...prev.members, memberEmail] }));
      setMemberEmail('');
    }
  };

  const handleAddDepartment = () => {
    if (!selectedDepartment) return;
    const deptUsers = allMembers.filter(u => u.department_id === selectedDepartment);
    const newEmails = deptUsers
      .map(u => u.email)
      .filter(email => !formData.members.includes(email));
    
    if (newEmails.length > 0) {
      setFormData(prev => ({ ...prev, members: [...prev.members, ...newEmails] }));
    }
    setSelectedDepartment('');
  };

  const handleRemoveMember = (email) => {
    setFormData(prev => ({ ...prev, members: prev.members.filter(m => m !== email) }));
  };

  const filteredGroups = groups.filter(group => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      group.name?.toLowerCase().includes(searchLower) ||
      group.description?.toLowerCase().includes(searchLower)
    );
  });

  const getUserName = (email) => {
    const member = allMembers.find(u => u.email === email);
    return member?.full_name || email;
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groups</h1>
          <p className="text-slate-500 mt-1">Manage user groups and team assignments</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Groups Table */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No groups found</h3>
          <p className="text-slate-500 mb-6">Create your first group to organize users</p>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${group.color || '#6366F1'}20` }}
                      >
                        <Users className="w-5 h-5" style={{ color: group.color || '#6366F1' }} />
                      </div>
                      <span className="font-medium text-slate-900">{group.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {group.description || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {getActiveMembers(group.members).slice(0, 3).map((email, i) => (
                          <Avatar key={i} className="w-7 h-7 border-2 border-white">
                            <AvatarFallback className="text-[10px] bg-slate-100 text-slate-600">
                              {email.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className="text-sm text-slate-500">
                        {getActiveMembers(group.members).length} member{getActiveMembers(group.members).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenDialog(group)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
            <DialogDescription>
              {editingGroup ? 'Update group details and members' : 'Create a new group to organize users'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                placeholder="Enter group name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Enter group description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Add Members</Label>
              <Tabs value={addMode} onValueChange={setAddMode} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-2">
                  <TabsTrigger value="member">By Member</TabsTrigger>
                  <TabsTrigger value="department">By Department</TabsTrigger>
                </TabsList>
                
                <TabsContent value="member" className="mt-0">
                  <div className="flex gap-2">
                    <Select value={memberEmail} onValueChange={setMemberEmail}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {allMembers
                          .filter(u => !formData.members.includes(u.email))
                          .map(member => (
                            <SelectItem key={member.email} value={member.email}>
                              {member.full_name || member.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={handleAddMember}>
                      <UserPlus className="w-4 h-4" />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="department" className="mt-0">
                  <div className="flex gap-2">
                    <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" onClick={handleAddDepartment}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add All
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="mt-4">
                <Label className="text-xs text-slate-500 mb-2 block">
                  Selected Members ({formData.members.length})
                </Label>
                {formData.members.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 max-h-32 overflow-y-auto">
                    {formData.members.map((email) => (
                      <Badge key={email} variant="secondary" className="gap-1 bg-white border border-slate-200">
                        {getUserName(email)}
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-red-500"
                          onClick={() => handleRemoveMember(email)}
                        />
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">No members added yet</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || createGroupMutation.isPending || updateGroupMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}