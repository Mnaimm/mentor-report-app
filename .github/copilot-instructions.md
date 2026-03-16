# GitHub Copilot Instructions

## Project Context
iTEKAD Mentor Reporting Tool - A Next.js app for mentors to submit session reports for Bangkit and Maju programs. Uses hybrid data storage (Google Sheets + Supabase) with dual-write pattern.

## Tech Stack
- **Framework:** Next.js 13 (Pages Router) + React 18
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js (Google OAuth)
- **Database:** Supabase PostgreSQL (dual-write mode)
- **Legacy:** Google Sheets API + Google Drive API
- **Charts:** Recharts

## Code Generation Rules

### File Structure
- **Pages:** Use `/pages` directory (NOT `/app`)
- **API Routes:** Place in `/pages/api`
- **Components:** Store in `/components` (flat structure)
- **Utilities:** Store in `/lib`
- **Scripts:** Place in `/scripts` for background sync jobs

### Naming Conventions
- **Files:** kebab-case (e.g., `laporan-bangkit.js`, `mentor-stats.js`)
- **Components:** PascalCase (e.g., `MenteeCard`, `StatCard`)
- **API Routes:** kebab-case (e.g., `submit-report.js`)
- **Functions:** camelCase (e.g., `getUserRoles`, `mapBangkitDataToSheetRow`)
- **Constants:** UPPER_SNAKE_CASE for environment variables

### Authentication Patterns
**DO:**
```javascript
import { useSession } from 'next-auth/react';
const { data: session, status } = useSession();
```

**DO NOT:**
- Hardcode admin emails in components
- Use client-side only auth checks for sensitive operations
- Skip server-side validation

### Authorization Pattern
**Server-side API routes:**
```javascript
import { getUserRoles, hasRole } from '../../lib/auth';

export default async function handler(req, res) {
  const email = req.headers['x-user-email'];
  const roles = await getUserRoles(email);

  if (!hasRole(roles, 'system_admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // ... rest of handler
}
```

### Data Handling

#### Dual-Write Pattern (CRITICAL)
When writing data, ALWAYS write to both systems:

```javascript
// 1. Write to Google Sheets (primary for PDF generation)
const appendRes = await sheets.spreadsheets.values.append({
  spreadsheetId: spreadsheetId,
  range: range,
  valueInputOption: 'USER_ENTERED',
  insertDataOption: 'INSERT_ROWS',
  requestBody: { values: [rowData] },
});

// 2. Write to Supabase (non-blocking, for querying)
try {
  const { data, error } = await supabase
    .from('reports')
    .insert(supabasePayload);

  if (error) throw error;

  // Log success to monitoring
  await supabase.from('dual_write_monitoring').insert({
    status: 'success',
    // ... monitoring data
  });
} catch (error) {
  console.error('Supabase dual-write failed (non-blocking):', error);
  // Log failure but don't block main flow
}
```

#### Database Client Usage
```javascript
// Server-side with service role (bypasses RLS)
import { supabase } from '../../lib/supabaseClient';

// Client-side (public anon key)
import { supabase } from '../lib/supabaseClient';
```

### Error Handling

**DO:**
```javascript
try {
  const result = await someOperation();
  return res.status(200).json({ success: true, data: result });
} catch (error) {
  console.error('Descriptive error message:', error);
  return res.status(500).json({
    success: false,
    error: error.message,
    retryable: true  // if operation can be retried
  });
}
```

**DO NOT:**
- Expose sensitive error details to client
- Throw errors without logging context
- Use generic error messages

### Form Submission Pattern
```javascript
const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const response = await fetch('/api/submit-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Submission failed');
    }

    alert('Success!');
  } catch (error) {
    console.error('Submission error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    setIsSubmitting(false);
  }
};
```

### Component Patterns

**StatCard Pattern:**
```javascript
const StatCard = ({ label, value, sublabel, color = "blue" }) => (
  <div className="bg-white rounded-xl shadow-md p-6 text-center">
    <div className={`text-3xl font-extrabold text-${color}-600`}>{value}</div>
    <div className="text-gray-500 mt-1">{label}</div>
    {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
  </div>
);
```

**ToolCard Pattern:**
```javascript
const ToolCard = ({ href, title, description }) => (
  <Link
    href={href}
    className="block p-6 bg-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-transform duration-200"
  >
    <h3 className="text-xl font-bold text-blue-600 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </Link>
);
```

