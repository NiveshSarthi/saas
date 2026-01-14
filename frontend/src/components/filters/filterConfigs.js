export const LEAD_FILTERS = {
  module: 'leads',
  title: 'Lead Filters',
  filters: [
    {
      field: 'date_range',
      label: 'Date Range',
      type: 'date_preset',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'this_week', label: 'This Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'last_7_days', label: 'Last 7 Days' },
        { value: 'last_30_days', label: 'Last 30 Days' }
      ]
    },
    {
      field: 'stage',
      label: 'Lead Stage',
      type: 'multi_select',
      options: [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'screening', label: 'Screening' },
        { value: 'qualified', label: 'Qualified' },
        { value: 'proposal', label: 'Proposal' },
        { value: 'negotiation', label: 'Negotiation' },
        { value: 'site_visit', label: 'Site Visit' },
        { value: 'agreement', label: 'Agreement' },
        { value: 'payment', label: 'Payment' },
        { value: 'closed_won', label: 'Closed Won' },
        { value: 'lost', label: 'Lost' },
        { value: 'cold', label: 'Cold' }
      ]
    },
    {
      field: 'source',
      label: 'Source',
      type: 'multi_select',
      options: [
        { value: 'walkin', label: 'Walk-in' },
        { value: 'call', label: 'Call' },
        { value: 'referral', label: 'Referral' },
        { value: 'website', label: 'Website' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'instagram', label: 'Instagram' }
      ]
    },
    {
      field: 'assigned_to',
      label: 'Assigned To',
      type: 'user_select'
    },
    {
      field: 'builder_id',
      label: 'Builder',
      type: 'builder'
    },
    {
      field: 'property_type',
      label: 'Property Type',
      type: 'multi_select',
      options: [
        { value: 'apartment', label: 'Apartment' },
        { value: 'villa', label: 'Villa' },
        { value: 'plot', label: 'Plot' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    {
      field: 'budget',
      label: 'Budget Range',
      type: 'number_range'
    },
    {
      field: 'city',
      label: 'City',
      type: 'text'
    }
  ]
};

export const MY_TASKS_FILTERS = {
  module: 'tasks',
  title: 'My Tasks Filters',
  filters: [
    {
      field: 'date_range',
      label: 'Due Date',
      type: 'date_preset'
    },
    {
      field: 'priority',
      label: 'Priority',
      type: 'multi_select',
      options: [
        { value: 'critical', label: '🔴 Critical' },
        { value: 'high', label: '🟠 High' },
        { value: 'medium', label: '🔵 Medium' },
        { value: 'low', label: '⚪ Low' }
      ]
    },
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'review', label: 'Review' },
        { value: 'blocked', label: 'Blocked' }
      ]
    },
    {
      field: 'project_id',
      label: 'Project',
      type: 'project'
    },
    {
      field: 'is_recurring',
      label: 'Task Type',
      type: 'select',
      options: [
        { value: 'false', label: 'Regular Tasks' },
        { value: 'true', label: 'Recurring Tasks' }
      ]
    }
  ]
};

export const BACKLOG_FILTERS = {
  module: 'backlog',
  title: 'Backlog Filters',
  filters: [
    {
      field: 'priority',
      label: 'Priority',
      type: 'multi_select',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
      ]
    },
    {
      field: 'task_type',
      label: 'Type',
      type: 'multi_select',
      options: [
        { value: 'epic', label: 'Epic' },
        { value: 'story', label: 'Story' },
        { value: 'task', label: 'Task' },
        { value: 'bug', label: 'Bug' },
        { value: 'feature', label: 'Feature' },
        { value: 'improvement', label: 'Improvement' }
      ]
    },
    {
      field: 'project_id',
      label: 'Project',
      type: 'project'
    },
    {
      field: 'has_story_points',
      label: 'Estimation',
      type: 'select',
      options: [
        { value: 'estimated', label: 'Estimated' },
        { value: 'unestimated', label: 'Unestimated' }
      ]
    },
    {
      field: 'created_by',
      label: 'Created By',
      type: 'user_select'
    }
  ]
};

export const PROJECT_BOARD_FILTERS = {
  module: 'projects',
  title: 'Project Board Filters',
  filters: [
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'backlog', label: 'Backlog' },
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'review', label: 'Review' },
        { value: 'done', label: 'Done' },
        { value: 'blocked', label: 'Blocked' }
      ]
    },
    {
      field: 'assignees',
      label: 'Assigned To',
      type: 'user_select'
    },
    {
      field: 'priority',
      label: 'Priority',
      type: 'multi_select',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
      ]
    },
    {
      field: 'task_type',
      label: 'Task Type',
      type: 'multi_select',
      options: [
        { value: 'epic', label: 'Epic' },
        { value: 'story', label: 'Story' },
        { value: 'task', label: 'Task' },
        { value: 'bug', label: 'Bug' },
        { value: 'feature', label: 'Feature' },
        { value: 'improvement', label: 'Improvement' }
      ]
    },
    {
      field: 'due_date_range',
      label: 'Due Date',
      type: 'date_preset'
    }
  ]
};

