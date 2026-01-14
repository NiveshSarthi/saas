import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowUpDown, Plus, MoreVertical, Trash2, Copy, GripVertical, Columns, History } from 'lucide-react';
import { toast } from 'sonner';
import AddColumnDialog from './AddColumnDialog';
import AddRowDialog from './AddRowDialog';

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Name', width: 200, editable: true },
  { key: 'phone', label: 'Phone', width: 130, editable: true },
  { key: 'alternate_phone', label: 'Alt Phone', width: 130, editable: true },
  { key: 'email', label: 'Email', width: 200, editable: true },
  { key: 'domain', label: 'Domain', width: 200, editable: true },
  { key: 'city', label: 'City', width: 120, editable: true },
  { key: 'state', label: 'State', width: 120, editable: true },
  { key: 'pincode', label: 'Pincode', width: 100, editable: true },
  { key: 'category', label: 'Category', width: 150, editable: true },
  { key: 'rating', label: 'Rating', width: 80, editable: true },
  { key: 'website', label: 'Website', width: 180, editable: true },
  { key: 'status', label: 'Status', width: 120, editable: true, type: 'select' },
  { key: 'priority', label: 'Priority', width: 100, editable: true, type: 'select' },
  { key: 'assigned_to', label: 'Assigned To', width: 180, editable: true, type: 'user-select' },
  { key: 'created_date', label: 'Created Date', width: 150, editable: false, type: 'date' },
  { key: 'assigned_date', label: 'Assigned Date', width: 150, editable: false, type: 'date' },
  { key: 'notes', label: 'Notes', width: 200, editable: true },
];

