# Revision Request Notification Analysis

## Current State: ❌ **PASSIVE ONLY - NO ACTIVE NOTIFICATIONS**

### Summary

When an admin requests a revision via `/api/admin/reports/[id]/request-revision.js`:
- ✅ Report status updated to `review_requested` in Supabase
- ✅ `revision_count` incremented
- ✅ Revision reasons and notes stored
- ❌ **NO email notification sent to mentor**
- ❌ **NO push notification**
- ❌ **NO dashboard alert banner**
- ❌ **NO notification badge on homepage**

**Mentor discovery method:** Entirely passive - mentor must manually visit `/mentor/my-reports` to see revision requests.

---

## Current Notification Flow

### 1. Admin Requests Revision
**File:** `pages/api/admin/reports/[id]/request-revision.js`

```javascript
// Lines 58-69: Update Supabase
const { error: updateError } = await supabase
    .from('reports')
    .update({
        status: 'review_requested',
        revision_reason: revision_reasons,
        revision_notes: revision_notes || null,
        revision_requested_by: session.user.email,
        revision_requested_at: new Date().toISOString(),
        revision_count: newRevisionCount,
        updated_at: new Date().toISOString()
    })
    .eq('id', id);

// ❌ NO EMAIL SENT HERE
// ❌ NO NOTIFICATION CREATED
```

**What happens:**
- Database updated ✅
- Sheets status synced ✅
- Admin sees success message ✅
- **Mentor receives NO notification** ❌

---

### 2. Mentor Discovery Points

#### A. Dashboard (pages/mentor/dashboard.js)
**Status:** ❌ **NO revision alerts shown**

**Current dashboard shows:**
- Total mentees count
- On-track count
- Needs action count (overdue + due soon)
- Overdue reports
- Due soon reports
- Timeline of upcoming deadlines

**Does NOT show:**
- Revision request count
- Alert banner for pending revisions
- Notification badge
- Review-requested reports

**Code evidence:**
```javascript
// Lines 258-271: Stats cards
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
  <div className="bg-white rounded-lg p-3 shadow-sm">
    <div className="text-2xl font-bold text-blue-600">{dashboardData.stats?.totalMentees || 0}</div>
    <div className="text-xs text-gray-600">Jumlah Usahawan</div>
  </div>
  <div className="bg-white rounded-lg p-3 shadow-sm">
    <div className="text-2xl font-bold text-green-600">{dashboardData.stats?.onTrack || 0}</div>
    <div className="text-xs text-gray-600">✓ Mengikut Jadual</div>
  </div>
  <div className="bg-white rounded-lg p-3 shadow-sm">
    <div className="text-2xl font-bold text-orange-600">{dashboardData.stats?.needsAction || 0}</div>
    <div className="text-xs text-gray-600">⚠️ Perlu Tindakan</div>
  </div>
</div>

// ❌ NO "review_requested" count shown
// ❌ NO alert banner for revisions
```

---

#### B. My Reports Page (pages/mentor/my-reports.js)
**Status:** ✅ **Shows revisions IF mentor visits the page**

**What it shows:**
- Alert banner if `review_requested` count > 0 (line 82-93)
- Filter tab for "Perlu Semakan" with count badge (line 114-116)
- Review requests sorted to top (line 41-42)
- Revision reasons displayed on report card (line 342-346)
- "Kemaskini Laporan" button to start revision (line 339)

**Code evidence:**
```javascript
// Lines 82-93: Alert banner (ONLY visible if on my-reports page)
{statusCounts.review_requested > 0 && (
    <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
        <div className="flex items-center gap-3">
            <div className="text-3xl">📝</div>
            <div>
                <p className="font-bold text-amber-900 text-lg mb-1">
                    Tindakan Diperlukan
                </p>
                <p className="text-amber-800">
                    Anda mempunyai <span className="font-bold">{statusCounts.review_requested} laporan</span> yang memerlukan semakan semula
                </p>
            </div>
        </div>
    </div>
)}

// Lines 114-116: Filter tab
<FilterTab
    label="Perlu Semakan"
    icon="📝"
    count={statusCounts.review_requested}
    active={activeFilter === 'review_requested'}
    onClick={() => setActiveFilter('review_requested')}
/>
```

