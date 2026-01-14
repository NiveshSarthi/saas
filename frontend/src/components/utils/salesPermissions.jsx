/**
 * Sales Department Role-Based Access Control Utilities
 * 
 * Defines permissions and visibility rules for Sales Department only.
 * Does not affect other departments or regular app features.
 */

export const SALES_ROLES = {
  SALES_HEAD: 'Sales Head',
  SALES_MANAGER: 'Sales Manager',
  SALES_EXECUTIVE: 'Sales Executive'
};

export const SALES_JOB_TITLES = [
  SALES_ROLES.SALES_HEAD,
  SALES_ROLES.SALES_MANAGER,
  SALES_ROLES.SALES_EXECUTIVE
];

/**
 * Check if a user belongs to Sales Department
 */
export const isSalesUser = (user, departments) => {
  if (!user?.department_id || !departments) return false;
  const dept = departments.find(d => d.id === user.department_id);
  return dept?.name?.toLowerCase().includes('sales');
};

/**
 * Get user's sales role from job_title
 */
export const getSalesRole = (user) => {
  if (!user?.job_title) return null;
  return SALES_JOB_TITLES.find(role => role === user.job_title) || null;
};

/**
 * Check if user is Sales Head
 */
export const isSalesHead = (user) => {
  return user?.job_title === SALES_ROLES.SALES_HEAD;
};

/**
 * Check if user is Sales Manager
 */
export const isSalesManager = (user) => {
  return user?.job_title === SALES_ROLES.SALES_MANAGER;
};

/**
 * Check if user is Sales Executive
 */
export const isSalesExecutive = (user) => {
  return user?.job_title === SALES_ROLES.SALES_EXECUTIVE;
};

/**
 * Check if user can access reports and projects
 * Sales Managers and Sales Executives cannot access these modules
 */
export const canAccessReportsAndProjects = (user, departments) => {
  // Admin can always access
  if (user?.role === 'admin') return true;
  
  // Check if user is in sales department
  if (!isSalesUser(user, departments)) return true;
  
  // Sales Managers and Sales Executives cannot access
  if (isSalesManager(user) || isSalesExecutive(user)) return false;
  
  return true;
};

/**
 * Get list of users visible to current user based on sales hierarchy
 * 
 * @param {Object} currentUser - The current logged-in user
 * @param {Array} allUsers - All users in the system
 * @param {Array} departments - All departments
 * @returns {Array} - Filtered list of users visible to current user
 */
export const getVisibleSalesUsers = (currentUser, allUsers, departments) => {
  // Admin sees everyone
  if (currentUser?.role === 'admin') {
    return allUsers;
  }

  // Non-sales users see everyone (no restriction)
  if (!isSalesUser(currentUser, departments)) {
    return allUsers;
  }

  const salesDeptIds = departments
    .filter(d => d.name?.toLowerCase().includes('sales'))
    .map(d => d.id);

  const salesUsers = allUsers.filter(u => 
    u.department_id && salesDeptIds.includes(u.department_id)
  );

  // Sales Head: See all sales users
  if (isSalesHead(currentUser)) {
    return salesUsers;
  }

  // Sales Manager: See themselves + their direct reports (executives)
  if (isSalesManager(currentUser)) {
    const visibleUsers = salesUsers.filter(u => {
      // Include self
      if (u.email?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
      // Include those who report to this manager
      if (u.reports_to?.toLowerCase() === currentUser.email?.toLowerCase()) return true;
      return false;
    });
    return visibleUsers;
  }

  // Sales Executive: See only themselves
  if (isSalesExecutive(currentUser)) {
    return allUsers.filter(u => 
      u.email?.toLowerCase() === currentUser.email?.toLowerCase()
    );
  }

  // Default: see everyone (for non-sales or unclassified users)
  return allUsers;
};

/**
 * Filter sales activities based on user's sales role
 * 
 * @param {Array} activities - All sales activities
 * @param {Object} currentUser - Current logged-in user
 * @param {Array} allUsers - All users
 * @param {Array} departments - All departments
 * @returns {Array} - Filtered activities
 */
export const getVisibleSalesActivities = (activities, currentUser, allUsers, departments) => {
  // Admin sees all activities
  if (currentUser?.role === 'admin') {
    return activities;
  }

  // Non-sales users see everything (no restriction)
  if (!isSalesUser(currentUser, departments)) {
    return activities;
  }

  const visibleUsers = getVisibleSalesUsers(currentUser, allUsers, departments);
  const visibleEmails = visibleUsers.map(u => u.email?.toLowerCase());

  return activities.filter(activity => {
    const activityEmail = activity.user_email?.toLowerCase();
    return visibleEmails.includes(activityEmail);
  });
};

/**
 * Filter leads based on user's sales role
 */
export const getVisibleLeads = (leads, currentUser, allUsers, departments) => {
  // Admin sees all leads
  if (currentUser?.role === 'admin') {
    return leads;
  }

  // Non-sales users see all leads (no restriction)
  if (!isSalesUser(currentUser, departments)) {
    return leads;
  }

  const visibleUsers = getVisibleSalesUsers(currentUser, allUsers, departments);
  const visibleEmails = visibleUsers.map(u => u.email?.toLowerCase());

  return leads.filter(lead => {
    // Only show assigned leads
    if (!lead.assigned_to) return false;
    
    const assignedEmail = lead.assigned_to?.toLowerCase();
    return visibleEmails.includes(assignedEmail);
  });
};

/**
 * Check if user can edit/approve sales data from another user
 */
export const canManageSalesUser = (currentUser, targetUser, departments) => {
  // Admin can manage everyone
  if (currentUser?.role === 'admin') return true;

  // Non-sales users have no sales restrictions
  if (!isSalesUser(currentUser, departments)) return true;

  // Can always manage self
  if (currentUser.email?.toLowerCase() === targetUser.email?.toLowerCase()) {
    return true;
  }

  // Sales Head can manage all sales users
  if (isSalesHead(currentUser)) return true;

  // Sales Manager can manage their direct reports
  if (isSalesManager(currentUser)) {
    return targetUser.reports_to?.toLowerCase() === currentUser.email?.toLowerCase();
  }

  // Sales Executive cannot manage others
  return false;
};