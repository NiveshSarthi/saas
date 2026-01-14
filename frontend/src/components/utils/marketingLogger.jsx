import { base44 } from '@/api/base44Client';

export const MarketingLogger = {
  // Helper to calculate changes between two objects
  calculateChanges: (oldData, newData, user) => {
    const changes = [];
    
    // Status Change
    if (oldData.status !== newData.status) {
      changes.push({
        action: 'status_changed',
        field: 'status',
        oldValue: oldData.status,
        newValue: newData.status,
        actorEmail: user.email
      });
    }

    // Assignee Change
    if (oldData.assignee_email !== newData.assignee_email) {
      changes.push({
        action: 'assigned',
        field: 'assignee_email',
        oldValue: oldData.assignee_email,
        newValue: newData.assignee_email,
        actorEmail: user.email
      });
    }

    // Campaign Name
    if (oldData.campaign_name !== newData.campaign_name) {
      changes.push({
        action: 'updated',
        field: 'campaign_name',
        oldValue: oldData.campaign_name,
        newValue: newData.campaign_name,
        actorEmail: user.email
      });
    }
    
    // Description
    if (oldData.description !== newData.description) {
      // Only log if significant change (avoid rich text tiny diffs if possible, but here simplistic)
      changes.push({
        action: 'updated',
        field: 'description',
        oldValue: 'Previous Description',
        newValue: 'Updated Description', // Don't store full HTML in log value usually
        actorEmail: user.email
      });
    }

    // Files - Simplified check
    const oldFiles = oldData.files || {};
    const newFiles = newData.files || {};
    Object.keys({...oldFiles, ...newFiles}).forEach(key => {
        if (oldFiles[key] !== newFiles[key]) {
            changes.push({
                action: 'attached',
                field: `files.${key}`,
                oldValue: oldFiles[key] || '(none)',
                newValue: newFiles[key] || '(removed)',
                actorEmail: user.email
            });
        }
    });

    // Version
    if (oldData.version !== newData.version) {
         changes.push({
            action: 'updated',
            field: 'version',
            oldValue: oldData.version,
            newValue: newData.version,
            actorEmail: user.email
        });
    }

    return changes;
  },

  // Log a single action
  log: async (taskId, action, user, details = {}) => {
    try {
      await base44.entities.Activity.create({
        task_id: taskId,
        project_id: 'marketing', // Default context
        actor_email: user.email,
        action: action,
        field_changed: details.field,
        old_value: details.oldValue ? String(details.oldValue) : null,
        new_value: details.newValue ? String(details.newValue) : null,
        metadata: {
           actorName: user.full_name || user.email.split('@')[0],
           actorRole: user.role,
           timestamp: new Date().toISOString(),
           ...details.metadata
        }
      });
    } catch (e) {
      console.error("Failed to log activity", e);
    }
  },

  // Batch log changes
  logChanges: async (taskId, changes, user) => {
    const promises = changes.map(change => 
        base44.entities.Activity.create({
            task_id: taskId,
            project_id: 'marketing',
            actor_email: user.email,
            action: change.action,
            field_changed: change.field,
            old_value: change.oldValue ? String(change.oldValue) : null,
            new_value: change.newValue ? String(change.newValue) : null,
            metadata: {
                actorName: user.full_name || user.email.split('@')[0],
                actorRole: user.role,
                timestamp: new Date().toISOString()
            }
        })
    );
    await Promise.all(promises);
  }
};