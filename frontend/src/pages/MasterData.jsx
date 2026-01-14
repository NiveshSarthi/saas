import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Upload,
  Download,
  Users,
  Filter,
  Search,
  RefreshCw,
  Database,
  History,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowUpDown,
  MoreHorizontal,
  ArrowRight,
  Columns,
  Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MasterDataImportDialog from '@/components/masterdata/MasterDataImportDialog';
import MasterDataSpreadsheet from '@/components/masterdata/MasterDataSpreadsheet';
import MasterDataAssignDialog from '@/components/masterdata/MasterDataAssignDialog';
import MasterDataDownloadDialog from '@/components/masterdata/MasterDataDownloadDialog';
import MasterDataAuditPanel from '@/components/masterdata/MasterDataAuditPanel';
import MasterDataSelfPickDialog from '@/components/masterdata/MasterDataSelfPickDialog';
import MasterDataStatsCards from '@/components/masterdata/MasterDataStatsCards';
import MoveToLeadsDialog from '@/components/masterdata/MoveToLeadsDialog';
import ColumnManagementDialog from '@/components/masterdata/ColumnManagementDialog';
import SoftDeleteManager from '@/components/masterdata/SoftDeleteManager';
import VersionHistoryDialog from '@/components/masterdata/VersionHistoryDialog';

