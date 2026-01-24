import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, MapPin, Clock, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function AdminVisitApprovals({ user }) {
    const [rejectDialog, setRejectDialog] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const queryClient = useQueryClient();

    const { data: pendingVisits, isLoading } = useQuery({
        queryKey: ['pending-visits'],
        queryFn: async () => {
            return await base44.entities.SiteVisit.filter({ approval_status: 'pending' });
        }
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, reason }) => {
            return await base44.entities.SiteVisit.update(id, {
                approval_status: status,
                rejection_reason: reason,
                approved_by: user?.email || 'Admin',
                approved_at: new Date().toISOString()
            });
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(['pending-visits']);
            if (variables.status === 'approved') {
                toast.success('Visit Approved successfully');
            } else {
                toast.success('Visit Rejected');
                setRejectDialog(null);
                setRejectionReason('');
            }
        },
        onError: (e) => toast.error('Failed to update status: ' + e.message)
    });

    const handleApprove = (id) => {
        updateStatusMutation.mutate({ id, status: 'approved' });
    };

    const handleRejectClick = (visit) => {
        setRejectDialog(visit);
    };

    const confirmReject = () => {
        if (!rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        updateStatusMutation.mutate({
            id: rejectDialog._id,
            status: 'rejected',
            reason: rejectionReason
        });
    };

    if (isLoading) return <div className="p-8 text-center">Loading pending visits...</div>;

    return (
        <div className="space-y-6 p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gate Pass Approvals</h1>
                    <p className="text-slate-500 mt-2">
                        Validate pending site visits for work duration calculation.
                    </p>
                </div>
                <Badge variant="outline" className="px-3 py-1 text-base">
                    Pending: {pendingVisits?.length || 0}
                </Badge>
            </div>

            <div className="grid gap-4">
                {pendingVisits?.length === 0 ? (
                    <Card className="p-12 text-center text-slate-500 bg-slate-50/50 border-dashed">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500/50" />
                        <h3 className="text-lg font-medium text-slate-900">All Caught Up!</h3>
                        <p>No pending site visit requests needing approval.</p>
                    </Card>
                ) : (
                    pendingVisits?.map((visit) => (
                        <Card key={visit._id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row md:items-center p-6 gap-6">

                                {/* User Info */}
                                <div className="flex items-center gap-4 min-w-[200px]">
                                    <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-lg">
                                        {visit.user_name?.[0] || visit.user_email?.[0] || <User />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">{visit.user_name || 'Sales User'}</p>
                                        <p className="text-sm text-slate-500">{visit.user_email}</p>
                                    </div>
                                </div>

                                {/* Vertical Divider */}
                                <div className="hidden md:block w-px h-12 bg-slate-200"></div>

                                {/* Visit Details */}
                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Client / Site</p>
                                        <div className="font-medium flex items-center gap-2">
                                            {visit.client_name}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Duration</p>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <span>
                                                {visit.actual_duration_minutes
                                                    ? `${Math.floor(visit.actual_duration_minutes / 60)}h ${visit.actual_duration_minutes % 60}m`
                                                    : `Est. ${visit.estimated_duration_minutes}m`}
                                            </span>
                                            {visit.status === 'ongoing' && <Badge variant="secondary" className="animate-pulse">Live</Badge>}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Purpose</p>
                                        <p className="text-sm text-slate-600 line-clamp-1" title={visit.purpose}>{visit.purpose}</p>
                                    </div>

                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold mb-1">Date</p>
                                        <div className="flex items-center gap-2 text-sm text-slate-600">
                                            <Calendar className="w-3 h-3" />
                                            {format(new Date(visit.start_time), 'MMM d, yyyy HH:mm')}
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                                    <Button
                                        variant="outline"
                                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                        onClick={() => handleApprove(visit._id)}
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Approve
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                                        onClick={() => handleRejectClick(visit)}
                                        disabled={updateStatusMutation.isPending}
                                    >
                                        <XCircle className="w-4 h-4 mr-2" />
                                        Reject
                                    </Button>
                                </div>

                            </div>

                            {/* Detailed Notes / Outcome if completed */}
                            {visit.notes && (
                                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-sm">
                                    <span className="font-semibold text-slate-700 mr-2">Outcome:</span>
                                    <span className="text-slate-600">{visit.notes}</span>
                                </div>
                            )}
                        </Card>
                    ))
                )}
            </div>

            <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Gate Pass</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this site visit. The user will be notified.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        placeholder="Reason for rejection (e.g. Not a valid client visit, documentation missing...)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="min-h-[100px]"
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmReject}>Reject Visit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
