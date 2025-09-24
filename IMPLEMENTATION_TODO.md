# iTEKAD MAJU Document Generation - Implementation To-Do List

## 🎯 **PHASE 1: Fix Sesi 1 Table Placement**
- [ ] **1.1** Deploy enhanced table insertion debugging version
- [ ] **1.2** Test Sesi 1 form submission with comprehensive logging
- [ ] **1.3** Analyze MajuTemplateAnalysis and MajuExecutionLogs for table placement issues
- [ ] **1.4** Fix direct replacement logic for `{{DATA_KEWANGAN_BULANAN_TABLE}}`
- [ ] **1.5** Fix direct replacement logic for `{{MENTORING_FINDINGS_TABLE}}`
- [ ] **1.6** Verify tables appear in template areas (not at document end)
- [ ] **1.7** Verify MAKLUMAT SESI placeholders work correctly
- [ ] **1.8** Test image placement in designated areas (not first page)

**Success Criteria for Phase 1:**
- ✅ Sesi 1 creates new document with all data in correct template positions
- ✅ No data appears at document end
- ✅ All placeholders replaced properly

---

## 🔄 **PHASE 2: Restructure Sesi 2+ Logic**
- [ ] **2.1** Change core logic: Remove `appendToExistingDocument` path for regular sessions
- [ ] **2.2** Create new `createProgressiveDocument()` function for Sesi 2+
- [ ] **2.3** Implement progressive data collection from all previous sessions
- [ ] **2.4** Build accumulated financial data (all months from all sessions)  
- [ ] **2.5** Build progressive mentoring findings with topic matching
- [ ] **2.6** Update document naming: `NAIM_Nisha_Sesi2_LaporanMaju` format
- [ ] **2.7** Ensure previous documents remain untouched

**Success Criteria for Phase 2:**
- ✅ Each session creates NEW independent document
- ✅ Sesi 2+ documents contain ALL accumulated data from previous sessions
- ✅ Previous session documents remain unchanged

---

## 📊 **PHASE 3: Progressive Data Integration**
- [ ] **3.1** Implement financial data merging logic
  - [ ] Collect all DATA_KEWANGAN_BULANAN_JSON from previous sessions
  - [ ] Merge into single comprehensive table
  - [ ] Maintain month order and data integrity
- [ ] **3.2** Implement mentoring findings progression logic
  - [ ] Collect all MENTORING_FINDINGS_JSON from previous sessions
  - [ ] Match topics by name (case-insensitive)
  - [ ] Update existing topics with new progress
  - [ ] Add new topics from current session
- [ ] **3.3** Handle image accumulation
  - [ ] Collect images from all previous sessions
  - [ ] Organize by session in designated template areas
- [ ] **3.4** Progressive reflection and summary data

**Success Criteria for Phase 3:**
- ✅ Financial tables show complete progression (Month 1, 2, 3, etc.)
- ✅ Mentoring tables show topic updates + new topics
- ✅ All data properly placed in template areas

---

## 🧪 **PHASE 4: Testing & Validation**
- [ ] **4.1** Test complete Sesi 1 → Sesi 2 → Sesi 3 flow
- [ ] **4.2** Verify document independence (edit Sesi 1, check Sesi 2 unchanged)
- [ ] **4.3** Test topic matching logic with various scenarios:
  - [ ] Exact topic name match
  - [ ] Case differences
  - [ ] Partial topic updates
  - [ ] All new topics
- [ ] **4.4** Test financial data accumulation accuracy
- [ ] **4.5** Verify image placement across sessions
- [ ] **4.6** Test bulk regeneration functions
- [ ] **4.7** Performance testing with multiple mentees/sessions

**Success Criteria for Phase 4:**
- ✅ Complete mentoring workflow works end-to-end
- ✅ Data accuracy maintained across all sessions
- ✅ Performance acceptable for production use

---

## 🚀 **PHASE 5: Production Readiness**
- [ ] **5.1** Clean up debug logging (keep essential logs only)
- [ ] **5.2** Add comprehensive error handling for edge cases
- [ ] **5.3** Document administrator functions for bulk operations
- [ ] **5.4** Create user documentation for mentors
- [ ] **5.5** Set up monitoring and maintenance procedures

**Success Criteria for Phase 5:**
- ✅ System ready for full production deployment
- ✅ Administrative tools available for bulk operations
- ✅ Documentation complete for users and administrators

---

## 📋 **CURRENT STATUS - SEPTEMBER 24, 2025**

