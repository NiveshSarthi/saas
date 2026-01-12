import { base44 } from '@/api/base44Client';

/**
 * Centralized notification helper to ensure consistent notification creation
 * across the application
 */

export const NotificationType = {
  TASK_ASSIGNED: 'task_assigned',
  STATUS_CHANGED: 'status_changed',
  COMMENT_ADDED: 'comment_added',
  MENTIONED: 'mentioned',
  DUE_REMINDER: 'due_reminder',
  BLOCKED_ALERT: 'blocked_alert',
  REVIEW_REQUESTED: 'review_requested',
  MEETING_SCHEDULED: 'meeting_scheduled',
  LEAD_ASSIGNED: 'lead_assigned',
};

/**
 * Create a notification for one or more users
 * @param {Object} params - Notification parameters
 * @param {string|string[]} params.userEmails - Email(s) of user(s) to notify
 * @param {string} params.type - Notification type from NotificationType
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} params.actorEmail - Email of user performing the action
 * @param {string} [params.link] - Optional link to related resource
 * @param {string} [params.taskId] - Optional task ID
 * @param {string} [params.projectId] - Optional project ID
 */
export async function createNotification({
  userEmails,
  type,
  title,
  message,
  actorEmail,
  link,
  taskId,
  projectId
}) {
  const emails = Array.isArray(userEmails) ? userEmails : [userEmails];

  // Filter out the actor (don't notify yourself)
  const filteredEmails = emails.filter(email => email !== actorEmail);

  if (filteredEmails.length === 0) return;

  // Create notifications for all recipients
  const notifications = filteredEmails.map(email => ({
    user_email: email,
    type,
    title,
    message,
    actor_email: actorEmail,
    link,
    task_id: taskId,
    project_id: projectId,
    read: false
  }));

  await Promise.all(
    notifications.map(notif => base44.entities.Notification.create(notif))
  );
}

/**
 * Notify when a task is assigned
 */
export async function notifyTaskAssigned({ task, assigneeEmail, actorEmail, actorName }) {
  await createNotification({
    userEmails: assigneeEmail,
    type: NotificationType.TASK_ASSIGNED,
    title: 'New Task Assigned',
    message: `${actorName} assigned you a task: "${task.title}"`,
    actorEmail,
    link: `TaskDetail?id=${task.id || task._id}`,
    taskId: task.id || task._id,
    projectId: task.project_id
  });
}

/**
 * Notify when task status changes
 */
export async function notifyStatusChange({ task, watchers, actorEmail, actorName, oldStatus, newStatus }) {
  if (!watchers || watchers.length === 0) return;

  await createNotification({
    userEmails: watchers,
    type: NotificationType.STATUS_CHANGED,
    title: 'Task Status Updated',
    message: `${actorName} moved "${task.title}" from ${oldStatus} to ${newStatus}`,
    actorEmail,
    link: `TaskDetail?id=${task.id || task._id}`,
    taskId: task.id || task._id,
    projectId: task.project_id
  });
}

/**
 * Notify when someone is mentioned in a comment
 */
export async function notifyMention({ mentionedEmails, taskId, actorEmail, actorName }) {
  await createNotification({
    userEmails: mentionedEmails,
    type: NotificationType.MENTIONED,
    title: 'You were mentioned',
    message: `${actorName} mentioned you in a comment`,
    actorEmail,
    link: `TaskDetail?id=${taskId}`,
    taskId
  });
}

/**
 * Notify when a comment is added to a watched task
 */
export async function notifyComment({ task, watchers, actorEmail, actorName }) {
  if (!watchers || watchers.length === 0) return;

  await createNotification({
    userEmails: watchers,
    type: NotificationType.COMMENT_ADDED,
    title: 'New Comment',
    message: `${actorName} commented on "${task.title}"`,
    actorEmail,
    link: `TaskDetail?id=${task.id || task._id}`,
    taskId: task.id || task._id,
    projectId: task.project_id
  });
}

/**
 * Notify when a meeting is scheduled
 */
export async function notifyMeetingScheduled({ meeting, participants, actorEmail, actorName }) {
  await createNotification({
    userEmails: participants,
    type: NotificationType.MEETING_SCHEDULED,
    title: 'New Meeting Scheduled',
    message: `${actorName} scheduled a meeting: "${meeting.title}"`,
    actorEmail,
    link: `MeetingRoom?id=${meeting.id}`
  });
}

/**
 * Notify when a lead is assigned
 */
export async function notifyLeadAssigned({ leadName, assigneeEmail, actorEmail, actorName, leadId }) {
  await createNotification({
    userEmails: assigneeEmail,
    type: NotificationType.LEAD_ASSIGNED,
    title: 'New Lead Assigned',
    message: `${actorName} assigned you a lead: ${leadName}`,
    actorEmail,
    link: `LeadDetail?id=${leadId}`
  });
}

/**
 * Clean up old read notifications (older than 30 days)
 */
export async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldNotifications = await base44.entities.Notification.filter({
      read: true
    });

    const toDelete = oldNotifications.filter(n => {
      const createdDate = new Date(n.created_date);
      return createdDate < thirtyDaysAgo;
    });

    await Promise.all(
      toDelete.map(n => base44.entities.Notification.delete(n.id))
    );

    return toDelete.length;
  } catch (error) {
    console.error('Failed to cleanup old notifications:', error);
    return 0;
  }
}