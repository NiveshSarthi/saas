import { base44 } from '@/api/base44Client';

/**
 * Global Notification Service
 * Centralized system for sending notifications across all modules
 */

// Notification types
export const NOTIFICATION_TYPES = {
  ASSIGNMENT: 'task_assigned',
  MENTION: 'mentioned',
  COMMENT: 'comment_added',
  STATUS_CHANGE: 'status_changed',
  DUE_REMINDER: 'due_reminder',
  APPROVAL_REQUEST: 'review_requested',
  BLOCKED_ALERT: 'blocked_alert'
};

// Module names for routing
export const MODULES = {
  TASK: 'task',
  SUBTASK: 'subtask',
  MARKETING_TASK: 'marketing_task',
  LEAD: 'lead',
  SALES_ACTIVITY: 'sales_activity',
  PROJECT: 'project',
  INVENTORY: 'inventory',
  MASTER_DATA: 'master_data',
  MEETING: 'meeting',
  APPROVAL: 'approval',
  PETTY_CASH: 'petty_cash',
  FINANCE: 'finance'
};

/**
 * Send assignment notification
 * @param {Object} params
 * @param {string} params.assignedTo - Email of user being assigned
 * @param {string} params.assignedBy - Email of user making assignment
 * @param {string} params.assignedByName - Name of user making assignment
 * @param {string} params.module - Module name (from MODULES)
 * @param {string} params.itemName - Name of item being assigned
 * @param {string} params.itemId - ID of item
 * @param {string} params.link - Link to the item
 * @param {string} params.description - Optional description
 * @param {Object} params.metadata - Additional metadata
 */
export async function sendAssignmentNotification({
  assignedTo,
  assignedBy,
  assignedByName,
  module,
  itemName,
  itemId,
  link,
  description = '',
  metadata = {}
}) {
  try {
    // Don't send notification if user assigns to themselves
    if (assignedTo === assignedBy) {
      return null;
    }

    const notification = await base44.entities.Notification.create({
      user_email: assignedTo,
      type: NOTIFICATION_TYPES.ASSIGNMENT,
      title: `New ${getModuleDisplayName(module)} Assigned`,
      message: `${assignedByName} assigned you: ${itemName}${description ? ' - ' + description : ''}`,
      actor_email: assignedBy,
      read: false,
      link: link || `/${module}/${itemId}`,
      metadata: {
        module,
        itemId,
        itemName,
        action: 'assigned',
        ...metadata
      }
    });

    // Log notification delivery
    await logNotificationDelivery({
      notificationId: notification.id,
      recipientEmail: assignedTo,
      senderEmail: assignedBy,
      type: 'assignment',
      module,
      itemId,
      success: true
    });

    return notification;
  } catch (error) {
    console.error('Failed to send assignment notification:', error);
    
    // Log failure
    await logNotificationDelivery({
      recipientEmail: assignedTo,
      senderEmail: assignedBy,
      type: 'assignment',
      module,
      itemId,
      success: false,
      error: error.message
    });
    
    return null;
  }
}

/**
 * Send bulk assignment notifications
 * @param {Array} assignments - Array of assignment objects
 */
export async function sendBulkAssignmentNotifications(assignments) {
  const results = [];
  
  for (const assignment of assignments) {
    const result = await sendAssignmentNotification(assignment);
    results.push(result);
  }
  
  return results;
}

/**
 * Extract @mentions from text and send notifications
 * @param {Object} params
 * @param {string} params.text - Text containing mentions
 * @param {string} params.mentionedBy - Email of user making mention
 * @param {string} params.mentionedByName - Name of user making mention
 * @param {string} params.module - Module name
 * @param {string} params.itemName - Name of item
 * @param {string} params.itemId - ID of item
 * @param {string} params.link - Link to the item
 * @param {Array} params.allUsers - List of all users to match against
 */
export async function processMentionsAndNotify({
  text,
  mentionedBy,
  mentionedByName,
  module,
  itemName,
  itemId,
  link,
  allUsers = []
}) {
  if (!text) return [];

  // Extract @mentions (formats: @email, @username, @"Full Name")
  const mentionRegex = /@([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)|@"([^"]+)"|@([a-zA-Z0-9._-]+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const mentionText = match[1] || match[2] || match[3];
    mentions.push(mentionText);
  }

  if (mentions.length === 0) return [];

  // Find matching users
  const mentionedUsers = [];
  for (const mention of mentions) {
    const user = allUsers.find(u => 
      u.email === mention || 
      u.full_name?.toLowerCase() === mention.toLowerCase() ||
      u.email?.toLowerCase().includes(mention.toLowerCase())
    );
    
    if (user && user.email !== mentionedBy) {
      mentionedUsers.push(user);
    }
  }

  // Remove duplicates
  const uniqueUsers = [...new Map(mentionedUsers.map(u => [u.email, u])).values()];

  // Send notifications
  const notifications = [];
  for (const user of uniqueUsers) {
    try {
      const notification = await base44.entities.Notification.create({
        user_email: user.email,
        type: NOTIFICATION_TYPES.MENTION,
        title: `You were mentioned`,
        message: `${mentionedByName} mentioned you in ${getModuleDisplayName(module)}: ${itemName}`,
        actor_email: mentionedBy,
        read: false,
        link: link || `/${module}/${itemId}`,
        metadata: {
          module,
          itemId,
          itemName,
          action: 'mentioned',
          mentionText: text.substring(0, 200)
        }
      });

      notifications.push(notification);

      // Log notification delivery
      await logNotificationDelivery({
        notificationId: notification.id,
        recipientEmail: user.email,
        senderEmail: mentionedBy,
        type: 'mention',
        module,
        itemId,
        success: true
      });
    } catch (error) {
      console.error(`Failed to send mention notification to ${user.email}:`, error);
      
      await logNotificationDelivery({
        recipientEmail: user.email,
        senderEmail: mentionedBy,
        type: 'mention',
        module,
        itemId,
        success: false,
        error: error.message
      });
    }
  }

  return notifications;
}

