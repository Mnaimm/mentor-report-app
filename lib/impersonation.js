// lib/impersonation.js
// Secure admin impersonation - only for specific super admin

// Super admin email (only this user can impersonate)
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();

// Check if user is the super admin who can impersonate
export function canImpersonate(userEmail) {
  if (!SUPER_ADMIN_EMAIL) return false;
  return userEmail?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
}

// Get the effective user email (either real user or impersonated user)
export function getEffectiveUserEmail(req, session) {
  const realUserEmail = session?.user?.email?.toLowerCase().trim();

  // Only super admin can impersonate
  if (!canImpersonate(realUserEmail)) {
    return realUserEmail;
  }

  // Check for impersonation header
  const impersonateEmail = req.headers['x-impersonate-user']?.toLowerCase().trim();

  if (impersonateEmail) {
    console.log(`🎭 Super admin ${realUserEmail} impersonating: ${impersonateEmail}`);
    return impersonateEmail;
  }

  return realUserEmail;
}

// Client-side storage for impersonation state
export const ImpersonationManager = {
  // Set impersonation target
  setImpersonateUser(mentorEmail) {
    if (mentorEmail) {
      localStorage.setItem('impersonate_user', mentorEmail.toLowerCase().trim());
      console.log(`🎭 Impersonation set: ${mentorEmail}`);
    } else {
      localStorage.removeItem('impersonate_user');
      console.log(`🎭 Impersonation cleared`);
    }
  },

  // Get current impersonation target
  getImpersonateUser() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('impersonate_user');
  },

  // Clear impersonation
  clearImpersonation() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('impersonate_user');
    }
  },

  // Get headers for API calls with impersonation
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    const impersonateUser = this.getImpersonateUser();
    if (impersonateUser) {
      headers['x-impersonate-user'] = impersonateUser;
    }

    return headers;
  }
};