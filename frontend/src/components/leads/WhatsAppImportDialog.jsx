import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { MessageSquare, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function WhatsAppImportDialog({ open, onOpenChange }) {
    const [data, setData] = useState('');
    const [campaignId, setCampaignId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState(null);
    const queryClient = useQueryClient();

    const handleImport = async () => {
        if (!data.trim()) {
            toast.error('Please paste some lead data first');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/whatsapp-leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: data,
                    campaign_id: campaignId || 'manual_import'
                }),
            });

            const resData = await response.json();

            if (resData.success) {
                setResult(resData);
                toast.success(`Successfully imported ${resData.created} new leads and updated ${resData.updated} leads.`);
                queryClient.invalidateQueries({ queryKey: ['leads-management'] });
                queryClient.invalidateQueries({ queryKey: ['leads'] });
            } else {
                toast.error(resData.error || 'Failed to import leads');
            }
        } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to connect to the server');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setData('');
        setCampaignId('');
        setResult(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !isSubmitting && (val ? onOpenChange(true) : handleClose())}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                        Import WhatsApp Leads
                    </DialogTitle>
                    <DialogDescription>
                        Paste the tab-separated lead data from WhatsApp here. Ensure headers are included.
                    </DialogDescription>
                </DialogHeader>

                {result ? (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                                <p className="text-2xl font-bold text-green-700">{result.created}</p>
                                <p className="text-xs text-green-600 uppercase font-semibold">New Leads</p>
                            </div>
                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                                <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
                                <p className="text-xs text-blue-600 uppercase font-semibold">Updated Leads</p>
                            </div>
                        </div>

                        {result.errors && result.errors.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-red-600 flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    Errors ({result.errors.length})
                                </Label>
                                <div className="max-h-40 overflow-y-auto border border-red-100 rounded bg-red-50 p-2 text-xs space-y-1">
                                    {result.errors.map((err, idx) => (
                                        <div key={idx} className="text-red-700">
                                            <strong>Row {idx + 1}:</strong> {err.error}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex justify-end">
                            <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
                                Done
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="campaignId">Campaign Identifier (Optional)</Label>
                            <Input
                                id="campaignId"
                                placeholder="e.g. FB-WA-REALESTATE-JAN"
                                value={campaignId}
                                onChange={(e) => setCampaignId(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="leadData">WhatsApp Data (TSV Format)</Label>
                                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Tab-Separated Only</span>
                            </div>
                            <Textarea
                                id="leadData"
                                placeholder="Paste data here... (e.g. Name [Tab] Phone [Tab] Question 1...)"
                                className="min-h-[250px] font-mono text-xs"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                disabled={isSubmitting}
                            />
                            <p className="text-[10px] text-slate-500 italic">
                                * Required columns: "name", "phone_no."
                            </p>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={isSubmitting || !data.trim()}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Import Leads
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
