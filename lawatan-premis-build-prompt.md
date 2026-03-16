# Build Lawatan Premis Dashboard - Complete Specification

## Project Context
We're building a **read-only monitoring dashboard** for tracking premise visits (lawatan premis) in a mentor-mentee program. This is part of an existing Next.js application that manages mentor programs (Bangkit, Maju, TUBF).

## File to Create
`/pages/admin/lawatan-premis.js`

## Reference Files (Study these patterns)
1. `/pages/admin/dashboard.js` - For UI patterns, auth, read-only badge, filtering
2. `/lib/auth.js` - For `canAccessAdmin()` and `isReadOnly()` functions
3. Existing API patterns in `/api/admin/` directory

---

## 1. DATA SOURCES (All from Google Sheets)

### Source 1: Upward Mobility Forms
- **Sheet Tab**: "UM" or "Upward Mobility"
- **Key Column**: `tarikhLawatanPremis` (date field)
- **Contains**: Actual date when premise visit happened
- **Priority**: PRIMARY source (most reliable)

### Source 2: Bangkit Session Reports
- **Sheet Tab**: "Laporan Bangkit"
- **Key Column**: `lawatanPremis` (boolean/checkbox)
- **Contains**: TRUE if visit completed, FALSE if not
- **Priority**: SECONDARY (for Bangkit program only)

### Source 3: Maju Session Reports
- **Sheet Tab**: "Laporan Maju"
- **Key Column**: `lawatanPremis` (boolean/checkbox)
- **Contains**: TRUE if visit completed, FALSE if not
- **Priority**: SECONDARY (for Maju program only)

---

## 2. DATA AGGREGATION LOGIC

### Status Calculation Priority:
```javascript
function calculateLawatanStatus(mentee, umData, reportData, batchInfo) {
  // 1. Check UM form for date (PRIMARY)
  if (mentee.tarikhLawatanPremis) {
    return {
      status: 'completed',
      visitDate: mentee.tarikhLawatanPremis,
      source: 'UM Form'
    };
  }
  
  // 2. Check session reports for boolean (SECONDARY)
  if (reportData.lawatanPremis === true) {
    return {
      status: 'completed',
      visitDate: null, // No date available
      source: mentee.program === 'Bangkit' ? 'Laporan Bangkit' : 'Laporan Maju'
    };
  }
  
  // 3. Not completed - determine if overdue or just pending
  const currentRound = batchInfo.currentRound;
  
  if (currentRound >= 2) {
    return {
      status: 'overdue', // Should be done by Round 2
      visitDate: null,
      source: '-'
    };
  }
  
  return {
    status: 'pending', // Round 1, still early
    visitDate: null,
    source: '-'
  };
}
```

### Only 3 Status Categories:
1. **✅ Selesai (Completed)** - Has date OR boolean is true
2. **⚠️ Tertunggak (Overdue)** - No completion AND batch is in Round 2+
3. **⏳ Belum Selesai (Pending)** - No completion but batch still in Round 1

---

## 3. API ENDPOINT TO CREATE

### File: `/api/admin/lawatan-premis.js`

```javascript
// Expected query params:
// - program (optional): 'bangkit', 'maju', 'tubf', or 'all'
// - batch (optional): specific batch name or 'all'
// - refresh (optional): 'true' to bypass cache

export default async function handler(req, res) {
  // 1. Authentication check
  const session = await getSession({ req });
  if (!session) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  
  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);
  if (!hasAccess) {
    return res.status(403).json({ success: false, error: 'Access denied' });
  }
  
  // 2. Get filter params
  const { program = 'all', batch = 'all', refresh = 'false' } = req.query;
  
  // 3. Check cache (5 minute TTL)
  const cacheKey = `lawatan-${program}-${batch}`;
  if (refresh !== 'true' && cache[cacheKey]) {
    const age = (Date.now() - cache[cacheKey].timestamp) / 1000;
    if (age < 300) { // 5 minutes
      return res.json({
        success: true,
        ...cache[cacheKey].data,
        cached: true,
        cacheAge: Math.round(age)
      });
    }
  }
  
  // 4. Fetch from Google Sheets
  const umData = await readFromSheet('UM');
  const bangkitReports = await readFromSheet('Laporan Bangkit');
  const majuReports = await readFromSheet('Laporan Maju');
  const batchesData = await getBatchesInfo(); // For current round info
  
  // 5. Aggregate data
  const allVisits = aggregateLawatanData(
    umData, 
    bangkitReports, 
    majuReports, 
    batchesData
  );
  
  // 6. Apply filters
  let filteredVisits = allVisits;
  if (program !== 'all') {
    filteredVisits = filteredVisits.filter(v => 
      v.program.toLowerCase() === program.toLowerCase()
    );
  }
  if (batch !== 'all') {
    filteredVisits = filteredVisits.filter(v => v.batch === batch);
  }
  
  // 7. Calculate summary stats
  const summary = {
    totalVisits: filteredVisits.length,
    completed: filteredVisits.filter(v => v.status === 'completed').length,
    pending: filteredVisits.filter(v => v.status === 'pending').length,
    overdue: filteredVisits.filter(v => v.status === 'overdue').length,
    withDate: filteredVisits.filter(v => v.visitDate !== null).length
  };
  
  // 8. Cache and return
  const responseData = {
    success: true,
    summary,
    visits: filteredVisits,
    filters: { program, batch },
    lastUpdated: new Date().toISOString()
  };
  
  cache[cacheKey] = {
    data: responseData,
    timestamp: Date.now()
  };
  
  return res.json(responseData);
}
```

