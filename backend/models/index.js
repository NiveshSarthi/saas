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
    is_late: Boolean,
    late_minutes: Number,
    is_early_checkout: Boolean,
    notes: String,
    created_at: { type: Date, default: Date.now }
});

const salaryPolicySchema = new mongoose.Schema({
    user_email: String,
    user_name: String,
    salary_type: String, // monthly, daily
    basic_salary: Number,
    hra: Number,
    travelling_allowance: Number,
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
    total_deductions: Number,
    net_salary: Number,
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
    fb_created_time: Date,
    activity_log: [mongoose.Schema.Types.Mixed],
    last_activity_date: Date,
    created_by: String,
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
export const Department = mongoose.model('Department', departmentSchema);
export const SavedFilter = mongoose.model('SavedFilter', savedFilterSchema);

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
    amount: Number,
    status: String, // pending, approved, paid
    description: String,
    user_email: String,
    date: Date,
    created_at: { type: Date, default: Date.now }
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
export const DailySalesPerformance = mongoose.model('DailySalesPerformance', dailySalesPerformanceSchema);

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