/**
 * Send comment notification
 */
export async function sendCommentNotification({
  recipientEmail,
  commentedBy,
  commentedByName,
  module,
  itemName,
  itemId,
  link,
  commentText
}) {
  try {
    if (recipientEmail === commentedBy) {
      return null;
    }

    const notification = await base44.entities.Notification.create({
      user_email: recipientEmail,
      type: NOTIFICATION_TYPES.COMMENT,
      title: `New Comment on ${getModuleDisplayName(module)}`,
      message: `${commentedByName} commented on ${itemName}: "${commentText.substring(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
      actor_email: commentedBy,
      read: false,
      link: link || `/${module}/${itemId}`,
      metadata: {
        module,
        itemId,
        itemName,
        action: 'commented'
      }
    });

    await logNotificationDelivery({
      notificationId: notification.id,
      recipientEmail,
      senderEmail: commentedBy,
      type: 'comment',
      module,
      itemId,
      success: true
    });

    return notification;
  } catch (error) {
    console.error('Failed to send comment notification:', error);
    
    await logNotificationDelivery({
      recipientEmail,
      senderEmail: commentedBy,
      type: 'comment',
      module,
      itemId,
      success: false,
      error: error.message
    });
    
    return null;
  }
}

/**
 * Log notification delivery for auditing
 */
async function logNotificationDelivery({
  notificationId = null,
  recipientEmail,
  senderEmail,
  type,
  module,
  itemId,
  success,
  error = null
}) {
  try {
    await base44.entities.AuditLog.create({
      action: 'notification_sent',
      entity_type: 'Notification',
      entity_id: notificationId,
      actor_email: senderEmail,
      metadata: {
        recipient: recipientEmail,
        notificationType: type,
        module,
        itemId,
        success,
        error,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Failed to log notification delivery:', err);
  }
}

/**
 * Get human-readable module name
 */
function getModuleDisplayName(module) {
  const displayNames = {
    task: 'Task',
    subtask: 'Subtask',
    marketing_task: 'Marketing Task',
    lead: 'Lead',
    sales_activity: 'Sales Activity',
    project: 'Project',
    inventory: 'Inventory Lead',
    master_data: 'Inventory Lead',
    meeting: 'Meeting',
    approval: 'Approval Request',
    petty_cash: 'Petty Cash Request',
    finance: 'Finance Item'
  };
  
  return displayNames[module] || module;
}

/**
 * Notify all assignees when task is assigned to multiple people
 */
export async function notifyMultipleAssignees({
  assignees,
  assignedBy,
  assignedByName,
  module,
  itemName,
  itemId,
  link
}) {
  const notifications = [];
  
  for (const assigneeEmail of assignees) {
    if (assigneeEmail === assignedBy) continue;
    
    const notification = await sendAssignmentNotification({
      assignedTo: assigneeEmail,
      assignedBy,
      assignedByName,
      module,
      itemName,
      itemId,
      link
    });
    
    if (notification) {
      notifications.push(notification);
    }
  }
  
  return notifications;
}

/**
 * Notify watchers of a task/item
 */
export async function notifyWatchers({
  watchers,
  actorEmail,
  actorName,
  module,
  itemName,
  itemId,
  link,
  action,
  actionDescription
}) {
  const notifications = [];
  
  for (const watcherEmail of watchers) {
    if (watcherEmail === actorEmail) continue;
    
    try {
      const notification = await base44.entities.Notification.create({
        user_email: watcherEmail,
        type: NOTIFICATION_TYPES.STATUS_CHANGE,
        title: `Update on ${getModuleDisplayName(module)}`,
        message: `${actorName} ${actionDescription} on ${itemName}`,
        actor_email: actorEmail,
        read: false,
        link: link || `/${module}/${itemId}`,
        metadata: {
          module,
          itemId,
          itemName,
          action
        }
      });
      
      notifications.push(notification);
    } catch (error) {
      console.error(`Failed to notify watcher ${watcherEmail}:`, error);
    }
  }
  
  return notifications;
}