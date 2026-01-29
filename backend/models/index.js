import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({
    id: String, // e.g. 'admin', 'project_manager' (to match frontend checks)
    name: String,
    description: String,
    permissions: mongoose.Schema.Types.Mixed,
    is_system: Boolean,
    priority: Number,
    restrict_project_visibility: Boolean,
    created_at: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    full_name: String,
    password_hash: String,
    role: { type: String, default: 'user' }, // admin, user
    role_id: String, // Reference to Role ID (string based)
    department_id: String,
    project_ids: [String],
    job_title: String,
    is_active: { type: Boolean, default: true },
    password_reset_token: String,
    password_reset_expires: Date,
    last_login: Date,
    created_by: String, // Email of user who created this account

    // Added for extended user management
    reports_to: String, // Email of manager
    user_category: String, // internal, realtor, cp, acp, rm, external
    territory: String,
    status: { type: String, default: 'active' }, // active, inactive (synced with is_active)
    joining_date: Date,

    created_at: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
    title: String,
    description: String,
    task_type: String,
    priority: String,
    status: String, // todo, in_progress, blocked, done
    estimated_hours: Number,
    actual_hours: Number,
    assignees: [String], // emails
    assignee_email: String,
    blocked_reason: String,
    due_date: Date,
    project_name: String,
    tags: [String],
    parent_task_id: String,
    order: Number,
    sprint_id: String,
    project_id: String,
    start_date: Date,
    blocked_by_task_ids: [String],
    subtask_comments: [{
        text: String,
        author: String,
        timestamp: Date
    }],
    subtask_time_tracked: Number,
    subtask_effort_points: Number,
    created_by: String, // added to track creator
    reporter_email: String, // added to track reporter
    attachments: [mongoose.Schema.Types.Mixed], // Array of file objects {name, url, type, size}
    custom_fields: mongoose.Schema.Types.Mixed, // Key-value pairs for custom fields
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const attendanceSchema = new mongoose.Schema({
    user_email: String,
    user_name: String,
    date: String, // YYYY-MM-DD
    status: String, // present, absent, leave, half_day, weekoff, holiday
    check_in: Date,
    check_out: Date,
    total_hours: Number,
    is_late: Boolean,
    late_minutes: Number,
    is_early_checkout: Boolean,
    source: String,
    marked_by: String,
    location: mongoose.Schema.Types.Mixed,
    ip_address: String,
    device_info: String,
    notes: String,
    created_at: { type: Date, default: Date.now }
});

const salaryPolicySchema = new mongoose.Schema({
    user_email: String,
    user_name: String,
    salary_type: String, // monthly, daily
    basic_salary: Number,
    hra: Number,
    conveyance_allowance: Number,
    special_allowance: Number,
    other_allowance: Number,
    travelling_allowance: Number, // Deprecated but kept for backward compatibility
    children_education_allowance: Number,
    fixed_incentive: Number,
    employer_incentive: Number,
    employee_pf_percentage: Number,
    employee_pf_fixed: Number,
    employer_pf_percentage: Number,
    employer_pf_fixed: Number,
    employee_esi_percentage: Number,
    employee_esi_fixed: Number,
    employer_esi_percentage: Number,
    employer_esi_fixed: Number,
    labour_welfare_employee: Number,
    labour_welfare_employer: Number,
    professional_tax: Number,
    pf_admin_charges: Number,
    bonus_amount: Number,
    gratuity_amount: Number,
    ex_gratia_percentage: Number,
    ex_gratia_fixed: Number,
    late_penalty_enabled: Boolean,
    late_penalty_per_minute: Number,
    is_active: { type: Boolean, default: true }
});

const salaryRecordSchema = new mongoose.Schema({
    employee_email: String,
    employee_name: String,
    month: String, // YYYY-MM
    total_working_days: Number,
    total_paid_days: Number,
    present_days: Number,
    absent_days: Number,
    leave_days: Number,
    weekoff_days: Number,
    holiday_days: Number,
    gross_salary: Number,
    sales_incentive: { type: Number, default: 0 },
    sales_reward: { type: Number, default: 0 },
    sales_performance_meta: mongoose.Schema.Types.Mixed, // Stores breakdown: count, team_avg, rates
    total_deductions: Number,
    net_salary: Number,
    attendance_adjustments: Number,
    status: { type: String, default: 'draft' }, // draft, locked, paid
    details: mongoose.Schema.Types.Mixed, // Store full calculation object
    locked: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

export const Role = mongoose.model('Role', roleSchema);
export const User = mongoose.model('User', userSchema);
const subtaskTemplateSchema = new mongoose.Schema({
    name: String,
    subtasks: [{
        title: String,
        priority: String,
        estimated_hours: Number,
        dependencies: [Number]
    }],
    category: String,
    is_public: Boolean,
    created_by: String,
    created_at: { type: Date, default: Date.now }
});

export const Task = mongoose.model('Task', taskSchema);
export const SubtaskTemplate = mongoose.model('SubtaskTemplate', subtaskTemplateSchema);
export const Attendance = mongoose.model('Attendance', attendanceSchema);
export const SalaryPolicy = mongoose.model('SalaryPolicy', salaryPolicySchema);
export const SalaryRecord = mongoose.model('SalaryRecord', salaryRecordSchema);

const leaveRequestSchema = new mongoose.Schema({
    user_email: String,
    start_date: String,
    end_date: String,
    status: String, // approved, pending, rejected
    type: String, // sick, casual
    reason: String
});

const salaryAdvanceSchema = new mongoose.Schema({
    employee_email: String,
    advance_amount: Number,
    installment_amount: Number,
    total_paid: Number,
    remaining_balance: Number,
    status: String, // active, closed
    recovery_start_month: String // YYYY-MM
});

const salaryAdjustmentSchema = new mongoose.Schema({
    employee_email: String,
    month: String,
    adjustment_type: String, // bonus, incentive, reimbursement, other, penalty
    amount: Number,
    description: String,
    status: String // approved
});

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
export const SalaryAdvance = mongoose.model('SalaryAdvance', salaryAdvanceSchema);
export const SalaryAdjustment = mongoose.model('SalaryAdjustment', salaryAdjustmentSchema);


const leadSchema = new mongoose.Schema({
    lead_name: String,
    phone: String,
    email: String,
    company: String,
    location: String,
    status: String,
    contact_status: String, // contacted, not_contacted, connected, etc.
    source: String,
    priority: String,
    assigned_to: String, // email
    import_batch_name: String,
    builder_id: String,
    notes: String,
    fb_lead_id: String,

    fb_form_id: String,
    fb_page_id: String,
    fb_created_time: Date,
    raw_facebook_data: mongoose.Schema.Types.Mixed, // Store complete field_data from Facebook
    activity_log: [mongoose.Schema.Types.Mixed],
    last_activity_date: Date,
    created_by: String,
    created_date: { type: Date, default: Date.now },
    // Additional fields for lead management
    lead_source: String,
    budget: String,
    timeline: String,
    requirements: String,
    project_name: String,
    is_cold: { type: Boolean, default: false },
    cold_date: Date,
    lost_reason: String,
    lost_comment: String,
    lost_date: Date,
    next_follow_up: Date,
    contacted_date: Date,
    last_contact_date: Date,
    verified_budget: String,
    proposal_sent: String,
    negotiation_notes: String,
    visit_date: Date,
    agreement_signed: String,
    payment_amount: String,
    payment_date: Date,
    final_amount: String,
    stage_notes: String
});

const reLeadActivitySchema = new mongoose.Schema({
    lead_id: { type: String, required: true },
    activity_type: { type: String, required: true },
    description: String,
    actor_email: String,
    metadata: mongoose.Schema.Types.Mixed,
    created_date: { type: Date, default: Date.now }
});

const departmentSchema = new mongoose.Schema({
    name: String,
    description: String,
    manager_email: String
});

const savedFilterSchema = new mongoose.Schema({
    user_email: String,
    module: String, // leads, tasks etc
    name: String,
    filters: mongoose.Schema.Types.Mixed,
    created_by: String,
    is_global: Boolean,
    created_at: { type: Date, default: Date.now }
});

export const Lead = mongoose.model('Lead', leadSchema);
export const RELeadActivity = mongoose.model('RELeadActivity', reLeadActivitySchema);
export const Department = mongoose.model('Department', departmentSchema);
export const SavedFilter = mongoose.model('SavedFilter', savedFilterSchema);

const organizationSchema = new mongoose.Schema({
    name: String,
    logo_url: String,
    settings: {
        autoAssignPaused: { type: Boolean, default: false },
        theme: String,
        notifications: mongoose.Schema.Types.Mixed
    },
    created_by: String,
    created_at: { type: Date, default: Date.now }
});

export const Organization = mongoose.model('Organization', organizationSchema);

const projectSchema = new mongoose.Schema({
    name: String,
    description: String,
    status: String, // active, archived
    color: String,
    created_by: String,
    members: [String],
    start_date: Date,
    end_date: Date,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
    user_email: String,
    title: String,
    message: String,
    type: String,
    link: String,
    read: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

const activitySchema = new mongoose.Schema({
    user_email: String,
    user_name: String,
    action: String,
    entity_type: String,
    entity_id: String,
    description: String,
    created_at: { type: Date, default: Date.now }
});

const meetingSchema = new mongoose.Schema({
    title: String,
    description: String,
    start_date: Date,
    end_date: Date,
    participants: [String], // emails
    created_by: String,
    status: String, // scheduled, cancelled, done
    meeting_link: String,
    created_at: { type: Date, default: Date.now }
});

const taskGroupSchema = new mongoose.Schema({
    name: String,
    color: String,
    order: Number,
    created_at: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
    task_id: String,
    user_email: String,
    user_name: String,
    content: String,
    mentions: [String], // emails
    created_at: { type: Date, default: Date.now }
});

const groupSchema = new mongoose.Schema({
    name: String,
    members: [String],
    created_at: { type: Date, default: Date.now }
});

export const Project = mongoose.model('Project', projectSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Activity = mongoose.model('Activity', activitySchema);
export const Meeting = mongoose.model('Meeting', meetingSchema);
export const TaskGroup = mongoose.model('TaskGroup', taskGroupSchema);
export const Comment = mongoose.model('Comment', commentSchema);
export const Group = mongoose.model('Group', groupSchema);

const paymentReceivableSchema = new mongoose.Schema({
    payment_date: Date,
    amount: Number,
    received_amount: Number,
    pending_amount: Number,
    status: String, // pending, overdue, paid
    client_name: String,
    invoice_id: String,
    description: String,
    created_at: { type: Date, default: Date.now }
});

const paymentPayableSchema = new mongoose.Schema({
    due_date: Date,
    amount: Number,
    paid_amount: Number,
    pending_amount: Number,
    status: String,
    vendor_name: String,
    description: String,
    created_at: { type: Date, default: Date.now }
});

const cashFlowForecastSchema = new mongoose.Schema({
    month: String, // YYYY-MM
    expected_inflow: Number,
    expected_outflow: Number,
    closing_balance: Number,
    net_cashflow: Number,
    created_at: { type: Date, default: Date.now }
});

const financialAlertSchema = new mongoose.Schema({
    title: String,
    message: String,
    severity: String, // critical, warning, info
    status: String, // active, resolved
    created_at: { type: Date, default: Date.now }
});

const marketingExpenseSchema = new mongoose.Schema({
    spent_amount: Number,
    allocated_budget: Number,
    campaign_name: String,
    date: Date,
    created_at: { type: Date, default: Date.now }
});

const pettyCashReimbursementSchema = new mongoose.Schema({
    transaction_type: {
        type: String,
        enum: ['reimbursement', 'advance', 'credit', 'debit'],
        default: 'reimbursement'
    },
    amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['submitted', 'approved', 'rejected', 'paid'],
        default: 'submitted'
    },
    category: String,
    subcategory: String,
    purpose: { type: String, required: true },
    notes: String,
    employee_email: { type: String, required: true },
    employee_name: String,
    expense_date: String, // YYYY-MM-DD
    receipt_urls: [String],
    receipt_url: String, // Legacy support
    gst_amount: { type: Number, default: 0 },
    approved_by: String,
    approved_date: Date,
    rejection_reason: String,
    payment_date: String,
    payment_mode: String,
    payment_reference: String,
    comments: [{
        author: String,
        text: String,
        timestamp: { type: Date, default: Date.now }
    }],
    is_duplicate_flag: Boolean,
    duplicate_warning: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export const PaymentReceivable = mongoose.model('PaymentReceivable', paymentReceivableSchema);
export const PaymentPayable = mongoose.model('PaymentPayable', paymentPayableSchema);
export const CashFlowForecast = mongoose.model('CashFlowForecast', cashFlowForecastSchema);
export const FinancialAlert = mongoose.model('FinancialAlert', financialAlertSchema);
export const MarketingExpense = mongoose.model('MarketingExpense', marketingExpenseSchema);
export const PettyCashReimbursement = mongoose.model('PettyCashReimbursement', pettyCashReimbursementSchema);

const customFieldSchema = new mongoose.Schema({
    name: String,
    label: String,
    type: String, // text, number, date, select
    options: [String], // for select
    domain: String, // all, or specific project domain
    order: Number,
    required: Boolean,
    created_at: { type: Date, default: Date.now }
});

const marketingTaskSchema = new mongoose.Schema({
    campaign_name: String,
    related_task_id: String,
    task_type: String, // video, post, blog
    video_subcategory: String, // Added: awareness_video, campaign_video, egc_videos
    level_of_editing: String,  // Added: B, A, A+
    description: String,
    status: String, // idea, scripting, shooting, editing, review, published
    assignee_email: String,
    shoot_date: Date,
    due_date: Date,
    platforms: [String], // youtube, instagram, linkedin
    tags: [String],
    script_url: String,
    video_url: String,
    thumbnail_url: String,
    created_at: { type: Date, default: Date.now }
});

export const CustomField = mongoose.model('CustomField', customFieldSchema);
export const MarketingTask = mongoose.model('MarketingTask', marketingTaskSchema);

// Newly added missing schemas
const sprintSchema = new mongoose.Schema({
    name: String,
    project_id: String,
    start_date: Date,
    end_date: Date,
    status: { type: String, default: 'planned' },
    goal: String,
    created_at: { type: Date, default: Date.now }
});

const builderSchema = new mongoose.Schema({
    name: String,
    contact_email: String,
    phone: String,
    address: String,
    projects: [String],
    created_at: { type: Date, default: Date.now }
});

const auditLogSchema = new mongoose.Schema({
    user_email: String,
    action: String,
    module: String,
    details: String,
    ip_address: String,
    created_at: { type: Date, default: Date.now }
});

const salaryAuditLogSchema = new mongoose.Schema({
    user_email: String,
    action: String,
    target_record_id: String,
    details: String,
    created_at: { type: Date, default: Date.now }
});

const leaveTypeSchema = new mongoose.Schema({
    name: String,
    code: String,
    days_allowed: Number,
    carry_forward: Boolean,
    created_at: { type: Date, default: Date.now }
});

const leaveBalanceSchema = new mongoose.Schema({
    user_email: String,
    leave_type_id: String,
    year: Number,
    total_allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    carried_forward: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const pettyCashDrawerSchema = new mongoose.Schema({
    name: String,
    balance: Number,
    status: String,
    custodian_email: String,
    created_at: { type: Date, default: Date.now }
});

const pettyCashBudgetSchema = new mongoose.Schema({
    department_id: String,
    display_name: String,
    amount: Number,
    month: String, // YYYY-MM
    created_at: { type: Date, default: Date.now }
});

export const Sprint = mongoose.model('Sprint', sprintSchema);
export const Builder = mongoose.model('Builder', builderSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const SalaryAuditLog = mongoose.model('SalaryAuditLog', salaryAuditLogSchema);
export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
export const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
export const PettyCashDrawer = mongoose.model('PettyCashDrawer', pettyCashDrawerSchema);
export const PettyCashBudget = mongoose.model('PettyCashBudget', pettyCashBudgetSchema);

// Additional missing schemas from latest logs
const tagSchema = new mongoose.Schema({
    name: String,
    color: String,
    project_id: String,
    created_at: { type: Date, default: Date.now }
});

const userInvitationSchema = new mongoose.Schema({
    email: String,
    role_id: String,
    department_id: String,
    status: String, // pending, accepted
    token: String,
    created_at: { type: Date, default: Date.now }
});

const salesActivitySchema = new mongoose.Schema({
    user_id: String,
    user_email: String, // Added for easier querying in salary controller
    activity_type: String, // call, email, meeting
    description: String,
    lead_id: String,
    timestamp: { type: Date, default: Date.now }
});

const salesTargetSchema = new mongoose.Schema({
    user_id: String,
    period: String, // monthly, quarterly
    target_amount: Number,
    achieved_amount: Number,
    start_date: Date,
    end_date: Date,
    created_at: { type: Date, default: Date.now }
});

const hrTargetSchema = new mongoose.Schema({
    target_type: {
        type: String,
        enum: ['attendance_rate', 'working_hours', 'timesheet_compliance', 'leave_utilization', 'recruitment', 'onboarding_completion'],
        required: true
    },
    target_name: { type: String, required: true },
    target_value: { type: Number, required: true },
    target_unit: { type: String, default: '%' }, // %, hours, count, days
    period: { type: String, enum: ['monthly', 'quarterly', 'yearly'], default: 'monthly' },
    department_id: String, // optional - for department-specific targets
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    description: String,
    created_by: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const salesKPISettingsSchema = new mongoose.Schema({
    user_id: String,
    target_calls_per_day: Number,
    target_meetings_per_week: Number,
    target_revenue_per_month: Number,
    created_at: { type: Date, default: Date.now }
});

const dailySalesPerformanceSchema = new mongoose.Schema({
    user_id: String,
    date: Date,
    calls_made: Number,
    emails_sent: Number,
    meetings_conducted: Number,
    deals_closed: Number,
    revenue_generated: Number,
    created_at: { type: Date, default: Date.now }
});

export const Tag = mongoose.model('Tag', tagSchema);
export const UserInvitation = mongoose.model('UserInvitation', userInvitationSchema);
export const SalesActivity = mongoose.model('SalesActivity', salesActivitySchema);
export const SalesTarget = mongoose.model('SalesTarget', salesTargetSchema);
export const SalesKPISettings = mongoose.model('SalesKPISettings', salesKPISettingsSchema);
export const HRTarget = mongoose.model('HRTarget', hrTargetSchema);
export const DailySalesPerformance = mongoose.model('DailySalesPerformance', dailySalesPerformanceSchema);

const hrGracePeriodSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    minutes: { type: Number, default: 30 },
    reason: String,
    created_by: String,
    created_at: { type: Date, default: Date.now }
});

export const HRGracePeriod = mongoose.model('HRGracePeriod', hrGracePeriodSchema);

const officePurchaseRequestSchema = new mongoose.Schema({
    item_name: { type: String, required: true },
    category: {
        type: String,
        enum: ['Stationery', 'Confectionery', 'Maintenance', 'Other'],
        required: true
    },
    quantity: { type: Number, required: true },
    estimated_unit_price: { type: Number, required: true },
    total_amount: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'linked_to_petty_cash', 'received'],
        default: 'pending'
    },
    requester_email: { type: String, required: true },
    approved_by: String,
    notes: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export const OfficePurchaseRequest = mongoose.model('OfficePurchaseRequest', officePurchaseRequestSchema);

const timesheetSchema = new mongoose.Schema({
    freelancer_email: String,
    freelancer_name: String,
    week_start_date: String, // YYYY-MM-DD
    period_start: String,
    period_end: String,
    status: { type: String, default: 'draft' }, // draft, submitted, approved, rejected
    entries: [{
        task_id: String,
        task_title: String,
        date: String,
        hours: Number,
        description: String,
        project_id: String,
        project_name: String
    }],
    total_hours: { type: Number, default: 0 },
    submitted_at: Date,
    approved_at: Date,
    approved_by: String,
    rejected_at: Date,
    rejected_by: String,
    rejection_reason: String,
    comments: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export const Timesheet = mongoose.model('Timesheet', timesheetSchema);

const facebookPageConnectionSchema = new mongoose.Schema({
    page_id: String,
    page_name: String,
    access_token: String,
    status: { type: String, default: 'active' },
    last_sync_date: Date,
    lead_forms: [{
        form_id: String,
        form_name: String,
        status: String,
        subscribed: Boolean
    }],
    created_date: { type: Date, default: Date.now }
});

export const FacebookPageConnection = mongoose.model('FacebookPageConnection', facebookPageConnectionSchema);

// =============================================
// MARKETING DASHBOARD MODULE SCHEMAS
// =============================================

// Marketing Goal Schema - For calendar goal planning
const marketingGoalSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    goal_type: { type: String, enum: ['daily', 'weekly', 'biweekly', 'custom'], default: 'custom' },
    content_type: { type: String, enum: ['video', 'post', 'blog', 'flyer', 'poster', 'article', 'other'] }, // Added
    video_category: { type: String, enum: ['awareness_video', 'campaign_video', 'egc_videos'] },        // Added
    shoot_date: Date,                                                                                   // Added
    target_date: Date,                    // For custom dates
    recurrence_days: [Number],            // For weekly: [0,1,2...] (Sunday=0)
    start_date: Date,
    end_date: Date,                       // Optional end date for recurring goals
    status: { type: String, enum: ['pending', 'done'], default: 'pending' },
    color: { type: String, default: '#6366F1' },
    created_by: String,
    completed_at: Date,
    completed_by: String,
    created_at: { type: Date, default: Date.now }
});

// Marketing Category Schema - For video categorization
const marketingCategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, required: true },
    description: String,
    is_active: { type: Boolean, default: true },
    created_by: String,
    created_at: { type: Date, default: Date.now }
});

// Video Schema - For video workflow management
const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    category_id: { type: String, required: true },
    status: {
        type: String,
        enum: ['shoot', 'editing', 'review', 'revision', 'approval', 'posting', 'posted', 'trash'],
        default: 'shoot'
    },
    editing_level: { type: String, enum: ['B', 'A', 'A+'], required: true }, // B-Basic, A-Medium, A+-Highest
    raw_file_url: String,
    editing_url: String,
    revision_urls: [{
        url: String,
        revision_number: Number,
        added_at: { type: Date, default: Date.now },
        added_by: String
    }],
    final_video_url: String,
    assigned_director: { type: String, required: true },    // User email
    assigned_cameraman: { type: String, required: true },   // User email
    assigned_editor: { type: String, required: true },      // User email
    assigned_manager: { type: String, required: true },     // User email
    is_deleted: { type: Boolean, default: false },          // Soft delete
    deleted_by: String,
    deleted_at: Date,
    created_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// Video Comment Schema - For video comments with @mentions
const videoCommentSchema = new mongoose.Schema({
    video_id: { type: String, required: true },
    user_email: { type: String, required: true },
    user_name: String,
    content: { type: String, required: true },
    mentions: [String],                                     // Array of mentioned user emails
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const reviewFeedbackSchema = new mongoose.Schema({
    video_id: { type: String, required: true },
    reviewer_email: { type: String, required: true },
    feedback: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

export const ReviewFeedback = mongoose.model('ReviewFeedback', reviewFeedbackSchema);

// NEW: Marketing KPI Models
const marketingKPISettingsSchema = new mongoose.Schema({
    user_id: String,
    content_targets: mongoose.Schema.Types.Mixed, // { egc_weekly: 5, ... }
    production_goals: mongoose.Schema.Types.Mixed, // { planning: { yearly: 100... } }
    created_by: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const marketingPerformanceLogSchema = new mongoose.Schema({
    user_id: String,
    date: String, // YYYY-MM-DD
    metrics: mongoose.Schema.Types.Mixed, // { egc: 1, awareness: 2 ... }
    production_data: mongoose.Schema.Types.Mixed, // { planning: 1, shoot: 0 ... }
    notes: String,
    created_by: String,
    created_at: { type: Date, default: Date.now }
});

export const MarketingKPISettings = mongoose.model('MarketingKPISettings', marketingKPISettingsSchema);
export const MarketingPerformanceLog = mongoose.model('MarketingPerformanceLog', marketingPerformanceLogSchema);

// Video Log Schema - For activity logging
const videoLogSchema = new mongoose.Schema({
    video_id: { type: String, required: true },
    action: { type: String, required: true },               // e.g., 'created', 'status_changed', 'field_updated', 'comment_added'
    user_email: { type: String, required: true },
    user_name: String,
    details: mongoose.Schema.Types.Mixed,                   // { field: 'status', old_value: 'shoot', new_value: 'editing' }
    created_at: { type: Date, default: Date.now }
});

export const MarketingGoal = mongoose.model('MarketingGoal', marketingGoalSchema);
export const MarketingCategory = mongoose.model('MarketingCategory', marketingCategorySchema);
export const Video = mongoose.model('Video', videoSchema);
export const VideoComment = mongoose.model('VideoComment', videoCommentSchema);

export const VideoLog = mongoose.model('VideoLog', videoLogSchema);

const attendanceSettingsSchema = new mongoose.Schema({
    work_start_time: { type: String, default: '09:00' },
    late_threshold_minutes: { type: Number, default: 15 },
    minimum_work_hours: { type: Number, default: 8 },
    early_checkout_threshold_hours: { type: Number, default: 8 },
    allow_multiple_checkins: { type: Boolean, default: false },
    enable_geofencing: { type: Boolean, default: false },
    office_latitude: Number,
    office_longitude: Number,
    geofence_radius_meters: { type: Number, default: 500 },
    week_off_days: [Number], // 0=Sunday
    require_checkout: { type: Boolean, default: true },
    auto_checkout_time: { type: String, default: '23:59' },
    updated_at: { type: Date, default: Date.now }
});

const workDaySchema = new mongoose.Schema({
    date: { type: String, required: true }, // YYYY-MM-DD
    is_holiday: { type: Boolean, default: false },
    name: String,
    description: String,
    is_weekoff: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

export const AttendanceSettings = mongoose.model('AttendanceSettings', attendanceSettingsSchema);
export const WorkDay = mongoose.model('WorkDay', workDaySchema);

const candidateSchema = new mongoose.Schema({
    full_name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    current_position: String,
    current_company: String,
    experience_years: Number,
    skills: [String],
    education: [String],
    expected_salary: Number,
    current_salary: Number,
    location: String,
    source: String,
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    tags: [String],
    resume_url: String,
    status: {
        type: String,
        enum: ['new', 'screening', 'interviewed', 'offered', 'hired', 'rejected'],
        default: 'new'
    },
    created_by: String,
    assigned_to: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const interviewSchema = new mongoose.Schema({
    candidate_id: { type: String, required: true },
    candidate_name: String,
    candidate_email: String,
    interviewer_email: { type: String, required: true },
    interviewer_name: String,
    interview_type: { type: String, default: 'technical' },
    round: { type: Number, default: 1 },
    scheduled_date: { type: Date, required: true },
    duration_minutes: { type: Number, default: 60 },
    notes: String,
    meeting_link: String,
    status: {
        type: String,
        enum: ['scheduled', 'completed', 'cancelled', 'no_show'],
        default: 'scheduled'
    },
    feedback: String,
    rating: Number,
    created_by: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const candidateActivitySchema = new mongoose.Schema({
    candidate_id: String,
    activity_type: String, // status_changed, note_added, interview_scheduled
    description: String,
    performed_by: String,
    metadata: mongoose.Schema.Types.Mixed,
    created_at: { type: Date, default: Date.now }
});

export const Candidate = mongoose.model('Candidate', candidateSchema);
export const Interview = mongoose.model('Interview', interviewSchema);
export const CandidateActivity = mongoose.model('CandidateActivity', candidateActivitySchema);

// =============================================
// ACCOUNTS MANAGEMENT MODULE
// =============================================

const chartOfAccountSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
        type: String,
        required: true,
        enum: ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
    },
    subtype: String, // Current Asset, Long Term Liability, etc.
    description: String,
    balance: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const vendorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: String,
    phone: String,
    address: String,
    tax_id: String, // GSTIN/VAT
    payment_terms: String, // Net 30, Net 15
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const clientSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: String,
    phone: String,
    address: String,
    tax_id: String,
    payment_terms: String,
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const invoiceSchema = new mongoose.Schema({
    invoice_number: { type: String, required: true, unique: true },
    client_id: { type: String, required: true },
    client_name: String, // Denormalized for display
    date: { type: Date, required: true },
    due_date: { type: Date, required: true },
    items: [{
        description: String,
        quantity: Number,
        unit_price: Number,
        tax_rate: Number,
        amount: Number,
        account_id: String // Revenue account
    }],
    notes: String,
    subtotal: { type: Number, default: 0 },
    tax_total: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    created_by: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const billSchema = new mongoose.Schema({
    bill_number: String,
    vendor_id: { type: String, required: true },
    vendor_name: String,
    date: { type: Date, required: true },
    due_date: { type: Date, required: true },
    items: [{
        description: String,
        quantity: Number,
        unit_price: Number,
        amount: Number,
        account_id: String // Expense account
    }],
    total: { type: Number, default: 0 },
    amount_paid: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['draft', 'received', 'partial', 'paid', 'overdue'],
        default: 'draft'
    },
    created_by: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    description: String,
    reference_id: String, // Invoice ID, Bill ID, etc.
    reference_type: { type: String, enum: ['invoice', 'bill', 'payment', 'journal', 'expense'] },
    account_id: { type: String, required: true }, // General Ledger Account
    type: { type: String, enum: ['debit', 'credit'], required: true },
    amount: { type: Number, required: true },
    created_by: String,
    created_at: { type: Date, default: Date.now }
});

const siteVisitSchema = new mongoose.Schema({
    user_email: { type: String, required: true },
    user_name: String,
    client_name: { type: String, required: true },
    purpose: String,
    location_start: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    location_end: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    estimated_duration_minutes: { type: Number, required: true },
    actual_duration_minutes: Number,
    start_time: { type: Date, default: Date.now },
    end_time: Date,
    status: {
        type: String,
        enum: ['ongoing', 'completed', 'cancelled'],
        default: 'ongoing'
    },
    notes: String, // Outcome notes
    approval_status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    approved_by: String, // Admin email or ID
    rejection_reason: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const itTicketSchema = new mongoose.Schema({
    ticket_id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    priority: { type: String, required: true },
    asset_id: String,
    created_by_email: { type: String, required: true },
    created_by_name: String,
    department_id: String,
    assigned_to: String, // Technician email
    status: {
        type: String,
        enum: ['pending_approval', 'open', 'in_progress', 'on_hold', 'resolved', 'closed', 'rejected'],
        default: 'pending_approval'
    },
    head_approval_status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    head_rejection_reason: String,
    sla_hours: Number,
    sla_due_at: Date,
    sla_breached: { type: Boolean, default: false },
    resolved_at: Date,
    resolution_notes: String,
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

const itSLAConfigSchema = new mongoose.Schema({
    priority: { type: String, required: true, unique: true },
    sla_hours: { type: Number, required: true }
});

const itTicketActivitySchema = new mongoose.Schema({
    ticket_id: { type: String, required: true },
    action: { type: String, required: true },
    old_value: String,
    new_value: String,
    performed_by: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

const itTicketCommentSchema = new mongoose.Schema({
    ticket_id: { type: String, required: true },
    comment: { type: String, required: true },
    author_email: { type: String, required: true },
    author_name: String,
    is_internal: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

export const SiteVisit = mongoose.model('SiteVisit', siteVisitSchema);

export const ChartOfAccount = mongoose.model('ChartOfAccount', chartOfAccountSchema);
export const Vendor = mongoose.model('Vendor', vendorSchema);
export const Client = mongoose.model('Client', clientSchema);
export const Invoice = mongoose.model('Invoice', invoiceSchema);
export const Bill = mongoose.model('Bill', billSchema);
export const Transaction = mongoose.model('Transaction', transactionSchema);

export const ITTicket = mongoose.model('ITTicket', itTicketSchema);
export const ITSLAConfig = mongoose.model('ITSLAConfig', itSLAConfigSchema);
export const ITTicketActivity = mongoose.model('ITTicketActivity', itTicketActivitySchema);
export const ITTicketComment = mongoose.model('ITTicketComment', itTicketCommentSchema);