**Limitation:** Mentor must **actively navigate** to `/mentor/my-reports` to see this.

---

## Problem Statement

### User Experience Issue

**Scenario:**
1. Admin reviews a report and requests revision at 10:00 AM
2. Mentor is logged in, working on dashboard
3. Mentor sees NO indication that action is needed
4. Mentor continues other work
5. **Hours/days later**, mentor happens to check My Reports
6. Mentor discovers the revision request (delayed response)

**Impact:**
- ❌ Delayed response to revision requests
- ❌ Missed deadlines for resubmission
- ❌ Poor user experience (passive discovery)
- ❌ No sense of urgency for revisions
- ❌ Mentors may think no issues exist

---

## Comparison: Current vs. Ideal

| Feature | Current State | Ideal State |
|---------|--------------|-------------|
| **Email notification** | ❌ None | ✅ Immediate email to mentor |
| **Dashboard alert banner** | ❌ None | ✅ "You have X reports needing revision" |
| **Dashboard badge count** | ❌ None | ✅ Badge on nav/header showing count |
| **My Reports alert** | ✅ Yes (if visited) | ✅ Yes |
| **Push notification** | ❌ None | ⚠️ Optional (requires PWA setup) |
| **In-app notification center** | ❌ None | ⚠️ Optional (future enhancement) |

---

## Recommended Improvements

### Priority 1: Dashboard Alert Banner (Quick Win)

**Add to `pages/mentor/dashboard.js` after line 244:**

```javascript
{/* REVISION REQUEST ALERT - Add this block */}
{dashboardData?.revisionRequestCount > 0 && (
  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm mb-6">
    <div className="flex items-center gap-3">
      <div className="text-3xl">📝</div>
      <div className="flex-1">
        <p className="font-bold text-amber-900 text-lg mb-1">
          Tindakan Diperlukan: Semakan Laporan
        </p>
        <p className="text-amber-800">
          Anda mempunyai <span className="font-bold">{dashboardData.revisionRequestCount} laporan</span> yang memerlukan semakan semula
        </p>
      </div>
      <button
        onClick={() => router.push('/mentor/my-reports?filter=review_requested')}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium shadow-sm whitespace-nowrap"
      >
        Lihat Laporan →
      </button>
    </div>
  </div>
)}
```

**Update API `/api/mentor/my-dashboard` to include:**
```javascript
revisionRequestCount: reports.filter(r => r.status === 'review_requested').length
```

**Effort:** 15 minutes
**Impact:** HIGH - Mentor immediately sees alert on login

---

### Priority 2: Email Notification (Moderate Implementation)

**Add to `pages/api/admin/reports/[id]/request-revision.js` after line 94:**

```javascript
// 4. SEND EMAIL NOTIFICATION TO MENTOR (NON-BLOCKING)
try {
    const emailSubject = `[iTEKAD] Laporan Memerlukan Semakan Semula - ${report.mentee_name}`;
    const emailBody = `
Dear ${report.mentor_email.split('@')[0]},

Laporan anda untuk ${report.mentee_name} (${report.program} - Sesi ${report.session_number}) memerlukan semakan semula.