export default function MasterDataSpreadsheet({
  data,
  selectedRows,
  onSelectionChange,
  isAdmin,
  isSalesHead,
  user,
  users,
  onViewHistory
}) {
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [activeCell, setActiveCell] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [dragSelecting, setDragSelecting] = useState(false);
  const [dragStartRowId, setDragStartRowId] = useState(null);
  const [dragCurrentRowId, setDragCurrentRowId] = useState(null);

  const tableRef = useRef(null);
  const autoScrollInterval = useRef(null);
  const queryClient = useQueryClient();

  const canEdit = isAdmin;
  const canSelect = true; // All users can select rows

  // Add new row mutation
  const addRowMutation = useMutation({
    mutationFn: async (rowData) => {
      const newRow = await base44.entities.MasterData.create({
        ...rowData,
        created_date: new Date().toISOString()
      });

      await base44.entities.MasterDataAuditLog.create({
        master_data_id: newRow.id,
        action: 'created',
        actor_email: user?.email,
        actor_name: user?.full_name,
        source: 'admin_update',
        timestamp: new Date().toISOString()
      });

      return newRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['master-data']);
      toast.success('Row added successfully');
    }
  });

  // Update cell mutation with version control
  const updateMutation = useMutation({
    mutationFn: async ({ id, field, value }) => {
      // Get current data for version control
      const currentData = await base44.entities.MasterData.list();
      const currentRecord = currentData.find(r => r.id === id);
      const oldValue = currentRecord[field];
      
      await base44.entities.MasterData.update(id, { [field]: value });
      
      // Create version entry
      const versions = await base44.entities.MasterDataVersion.filter({ master_data_id: id });
      const versionNumber = versions.length + 1;
      
      await base44.entities.MasterDataVersion.create({
        master_data_id: id,
        version_number: versionNumber,
        changed_by: user?.email,
        changed_at: new Date().toISOString(),
        changes: { [field]: { before: oldValue, after: value } },
        full_snapshot: { ...currentRecord, [field]: value }
      });

      await base44.entities.MasterDataAuditLog.create({
        master_data_id: id,
        action: 'updated',
        actor_email: user?.email,
        actor_name: user?.full_name,
        field_changed: field,
        before_value: oldValue,
        after_value: value,
        source: 'admin_update',
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['master-data']);
      toast.success('Updated successfully');
    }
  });

  // Delete row mutation
  const deleteRowMutation = useMutation({
    mutationFn: async (id) => {
      await base44.entities.MasterData.delete(id);
      await base44.entities.MasterDataAuditLog.create({
        master_data_id: id,
        action: 'deleted',
        actor_email: user?.email,
        actor_name: user?.full_name,
        source: 'admin_update',
        timestamp: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['master-data']);
      toast.success('Row deleted');
    }
  });

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key] || '';
      const bVal = b[sortConfig.key] || '';
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const visibleColumns = columns.filter(col => !hiddenColumns.includes(col.key));

  // Get selected range
  const selectedRange = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    
    const startIdx = sortedData.findIndex(d => d.id === rangeStart.rowId);
    const endIdx = sortedData.findIndex(d => d.id === rangeEnd.rowId);
    const startColIdx = visibleColumns.findIndex(c => c.key === rangeStart.colKey);
    const endColIdx = visibleColumns.findIndex(c => c.key === rangeEnd.colKey);

    const minRow = Math.min(startIdx, endIdx);
    const maxRow = Math.max(startIdx, endIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    const range = [];
    for (let i = minRow; i <= maxRow; i++) {
      for (let j = minCol; j <= maxCol; j++) {
        range.push({
          rowId: sortedData[i]?.id,
          colKey: visibleColumns[j]?.key
        });
      }
    }
    return range;
  }, [rangeStart, rangeEnd, sortedData, visibleColumns]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeCell || editingCell) return;

      const rowIdx = sortedData.findIndex(d => d.id === activeCell.rowId);
      const colIdx = visibleColumns.findIndex(c => c.key === activeCell.colKey);

      let newRowIdx = rowIdx;
      let newColIdx = colIdx;

      if (e.key === 'ArrowUp' && rowIdx > 0) {
        e.preventDefault();
        newRowIdx--;
      } else if (e.key === 'ArrowDown' && rowIdx < sortedData.length - 1) {
        e.preventDefault();
        newRowIdx++;
      } else if (e.key === 'ArrowLeft' && colIdx > 0) {
        e.preventDefault();
        newColIdx--;
      } else if (e.key === 'ArrowRight' && colIdx < visibleColumns.length - 1) {
        e.preventDefault();
        newColIdx++;
      } else if (e.key === 'Enter' && canEdit) {
        e.preventDefault();
        const row = sortedData[rowIdx];
        const col = visibleColumns[colIdx];
        handleCellEdit(row.id, col.key, row[col.key]);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          newColIdx = colIdx > 0 ? colIdx - 1 : colIdx;
        } else {
          newColIdx = colIdx < visibleColumns.length - 1 ? colIdx + 1 : colIdx;
        }
      }

      if (newRowIdx !== rowIdx || newColIdx !== colIdx) {
        setActiveCell({
          rowId: sortedData[newRowIdx]?.id,
          colKey: visibleColumns[newColIdx]?.key
        });

        if (!e.shiftKey) {
          setRangeStart(null);
          setRangeEnd(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCell, sortedData, visibleColumns, editingCell, canEdit]);

  // Click outside to close context menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCellClick = (rowId, colKey, e) => {
    e.stopPropagation();
    
    if (e.shiftKey && rangeStart) {
      // Shift + Click = Range selection
      setRangeEnd({ rowId, colKey });
      
      // Select all rows in range
      const startIdx = sortedData.findIndex(d => d.id === rangeStart.rowId);
      const endIdx = sortedData.findIndex(d => d.id === rowId);
      const minRow = Math.min(startIdx, endIdx);
      const maxRow = Math.max(startIdx, endIdx);
      const rangeIds = sortedData.slice(minRow, maxRow + 1).map(d => d.id);
      onSelectionChange(rangeIds);
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl + Click = Multi-select
      setActiveCell({ rowId, colKey });
      if (selectedRows.includes(rowId)) {
        onSelectionChange(selectedRows.filter(id => id !== rowId));
      } else {
        onSelectionChange([...selectedRows, rowId]);
      }
    } else {
      // Normal click
      setActiveCell({ rowId, colKey });
      setRangeStart({ rowId, colKey });
      setRangeEnd(null);
    }
  };

  const handleCellEdit = (rowId, field, currentValue) => {
    if (!canEdit) return;
    setEditingCell({ rowId, field });
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    
    const { rowId, field } = editingCell;
    await updateMutation.mutateAsync({ id: rowId, field, value: editValue });
    
    // Move to next cell
    const rowIdx = sortedData.findIndex(d => d.id === rowId);
    const colIdx = visibleColumns.findIndex(c => c.key === field);
    
    if (colIdx < visibleColumns.length - 1) {
      setActiveCell({
        rowId,
        colKey: visibleColumns[colIdx + 1].key
      });
    } else if (rowIdx < sortedData.length - 1) {
      setActiveCell({
        rowId: sortedData[rowIdx + 1].id,
        colKey: visibleColumns[0].key
      });
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleSelectAll = () => {
    if (selectedRows.length === sortedData.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sortedData.map(d => d.id));
    }
  };

  const handleSelectRow = (id, e) => {
    if (e?.ctrlKey || e?.metaKey) {
      if (selectedRows.includes(id)) {
        onSelectionChange(selectedRows.filter(r => r !== id));
      } else {
        onSelectionChange([...selectedRows, id]);
      }
    } else {
      if (selectedRows.includes(id)) {
        onSelectionChange(selectedRows.filter(r => r !== id));
      } else {
        onSelectionChange([...selectedRows, id]);
      }
    }
  };

  // Drag selection handlers
  const handleDragSelectStart = (rowId, e) => {
    if (!canSelect) return;
    e.preventDefault();
    setDragSelecting(true);
    setDragStartRowId(rowId);
    setDragCurrentRowId(rowId);
    onSelectionChange([rowId]);
  };

  const handleDragSelectMove = (rowId, e) => {
    if (!dragSelecting || !dragStartRowId) return;
    
    setDragCurrentRowId(rowId);
    
    // Select all rows between start and current
    const startIdx = sortedData.findIndex(d => d.id === dragStartRowId);
    const endIdx = sortedData.findIndex(d => d.id === rowId);
    
    if (startIdx !== -1 && endIdx !== -1) {
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);
      const rangeIds = sortedData.slice(minIdx, maxIdx + 1).map(d => d.id);
      onSelectionChange(rangeIds);
    }

    // Auto-scroll
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const scrollContainer = tableRef.current?.parentElement;
    
    if (scrollContainer) {
      const threshold = 50;
      const scrollSpeed = 10;
      
      if (rect.top < threshold) {
        // Scroll up
        if (!autoScrollInterval.current) {
          autoScrollInterval.current = setInterval(() => {
            scrollContainer.scrollTop -= scrollSpeed;
          }, 16);
        }
      } else if (rect.bottom > window.innerHeight - threshold) {
        // Scroll down
        if (!autoScrollInterval.current) {
          autoScrollInterval.current = setInterval(() => {
            scrollContainer.scrollTop += scrollSpeed;
          }, 16);
        }
      } else {
        // Stop auto-scroll
        if (autoScrollInterval.current) {
          clearInterval(autoScrollInterval.current);
          autoScrollInterval.current = null;
        }
      }
    }
  };

  const handleDragSelectEnd = () => {
    setDragSelecting(false);
    setDragStartRowId(null);
    setDragCurrentRowId(null);
    
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  };

  // Global mouseup listener for drag select
  useEffect(() => {
    if (dragSelecting) {
      const handleMouseUp = () => handleDragSelectEnd();
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [dragSelecting]);

  // Cleanup auto-scroll on unmount
  useEffect(() => {
    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
    };
  }, []);

  const handleContextMenu = (e, rowId, colKey) => {
    if (!canEdit) return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowId,
      colKey
    });
  };

  const handleDeleteRow = async (id) => {
    if (!canEdit) return;
    if (confirm('Delete this row?')) {
      await deleteRowMutation.mutateAsync(id);
    }
  };

  const handleBulkDelete = async () => {
    if (!canEdit || selectedRows.length === 0) return;
    if (confirm(`Delete ${selectedRows.length} selected rows?`)) {
      for (const id of selectedRows) {
        await deleteRowMutation.mutateAsync(id);
      }
      onSelectionChange([]);
    }
  };

  const handleDuplicateRow = async (rowId) => {
    if (!canEdit) return;
    const row = sortedData.find(d => d.id === rowId);
    if (!row) return;

    const { id, created_date, updated_date, created_by, ...rowData } = row;
    await addRowMutation.mutateAsync({
      ...rowData,
      name: `${rowData.name} (Copy)`
    });
  };

  const handleAddColumn = (columnDef) => {
    setColumns([...columns, columnDef]);
    toast.success('Column added successfully');
  };

  const isCellInRange = (rowId, colKey) => {
    return selectedRange.some(cell => cell.rowId === rowId && cell.colKey === colKey);
  };

  const renderCell = (row, column) => {
    const isEditing = editingCell?.rowId === row.id && editingCell?.field === column.key;
    const value = row[column.key];
    const isActive = activeCell?.rowId === row.id && activeCell?.colKey === column.key;
    const inRange = isCellInRange(row.id, column.key);

    if (isEditing) {
      if (column.type === 'select') {
        const options = column.key === 'status' 
          ? ['new', 'assigned', 'contacted', 'qualified', 'converted', 'closed', 'rejected']
          : ['low', 'medium', 'high', 'urgent'];
        
        return (
          <div className="flex items-center gap-1 p-1">
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
              <ArrowUpDown className="w-3 h-3" />
            </Button>
          </div>
        );
      } else if (column.type === 'user-select') {
        return (
          <div className="flex items-center gap-1 p-1">
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Unassigned</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.email} value={u.email}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="icon" className="h-7 w-7" onClick={handleSaveEdit}>
              <ArrowUpDown className="w-3 h-3" />
            </Button>
          </div>
        );
      } else {
        return (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-7 text-xs border-2 border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelEdit();
              }
              if (e.key === 'Tab') {
                e.preventDefault();
                handleSaveEdit();
              }
            }}
            onBlur={handleSaveEdit}
          />
        );
      }
    }

    // Display mode
    let cellContent;
    if (column.key === 'status') {
      const colors = {
        new: 'bg-blue-100 text-blue-700',
        assigned: 'bg-purple-100 text-purple-700',
        contacted: 'bg-amber-100 text-amber-700',
        qualified: 'bg-emerald-100 text-emerald-700',
        converted: 'bg-green-100 text-green-700',
        closed: 'bg-slate-100 text-slate-700',
        rejected: 'bg-red-100 text-red-700'
      };
      cellContent = (
        <Badge className={colors[value] || 'bg-slate-100 text-xs'}>
          {value || 'new'}
        </Badge>
      );
    } else if (column.key === 'priority') {
      const colors = {
        low: 'bg-slate-100 text-slate-700',
        medium: 'bg-blue-100 text-blue-700',
        high: 'bg-orange-100 text-orange-700',
        urgent: 'bg-red-100 text-red-700'
      };
      cellContent = (
        <Badge className={colors[value] || 'bg-slate-100 text-xs'}>
          {value || 'medium'}
        </Badge>
      );
    } else if (column.type === 'date' && value) {
      // Format date fields
      try {
        const date = new Date(value);
        cellContent = <span className="text-slate-600 text-xs">{date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
      } catch (e) {
        cellContent = <span className="truncate">{value || '-'}</span>;
      }
    } else {
      cellContent = <span className="truncate">{value || '-'}</span>;
    }

    return (
      <div
        className={`px-1.5 sm:px-2 py-1 cursor-cell text-xs sm:text-sm ${
          isActive ? 'ring-2 ring-blue-500 ring-inset bg-blue-50' : ''
        } ${inRange ? 'bg-blue-100' : ''} ${canEdit ? 'hover:bg-slate-50' : ''}`}
        onDoubleClick={() => handleCellEdit(row.id, column.key, value)}
      >
        {cellContent}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-slate-200 overflow-hidden w-full">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2 sm:p-3 border-b bg-slate-50 gap-2">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          {canEdit && (
            <>
              <Button size="sm" onClick={() => setShowAddRow(true)} className="h-8 text-xs">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                <span className="hidden sm:inline">Add Row</span>
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setShowAddColumn(true)} className="h-8 text-xs">
                  <Columns className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Column</span>
                </Button>
              )}
            </>
          )}
          {selectedRows.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => onSelectionChange([])} className="h-8 text-xs">
                Clear ({selectedRows.length})
              </Button>
              {canEdit && (
                <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-8 text-xs">
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Delete ({selectedRows.length})</span>
                  <span className="sm:hidden">{selectedRows.length}</span>
                </Button>
              )}
            </>
          )}
        </div>
        <div className="text-[10px] sm:text-xs text-slate-600 whitespace-nowrap">
          {selectedRange.length > 0 && <span className="hidden sm:inline">{selectedRange.length} cells • </span>}
          {sortedData.length} rows
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto max-h-[400px] sm:max-h-[500px] scrollbar-thin -webkit-overflow-scrolling-touch" ref={tableRef}>
        <table className="w-full text-xs sm:text-sm border-collapse min-w-max">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <tr>
              {canSelect && (
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left w-10 sm:w-12 border-r">
                  <Checkbox
                    checked={selectedRows.length === sortedData.length && sortedData.length > 0}
                    onCheckedChange={handleSelectAll}
                    className="w-4 h-4"
                  />
                </th>
              )}
              {visibleColumns.map((column, idx) => (
                <th
                  key={column.key}
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left font-medium text-slate-700 cursor-pointer hover:bg-slate-100 border-r relative group whitespace-nowrap"
                  style={{ minWidth: Math.max(column.width * 0.8, 100) }}
                  onClick={() => handleSort(column.key)}
                  onContextMenu={(e) => isAdmin && handleContextMenu(e, null, column.key)}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm truncate">{column.label}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  </div>
                </th>
              ))}
              {canEdit && (
                <th className="px-1 sm:px-2 py-2 sm:py-3 w-10">
                  <MoreVertical className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400" />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedData.map((row, rowIdx) => (
              <tr 
                key={row.id} 
                className={`hover:bg-slate-50 ${selectedRows.includes(row.id) ? 'bg-blue-50' : ''} ${
                  dragSelecting && dragStartRowId && dragCurrentRowId && 
                  sortedData.findIndex(d => d.id === row.id) >= Math.min(
                    sortedData.findIndex(d => d.id === dragStartRowId),
                    sortedData.findIndex(d => d.id === dragCurrentRowId)
                  ) &&
                  sortedData.findIndex(d => d.id === row.id) <= Math.max(
                    sortedData.findIndex(d => d.id === dragStartRowId),
                    sortedData.findIndex(d => d.id === dragCurrentRowId)
                  ) ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                }`}
                onContextMenu={(e) => handleContextMenu(e, row.id, null)}
                onMouseEnter={(e) => dragSelecting && handleDragSelectMove(row.id, e)}
              >
                {canSelect && (
                  <td 
                    className="px-2 sm:px-4 py-1.5 sm:py-2 border-r cursor-pointer select-none"
                    onMouseDown={(e) => {
                      if (e.button === 0) { // Left click only
                        handleDragSelectStart(row.id, e);
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedRows.includes(row.id)}
                      onCheckedChange={(checked) => handleSelectRow(row.id)}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="w-4 h-4"
                    />
                  </td>
                )}
                {visibleColumns.map((column) => (
                  <td
                    key={column.key}
                    className="border-r"
                    style={{ minWidth: Math.max(column.width * 0.8, 100) }}
                    onClick={(e) => handleCellClick(row.id, column.key, e)}
                  >
                    {renderCell(row, column)}
                  </td>
                ))}
                {canEdit && (
                  <td className="px-1 sm:px-2 py-1.5 sm:py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          <MoreVertical className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDuplicateRow(row.id)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate Row
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewHistory && onViewHistory(row.id)}>
                          <History className="w-4 h-4 mr-2" />
                          View History
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteRow(row.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Row
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          No data found
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white shadow-lg border rounded-lg py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.rowId && (
            <>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100"
                onClick={() => {
                  handleDuplicateRow(contextMenu.rowId);
                  setContextMenu(null);
                }}
              >
                Duplicate Row
              </button>
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 text-red-600"
                onClick={() => {
                  handleDeleteRow(contextMenu.rowId);
                  setContextMenu(null);
                }}
              >
                Delete Row
              </button>
            </>
          )}
        </div>
      )}

      {/* Dialogs */}
      <AddRowDialog
        open={showAddRow}
        onOpenChange={setShowAddRow}
        columns={columns}
        onAddRow={(rowData) => addRowMutation.mutate(rowData)}
      />

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAddColumn={handleAddColumn}
        existingColumns={columns}
      />
    </div>
  );
}