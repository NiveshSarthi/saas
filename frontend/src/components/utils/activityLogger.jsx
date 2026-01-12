import { base44 } from '@/api/base44Client';

export async function logActivity({ 
  taskId, 
  projectId, 
  actorEmail, 
  action, 
  fieldChanged = null, 
  oldValue = null, 
  newValue = null, 
  metadata = null 
}) {
  return base44.entities.Activity.create({
    task_id: taskId,
    project_id: projectId,
    actor_email: actorEmail,
    action,
    field_changed: fieldChanged,
    old_value: oldValue ? String(oldValue) : null,
    new_value: newValue ? String(newValue) : null,
    metadata
  });
}

export function detectChanges(oldData, newData, fieldsToTrack = ['status', 'priority', 'assignee_email', 'due_date']) {
  const changes = [];
  
  for (const field of fieldsToTrack) {
    if (oldData[field] !== newData[field]) {
      changes.push({
        field,
        oldValue: oldData[field],
        newValue: newData[field]
      });
    }
  }
  
  return changes;
}