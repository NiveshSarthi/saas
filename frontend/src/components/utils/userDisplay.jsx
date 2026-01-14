// Utility functions for displaying user information with category

export const CATEGORY_LABELS = {
  internal: 'Internal Team',
  realtor: 'Realtor',
  cp: 'CP',
  acp: 'ACP',
  rm: 'RM',
  external: 'External Team'
};

/**
 * Get formatted user display with category
 * @param {Object} user - User object with email, full_name, and user_category
 * @returns {string} Formatted string like "John Doe — (CP)"
 */
export const getUserDisplayName = (user) => {
  if (!user) return 'Unknown User';
  
  const name = user.full_name || user.email?.split('@')[0] || 'Unknown';
  const category = user.user_category || 'internal';
  const categoryLabel = CATEGORY_LABELS[category] || 'Internal Team';
  
  return `${name} — (${categoryLabel})`;
};

/**
 * Get user display name from email by searching in users array
 * @param {string} email - User email
 * @param {Array} users - Array of user objects
 * @returns {string} Formatted string
 */
export const getUserDisplayByEmail = (email, users) => {
  const user = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
  return getUserDisplayName(user);
};

/**
 * Get just the category label for a user
 * @param {Object} user - User object
 * @returns {string} Category label
 */
export const getCategoryLabel = (user) => {
  const category = user?.user_category || 'internal';
  return CATEGORY_LABELS[category] || 'Internal Team';
};