import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@/components/rbac/PermissionsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
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
import {
    Plus,
    Pencil,
    Trash2,
    Palette,
    Tag,
    AlertTriangle,
    Info,
    Search
} from 'lucide-react';
import { toast } from 'sonner';

// Predefined color palette for categories
const COLOR_PALETTE = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#64748B', '#475569', '#1E293B'
];

export default function MarketingCategories() {
    const { can, isAdmin } = usePermissions();
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        color: '#6366F1',
        description: ''
    });

    // Load user
    useEffect(() => {
        const loadUser = async () => {
            try {
                const userData = await base44.auth.me();
                setUser(userData);
            } catch (e) {
                console.error('Failed to load user');
            }
        };
        loadUser();
    }, []);

    // Check permission
    const canManageCategories = isAdmin() || can('marketing_category', 'create');
    const canDeleteCategories = isAdmin() || can('marketing_category', 'delete');

    // Fetch categories
    const { data: categories = [], isLoading, refetch } = useQuery({
        queryKey: ['marketing-categories'],
        queryFn: () => base44.entities.MarketingCategory.list('name', 100),
    });

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data) => {
            if (selectedCategory) {
                return base44.entities.MarketingCategory.update(selectedCategory.id || selectedCategory._id, data);
            } else {
                return base44.entities.MarketingCategory.create({ ...data, created_by: user?.email });
            }
        },
        onSuccess: () => {
            toast.success(selectedCategory ? 'Category updated successfully' : 'Category created successfully');
            queryClient.invalidateQueries(['marketing-categories']);
            handleCloseModal();
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to save category');
        }
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            return base44.entities.MarketingCategory.delete(id);
        },
        onSuccess: () => {
            toast.success('Category deleted successfully');
            queryClient.invalidateQueries(['marketing-categories']);
            setIsDeleteDialogOpen(false);
            setSelectedCategory(null);
        },
        onError: (error) => {
            toast.error(error.message || 'Failed to delete category');
        }
    });

    const handleOpenModal = (category = null) => {
        if (category) {
            setSelectedCategory(category);
            setFormData({
                name: category.name || '',
                color: category.color || '#6366F1',
                description: category.description || ''
            });
        } else {
            setSelectedCategory(null);
            setFormData({
                name: '',
                color: '#6366F1',
                description: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCategory(null);
        setFormData({ name: '', color: '#6366F1', description: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error('Category name is required');
            return;
        }
        saveMutation.mutate(formData);
    };

    const handleDeleteClick = (category) => {
        setSelectedCategory(category);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (selectedCategory) {
            deleteMutation.mutate(selectedCategory.id || selectedCategory._id);
        }
    };

    // Filter categories
    const filteredCategories = categories.filter(cat =>
        cat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Authorization check
    if (!can('marketing_category', 'read') && !isAdmin()) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] text-center p-8">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
                <p className="text-slate-500 max-w-md">
                    You don't have permission to view marketing categories.
                    Please contact your administrator if you believe you should have access.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="relative mb-6 md:mb-8">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-3xl blur-3xl -z-10" />
                <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl shadow-lg border border-white/20 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                <Tag className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    Marketing Categories
                                </h1>
                                <p className="text-sm text-slate-600 mt-0.5">
                                    Manage video categories for content organization
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search categories..."
                                    className="pl-10 bg-white/90"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Add Button */}
                            {canManageCategories && (
                                <Button
                                    onClick={() => handleOpenModal()}
                                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/30"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Category
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Banner for non-editors */}
            {!canManageCategories && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-blue-800">View Only Mode</p>
                        <p className="text-sm text-blue-600">
                            You can view categories but cannot create, edit, or delete them.
                            Contact an administrator to request edit access.
                        </p>
                    </div>
                </div>
            )}

            {/* Categories Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : filteredCategories.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                        <Tag className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        {searchQuery ? 'No categories found' : 'No categories yet'}
                    </h3>
                    <p className="text-slate-500 mb-4">
                        {searchQuery
                            ? 'Try adjusting your search query'
                            : 'Create your first category to organize videos'}
                    </p>
                    {canManageCategories && !searchQuery && (
                        <Button onClick={() => handleOpenModal()}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create First Category
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredCategories.map((category) => (
                        <Card
                            key={category.id || category._id}
                            className="group hover:shadow-lg transition-all duration-200 overflow-hidden"
                        >
                            {/* Color stripe */}
                            <div
                                className="h-2 w-full"
                                style={{ backgroundColor: category.color || '#6366F1' }}
                            />
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-slate-100"
                                            style={{ backgroundColor: category.color || '#6366F1' }}
                                        />
                                        <CardTitle className="text-lg">{category.name}</CardTitle>
                                    </div>
                                    {category.is_active === false && (
                                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                                    {category.description || 'No description'}
                                </p>

                                {canManageCategories && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenModal(category)}
                                        >
                                            <Pencil className="w-3 h-3 mr-1" />
                                            Edit
                                        </Button>
                                        {canDeleteCategories && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDeleteClick(category)}
                                            >
                                                <Trash2 className="w-3 h-3 mr-1" />
                                                Delete
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Category Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {selectedCategory ? 'Edit Category' : 'Create New Category'}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedCategory
                                ? 'Update the category details below'
                                : 'Add a new category for organizing your videos'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Category Name *</Label>
                            <Input
                                id="name"
                                placeholder="e.g., Educational, Promotional, Tutorial"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Color *</Label>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-lg border-2 border-slate-200 shadow-inner"
                                    style={{ backgroundColor: formData.color }}
                                />
                                <div className="flex-1 grid grid-cols-10 gap-1">
                                    {COLOR_PALETTE.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`w-6 h-6 rounded-md transition-transform hover:scale-110 ${formData.color === color ? 'ring-2 ring-offset-1 ring-slate-800' : ''
                                                }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setFormData({ ...formData, color })}
                                        />
                                    ))}
                                </div>
                            </div>
                            {/* Custom color input */}
                            <div className="flex items-center gap-2 mt-2">
                                <Palette className="w-4 h-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder="#HEX color"
                                    className="w-28 h-8 text-sm"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                placeholder="Brief description of this category..."
                                rows={3}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={handleCloseModal}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={saveMutation.isPending}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600"
                            >
                                {saveMutation.isPending ? 'Saving...' : (selectedCategory ? 'Update' : 'Create')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{selectedCategory?.name}"?
                            This action cannot be undone. Videos using this category will need to be reassigned.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
