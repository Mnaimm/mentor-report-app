# RBAC Quick Reference Card

## 🚀 Quick Start for Developers

### Import Required Functions
```javascript
import { getSession } from 'next-auth/react';
import { canAccessAdmin, canAccessCoordinator, canAccessMonitoring, isSystemAdmin, isReadOnly } from '../lib/auth';
import AccessDenied from '../components/AccessDenied';
import ReadOnlyBadge from '../components/ReadOnlyBadge';
```

---

## 🔒 Protect a Page (Template)

```javascript
// pages/your-protected-page.js
export default function YourPage({ userEmail, isReadOnlyUser, accessDenied }) {
  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  return (
    <div>
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      {/* Disable buttons for read-only users */}
      <button disabled={isReadOnlyUser}>Edit</button>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } };
  }

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail); // Change function as needed

  if (!hasAccess) {
    return { props: { accessDenied: true, userEmail } };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);

  return { props: { userEmail, isReadOnlyUser } };
}
```

---

## 📋 Authorization Functions

```javascript
// Check specific access
await canAccessAdmin(email)       // Admin page access
await canAccessCoordinator(email) // Coordinator page access
await canAccessMonitoring(email)  // Monitoring page access
await isSystemAdmin(email)        // Superadmin access

// Check read-only status
await isReadOnly(email)           // Returns true if ONLY has stakeholder role

// Get all roles
await getUserRoles(email)         // Returns ['system_admin', 'stakeholder', ...]
```

---

## 🎨 UI Components

### AccessDenied Component
```javascript
<AccessDenied userEmail={session.user.email} />
```

### ReadOnlyBadge Component
```javascript
<ReadOnlyBadge
  userEmail={session.user.email}
  position="top-right" // Optional: 'top-right', 'top-left', 'top-center'
/>
```

---

## 🔐 Role Hierarchy

### Access Levels (Most to Least):
1. **system_admin** → Everything including role management
2. **program_coordinator** → Admin + Coordinator pages
3. **report_admin, payment_admin** → Admin page only
4. **stakeholder (ONLY)** → Admin + Coordinator + Monitoring (read-only)
5. **mentor** → Mentor pages only

---

## 🎯 Read-Only Rules

**User is Read-Only if:**
- Has EXACTLY ONE role: `stakeholder`

**User is NOT Read-Only if:**
- Has `stakeholder` + any other role
- Has any role except `stakeholder`

**Examples:**
```javascript
['stakeholder'] → Read-Only ✅
['stakeholder', 'payment_approver'] → Full Access ❌
['system_admin'] → Full Access ❌
['mentor'] → N/A (no access to admin pages)
```

---

## 🛠️ Common Code Patterns

### Pattern 1: Conditional Button
```javascript
<button
  onClick={handleAction}
  disabled={isReadOnlyUser}
  className={isReadOnlyUser ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
  title={isReadOnlyUser ? 'View-only access' : ''}
>
  Action
</button>
```

### Pattern 2: Hide Element for Read-Only
```javascript
{!isReadOnlyUser && (
  <button onClick={handleEdit}>Edit</button>
)}
```

### Pattern 3: Show Info Message
```javascript
{isReadOnlyUser && (
  <div className="text-yellow-700 bg-yellow-50 px-3 py-2 rounded">
    You have view-only access
  </div>
)}
```

---

## 📡 API Endpoints

### List All Users
```javascript
GET /api/superadmin/list-users
// Response: { users: [{ email, roles: [], assigned_by, assigned_at }], total }
```

### Add Role
```javascript
POST /api/superadmin/add-user-role
// Body: { email: "user@example.com", role: "report_admin" }
// Response: { success: true, message, role }
```

### Remove Role
```javascript
DELETE /api/superadmin/remove-user-role
// Body: { email: "user@example.com", role: "report_admin" }
// Response: { success: true, message }
```

**Note:** All endpoints require `system_admin` role!

---

## 🗄️ Database Queries

### Check User's Roles
```sql
SELECT role FROM user_roles WHERE email = 'user@example.com';
```

### Add Role Manually
```sql
INSERT INTO user_roles (email, role, assigned_by, assigned_at)
VALUES ('user@example.com', 'system_admin', 'admin@example.com', NOW());
```

### Remove Role Manually
```sql
DELETE FROM user_roles
WHERE email = 'user@example.com' AND role = 'stakeholder';
```

### Count System Admins
```sql
SELECT COUNT(DISTINCT email) FROM user_roles WHERE role = 'system_admin';
```

---

## 🎨 Role Badge Colors

```javascript
const ROLE_COLORS = {
  system_admin: 'bg-red-100 text-red-800',
  program_coordinator: 'bg-blue-100 text-blue-800',
  report_admin: 'bg-green-100 text-green-800',
  payment_admin: 'bg-purple-100 text-purple-800',
  payment_approver: 'bg-indigo-100 text-indigo-800',
  stakeholder: 'bg-yellow-100 text-yellow-800',
  mentor: 'bg-gray-100 text-gray-800',
  premier_mentor: 'bg-pink-100 text-pink-800'
};
```

---

## ⚠️ Safety Checks

### Before Removing Role:
1. ✅ User must have at least 2 roles
2. ✅ If removing `system_admin`, check there's another system admin
3. ✅ Confirm with user before deletion

### Before Adding Role:
1. ✅ Validate email format
2. ✅ Check role is in valid roles list
3. ✅ Check for duplicate roles

---

## 🐛 Debugging Tips

### User Can't Access Page
```javascript
// Check in browser console:
console.log('User email:', session?.user?.email);
console.log('User roles:', await getUserRoles(session?.user?.email));
console.log('Has access:', await canAccessAdmin(session?.user?.email));
```

### Read-Only Not Working
```sql
-- Check in Supabase:
SELECT * FROM user_roles WHERE email = 'user@example.com';
-- Should show ONLY 'stakeholder' for read-only mode
```

### API Returning 403
```javascript
// Check in API route:
const isSuperAdmin = await isSystemAdmin(session.user.email);
console.log('Is super admin:', isSuperAdmin);
```

---

## 📝 Testing Checklist

- [ ] Unauthenticated → Redirects to sign-in
- [ ] system_admin → Full access everywhere
- [ ] program_coordinator → Admin + Coordinator only
- [ ] stakeholder (ONLY) → Read-only with badge
- [ ] stakeholder + other → Full access (no badge!)
- [ ] mentor → Access denied on admin pages
- [ ] Read-only users can't click edit buttons
- [ ] Role management page works
- [ ] Can't remove last role
- [ ] Can't remove last system_admin

---

## 🆘 Emergency Access

### Lost All System Admins?
```sql
-- Manually add yourself as system admin:
INSERT INTO user_roles (email, role, assigned_by, assigned_at)
VALUES ('your-email@example.com', 'system_admin', 'emergency', NOW())
ON CONFLICT (email, role) DO NOTHING;
```

### User Locked Out?
```sql
-- Check their roles:
SELECT * FROM user_roles WHERE email = 'locked-user@example.com';

-- Add appropriate role:
INSERT INTO user_roles (email, role, assigned_by, assigned_at)
VALUES ('locked-user@example.com', 'report_admin', 'support', NOW());
```

---

## 📞 Quick Links

- **Testing Guide**: `RBAC_TESTING_GUIDE.md`
- **Full Documentation**: `RBAC_IMPLEMENTATION_SUMMARY.md`
- **Auth Functions**: `lib/auth.js`
- **Role Management UI**: `/superadmin/roles`

---

**Print this page and keep it handy!** 📌