### Styling Rules
- **Use:** Tailwind utility classes
- **Prefer:** `rounded-xl` over `rounded-lg` for cards
- **Shadow:** `shadow-md` for cards, `shadow-xl` for hover states
- **Colors:** `blue-600` for primary, `red-600` for MIA/errors, `green-600` for success
- **DO NOT:** Use custom CSS unless absolutely necessary

### API Response Format
```javascript
// Success
return res.status(200).json({
  success: true,
  message: 'Operation successful',
  data: resultData,
  rowNumber: newRowNumber  // if applicable
});

// Error
return res.status(400).json({
  success: false,
  error: 'User-friendly error message',
  details: error.message,
  retryable: false
});
```

### Environment Variables
**Always use:**
- `NEXT_PUBLIC_` prefix for client-accessible vars
- `process.env.GOOGLE_CREDENTIALS_BASE64` for service account (decode first)
- `process.env.NEXT_PUBLIC_SUPABASE_URL` for Supabase URL
- `process.env.SUPABASE_SERVICE_ROLE_KEY` for server-side Supabase

### Console Logging
Use emoji prefixes for visibility:
```javascript
console.log('✅ Success message');
console.error('❌ Error message');
console.warn('⚠️ Warning message');
console.log('📊 Data operation');
console.log('🔄 Processing...');
```

## Critical Gotchas

### DO NOT:
1. **Skip dual-write** - MUST write to both Google Sheets AND Supabase
2. **Use App Router** - This project uses Pages Router only
3. **Hardcode sheet IDs** - Always use environment variables
4. **Skip cache invalidation** - Invalidate cache after data mutations
5. **Expose service credentials** - Never send to client
6. **Use inline styles** - Use Tailwind classes only
7. **Skip validation** - Validate on both client and server
8. **Forget timeout handling** - Use Promise.race for Google Sheets API calls
9. **Mix program types** - Bangkit and Maju have separate endpoints
10. **Skip monitoring logs** - Always log to `dual_write_monitoring` table

### DO:
1. **Handle null sessions** - Always check `if (!session) return null`
2. **Use kebab-case for routes** - `/laporan-bangkit` not `/laporanBangkit`
3. **Normalize emails** - `email.toLowerCase().trim()`
4. **Add loading states** - Show feedback during async operations
5. **Include retry logic** - For network operations
6. **Cache mentor-mentee mappings** - Use `lib/simple-cache`
7. **Add descriptive comments** - Especially for column mappings
8. **Use semantic commit messages** - `feat:`, `fix:`, `refactor:`
9. **Test timeout scenarios** - Google Sheets API is slow
10. **Preserve legacy compatibility** - Apps Script still generates PDFs

## Program-Specific Rules

### Bangkit Reports
- Endpoint: `/api/submitReport`
- Sheet: `GOOGLE_SHEETS_REPORT_ID`
- Tab: `Bangkit`
- Sessions: 1-4
- Fields: Requires `gwSkor` (GrowthWheel scores array)

### Maju Reports
- Endpoint: `/api/submitMajuReport`
- Sheet: `GOOGLE_SHEETS_MAJU_REPORT_ID`
- Tab: `LaporanMajuUM`
- Sessions: 1-4
- Fields: Includes financial data, structured initiatives

### Upward Mobility
- Endpoint: `/api/submit-upward-mobility`
- Sheet: `GOOGLE_SHEET_ID_UM`
- Admin-only manual submission
- Tracks economic advancement metrics

## Common Patterns to Follow

### Image Upload
```javascript
const formData = new FormData();
formData.append('image', file);
formData.append('menteeFolder', menteeName);

const response = await fetch('/api/upload-image', {
  method: 'POST',
  body: formData
});
```

### Cache Invalidation
```javascript
import cache from '../../lib/simple-cache';

// After data mutation
cache.delete(`mentor-stats:${mentorEmail}`);
cache.delete('mapping:bangkit');
```

### Date Formatting
```javascript
import { format } from 'date-fns';

const formattedDate = format(new Date(), 'dd/MM/yyyy');
```

## Testing Checklist
- [ ] Test both Bangkit and Maju flows
- [ ] Verify dual-write to both systems
- [ ] Check cache invalidation
- [ ] Test MIA status transitions
- [ ] Verify image uploads to Google Drive
- [ ] Check timeout handling (10s limit)
- [ ] Test with null/missing data
- [ ] Verify RBAC permissions
- [ ] Test on mobile viewport
- [ ] Check console for errors

## When in Doubt
- Check existing patterns in similar files
- Prefer explicit over implicit
- Log extensively with emoji prefixes
- Document complex column mappings
- Add validation at boundaries
- Keep dual-write non-blocking for Supabase
