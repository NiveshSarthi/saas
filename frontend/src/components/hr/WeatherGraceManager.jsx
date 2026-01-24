
import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function WeatherGraceManager({ user }) {
    const [graceActive, setGraceActive] = useState(false);
    const [graceLoading, setGraceLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    useEffect(() => {
        checkGraceStatus();
    }, []);

    const checkGraceStatus = async () => {
        try {
            setLoading(true);
            const res = await base44.functions.invoke('getGracePeriod', { date: today });
            if (res.data) {
                setGraceActive(true);
            }
        } catch (e) {
            console.log('Error checking grace status', e);
        } finally {
            setLoading(false);
        }
    };

    const handleActivateGrace = async () => {
        try {
            setGraceLoading(true);
            await base44.functions.invoke('setGracePeriod', {
                date: today,
                minutes: 30,
                reason: 'Manual Grace Period - HR Admin',
                created_by: user?.email
            });
            setGraceActive(true);
            toast.success('30-minute Grace Period Activated!');
        } catch (e) {
            toast.error('Failed to activate grace period');
        } finally {
            setGraceLoading(false);
        }
    };

    const handleDeactivateGrace = async () => {
        try {
            setGraceLoading(true);
            await base44.functions.invoke('deleteGracePeriod', { date: today });
            setGraceActive(false);
            toast.success('Grace Period Deactivated');
        } catch (e) {
            toast.error('Failed to deactivate grace period');
        } finally {
            setGraceLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500">Loading grace period status...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Card className={`border-slate-200 ${graceActive ? 'bg-green-50/50 border-green-200' : ''}`}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className={`w-5 h-5 ${graceActive ? 'text-green-600' : 'text-slate-500'}`} />
                        Attendance Grace Control
                    </CardTitle>
                    <CardDescription>
                        Manage weather-related attendance exceptions
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        {graceActive ? (
                            <div className="space-y-4">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-10 h-10 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-green-700">Grace Period Active</h3>
                                    <p className="text-green-600 mt-2">30 minutes grace applied for today</p>
                                </div>
                                <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 mt-4">
                                    Applied by: {user?.full_name || 'Admin User'}
                                </Badge>
                                <Button
                                    size="lg"
                                    variant="destructive"
                                    onClick={handleDeactivateGrace}
                                    disabled={graceLoading}
                                    className="w-full max-w-sm mx-auto mt-4"
                                >
                                    {graceLoading ? 'Deactivating...' : 'Deactivate Grace Period'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto">
                                    <AlertCircle className="w-10 h-10 text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-slate-900">No Grace Period Active</h3>
                                    <p className="text-slate-500 mt-2 max-w-md mx-auto">
                                        Click the button below to manually activate a 30-minute grace period for today's attendance.
                                    </p>
                                </div>
                                <Button
                                    size="lg"
                                    onClick={handleActivateGrace}
                                    disabled={graceLoading}
                                    className="w-full max-w-sm mx-auto bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all font-bold"
                                >
                                    {graceLoading ? 'Activating...' : 'Activate 30m Grace Period'}
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