export default function MasterData() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [dateFilters, setDateFilters] = useState({
    dateField: 'all',
    startDate: '',
    endDate: ''
  });
  const [tempFilters, setTempFilters] = useState({});
  const [tempDateFilters, setTempDateFilters] = useState({
    dateField: 'all',
    startDate: '',
    endDate: ''
  });
  const [selectedRows, setSelectedRows] = useState([]);
  const [showImport, setShowImport] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showSelfPick, setShowSelfPick] = useState(false);
  const [showMoveToLeads, setShowMoveToLeads] = useState(false);
  const [showColumnManagement, setShowColumnManagement] = useState(false);
  const [showDeletedRecords, setShowDeletedRecords] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionRecordId, setVersionRecordId] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await base44.auth.me();
        setUser(userData);
      } catch (e) {
        console.log('User not authenticated');
      }
    };
    fetchUser();
  }, []);

  const { data: masterData = [], isLoading } = useQuery({
    queryKey: ['master-data'],
    queryFn: async () => {
      const allData = await base44.entities.MasterData.list('-created_date', 10000);
      return allData.filter(d => !d.is_deleted); // Filter out soft-deleted
    },
    enabled: !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user,
  });

  const isAdmin = user?.role === 'admin';

  // Filter data based on role and permissions
  const visibleData = useMemo(() => {
    if (isAdmin) return masterData;
    
    // Non-admins see assigned data or row-level permissions
    return masterData.filter(d => 
      d.assigned_to === user?.email || 
      (d.row_permissions && d.row_permissions.includes(user?.email))
    );
  }, [masterData, user, isAdmin]);

  // Apply tab and search filters
  const filteredData = useMemo(() => {
    let data = visibleData;

    // Tab filter
    if (activeTab === 'assigned') {
      data = data.filter(d => d.assigned_to);
    } else if (activeTab === 'unassigned') {
      data = data.filter(d => !d.assigned_to);
    } else if (activeTab === 'my-data') {
      data = data.filter(d => d.assigned_to === user?.email);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(d =>
        d.name?.toLowerCase().includes(query) ||
        d.phone?.toLowerCase().includes(query) ||
        d.email?.toLowerCase().includes(query) ||
        d.city?.toLowerCase().includes(query) ||
        d.domain?.toLowerCase().includes(query)
      );
    }

    // Apply additional filters
    if (filters.status && filters.status !== 'all') {
      data = data.filter(d => d.status === filters.status);
    }
    
    if (filters.priority && filters.priority !== 'all') {
      data = data.filter(d => d.priority === filters.priority);
    }

    // Apply date filters
    if (dateFilters.dateField && dateFilters.dateField !== 'all' && (dateFilters.startDate || dateFilters.endDate)) {
      data = data.filter(d => {
        const dateValue = d[dateFilters.dateField];
        if (!dateValue) return false;
        
        try {
          const recordDate = new Date(dateValue);
          const start = dateFilters.startDate ? new Date(dateFilters.startDate) : null;
          const end = dateFilters.endDate ? new Date(dateFilters.endDate) : null;
          
          // Set end date to end of day for inclusive filtering
          if (end) {
            end.setHours(23, 59, 59, 999);
          }
          
          if (start && end) {
            return recordDate >= start && recordDate <= end;
          } else if (start) {
            return recordDate >= start;
          } else if (end) {
            return recordDate <= end;
          }
        } catch (e) {
          return false;
        }
        return true;
      });
    }

    return data;
  }, [visibleData, activeTab, searchQuery, filters, dateFilters, user]);

  const stats = useMemo(() => {
    // Always calculate from masterData to show true totals
    const total = masterData.length;
    const assigned = masterData.filter(d => d.assigned_to).length;
    const unassigned = total - assigned;
    const myAssigned = masterData.filter(d => d.assigned_to === user?.email).length;
    const selfPicked = masterData.filter(d => d.assignment_type === 'self_picked').length;

    return { total, assigned, unassigned, myAssigned, selfPicked };
  }, [masterData, user]);

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6 overflow-x-hidden w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-600" />
            Inventory Bucket
          </h1>
          <p className="text-slate-500 mt-1">
            Complete real estate CP mega database
          </p>
        </div>

        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
          )}

          {selectedRows.length > 0 && isAdmin && (
            <Button onClick={() => setShowAssign(true)}>
              <Users className="w-4 h-4 mr-2" />
              Assign ({selectedRows.length})
            </Button>
          )}

          {selectedRows.length > 0 && !isAdmin && (
            <Button onClick={() => setShowMoveToLeads(true)}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Move to Leads ({selectedRows.length})
            </Button>
          )}

          {isAdmin && (
            <Button variant="outline" onClick={() => setShowDownload(true)}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}

          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setShowColumnManagement(true)}>
                <Columns className="w-4 h-4 mr-2" />
                Columns
              </Button>

              <Button variant="outline" onClick={() => setShowDeletedRecords(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Deleted
              </Button>

              <Button variant="outline" onClick={() => setShowAudit(true)}>
                <History className="w-4 h-4 mr-2" />
                Audit Log
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <MasterDataStatsCards stats={stats} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <TabsList className="bg-white border">
            {isAdmin ? (
              <>
                <TabsTrigger value="all">All Data ({stats.total})</TabsTrigger>
                <TabsTrigger value="assigned">Assigned ({stats.assigned})</TabsTrigger>
                <TabsTrigger value="unassigned">Unassigned ({stats.unassigned})</TabsTrigger>
                <TabsTrigger value="my-data">My Data ({stats.myAssigned})</TabsTrigger>
              </>
            ) : user?.role === 'manager' ? (
              <>
                <TabsTrigger value="all">Team Data ({stats.total})</TabsTrigger>
                <TabsTrigger value="my-data">My Data ({stats.myAssigned})</TabsTrigger>
              </>
            ) : (
              <TabsTrigger value="my-data">My Data ({stats.myAssigned})</TabsTrigger>
            )}
          </TabsList>

          {/* Search and Filters */}
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search name, phone, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>

            <DropdownMenu 
              onOpenChange={(open) => {
                if (open) {
                  setTempFilters(filters);
                  setTempDateFilters(dateFilters);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {(Object.values(filters).some(v => v && v !== 'all') || dateFilters.dateField !== 'all') && (
                    <Badge className="ml-2 bg-indigo-600 text-white">Active</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="p-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600">Status</label>
                    <select
                      className="w-full mt-1 rounded border p-1 text-sm"
                      value={tempFilters.status || 'all'}
                      onChange={(e) => setTempFilters({...tempFilters, status: e.target.value})}
                    >
                      <option value="all">All Status</option>
                      <option value="new">New</option>
                      <option value="assigned">Assigned</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="converted">Converted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600">Priority</label>
                    <select
                      className="w-full mt-1 rounded border p-1 text-sm"
                      value={tempFilters.priority || 'all'}
                      onChange={(e) => setTempFilters({...tempFilters, priority: e.target.value})}
                    >
                      <option value="all">All Priority</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <DropdownMenuSeparator />

                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-2">Date Filter</label>
                    <select
                      className="w-full mb-2 rounded border p-1 text-sm"
                      value={tempDateFilters.dateField}
                      onChange={(e) => setTempDateFilters({...tempDateFilters, dateField: e.target.value})}
                    >
                      <option value="all">No Date Filter</option>
                      <option value="last_contact_date">Last Contact Date</option>
                      <option value="next_follow_up_date">Next Follow-up Date</option>
                      <option value="assigned_date">Assignment Date</option>
                      <option value="import_date">Import Date</option>
                      <option value="created_date">Created Date</option>
                    </select>

                    {tempDateFilters.dateField !== 'all' && (
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs text-slate-500">From Date</label>
                          <Input
                            type="date"
                            value={tempDateFilters.startDate}
                            onChange={(e) => setTempDateFilters({...tempDateFilters, startDate: e.target.value})}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">To Date</label>
                          <Input
                            type="date"
                            value={tempDateFilters.endDate}
                            onChange={(e) => setTempDateFilters({...tempDateFilters, endDate: e.target.value})}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <DropdownMenuSeparator />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setTempFilters({});
                        setTempDateFilters({ dateField: 'all', startDate: '', endDate: '' });
                        setFilters({});
                        setDateFilters({ dateField: 'all', startDate: '', endDate: '' });
                      }}
                    >
                      Clear All
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => {
                        setFilters(tempFilters);
                        setDateFilters(tempDateFilters);
                      }}
                    >
                      Apply Filters
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['master-data'] })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          <MasterDataSpreadsheet
            data={filteredData}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            isAdmin={isAdmin}
            isSalesHead={false}
            user={user}
            users={users}
            onViewHistory={(recordId) => {
              setVersionRecordId(recordId);
              setShowVersionHistory(true);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {showImport && isAdmin && (
        <MasterDataImportDialog
          open={showImport}
          onOpenChange={setShowImport}
          user={user}
        />
      )}

      {showAssign && isAdmin && (
        <MasterDataAssignDialog
          open={showAssign}
          onOpenChange={setShowAssign}
          selectedRows={selectedRows}
          onSuccess={() => {
            setSelectedRows([]);
            queryClient.invalidateQueries({ queryKey: ['master-data'] });
            queryClient.refetchQueries({ queryKey: ['master-data'] });
          }}
          user={user}
          users={users}
        />
      )}

      {showDownload && (
        <MasterDataDownloadDialog
          open={showDownload}
          onOpenChange={setShowDownload}
          data={filteredData}
          selectedRows={selectedRows}
          filters={filters}
          user={user}
          isAdmin={isAdmin}
        />
      )}

      {showAudit && isAdmin && (
        <MasterDataAuditPanel
          open={showAudit}
          onOpenChange={setShowAudit}
        />
      )}

      {showMoveToLeads && !isAdmin && (
        <MoveToLeadsDialog
          open={showMoveToLeads}
          onOpenChange={setShowMoveToLeads}
          selectedRows={selectedRows}
          masterData={masterData}
          onSuccess={() => {
            setSelectedRows([]);
            queryClient.invalidateQueries({ queryKey: ['master-data'] });
          }}
          user={user}
        />
      )}

      {showColumnManagement && isAdmin && (
        <ColumnManagementDialog
          open={showColumnManagement}
          onOpenChange={setShowColumnManagement}
        />
      )}

      {showDeletedRecords && isAdmin && (
        <SoftDeleteManager
          open={showDeletedRecords}
          onOpenChange={setShowDeletedRecords}
          user={user}
        />
      )}

      {showVersionHistory && (
        <VersionHistoryDialog
          open={showVersionHistory}
          onOpenChange={setShowVersionHistory}
          recordId={versionRecordId}
          user={user}
        />
      )}
    </div>
  );
}