export const SPRINT_BOARD_FILTERS = {
  module: 'sprints',
  title: 'Sprint Board Filters',
  filters: [
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'review', label: 'Review' },
        { value: 'done', label: 'Done' },
        { value: 'blocked', label: 'Blocked' }
      ]
    },
    {
      field: 'assignees',
      label: 'Team Member',
      type: 'user_select'
    },
    {
      field: 'priority',
      label: 'Priority',
      type: 'multi_select',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
      ]
    }
  ]
};

export const PROJECT_FILTERS = {
  module: 'projects',
  title: 'Project Filters',
  filters: [
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'on_hold', label: 'On Hold' },
        { value: 'completed', label: 'Completed' },
        { value: 'archived', label: 'Archived' }
      ]
    },
    {
      field: 'owner_email',
      label: 'Project Owner',
      type: 'user_select'
    },
    {
      field: 'progress',
      label: 'Progress',
      type: 'select',
      options: [
        { value: 'not_started', label: 'Not Started (0%)' },
        { value: 'in_progress', label: 'In Progress (1-99%)' },
        { value: 'completed', label: 'Completed (100%)' }
      ]
    }
  ]
};

export const SALES_ACTIVITY_FILTERS = {
  module: 'sales_activity',
  title: 'Sales Activity Filters',
  filters: [
    {
      field: 'date_range',
      label: 'Date Range',
      type: 'date_preset'
    },
    {
      field: 'activity_type',
      label: 'Activity Type',
      type: 'multi_select',
      options: [
        { value: 'walk_in', label: 'Walk-In' },
        { value: 'closure', label: 'Closure' }
      ]
    },
    {
      field: 'sales_member',
      label: 'Sales Member',
      type: 'user_select'
    },
    {
      field: 'project_id',
      label: 'Project',
      type: 'project'
    }
  ]
};

export const INVENTORY_FILTERS = {
  module: 'inventory',
  title: 'Inventory Filters',
  filters: [
    {
      field: 'project_id',
      label: 'Project',
      type: 'project'
    },
    {
      field: 'unit_type',
      label: 'Unit Type',
      type: 'multi_select',
      options: [
        { value: 'apartment', label: 'Apartment' },
        { value: 'villa', label: 'Villa' },
        { value: 'plot', label: 'Plot' },
        { value: 'commercial', label: 'Commercial' }
      ]
    },
    {
      field: 'status',
      label: 'Availability',
      type: 'multi_select',
      options: [
        { value: 'available', label: 'Available' },
        { value: 'sold', label: 'Sold' },
        { value: 'on_hold', label: 'On Hold' }
      ]
    }
  ]
};

export const MEETING_FILTERS = {
  module: 'meetings',
  title: 'Meeting Filters',
  filters: [
    {
      field: 'date_range',
      label: 'Date Range',
      type: 'date_preset'
    },
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    },
    {
      field: 'participants',
      label: 'Participants',
      type: 'user_select'
    }
  ]
};

export const TEAM_TASKS_FILTERS = {
  module: 'tasks',
  title: 'Team Task Filters',
  filters: [
    {
      field: 'date_range',
      label: 'Due Date',
      type: 'date_preset'
    },
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'backlog', label: 'Backlog' },
        { value: 'todo', label: 'To Do' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'review', label: 'Review' },
        { value: 'done', label: 'Done' },
        { value: 'blocked', label: 'Blocked' }
      ]
    },
    {
      field: 'assignees',
      label: 'Assigned To',
      type: 'user_select'
    },
    {
      field: 'department_id',
      label: 'Department',
      type: 'department'
    },
    {
      field: 'priority',
      label: 'Priority',
      type: 'multi_select',
      options: [
        { value: 'critical', label: 'Critical' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' }
      ]
    },
    {
      field: 'project_id',
      label: 'Project',
      type: 'project'
    }
  ]
};

export const MARKETING_FILTERS = {
  module: 'marketing',
  title: 'Marketing Filters',
  filters: [
    {
      field: 'date_range',
      label: 'Date Range',
      type: 'date_preset'
    },
    {
      field: 'status',
      label: 'Status',
      type: 'multi_select',
      options: [
        { value: 'editing', label: 'Editing' },
        { value: 'review', label: 'Review' },
        { value: 'revision', label: 'Revision' },
        { value: 'compliance', label: 'Compliance' },
        { value: 'compliance_revision', label: 'Compliance Revision' },
        { value: 'approved', label: 'Approved' },
        { value: 'published', label: 'Published' },
        { value: 'tracking', label: 'Tracking' },
        { value: 'closed', label: 'Closed' }
      ]
    },
    {
      field: 'task_type',
      label: 'Content Type',
      type: 'multi_select',
      options: [
        { value: 'video', label: 'Video' },
        { value: 'flyer', label: 'Flyer' },
        { value: 'poster', label: 'Poster' },
        { value: 'social_post', label: 'Social Post' },
        { value: 'article', label: 'Article' },
        { value: 'other', label: 'Other' }
      ]
    },
    {
      field: 'assignee_email',
      label: 'Assignee',
      type: 'user_select'
    },
    {
      field: 'platforms',
      label: 'Platforms',
      type: 'multi_select',
      options: [
        { value: 'youtube', label: 'YouTube' },
        { value: 'instagram', label: 'Instagram' },
        { value: 'facebook', label: 'Facebook' },
        { value: 'twitter', label: 'Twitter' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'tiktok', label: 'TikTok' }
      ]
    }
  ]
};
