import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterDataDownloadDialog({
  open,
  onOpenChange,
  data,
  selectedRows,
  filters,
  user,
  isAdmin
}) {
  const [downloadType, setDownloadType] = useState('selected');
  const [format, setFormat] = useState('csv');

  const downloadMutation = useMutation({
    mutationFn: async () => {
      let dataToDownload = [];
      let type = downloadType;

      if (downloadType === 'selected' && selectedRows.length > 0) {
        dataToDownload = data.filter(d => selectedRows.includes(d.id));
        type = 'selected_rows';
      } else if (downloadType === 'filtered') {
        dataToDownload = data;
        type = 'filtered_dataset';
      } else if (downloadType === 'assigned') {
        dataToDownload = data.filter(d => d.assigned_to === user?.email);
        type = 'assigned_only';
      } else if (downloadType === 'all' && isAdmin) {
        const allData = await base44.entities.MasterData.list('-created_date', 50000);
        dataToDownload = allData;
        type = 'full_dataset';
      }

      // Log download
      await base44.entities.MasterDataDownloadLog.create({
        user_email: user?.email,
        user_name: user?.full_name,
        download_type: type,
        row_count: dataToDownload.length,
        filters_applied: filters,
        master_data_ids: dataToDownload.map(d => d.id),
        format: format,
        timestamp: new Date().toISOString()
      });

      // Generate CSV
      const headers = [
        'name', 'phone', 'alternate_phone', 'email', 'domain',
        'address', 'city', 'state', 'pincode', 'country',
        'latitude', 'longitude', 'place_id', 'uuid',
        'category', 'rating', 'reviews', 'website',
        'facebook', 'instagram', 'linkedin', 'twitter', 'youtube',
        'status', 'priority', 'assigned_to', 'batch_name', 'notes'
      ];

      const csvContent = [
        headers.join(','),
        ...dataToDownload.map(row =>
          headers.map(header => {
            const value = row[header] || '';
            return `"${String(value).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `master-data-${type}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      return dataToDownload.length;
    },
    onSuccess: (count) => {
      toast.success(`Downloaded ${count} records`);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to download data');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-indigo-600" />
            Download Master Data
          </DialogTitle>
          <DialogDescription>
            Export master data records to CSV format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Download Type</Label>
            <RadioGroup value={downloadType} onValueChange={setDownloadType}>
              {selectedRows.length > 0 && (
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="flex-1 cursor-pointer">
                    <div className="font-medium">Selected Rows</div>
                    <div className="text-sm text-slate-500">{selectedRows.length} record{selectedRows.length !== 1 ? 's' : ''}</div>
                  </Label>
                </div>
              )}

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                <RadioGroupItem value="filtered" id="filtered" />
                <Label htmlFor="filtered" className="flex-1 cursor-pointer">
                  <div className="font-medium">Filtered Dataset</div>
                  <div className="text-sm text-slate-500">{data.length} record{data.length !== 1 ? 's' : ''} (current view)</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                <RadioGroupItem value="assigned" id="assigned" />
                <Label htmlFor="assigned" className="flex-1 cursor-pointer">
                  <div className="font-medium">My Assigned Data</div>
                  <div className="text-sm text-slate-500">Only records assigned to you</div>
                </Label>
              </div>

              {isAdmin && (
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="flex-1 cursor-pointer">
                    <div className="font-medium">Complete Dataset</div>
                    <div className="text-sm text-slate-500">All master data (Admin only)</div>
                  </Label>
                </div>
              )}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Format</Label>
            <RadioGroup value={format} onValueChange={setFormat}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex-1 cursor-pointer flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <div>
                    <div className="font-medium">CSV</div>
                    <div className="text-sm text-slate-500">Comma-separated values</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-sm text-amber-900">
              <strong>Note:</strong> This download will be logged for audit purposes
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloadMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={() => downloadMutation.mutate()} disabled={downloadMutation.isPending}>
            {downloadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}