### ✅ **COMPLETED TODAY:**
- Fixed SpreadsheetApp permission issue (corrected SPREADSHEET_ID typo)
- Document generation now working (confirmed document creation successful)
- Enhanced permission testing infrastructure (`testPermissions`, `testSimpleDocCreation`)
- Simplified placeholder logic (exact matches instead of multiple variations)
- Fixed variable reference errors (`financialPlaceholders` → `financialPlaceholder`)
- Updated environment with latest deployment URL

### 🚨 **CURRENT ISSUES IDENTIFIED:**
1. **Table Placement**: Tables still appearing at document END instead of replacing placeholders
2. **Sesi 2+ Logic**: Overwrites Sesi 1 document instead of creating new document

### 🔄 **IN PROGRESS:**
- **Phase 1**: Table placement debugging and fixes
- **Current Focus**: Why `{{DATA_KEWANGAN_BULANAN_TABLE}}` and `{{MENTORING_FINDINGS_TABLE}}` aren't being replaced

### ⏳ **PENDING:**
- Fix placeholder replacement logic in `insertTableFromJson` function
- Implement proper Sesi 2+ NEW document creation strategy
- Progressive data accumulation
- End-to-end testing

---

## 🎯 **DETAILED ACTION PLAN FOR TOMORROW**

### **PRIORITY 1: Fix Table Placement (Issue 1)**

#### **Task 1.1: Debug Placeholder Replacement**
- [ ] Add console logging to `insertTableFromJson` function
- [ ] Check if `findText({{DATA_KEWANGAN_BULANAN_TABLE}})` returns valid range
- [ ] Verify placeholder exists exactly as expected in template
- [ ] Test direct text replacement without table insertion

#### **Task 1.2: Test Placeholder Search Logic**
- [ ] Create simple test function: `testFindPlaceholder()`
- [ ] Test with exact string: `{{DATA_KEWANGAN_BULANAN_TABLE}}`
- [ ] Verify `body.getText().includes()` vs `body.findText()` results
- [ ] Check for hidden characters or formatting issues

#### **Task 1.3: Fix Table Insertion Logic**
- [ ] Review `insertTableFromJson` element-by-element search
- [ ] Fix direct paragraph replacement approach
- [ ] Ensure table gets inserted at correct index position
- [ ] Test with simplified table insertion (no complex search)

### **PRIORITY 2: Fix Sesi 2+ Document Strategy (Issue 2)**

#### **Task 2.1: Analyze Current Logic**
- [ ] Review `processMajuRow` function decision tree
- [ ] Check why Sesi 2+ calls `appendToExistingDocument` instead of new creation
- [ ] Identify where existing document ID is being reused

#### **Task 2.2: Implement New Document Strategy**
- [ ] Modify logic: ALL sessions create NEW documents
- [ ] Create `createProgressiveDocument()` function
- [ ] Collect data from ALL previous sessions for current document
- [ ] Test Sesi 1 → Sesi 2 creates 2 separate documents

### **QUICK WINS TO TRY FIRST:**
1. **Simple Placeholder Test**: Create test function that only does placeholder replacement
2. **Check Template**: Verify exact placeholder text in Google Docs template
3. **Disable Fallback**: Comment out fallback table insertion to force placeholder replacement
4. **Test in Isolation**: Create minimal document with just placeholders for testing

---

## 🔧 **TECHNICAL CONTEXT FOR TOMORROW**

### **Current System State:**
- ✅ **Apps Script URL**: `AKfycbwexs7_5wKfJyFFwp1oYBY0hOKbAOqd227T2Vg1Ee6_a7ourbCR7ehZtDgJJr7CUJ5fMA`
- ✅ **Permissions**: All working (Sheets, Docs, Drive access confirmed)
- ✅ **Document Creation**: Working (documents are being created)
- ❌ **Table Placement**: Tables at end instead of replacing placeholders
- ❌ **Sesi 2+ Logic**: Overwrites instead of creating new documents

### **Files to Focus On:**
- `appsscript-2/Code.js` - Main logic file
- `insertTableFromJson` function - Table placement logic
- `processMajuRow` function - Session decision logic
- Google Docs template - Verify exact placeholder format

### **Success Metrics for Tomorrow:**
- [ ] Tables appear in template middle sections (not at end)
- [ ] Sesi 2 creates NEW document (doesn't modify Sesi 1 document)
- [ ] Both financial and mentoring tables placed correctly

---

**Last Updated:** September 24, 2025 8:30 PM  
**Current Focus:** Fix table placement issue, then tackle Sesi 2+ new document strategy  
**Next Session Goal:** Get tables in correct positions within 1 hour of debugging