import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-slate-100 text-slate-700' },
  todo: { label: 'To Do', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700' },
};

export default function TaskListTimeline({ groupedTasks, projects, onTaskClick }) {
  return (
    <div className="space-y-8">
      {Object.entries(groupedTasks).map(([groupName, tasks]) => (
        <motion.div
          key={groupName}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 border border-slate-200 shadow-lg"
        >
          {/* Group Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">{groupName}</h3>
            <Badge variant="secondary" className="ml-auto">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
            </Badge>
          </div>

          {/* Timeline */}
          <div className="space-y-4 relative">
            {/* Vertical Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-200 to-purple-200" />

            {tasks.map((task, index) => {
              const project = projects.find(p => p.id === task.project_id);
              const status = statusConfig[task.status] || statusConfig.todo;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onTaskClick(task)}
                  className="relative pl-16 cursor-pointer group"
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-4 top-3 w-5 h-5 rounded-full border-4 border-white shadow-md bg-gradient-to-br from-indigo-500 to-purple-500 group-hover:scale-125 transition-transform" />

                  {/* Task Card */}
                  <div className="bg-gradient-to-r from-slate-50 to-white p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className={cn(
                        "font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors",
                        task.status === 'done' && "line-through text-slate-500"
                      )}>
                        {task.title}
                      </h4>
                      <Badge className={cn("text-xs ml-2 flex-shrink-0", status.color)}>
                        {status.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      {project && (
                        <span
                          className="px-2 py-1 rounded-lg font-medium"
                          style={{
                            backgroundColor: `${project.color}20`,
                            color: project.color
                          }}
                        >
                          {project.name}
                        </span>
                      )}

                      {task.priority && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span className="capitalize">{task.priority}</span>
                        </span>
                      )}

                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(task.due_date), 'MMM d, yyyy')}
                        </span>
                      )}

                      {task.assignee_email && (
                        <span className="ml-auto text-indigo-600 font-medium">
                          @{task.assignee_email.split('@')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}

      {Object.keys(groupedTasks).length === 0 && (
        <div className="text-center py-16">
          <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">No tasks in timeline</p>
        </div>
      )}
    </div>
  );
}