import { base44 } from '@/api/base44Client';

/**
 * Handles auto-completion logic for parent tasks based on subtask status
 * @param {string} subtaskId - The subtask that was updated
 * @param {string} newStatus - The new status of the subtask
 * @param {string} parentTaskId - The parent task ID
 */
export async function handleParentTaskAutomation(subtaskId, newStatus, parentTaskId) {
  if (!parentTaskId) return;

  try {
    // Fetch parent task
    const parents = await base44.entities.Task.filter({ id: parentTaskId });
    const parentTask = parents[0];
    if (!parentTask) return;

    // Fetch all subtasks of this parent
    const allSubtasks = await base44.entities.Task.filter({ parent_task_id: parentTaskId });
    if (allSubtasks.length === 0) return;

    // Check if all subtasks are completed
    const allCompleted = allSubtasks.every(st => st.status === 'done');
    
    // Check if any subtask is not completed
    const anyIncomplete = allSubtasks.some(st => st.status !== 'done');

    // Auto-complete parent if all subtasks are done
    if (allCompleted && parentTask.status !== 'done') {
      await base44.entities.Task.update(parentTaskId, { 
        status: 'done',
        progress: 100 
      });

      // Log activity
      await base44.entities.Activity.create({
        task_id: parentTaskId,
        project_id: parentTask.project_id,
        actor_email: 'system',
        action: 'status_changed',
        field_changed: 'status',
        old_value: parentTask.status,
        new_value: 'done',
        metadata: {
          reason: 'Parent task auto-completed because all subtasks were completed',
          automated: true
        }
      });

      // Create notification for assignee and reporter
      const notifyEmails = new Set([
        parentTask.assignee_email,
        parentTask.reporter_email,
        ...(parentTask.assignees || [])
      ].filter(Boolean));

      for (const email of notifyEmails) {
        await base44.entities.Notification.create({
          user_email: email,
          type: 'status_changed',
          title: 'Task Auto-Completed',
          message: `"${parentTask.title}" was automatically marked as completed because all its subtasks are done.`,
          task_id: parentTaskId,
          project_id: parentTask.project_id,
          actor_email: 'system',
          link: `/task/${parentTaskId}`
        });
      }
    }
    // Reopen parent if it was done but now has incomplete subtasks
    else if (anyIncomplete && parentTask.status === 'done') {
      await base44.entities.Task.update(parentTaskId, { 
        status: 'in_progress',
        progress: Math.round((allSubtasks.filter(st => st.status === 'done').length / allSubtasks.length) * 100)
      });

      // Log activity
      await base44.entities.Activity.create({
        task_id: parentTaskId,
        project_id: parentTask.project_id,
        actor_email: 'system',
        action: 'status_changed',
        field_changed: 'status',
        old_value: 'done',
        new_value: 'in_progress',
        metadata: {
          reason: 'Parent task reopened because a subtask status changed from completed',
          automated: true
        }
      });

      // Create notification
      const notifyEmails = new Set([
        parentTask.assignee_email,
        parentTask.reporter_email,
        ...(parentTask.assignees || [])
      ].filter(Boolean));

      for (const email of notifyEmails) {
        await base44.entities.Notification.create({
          user_email: email,
          type: 'status_changed',
          title: 'Task Reopened',
          message: `"${parentTask.title}" was automatically reopened because a subtask status changed.`,
          task_id: parentTaskId,
          project_id: parentTask.project_id,
          actor_email: 'system',
          link: `/task/${parentTaskId}`
        });
      }
    }
  } catch (error) {
    console.error('Error in parent task automation:', error);
    // Don't throw - automation should not break the main flow
  }
}