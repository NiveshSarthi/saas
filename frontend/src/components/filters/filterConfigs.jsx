// My Tasks Page - Focus on personal productivity
export const MY_TASKS_FILTERS = {
  date_range: { 
    label: 'Due Date', 
    type: 'date_preset',
    options: [
      { value: 'today', label: 'Today' },
      { value: 'tomorrow', label: 'Tomorrow' },
      { value: 'this_week', label: 'This Week' },
      { value: 'next_week', label: 'Next Week' },
      { value: 'overdue', label: 'Overdue' }
    ]
  },
  priority: { 
    label: 'Priority', 
    type: 'multi_select',
    options: [
      { value: 'critical', label: '🔴 Critical' },
      { value: 'high', label: '🟠 High' },
      { value: 'medium', label: '🔵 Medium' },
      { value: 'low', label: '⚪ Low' }
    ]
  },
  status: { 
    label: 'Status', 
    type: 'multi_select',
    options: [
      { value: 'todo', label: 'To Do' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'review', label: 'Review' },
      { value: 'blocked', label: 'Blocked' }
    ]
  },
  project_id: {
    label: 'Project',
    type: 'project_select'
  },
  is_recurring: {
    label: 'Task Type',
    type: 'single_select',
    options: [
      { value: 'false', label: 'Regular Tasks' },
      { value: 'true', label: 'Recurring Tasks' }
    ]
  }
};

// Backlog Page - Focus on prioritization and grooming
export const BACKLOG_FILTERS = {
  priority: { 
    label: 'Priority', 
    type: 'multi_select',
    options: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' }
    ]
  },
  task_type: { 
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
  project_id: {
    label: 'Project',
    type: 'project_select'
  },
  has_story_points: {
    label: 'Estimation',
    type: 'single_select',
    options: [
      { value: 'estimated', label: 'Estimated' },
      { value: 'unestimated', label: 'Unestimated' }
    ]
  },
  created_by: { 
    label: 'Created By', 
    type: 'user_multi_select'
  },
  age_days: {
    label: 'Age',
    type: 'single_select',
    options: [
      { value: 'new', label: 'New (< 7 days)' },
      { value: 'recent', label: 'Recent (< 30 days)' },
      { value: 'stale', label: 'Stale (30+ days)' }
    ]
  }
};

// Project Board - Focus on workflow and team collaboration
export const PROJECT_BOARD_FILTERS = {
  status: { 
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
  assignees: { 
    label: 'Assigned To', 
    type: 'user_multi_select'
  },
  priority: { 
    label: 'Priority', 
    type: 'multi_select',
    options: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' }
    ]
  },
  task_type: { 
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
  group_id: {
    label: 'Task Group',
    type: 'group_select'
  },
  due_date_range: { 
    label: 'Due Date', 
    type: 'date_preset',
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Today' },
      { value: 'this_week', label: 'This Week' },
      { value: 'this_month', label: 'This Month' }
    ]
  }
};

// Sprint Board - Focus on sprint execution
export const SPRINT_BOARD_FILTERS = {
  status: { 
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
  assignees: { 
    label: 'Team Member', 
    type: 'user_multi_select'
  },
  priority: { 
    label: 'Priority', 
    type: 'multi_select',
    options: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' }
    ]
  },
  story_points: {
    label: 'Story Points',
    type: 'single_select',
    options: [
      { value: 'small', label: 'Small (1-3)' },
      { value: 'medium', label: 'Medium (5-8)' },
      { value: 'large', label: 'Large (13+)' }
    ]
  }
};

// Projects Page Filters
export const PROJECT_FILTERS = {
  status: {
    label: 'Status',
    type: 'multi_select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'on_hold', label: 'On Hold' },
      { value: 'completed', label: 'Completed' },
      { value: 'archived', label: 'Archived' }
    ]
  },
  domain: {
    label: 'Domain',
    type: 'multi_select',
    options: [
      { value: 'it', label: 'IT' },
      { value: 'real_estate', label: 'Real Estate' },
      { value: 'generic', label: 'Generic' }
    ]
  },
  owner_email: {
    label: 'Project Owner',
    type: 'user_multi_select'
  },
  has_end_date: {
    label: 'Timeline',
    type: 'single_select',
    options: [
      { value: 'upcoming_deadline', label: 'Deadline This Month' },
      { value: 'no_deadline', label: 'No Deadline' },
      { value: 'overdue', label: 'Past Deadline' }
    ]
  },
  progress: {
    label: 'Progress',
    type: 'single_select',
    options: [
      { value: 'not_started', label: 'Not Started (0%)' },
      { value: 'in_progress', label: 'In Progress (1-99%)' },
      { value: 'completed', label: 'Completed (100%)' }
    ]
  }
};

