import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

/**
 * Handles completion of recurring task instances
 * @param {Object} task - The task being completed
 * @param {Object} user - Current user
 * @returns {Promise<boolean>} - Whether the completion was handled
 */
export async function handleRecurringTaskCompletion(task, user) {
  // Only handle if this is a recurring instance and status is being set to 'done'
  if (!task.parent_recurring_task_id || !task.is_recurring_instance) {
    return false;
  }
  
  try {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Log completion in RecurringTaskCompletion
    await base44.entities.RecurringTaskCompletion.create({
      recurring_task_id: task.parent_recurring_task_id,
      completion_date: task.instance_date || today,
      completed_by: user?.email
    });
    
    // Mark the instance as done
    await base44.entities.Task.update(task.id, {
      status: 'done',
      progress: 100
    });
    
    return true;
  } catch (error) {
    console.error('Error handling recurring task completion:', error);
    return false;
  }
}

/**
 * Gets completion history for a recurring task
 * @param {string} recurringTaskId - Master recurring task ID
 * @returns {Promise<Array>} - Array of completion records
 */
export async function getRecurringTaskCompletions(recurringTaskId) {
  try {
    const completions = await base44.entities.RecurringTaskCompletion.filter(
      { recurring_task_id: recurringTaskId },
      '-completion_date',
      100
    );
    return completions;
  } catch (error) {
    console.error('Error fetching recurring task completions:', error);
    return [];
  }
}