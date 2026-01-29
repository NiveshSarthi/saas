import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Video, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function AddVideoModal({
    isOpen,
    onClose,
    onSubmit,
    categories = [],
    users = [],
    currentUser
}) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category_id: '',
        editing_level: 'B',
        raw_file_url: '',
        assigned_director: '',
        assigned_cameraman: '',
        assigned_editor: '',
        assigned_manager: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!formData.description.trim()) {
            toast.error('Description is required');
            return;
        }
        if (!formData.category_id) {
            toast.error('Category is required');
            return;
        }
        // Optional: assigned_director, assigned_cameraman, assigned_editor, assigned_manager are now optional

        setIsSubmitting(true);
        try {
            await onSubmit({
                ...formData,
                status: 'shoot',
                created_by: currentUser?.email
            });
            // Reset form
            setFormData({
                title: '',
                description: '',
                category_id: '',
                editing_level: 'B',
                raw_file_url: '',
                assigned_director: '',
                assigned_cameraman: '',
                assigned_editor: '',
                assigned_manager: ''
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({
            title: '',
            description: '',
            category_id: '',
            editing_level: 'B',
            raw_file_url: '',
            assigned_director: '',
            assigned_cameraman: '',
            assigned_editor: '',
            assigned_manager: ''
        });
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Video className="w-5 h-5 text-indigo-600" />
                        Add New Video
                    </DialogTitle>
                    <DialogDescription>
                        Create a new video in the Shoot stage.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Title */}
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input
                            id="title"
                            placeholder="Video title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description *</Label>
                        <Textarea
                            id="description"
                            placeholder="Video description and details..."
                            rows={3}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            required
                        />
                    </div>

                    {/* Category and Editing Level */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category *</Label>
                            <Select
                                value={formData.category_id}
                                onValueChange={(v) => setFormData({ ...formData, category_id: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.filter(c => c.is_active !== false).map(cat => (
                                        <SelectItem key={cat.id || cat._id} value={cat.id || cat._id}>
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: cat.color }}
                                                />
                                                {cat.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Editing Level *</Label>
                            <Select
                                value={formData.editing_level}
                                onValueChange={(v) => setFormData({ ...formData, editing_level: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="B">B - Basic</SelectItem>
                                    <SelectItem value="A">A - Medium</SelectItem>
                                    <SelectItem value="A+">A+ - Highest</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Raw File URL (Optional) */}
                    <div className="space-y-2">
                        <Label htmlFor="raw_file_url">Raw File URL (Optional)</Label>
                        <Input
                            id="raw_file_url"
                            type="url"
                            placeholder="https://..."
                            value={formData.raw_file_url}
                            onChange={(e) => setFormData({ ...formData, raw_file_url: e.target.value })}
                        />
                        <p className="text-xs text-slate-500">Can be added later before moving to Editing</p>
                    </div>

                    {/* Team Assignment */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Users className="w-4 h-4" />
                            Team Assignment
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Director</Label>
                                <Select
                                    value={formData.assigned_director}
                                    onValueChange={(v) => setFormData({ ...formData, assigned_director: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select director" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(user => (
                                            <SelectItem key={user.email} value={user.email}>
                                                {user.full_name || user.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Cameraman</Label>
                                <Select
                                    value={formData.assigned_cameraman}
                                    onValueChange={(v) => setFormData({ ...formData, assigned_cameraman: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select cameraman" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(user => (
                                            <SelectItem key={user.email} value={user.email}>
                                                {user.full_name || user.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Editor</Label>
                                <Select
                                    value={formData.assigned_editor}
                                    onValueChange={(v) => setFormData({ ...formData, assigned_editor: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select editor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(user => (
                                            <SelectItem key={user.email} value={user.email}>
                                                {user.full_name || user.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Manager</Label>
                                <Select
                                    value={formData.assigned_manager}
                                    onValueChange={(v) => setFormData({ ...formData, assigned_manager: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(user => (
                                            <SelectItem key={user.email} value={user.email}>
                                                {user.full_name || user.email}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600"
                        >
                            {isSubmitting ? 'Creating...' : 'Create Video'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