SEBAB SEMAKAN DIPERLUKAN:
${revision_reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

${revision_notes ? `\nNOTA TAMBAHAN:\n${revision_notes}` : ''}

Sila log masuk ke sistem untuk mengemaskini laporan anda:
${process.env.NEXTAUTH_URL}/mentor/my-reports

Terima kasih atas kerjasama anda.

---
Sistem iTEKAD Mentor Portal
    `.trim();

    // Use your email service (SendGrid, AWS SES, etc.)
    await sendEmail({
        to: report.mentor_email,
        subject: emailSubject,
        body: emailBody
    });

    console.log(`✅ Email notification sent to ${report.mentor_email}`);
} catch (emailError) {
    console.error('⚠️ Email notification failed (non-blocking):', emailError);
    // Don't block the revision request if email fails
}
```

**Requirements:**
- Set up email service (SendGrid/AWS SES/Resend)
- Add email credentials to environment variables
- Create reusable `sendEmail` helper function

**Effort:** 2-3 hours (including email service setup)
**Impact:** VERY HIGH - Proactive notification

---

### Priority 3: Navigation Badge Count (Visual Enhancement)

**Add to main layout/header component:**

```javascript
// Show badge on "My Reports" nav link
<Link href="/mentor/my-reports">
  My Reports
  {revisionCount > 0 && (
    <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
      {revisionCount}
    </span>
  )}
</Link>
```

**Effort:** 30 minutes
**Impact:** MEDIUM - Visual reminder in navigation

---

## Implementation Checklist

### Phase 1: Quick Wins (1 hour)
- [ ] Add `revisionRequestCount` to `/api/mentor/my-dashboard` response
- [ ] Add alert banner to `pages/mentor/dashboard.js`
- [ ] Test banner appears when revision_count > 0
- [ ] Test "Lihat Laporan" button navigation

### Phase 2: Email Notifications (3 hours)
- [ ] Choose email service (SendGrid/AWS SES/Resend)
- [ ] Add email credentials to environment variables
- [ ] Create `lib/email.js` helper with `sendEmail` function
- [ ] Update `request-revision.js` to send email
- [ ] Test email delivery
- [ ] Update email template for production

### Phase 3: Visual Enhancements (1 hour)
- [ ] Add badge count to navigation
- [ ] Add favicon notification dot (optional)
- [ ] Test visual indicators

### Phase 4: Optional Advanced Features
- [ ] In-app notification center
- [ ] Browser push notifications (requires PWA setup)
- [ ] SMS notifications (for urgent cases)

---

## Testing Checklist

### Test Scenario 1: Dashboard Alert
1. Login as mentor
2. Admin requests revision on one of mentor's reports
3. Mentor refreshes dashboard
4. **Expected:** Alert banner appears with count and "Lihat Laporan" button
5. Click button
6. **Expected:** Navigate to My Reports with `review_requested` filter active

### Test Scenario 2: Email Notification
1. Admin requests revision
2. **Expected:** Mentor receives email within 1 minute
3. Email contains:
   - Report details (mentee name, program, session)
   - List of revision reasons
   - Notes (if any)
   - Direct link to My Reports page

### Test Scenario 3: Multiple Revisions
1. Admin requests revisions on 3 different reports
2. **Expected:** Dashboard shows "3 laporan"
3. My Reports shows all 3 with "Perlu Semakan" badge
4. Email sent for each revision (3 separate emails)

---

## Current Workaround

**For mentors to check for revisions:**
1. Navigate to `/mentor/my-reports`
2. Look for alert banner (appears if revisions exist)
3. Click "Perlu Semakan" tab to filter
4. Review revision reasons
5. Click "Kemaskini Laporan" to revise

**This works, but is entirely passive** - mentors must remember to check.

---

## Conclusion

**Current State:** ❌ **Passive discovery only**
- No email notification
- No dashboard alert
- No badge counts
- Mentor must manually visit My Reports page

**Recommended Priority:**
1. **Dashboard alert banner** (quick win, high impact)
2. **Email notification** (moderate effort, very high impact)
3. **Navigation badges** (low effort, medium impact)

**Estimated Total Implementation Time:** 5-6 hours for all three priorities

Would you like me to implement the dashboard alert banner first? It's a 15-minute change with immediate UX improvement.