// Lead Management Page Filters
export const LEAD_FILTERS = {
  date_range: { 
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
  stage: { 
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
  source: { 
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
  assigned_to: { 
    label: 'Assigned To', 
    type: 'user_multi_select'
  },
  builder_id: {
    label: 'Builder',
    type: 'builder_select'
  },
  property_type: { 
    label: 'Property Type', 
    type: 'multi_select',
    options: [
      { value: 'apartment', label: 'Apartment' },
      { value: 'villa', label: 'Villa' },
      { value: 'plot', label: 'Plot' },
      { value: 'commercial', label: 'Commercial' }
    ]
  },
  budget: {
    label: 'Budget Range',
    type: 'number_range',
    placeholder: { min: 'Min budget', max: 'Max budget' }
  },
  city: {
    label: 'City',
    type: 'text'
  },
  batch_name: {
    label: 'Batch Name',
    type: 'text'
  }
};

// Sales Activity Filters
export const SALES_ACTIVITY_FILTERS = {
  date_range: { 
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
  activity_type: { 
    label: 'Activity Type', 
    type: 'multi_select',
    options: [
      { value: 'walk_in', label: 'Walk-In' },
      { value: 'closure', label: 'Closure' }
    ]
  },
  sales_member: { 
    label: 'Sales Member', 
    type: 'user_multi_select'
  },
  builder_verification_status: {
    label: 'Builder Verification',
    type: 'single_select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'verified', label: 'Verified' },
      { value: 'not_verified', label: 'Not Verified' }
    ]
  },
  approval_status: {
    label: 'Approval Status',
    type: 'single_select',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'changes_requested', label: 'Changes Requested' },
      { value: 'pending_assignment', label: 'Pending Assignment' }
    ]
  },
  project_id: {
    label: 'Project',
    type: 'project_select'
  }
};

// Inventory Filters
export const INVENTORY_FILTERS = {
  project_id: {
    label: 'Project',
    type: 'project_select'
  },
  builder_id: {
    label: 'Builder',
    type: 'builder_select'
  },
  unit_type: {
    label: 'Unit Type',
    type: 'multi_select',
    options: [
      { value: 'apartment', label: 'Apartment' },
      { value: 'villa', label: 'Villa' },
      { value: 'plot', label: 'Plot' },
      { value: 'commercial', label: 'Commercial' }
    ]
  },
  price_range: {
    label: 'Price Range',
    type: 'number_range',
    placeholder: { min: 'Min price', max: 'Max price' }
  },
  status: {
    label: 'Availability',
    type: 'multi_select',
    options: [
      { value: 'available', label: 'Available' },
      { value: 'sold', label: 'Sold' },
      { value: 'on_hold', label: 'On Hold' }
    ]
  }
};

// Meeting Filters
export const MEETING_FILTERS = {
  date_range: { 
    label: 'Date Range', 
    type: 'date_preset',
    options: [
      { value: 'today', label: 'Today' },
      { value: 'tomorrow', label: 'Tomorrow' },
      { value: 'this_week', label: 'This Week' },
      { value: 'this_month', label: 'This Month' }
    ]
  },
  status: {
    label: 'Status',
    type: 'multi_select',
    options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' }
    ]
  },
  participants: {
    label: 'Participants',
    type: 'user_multi_select'
  },
  project_id: {
    label: 'Related Project',
    type: 'project_select'
  }
};

// Activity Log Filters
export const ACTIVITY_LOG_FILTERS = {
  date_range: { 
    label: 'Date Range', 
    type: 'date_preset',
    options: [
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'this_week', label: 'This Week' },
      { value: 'this_month', label: 'This Month' },
      { value: 'last_7_days', label: 'Last 7 Days' }
    ]
  },
  action: {
    label: 'Action Type',
    type: 'multi_select',
    options: [
      { value: 'created', label: 'Created' },
      { value: 'updated', label: 'Updated' },
      { value: 'deleted', label: 'Deleted' },
      { value: 'commented', label: 'Commented' },
      { value: 'assigned', label: 'Assigned' },
      { value: 'status_changed', label: 'Status Changed' }
    ]
  },
  actor_email: {
    label: 'Performed By',
    type: 'user_multi_select'
  },
  project_id: {
    label: 'Project',
    type: 'project_select'
  }
};

// Team Tasks Page Filters
export const TEAM_TASKS_FILTERS = {
  date_range: { 
    label: 'Due Date', 
    type: 'date_preset',
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Today' },
      { value: 'this_week', label: 'This Week' },
      { value: 'this_month', label: 'This Month' },
      { value: 'next_month', label: 'Next Month' }
    ]
  },
  status: { 
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
  assignees: { 
    label: 'Assigned To', 
    type: 'user_multi_select'
  },
  department_id: {
    label: 'Department',
    type: 'department_select'
  },
  priority: { 
    label: 'Priority', 
    type: 'multi_select',
    options: [
      { value: 'critical', label: 'Critical' },
      { value: 'high', label: 'High' },
      { value: 'medium', label: 'Medium' },
      { value: 'low', label: 'Low' }
    ]
  },
  project_id: {
    label: 'Project',
    type: 'project_select'
  },
  task_type: { 
    label: 'Type', 
    type: 'multi_select',
    options: [
      { value: 'epic', label: 'Epic' },
      { value: 'story', label: 'Story' },
      { value: 'task', label: 'Task' },
      { value: 'bug', label: 'Bug' },
      { value: 'feature', label: 'Feature' }
    ]
  }
};

// Marketing Campaigns Page Filters
export const MARKETING_FILTERS = {
  date_range: { 
    label: 'Date Range', 
    type: 'date_preset',
    options: [
      { value: 'today', label: 'Today' },
      { value: 'this_week', label: 'This Week' },
      { value: 'this_month', label: 'This Month' },
      { value: 'last_7_days', label: 'Last 7 Days' },
      { value: 'last_30_days', label: 'Last 30 Days' }
    ]
  },
  status: { 
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
  task_type: { 
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
  video_subcategory: { 
    label: 'Video Category', 
    type: 'multi_select',
    options: [
      { value: 'egc_videos', label: 'EGC Videos' },
      { value: 'campaign_video', label: 'Campaign Video' },
      { value: 'awareness_video', label: 'Awareness Video' }
    ]
  },
  assignee_email: { 
    label: 'Assignee', 
    type: 'user_multi_select'
  },
  reviewer_email: { 
    label: 'Reviewer', 
    type: 'user_multi_select'
  },
  platforms: {
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
};