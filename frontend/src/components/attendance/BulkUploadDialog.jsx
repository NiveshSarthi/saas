import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function BulkUploadDialog({ isOpen, onClose, selectedMonth }) {
  const [file, setFile] = useState(null);
  const [uploadMonth, setUploadMonth] = useState(selectedMonth || '');
  const [uploadResult, setUploadResult] = useState(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async ({ file, month }) => {
      // Read file as text
      const fileText = await file.text();
      
      const response = await base44.functions.invoke('uploadBulkAttendance', {
        fileContent: fileText,
        month: month
      });
      return response.data;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      queryClient.invalidateQueries(['attendance']);
      toast.success(data.message || 'Bulk upload successful!');
    },
    onError: (error) => {
      toast.error('Upload failed: ' + error.message);
      setUploadResult({ success: false, error: error.message });
    }
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a valid CSV file (.csv)');
        return;
      }
      
      setFile(selectedFile);
      setUploadResult(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }
    if (!uploadMonth) {
      toast.error('Please select a month');
      return;
    }

    uploadMutation.mutate({ file, month: uploadMonth });
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await base44.functions.invoke('generateBulkAttendanceTemplate', { 
        month: uploadMonth || selectedMonth 
      });
      
      // Create blob from CSV content
      const blob = new Blob([response.data.csv_content], { type: 'text/csv' });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Template downloaded successfully');
    } catch (error) {
      toast.error('Failed to download template: ' + error.message);
    }
  };

  const handleClose = () => {
    setFile(null);
    setUploadResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Bulk Attendance Upload
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Upload Instructions:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Download the CSV template below with all employee names pre-filled</li>
                  <li>Open in Excel/Google Sheets and fill attendance for each day (columns 1-31)</li>
                  <li><strong>P</strong> = Present, <strong>A</strong> = Absent, <strong>W</strong> = Week Off</li>
                  <li><strong>L</strong> = Late, <strong>H</strong> or <strong>HD</strong> = Half Day</li>
                  <li>Empty cells will be skipped</li>
                  <li>Save as CSV and upload</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Download Template Button */}
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template with All Members
            </Button>
          </div>

          {/* Month Selection */}
          <div>
            <Label htmlFor="month">Select Month *</Label>
            <Input
              id="month"
              type="month"
              value={uploadMonth}
              onChange={(e) => setUploadMonth(e.target.value)}
              className="mt-2"
              max={new Date().toISOString().slice(0, 7)}
            />
          </div>

          {/* File Upload */}
          <div>
            <Label htmlFor="file">Upload CSV File *</Label>
            <div className="mt-2">
              <Input
                id="file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
              />
              {file && (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(2)} KB)</span>
                </div>
              )}
            </div>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <Alert className={uploadResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {uploadResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">
                    {uploadResult.success ? 'Upload Successful!' : 'Upload Failed'}
                  </p>
                  {uploadResult.successCount !== undefined && (
                    <p className="text-sm">
                      ✅ {uploadResult.successCount} records processed
                      {uploadResult.errorCount > 0 && ` | ❌ ${uploadResult.errorCount} errors`}
                    </p>
                  )}
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <p className="text-xs font-semibold mb-1">Errors:</p>
                      {uploadResult.errors.slice(0, 10).map((err, idx) => (
                        <p key={idx} className="text-xs text-red-700">
                          • {err.employeeName || 'Unknown'} - {err.date || ''}: {err.error}
                        </p>
                      ))}
                      {uploadResult.errors.length > 10 && (
                        <p className="text-xs text-slate-500 mt-1">
                          ...and {uploadResult.errors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  )}
                  {uploadResult.error && (
                    <p className="text-sm text-red-700">{uploadResult.error}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || !uploadMonth || uploadMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Attendance
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}