import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Link2, AlertCircle } from 'lucide-react';

export default function UrlPromptDialog({
    isOpen,
    onClose,
    onSubmit,
    title,
    message,
    urlType
}) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();

        // Basic URL validation
        if (!url.trim()) {
            setError('URL is required');
            return;
        }

        try {
            new URL(url);
        } catch {
            setError('Please enter a valid URL');
            return;
        }

        onSubmit(url);
        setUrl('');
        setError('');
    };

    const handleClose = () => {
        setUrl('');
        setError('');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-indigo-600" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {message}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <p className="text-sm text-amber-700">
                                This URL is required before the video can be moved to the next stage.
                            </p>
                        </div>

                        <Input
                            type="url"
                            placeholder={`Enter ${urlType} URL...`}
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setError(''); }}
                            className={error ? 'border-red-500' : ''}
                        />
                        {error && (
                            <p className="text-sm text-red-500">{error}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gradient-to-r from-indigo-600 to-purple-600"
                        >
                            Add URL & Move
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
