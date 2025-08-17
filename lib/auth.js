// lib/auth.js

/**
 * Checks if the provided email address is in the list of admin emails.
 * The list of admin emails is stored in an environment variable.
 * @param {string | undefined | null} email The user's email to check.
 * @returns {boolean} True if the user is an admin, false otherwise.
 */
export function isAdmin(email) {
  // Get the comma-separated list of admin emails from environment variables.
  // Use ADMIN_EMAILS instead of NEXT_PUBLIC_ADMIN_EMAILS for security
  const adminEmails = process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS;

  // If the user's email is not provided or the admin list is not set, deny access.
  if (!email || !adminEmails) {
    console.log('Admin check failed: no email or admin list not configured');
    return false;
  }

  // Split the string into an array of emails and remove any extra spaces.
  const adminEmailArray = adminEmails.split(',').map(e => e.trim().toLowerCase());

  // Check if the user's email is included in the array of admins.
  const isAdminUser = adminEmailArray.includes(email.toLowerCase().trim());
  
  console.log(`Admin check for ${email}: ${isAdminUser}`);
  return isAdminUser;
}