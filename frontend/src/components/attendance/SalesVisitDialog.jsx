
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function SalesVisitDialog({ open, onOpenChange, user, currentLocation }) {
    const [formData, setFormData] = useState({
        client_name: '',
        purpose: '',
        estimated_duration_minutes: 60
    });

    const queryClient = useQueryClient();

    const startVisitMutation = useMutation({
        mutationFn: async (data) => {
            const response = await fetch('http://localhost:3001/api/visits/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_email: user.email,
                    ...data,
                    location: currentLocation
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['active-visit']);
            toast.success('Gate Pass Generated! Site Visit Started.');
            onOpenChange(false);
        },
        onError: (e) => toast.error(e.message)
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log("Submitting Gate Pass Request...", { user, formData, currentLocation });

        if (!user || !user.email) {
            toast.error("User email missing. Cannot start visit.");
            return;
        }

        startVisitMutation.mutate(formData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Start Site Visit (Gate Pass)</DialogTitle>
                    <DialogDescription>
                        Enter visit details to generate a digital gate pass.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Client Name / Site Name</Label>
                        <Input
                            placeholder="e.g. Acme Corp HQ"
                            required
                            value={formData.client_name}
                            onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Purpose of Visit</Label>
                        <Textarea
                            placeholder="e.g. Sales pitch, Site inspection..."
                            required
                            value={formData.purpose}
                            onChange={e => setFormData({ ...formData, purpose: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Estimated Duration (Minutes)</Label>
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <Input
                                type="number"
                                min="1"
                                required
                                value={formData.estimated_duration_minutes}
                                onChange={e => setFormData({ ...formData, estimated_duration_minutes: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    {currentLocation && (
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>Location Verified: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}</span>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={startVisitMutation.isPending}>
                            {startVisitMutation.isPending ? 'Generating...' : 'Generate Gate Pass'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
