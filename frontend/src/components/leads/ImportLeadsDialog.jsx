import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ImportLeadsDialog({ open, onOpenChange, salesUsers }) {
  const [file, setFile] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [assignmentMode, setAssignmentMode] = useState('unassigned');
  const [selectedUser, setSelectedUser] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const queryClient = useQueryClient();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setImportResult(null);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a CSV file');
      return;
    }

    if (!batchName || batchName.trim() === '') {
      toast.error('Please enter an import batch name');
      return;
    }

    if (assignmentMode === 'assign_to' && !selectedUser) {
      toast.error('Please select a user to assign leads to');
      return;
    }

    setImporting(true);

    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data from CSV
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            lead_name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string' },
            company: { type: 'string' },
            priority: { type: 'string' },
            property_interest: { type: 'string' },
            location: { type: 'string' },
            notes: { type: 'string' },
            follow_up_date: { type: 'string' }
          }
        }
      });

      if (extractResult.status === 'error') {
        throw new Error(extractResult.details || 'Failed to extract data from CSV');
      }

      const extractedLeads = Array.isArray(extractResult.output) ? extractResult.output : [extractResult.output];

      // Check for duplicates
      const allLeads = await base44.entities.Lead.list();
      const existingPhones = new Set(allLeads.map(l => l.phone));
      const existingEmails = new Set(allLeads.map(l => l.email).filter(Boolean));

      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const batchId = `import_${Date.now()}`;

      // Auto-assign logic for round robin
      let currentUserIndex = 0;

      for (const leadData of extractedLeads) {
        // Skip if missing required fields
        if (!leadData.lead_name || !leadData.phone) {
          errors++;
          continue;
        }

        // Check duplicates
        if (existingPhones.has(leadData.phone) || (leadData.email && existingEmails.has(leadData.email))) {
          skipped++;
          continue;
        }

        try {
          // Determine assignment
          let assignedTo = null;
          if (assignmentMode === 'assign_to') {
            assignedTo = selectedUser;
          } else if (assignmentMode === 'round_robin') {
            assignedTo = salesUsers[currentUserIndex % salesUsers.length]?.email;
            currentUserIndex++;
          }

          // Track which fields were imported (non-empty values)
          const importedFields = [];
          if (leadData.title) importedFields.push('title');
          if (leadData.lead_name) importedFields.push('lead_name');
          if (leadData.phone) importedFields.push('phone');
          if (leadData.email) importedFields.push('email');
          if (leadData.company) importedFields.push('company');
          if (leadData.property_interest) importedFields.push('property_interest');
          if (leadData.location) importedFields.push('location');
          if (leadData.notes) importedFields.push('notes');
          if (leadData.follow_up_date) importedFields.push('follow_up_date');

          await base44.entities.Lead.create({
            title: leadData.title || null,
            lead_name: leadData.lead_name,
            phone: leadData.phone,
            email: leadData.email || null,
            company: leadData.company || null,
            contact_status: 'not_contacted',
            priority: leadData.priority || 'medium',
            property_interest: leadData.property_interest || null,
            location: leadData.location || null,
            notes: leadData.notes || null,
            follow_up_date: leadData.follow_up_date || null,
            assigned_to: assignedTo,
            import_batch_id: batchId,
            import_batch_name: batchName.trim(),
            import_date: new Date().toISOString(),
            imported_fields: importedFields,
            status: 'new'
          });

          // Create notification if assigned
          if (assignedTo) {
            await base44.entities.Notification.create({
              user_email: assignedTo,
              type: 'task_assigned',
              title: 'New Lead Assigned',
              message: `New lead assigned: ${leadData.lead_name}. Please contact and update status.`,
              read: false
            });
          }

          imported++;
          existingPhones.add(leadData.phone);
          if (leadData.email) existingEmails.add(leadData.email);
        } catch (err) {
          errors++;
        }
      }

      setImportResult({ imported, skipped, errors, total: extractedLeads.length });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      
      if (imported > 0) {
        toast.success(`Successfully imported ${imported} lead(s)`);
      }
    } catch (error) {
      toast.error(error.message || 'Import failed');
      setImportResult({ imported: 0, skipped: 0, errors: 1, total: 0 });
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setBatchName('');
    setAssignmentMode('unassigned');
    setSelectedUser('');
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing lead information. Duplicates (based on phone/email) will be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Import Batch Name */}
          <div className="space-y-2">
            <Label htmlFor="batch-name">Import Batch Name *</Label>
            <Input
              id="batch-name"
              placeholder="e.g., Expo 2025 Leads, Website Leads Jan 2025"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="font-medium"
            />
            <p className="text-xs text-slate-500">
              This name will help identify and track the origin of imported leads
            </p>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>CSV File *</Label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-8 h-8 text-indigo-600" />
                    <div className="text-left">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-medium">Click to upload CSV</p>
                    <p className="text-xs text-slate-500 mt-1">Supports: title, lead_name, phone, email, company, etc.</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Assignment Options */}
          <div className="space-y-3">
            <Label>Lead Assignment</Label>
            <RadioGroup value={assignmentMode} onValueChange={setAssignmentMode}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="unassigned" id="unassigned" />
                <Label htmlFor="unassigned" className="cursor-pointer flex-1">
                  <div className="font-medium">Keep Unassigned</div>
                  <div className="text-xs text-slate-500">Manually assign later</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="assign_to" id="assign_to" />
                <Label htmlFor="assign_to" className="cursor-pointer flex-1">
                  <div className="font-medium">Assign to Specific User</div>
                  <div className="text-xs text-slate-500">All leads go to one person</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="round_robin" id="round_robin" />
                <Label htmlFor="round_robin" className="cursor-pointer flex-1">
                  <div className="font-medium">Round Robin (Auto-Assign)</div>
                  <div className="text-xs text-slate-500">Distribute evenly across sales team</div>
                </Label>
              </div>
            </RadioGroup>

            {assignmentMode === 'assign_to' && (
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {salesUsers.map(u => (
                    <SelectItem key={u.email} value={u.email}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Import Result */}
          {importResult && (
            <div className="p-4 bg-slate-50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Import Complete</span>
              </div>
              <div className="text-sm space-y-1 ml-7">
                <p>✅ Imported: <strong>{importResult.imported}</strong> lead(s)</p>
                <p>⚠️ Skipped (duplicates): <strong>{importResult.skipped}</strong></p>
                {importResult.errors > 0 && (
                  <p className="text-red-600">❌ Errors: <strong>{importResult.errors}</strong></p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult ? 'Close' : 'Cancel'}
          </Button>
          {!importResult && (
            <Button 
              onClick={handleImport} 
              disabled={!file || !batchName || importing}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import Leads
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}