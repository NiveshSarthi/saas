import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Upload, Loader2, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterDataImportDialog({ open, onOpenChange, user }) {
  const [file, setFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [duplicateStrategy, setDuplicateStrategy] = useState('skip');
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1);
  const [duplicatesFound, setDuplicatesFound] = useState([]);

  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      setFile(selectedFile);
      setBatchName(selectedFile.name.replace(/\.csv$/, ''));
      setStep(2);
    }
  };

  const checkDuplicates = async (leads, existingData) => {
    const duplicates = [];
    
    leads.forEach(lead => {
      const duplicate = existingData.find(existing => 
        (lead.phone && existing.phone === lead.phone) ||
        (lead.domain && existing.domain === lead.domain) ||
        (lead.place_id && existing.place_id === lead.place_id) ||
        (lead.uuid && existing.uuid === lead.uuid)
      );
      
      if (duplicate) {
        duplicates.push({ lead, duplicate });
      }
    });

    return duplicates;
  };

  const handleImport = async () => {
    if (!file || !batchName) {
      toast.error('Please select a file and provide a batch name');
      return;
    }

    setUploading(true);
    try {
      // Upload file
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes.file_url;

      // Extract data
      const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: fileUrl,
        json_schema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              phone: { type: 'string' },
              alternate_phone: { type: 'string' },
              email: { type: 'string' },
              domain: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              pincode: { type: 'string' },
              country: { type: 'string' },
              latitude: { type: 'string' },
              longitude: { type: 'string' },
              place_id: { type: 'string' },
              uuid: { type: 'string' },
              category: { type: 'string' },
              rating: { type: 'string' },
              reviews: { type: 'string' },
              website: { type: 'string' },
              facebook: { type: 'string' },
              instagram: { type: 'string' },
              linkedin: { type: 'string' },
              twitter: { type: 'string' },
              youtube: { type: 'string' }
            },
            required: ['name', 'phone']
          }
        }
      });

      if (extractRes.status === 'error') {
        toast.error('Failed to extract data: ' + extractRes.details);
        setUploading(false);
        return;
      }

      const leadsData = Array.isArray(extractRes.output) ? extractRes.output : [];
      if (leadsData.length === 0) {
        toast.error('No valid data found in the file');
        setUploading(false);
        return;
      }

      // Check for duplicates
      const existingData = await base44.entities.MasterData.list('-created_date', 50000);
      const duplicates = await checkDuplicates(leadsData, existingData);

      if (duplicates.length > 0) {
        setDuplicatesFound(duplicates);
        toast.warning(`Found ${duplicates.length} duplicate records`);
      }

      // Process based on duplicate strategy
      const batchId = `batch_${Date.now()}`;
      let leadsToCreate = [];

      if (duplicateStrategy === 'skip') {
        const duplicatePhones = new Set(duplicates.map(d => d.lead.phone));
        leadsToCreate = leadsData
          .filter(lead => !duplicatePhones.has(lead.phone))
          .map(lead => ({
            ...lead,
            status: 'new',
            priority: 'medium',
            batch_name: batchName,
            batch_id: batchId,
            import_date: new Date().toISOString(),
          }));
      } else if (duplicateStrategy === 'overwrite') {
        // Delete duplicates first
        for (const dup of duplicates) {
          await base44.entities.MasterData.delete(dup.duplicate.id);
        }
        leadsToCreate = leadsData.map(lead => ({
          ...lead,
          status: 'new',
          priority: 'medium',
          batch_name: batchName,
          batch_id: batchId,
          import_date: new Date().toISOString(),
        }));
      } else if (duplicateStrategy === 'keep_both') {
        leadsToCreate = leadsData.map(lead => {
          const isDuplicate = duplicates.some(d => d.lead.phone === lead.phone);
          return {
            ...lead,
            status: 'new',
            priority: 'medium',
            batch_name: batchName,
            batch_id: batchId,
            import_date: new Date().toISOString(),
            is_duplicate: isDuplicate,
            duplicate_of: isDuplicate ? duplicates.find(d => d.lead.phone === lead.phone)?.duplicate.id : null
          };
        });
      }

      // Batch create
      if (leadsToCreate.length > 0) {
        // Process in chunks of 100
        const chunkSize = 100;
        for (let i = 0; i < leadsToCreate.length; i += chunkSize) {
          const chunk = leadsToCreate.slice(i, i + chunkSize);
          await base44.entities.MasterData.bulkCreate(chunk);
        }
      }

      // Log activity
      await base44.entities.MasterDataAuditLog.create({
        action: 'imported',
        actor_email: user?.email,
        actor_name: user?.full_name,
        source: 'import',
        timestamp: new Date().toISOString(),
        metadata: {
          batch_name: batchName,
          batch_id: batchId,
          total_rows: leadsData.length,
          imported_rows: leadsToCreate.length,
          duplicates_found: duplicates.length,
          duplicate_strategy: duplicateStrategy
        }
      });

      queryClient.invalidateQueries({ queryKey: ['master-data'] });
      toast.success(`Successfully imported ${leadsToCreate.length} records`);
      
      setStep(3);
      setTimeout(() => {
        onOpenChange(false);
        setStep(1);
        setFile(null);
        setBatchName('');
        setDuplicatesFound([]);
      }, 2000);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Master Data CSV</DialogTitle>
          <DialogDescription>
            Upload CSV with exact column headers. Supports large files (5k-10k rows).
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="py-6">
            <Label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-48 px-4 transition bg-white border-2 border-dashed rounded-lg appearance-none cursor-pointer hover:border-indigo-400 border-slate-300"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 mb-3 text-slate-400" />
                <p className="mb-2 text-sm text-slate-600">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-slate-500">CSV file with master data columns</p>
              </div>
              <Input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </Label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{file?.name}</div>
                <div className="text-sm text-slate-600">{(file?.size / 1024).toFixed(2)} KB</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Batch Name *</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g., Faridabad December 2024"
              />
            </div>

            <div className="space-y-2">
              <Label>Duplicate Handling</Label>
              <RadioGroup value={duplicateStrategy} onValueChange={setDuplicateStrategy}>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip" className="flex-1 cursor-pointer">
                    <div className="font-medium">Skip Duplicates</div>
                    <div className="text-sm text-slate-500">Don't import duplicate records</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  <Label htmlFor="overwrite" className="flex-1 cursor-pointer">
                    <div className="font-medium">Overwrite Existing</div>
                    <div className="text-sm text-slate-500">Replace old data with new</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-slate-50">
                  <RadioGroupItem value="keep_both" id="keep_both" />
                  <Label htmlFor="keep_both" className="flex-1 cursor-pointer">
                    <div className="font-medium">Keep Both</div>
                    <div className="text-sm text-slate-500">Save as duplicate copy</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {duplicatesFound.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-900">
                      {duplicatesFound.length} Duplicates Found
                    </div>
                    <div className="text-sm text-amber-700 mt-1">
                      Based on phone, domain, place_id, or uuid matching
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="py-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Successful!</h3>
            <p className="text-slate-600">Master data has been imported successfully</p>
          </div>
        )}

        {step === 2 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setStep(1)} disabled={uploading}>
              Back
            </Button>
            <Button onClick={handleImport} disabled={uploading || !batchName}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}