---

## 4. FRONTEND PAGE STRUCTURE

### Authentication & Authorization (Same as admin/dashboard.js)
```javascript
export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);

  if (!hasAccess) {
    return {
      props: {
        accessDenied: true,
        userEmail,
      },
    };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);

  return {
    props: {
      userEmail,
      isReadOnlyUser,
    },
  };
}
```

### Main Component Structure
```javascript
export default function LawatanPremisDashboard({ userEmail, isReadOnlyUser, accessDenied }) {
  // States
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  // Timestamps
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // If access denied, show AccessDenied component
  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }
  
  // Fetch data function
  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const url = forceRefresh
        ? `/api/admin/lawatan-premis?program=${filterProgram}&batch=${filterBatch}&refresh=true`
        : `/api/admin/lawatan-premis?program=${filterProgram}&batch=${filterBatch}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API responded with status: ${res.status}`);
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch data');
      
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [filterProgram, filterBatch]); // Re-fetch when filters change
  
  // ... rest of component
}
```

---

## 5. UI COMPONENTS NEEDED

### A. Batch/Program Selector (Top of page)
- Visual mockup reference: See the gradient indigo box in mockup
- Dropdowns for Program and Batch selection
- "Terapkan" button to apply filters
- "Reset" button to clear filters
- Shows current view indicator (e.g., "Semua Program - 156 lawatan")

### B. Summary Cards (5 cards)
1. **Jumlah Lawatan** - Total visits
2. **Selesai** - Completed (with progress bar)
3. **Belum Selesai** - Pending
4. **Tertunggak** - Overdue (red theme)
5. **Dengan Tarikh** - Visits with recorded dates (purple theme)

### C. Alert Box
- Only ONE alert: "🚨 X Lawatan Tertunggak"
- Shows count of overdue visits
- Click "Lihat Senarai →" to filter table to overdue only

### D. Filters Section
- Search bar (mentee/mentor name)
- Program dropdown
- Batch dropdown
- Status dropdown (Semua, Selesai, Tertunggak, Belum Selesai)
- Date range pickers (Tarikh Mula, Tarikh Tamat)
- Quick filter buttons:
  - ⚠️ Tertunggak (X)
  - ⏳ Belum Selesai (X)
  - ✅ Selesai (X)
  - 📅 Ada Tarikh (X)

### E. Table with Columns
1. Checkbox (for bulk selection)
2. Usahawan (Mentee name + email)
3. Mentor (Mentor name + email)
4. Program / Batch
5. Status (badge: ✅ Selesai / ⚠️ Tertunggak / ⏳ Belum Selesai)
6. Tarikh Lawatan (date or "Belum selesai" or "Tarikh tidak direkod")
7. Sumber Data (UM Form / Laporan Bangkit / Laporan Maju / -)
8. Tindakan (buttons: "Lihat" / "Hubungi Mentor")

### F. Pagination
- Show "X-Y daripada Z lawatan"
- Previous/Next buttons
- Page numbers (1, 2, 3, ..., Last)

---

## 6. KEY FEATURES

### ✅ Features to Implement:
1. **Read-only monitoring** - No editing/scheduling capability
2. **Batch filtering at top** - Recalculates ALL stats when changed
3. **Status badges** - Color-coded (green=completed, red=overdue, grey=pending)
4. **Search functionality** - By mentee or mentor name
5. **Quick filters** - One-click to show specific status
6. **Export button** - Download filtered data as CSV
7. **Bulk reminder** - Send emails to selected mentors
8. **Responsive design** - Hide columns on mobile (like admin/dashboard)
9. **Caching** - 5-minute cache on API responses
10. **Loading states** - Spinner while fetching
11. **Error handling** - User-friendly error messages
12. **Relative dates** - "38 hari yang lalu" for past dates

