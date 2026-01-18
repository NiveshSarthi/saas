
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MapPin, Timer, Navigation, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInMinutes, addMinutes, format } from 'date-fns';
import { toast } from 'sonner';

export default function ActiveVisitCard({ visit, currentLocation }) {
    const [timeLeft, setTimeLeft] = useState(0);
    const [isOverdue, setIsOverdue] = useState(false);
    const [showEndDialog, setShowEndDialog] = useState(false);
    const [notes, setNotes] = useState('');

    const queryClient = useQueryClient();

    // Timer Logic
    useEffect(() => {
        if (!visit) return;

        const calculateTime = () => {
            const start = new Date(visit.start_time);
            const end = addMinutes(start, visit.estimated_duration_minutes);
            const now = new Date();
            const diff = differenceInMinutes(end, now);

            setTimeLeft(diff);
            setIsOverdue(diff < 0);
        };

        calculateTime();
        const timer = setInterval(calculateTime, 60000); // Update every minute
        return () => clearInterval(timer);
    }, [visit]);

    const endVisitMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch(`http://localhost:3001/api/visits/${visit._id}/end`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    notes,
                    location: currentLocation
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return result.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['active-visit']);
            toast.success('Site Visit Completed!');
            setShowEndDialog(false);
        },
        onError: (e) => toast.error(e.message)
    });

    if (!visit) return null;

    return (
        <>
            <Card className={`border-l-4 shadow-sm ${isOverdue ? 'border-l-red-500 bg-red-50/50' : 'border-l-indigo-500 bg-indigo-50/50'}`}>
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                            <Navigation className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                Active Site Visit
                                {isOverdue && <Badge variant="destructive" className="text-[10px] h-5">OVERDUE</Badge>}
                                {visit.approval_status === 'pending' && <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-600 border-amber-200">PENDING APPROVAL</Badge>}
                                {visit.approval_status === 'approved' && <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-600 border-emerald-200">APPROVED</Badge>}
                                {visit.approval_status === 'rejected' && <Badge variant="destructive" className="text-[10px] h-5">REJECTED</Badge>}
                            </h3>
                            <p className="text-sm font-medium text-slate-700">{visit.client_name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" /> {visit.purpose}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-right">
                        <div className={`text-2xl font-mono font-bold ${isOverdue ? 'text-red-600' : 'text-indigo-600'}`}>
                            {isOverdue ? 'Overdue' : `${timeLeft} min`}
                        </div>
                        <p className="text-xs text-slate-500">
                            {isOverdue ? `Estimated end: ${format(addMinutes(new Date(visit.start_time), visit.estimated_duration_minutes), 'hh:mm a')}` : 'Remaining'}
                        </p>
                        <Button size="sm" onClick={() => setShowEndDialog(true)} className={isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"}>
                            End Visit
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* End Visit Dialog */}
            <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>End Site Visit</DialogTitle>
                        <DialogDescription>Please provide a summary of the visit outcome.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Meeting Outcome / Notes</label>
                        <Textarea
                            placeholder="Discussed requirements, client interested..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEndDialog(false)}>Cancel</Button>
                        <Button onClick={() => endVisitMutation.mutate()} disabled={endVisitMutation.isPending}>
                            {endVisitMutation.isPending ? 'Saving...' : 'Complete Visit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
