import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import MarketingTaskCard from './MarketingTaskCard';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { MarketingLogger } from '@/components/utils/marketingLogger';
import { Checkbox } from '@/components/ui/checkbox';

const COLUMNS = [
  { id: 'editing', title: 'Editing', color: 'bg-slate-100 border-slate-200' },
  { id: 'review', title: 'In Review', color: 'bg-blue-50 border-blue-200' },
  { id: 'revision', title: 'Revisions', color: 'bg-orange-50 border-orange-200' },
  { id: 'compliance', title: 'Compliance', color: 'bg-purple-50 border-purple-200' },
  { id: 'compliance_revision', title: 'Legal Fix', color: 'bg-red-50 border-red-200' },
  { id: 'approved', title: 'Approved', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'published', title: 'Published', color: 'bg-emerald-50 border-emerald-200' },
  { id: 'tracking', title: 'Tracking', color: 'bg-cyan-50 border-cyan-200' },
  { id: 'closed', title: 'Closed', color: 'bg-slate-100 border-slate-200' },
  { id: 'trash', title: 'Trash', color: 'bg-gray-100 border-gray-300' },
];

export default function MarketingKanban({ tasks, onEditTask, user, refetch, selectedTasks = [], onSelectTask }) {
  const handleDeleteTask = async (task) => {
    if (confirm(`Delete "${task.campaign_name}"? This action cannot be undone.`)) {
      try {
        await base44.entities.MarketingTask.delete(task.id);
        toast.success('Task deleted successfully');
        refetch();
      } catch (error) {
        toast.error('Failed to delete task');
      }
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;
    const task = tasks.find(t => t.id === draggableId);

    // Permission Check for Dragging
    // Simplified: Admin can move anywhere. Editor can move to Review. Reviewer can move to Revision/Approved/Compliance.
    // This is a quick UX check, stricter check should be in backend or before mutation

    try {
      const task = tasks.find(t => t.id === draggableId);
      // Log activity
      await MarketingLogger.log(draggableId, 'status_changed', user, {
        field: 'status',
        oldValue: task.status,
        newValue: newStatus
      });

      await base44.entities.MarketingTask.update(draggableId, { status: newStatus });
      toast.success(`Moved to ${COLUMNS.find(c => c.id === newStatus)?.title}`);
      refetch();
    } catch (error) {
      toast.error('Failed to move task');
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-full overflow-x-auto gap-4 pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter(t => t.status === column.id);

          return (
            <div key={column.id} className="min-w-[320px] flex flex-col h-full">
              {/* Column Header */}
              <div className={`p-4 rounded-t-xl border-b-2 flex justify-between items-center ${column.color} backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${column.color.replace('bg-', 'bg-slate-').replace('border-', 'bg-').split(' ')[0] === 'bg-slate-100' ? 'bg-slate-400' : column.color.replace('bg-', 'bg-').split(' ')[0].replace('-50', '-500')}`}></div>
                  <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">{column.title}</h3>
                </div>
                <span className="text-xs font-bold bg-white px-2.5 py-1 rounded-full text-slate-600 shadow-sm">
                  {columnTasks.length}
                </span>
              </div>

              {/* Droppable Area */}
              <div className={`flex-1 bg-slate-50/80 border-x border-b rounded-b-xl p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 ${column.id === 'closed' ? 'bg-slate-100/80' : ''}`}>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[150px] space-y-3 transition-colors rounded-lg ${snapshot.isDraggingOver ? 'bg-indigo-50/50 ring-2 ring-indigo-100 ring-inset' : ''}`}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id || task._id} draggableId={task.id || task._id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                opacity: snapshot.isDragging ? 0.9 : 1,
                                rotate: snapshot.isDragging ? '2deg' : '0deg',
                              }}
                            >
                              <div className="relative">
                                {onSelectTask && (
                                  <div className="absolute top-2 left-2 z-10">
                                    <Checkbox
                                      checked={selectedTasks.includes(task.id)}
                                      onCheckedChange={() => onSelectTask(task.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="bg-white border-2 shadow-sm"
                                    />
                                  </div>
                                )}
                                <MarketingTaskCard
                                  task={task}
                                  onClick={() => onEditTask(task)}
                                  onDelete={handleDeleteTask}
                                />
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}