import React, { useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function MasterDataSelfPickDialog({
  open,
  onOpenChange,
  user,
  availableData
}) {
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');

  const queryClient = useQueryClient();

  const cities = useMemo(() => {
    const citySet = new Set(availableData.map(d => d.city).filter(Boolean));
    return Array.from(citySet).sort();
  }, [availableData]);

  const filteredLeads = useMemo(() => {
    let leads = availableData;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      leads = leads.filter(d =>
        d.name?.toLowerCase().includes(query) ||
        d.phone?.toLowerCase().includes(query) ||
        d.city?.toLowerCase().includes(query)
      );
    }

    if (cityFilter !== 'all') {
      leads = leads.filter(d => d.city === cityFilter);
    }

    return leads;
  }, [availableData, searchQuery, cityFilter]);

  const pickMutation = useMutation({
    mutationFn: async () => {
      if (selectedLeads.length === 0) {
        throw new Error('Please select at least one lead');
      }

      const timestamp = new Date().toISOString();

      for (const leadId of selectedLeads) {
        await base44.entities.MasterData.update(leadId, {
          assigned_to: user?.email,
          assigned_by: user?.email,
          assigned_date: timestamp,
          assignment_type: 'self_picked',
          status: 'assigned'
        });

        await base44.entities.MasterDataAssignment.create({
          master_data_id: leadId,
          assigned_to: user?.email,
          assigned_by: user?.email,
          assignment_type: 'self_picked',
          assignment_date: timestamp
        });

        await base44.entities.MasterDataAuditLog.create({
          master_data_id: leadId,
          action: 'self_picked',
          actor_email: user?.email,
          actor_name: user?.full_name,
          after_value: user?.email,
          source: 'self_pick',
          timestamp: timestamp
        });
      }

      return selectedLeads.length;
    },
    onSuccess: (count) => {
      toast.success(`Successfully picked ${count} lead${count !== 1 ? 's' : ''}`);
      setSelectedLeads([]);
      queryClient.invalidateQueries(['master-data']);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to pick leads');
    }
  });

  const handleSelectLead = (id) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(l => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            Pick Available Leads
          </DialogTitle>
          <DialogDescription>
            Select leads from the available pool to work on
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search name, phone, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              className="rounded border px-3 py-2 text-sm"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Summary */}
          <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="text-sm text-emerald-900">
              {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
            </div>
            <div className="text-xs text-emerald-700">
              {filteredLeads.length} available
            </div>
          </div>

          {/* Leads Table */}
          <div className="flex-1 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <Checkbox
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={() => {
                        if (selectedLeads.length === filteredLeads.length) {
                          setSelectedLeads([]);
                        } else {
                          setSelectedLeads(filteredLeads.map(d => d.id));
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">City</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => handleSelectLead(lead.id)}
                      />
                    </td>
                    <td className="px-4 py-3">{lead.name}</td>
                    <td className="px-4 py-3">{lead.phone}</td>
                    <td className="px-4 py-3">{lead.city || '-'}</td>
                    <td className="px-4 py-3">{lead.category || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-blue-100 text-blue-700">{lead.status || 'new'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                No available leads found
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pickMutation.isPending}>
            Cancel
          </Button>
          <Button 
            onClick={() => pickMutation.mutate()} 
            disabled={pickMutation.isPending || selectedLeads.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {pickMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Picking...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Pick {selectedLeads.length} Lead{selectedLeads.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}