### ❌ Features NOT to Implement:
1. ~~Scheduling new visits~~
2. ~~Editing visit dates~~
3. ~~Manually marking as complete~~
4. ~~Calendar view~~ (Phase 2)
5. ~~Future/upcoming visits~~ (data doesn't support this)

---

## 7. STYLING GUIDELINES

### Use Existing Patterns from admin/dashboard.js:
- Tailwind CSS for all styling
- Same color scheme (blues, purples, greens, reds)
- Same component patterns (cards, badges, buttons)
- Same table styling
- Same responsive breakpoints

### Status Colors:
- **Completed**: Green (`bg-green-100 text-green-800`)
- **Overdue**: Red (`bg-red-100 text-red-800`)
- **Pending**: Grey (`bg-gray-100 text-gray-800`)

### Card Colors:
- Total: Grey/Blue
- Completed: Green
- Pending: Blue/Grey
- Overdue: Red
- With Date: Purple

---

## 8. IMPORTANT NOTES

### Data is Historical Only:
- All `tarikhLawatanPremis` dates are PAST dates (when visit already happened)
- No future scheduled dates
- Status reflects what's already done vs what should be done
- Use past tense: "38 hari yang lalu" not "dalam 3 hari"

### Overdue Logic:
```javascript
// A visit is overdue if:
// - Not completed (no date, no boolean)
// - AND batch is in Round 2 or later
const isOverdue = !hasLawatan && batchCurrentRound >= 2;
```

### Source Priority:
1. If `tarikhLawatanPremis` exists → Use this (show date)
2. Else if `lawatanPremis` boolean is TRUE → Mark completed (no date)
3. Else → Check if overdue or pending based on round

### Read-Only Badge:
- Import and use `<ReadOnlyBadge>` component if `isReadOnlyUser` is true
- Same as admin/dashboard.js pattern

---

## 9. TESTING CHECKLIST

Before considering complete, test:
- [ ] Authentication works (redirects if not logged in)
- [ ] Authorization works (shows AccessDenied if not admin)
- [ ] Read-only badge shows for read-only users
- [ ] Batch selector updates all summary cards
- [ ] Batch selector filters table correctly
- [ ] Search filters mentee/mentor names
- [ ] Status filter works
- [ ] Quick filter buttons work
- [ ] Pagination works
- [ ] "Lihat Senarai" in alert box filters to overdue
- [ ] Overdue rows have red background
- [ ] Export button (can be placeholder for now)
- [ ] Bulk reminder button (can be placeholder for now)
- [ ] Loading spinner shows during fetch
- [ ] Error message shows if API fails
- [ ] Refresh button works
- [ ] Mobile responsive (columns hide appropriately)
- [ ] Relative dates show correctly ("X hari yang lalu")

---

## 10. MOCKUP REFERENCE

A visual mockup HTML file is provided showing:
- Layout and spacing
- Color schemes
- Component placement
- Sample data
- Responsive behavior

Reference: `lawatan-premis-mockup.html`

---

## 11. ACCEPTANCE CRITERIA

### The page is complete when:
1. ✅ Admin can select program/batch and see filtered stats
2. ✅ All 5 summary cards update based on selection
3. ✅ Table shows correct data with 3 status types
4. ✅ Overdue visits are highlighted in red
5. ✅ Search and filters work correctly
6. ✅ Pagination works
7. ✅ Loads in <5 seconds with caching
8. ✅ Mobile responsive
9. ✅ Read-only users see badge
10. ✅ Non-admin users see AccessDenied

---

## 12. QUESTIONS TO RESOLVE DURING BUILD

If you encounter these scenarios, here's how to handle:

**Q: What if a mentee has multiple UM forms with different dates?**
A: Use the LATEST date (most recent `tarikhLawatanPremis`)

**Q: What if Bangkit report says TRUE but Maju report says FALSE for same mentee?**
A: Use program-specific report (Bangkit mentee → use Bangkit report)

**Q: How to get batch current round?**
A: Reference existing batch configuration (same as admin/dashboard.js uses)

**Q: What if data is missing (no mentee name, no batch)?**
A: Skip that record and log warning in API response

**Q: Export format?**
A: CSV with columns: Mentee, Mentor, Program, Batch, Status, Date, Source

---

## FINAL NOTES

- Follow existing code patterns from `/pages/admin/dashboard.js`
- Reuse components where possible (StatusBadge, ProgressBar, etc.)
- Keep it simple - read-only monitoring only
- Cache aggressively - data doesn't change minute-to-minute
- Mobile-first responsive design
- Clear, helpful error messages

Good luck building! 🚀
