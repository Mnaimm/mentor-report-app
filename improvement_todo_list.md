# Mentoring Report System - Improvement To-Do List

## Phase 1: Template Updates (Your Tasks)

### Sesi 1 Template
- [x] **Keep existing table structure** - Don't replace the complex Inisiatif Utama table
- [x] **Add placeholders within table cells**:
  - Middle column: `{{Inisiatif_Focus_Content}}`
  - Right column: `{{Inisiatif_Keputusan_Content}}`
- [x] **Add session tracking placeholders**:
  - `{{Tarikh Sesi}}` for current session date
  - `{{Mod Sesi}}` for session mode

### Sesi 2-4 Template
- [x] **Update Sesi Mentoring table** with fixed placeholders:
  ```
  | 1 | {{Sesi1_Date}} | {{Sesi1_Mode}} |
  | 2 | {{Sesi2_Date}} | {{Sesi2_Mode}} |
  | 3 | {{Sesi3_Date}} | {{Sesi3_Mode}} |
  | 4 | {{Sesi4_Date}} | {{Sesi4_Mode}} |
  ```
- [ ] **Update Rumusan Sesi table** with content placeholders:
  - Left column: `{{Previous_Session_Updates}}`
  - Right column: `{{Current_Session_Focus}}`

---

## Phase 2: Apps Script Core Fixes (High Priority)

### Critical Fixes
- [x] **Fix table content building** ✅ - **UPDATED** with business category approach:
  - [x] Replaced complex table manipulation with simple placeholder replacement ✅
  - [x] Created focus area mapping for business categories (Konsep Bisnes, Organisasi, Hubungan Pelanggan, Operasi) ✅
  - [x] Uses category-specific placeholders: `{{Konsep_Bisnes_Focus}}`, `{{Konsep_Bisnes_Keputusan}}`, etc. ✅
  - [x] Added `buildBusinessCategoryContent_()` function with intelligent mapping ✅
  - [x] Handles multiple inisiatif per category (combines them) ✅
  - [x] Leaves unused categories empty ✅
  - [x] Added comprehensive test functions: `testBusinessCategoryContent()`, `testMultipleInisiatifSameCategory()`, `testRealWorldFocusAreas()` ✅
  - [x] **PRODUCTION TESTED** - Successfully processed real data and identified/fixed missing mappings ✅
  - [x] Added mappings for real-world focus areas: "Product Portfolio:", "Business Process", "Marketing" ✅
  - [x] **CORRECTED** Marketing mapping: Moved from Konsep Bisnes → Hubungan Pelanggan ✅
  - [x] **COMPREHENSIVE MAPPING UPDATE** - Added all 20 official business subcategories ✅
    - **Konsep Bisnes**: Business Idea, Product Portfolio, Revenue Model, Customer Portfolio, Market Position
    - **Organisasi**: Ownership & Board, Employees, Partnership, Business Process, Legal Issue
    - **Hubungan Pelanggan**: Networking, Marketing, Sale & Service, Communication & PR, Branding
    - **Operasi**: Financial, Funding, Production & Deliveries, IT Systems, Facilities
  - [x] Added comprehensive test function: `testComprehensiveMapping()` ✅
  - [x] Full case-insensitive coverage with English/Malay variants ✅

- [x] **Implement proper session history tracking** ✅ - **COMPLETED & ENHANCED**:
  - [x] Updated Sesi 2-4 processing to use simple placeholder replacement ✅
  - [x] Added `buildSessionHistory_()` function for chronological session data ✅
  - [x] Implemented session date/mode placeholders: `{{Sesi1_Date}}`, `{{Sesi1_Mode}}`, etc. ✅
  - [x] **SESSION-SPECIFIC RUMUSAN TABLES** - Only fills current session's table ✅
    - **Sesi 2 doc**: Only fills `{{Sesi2_ISU_UTAMA}}` + `{{Sesi2_LANGKAH_KEHADAPAN}}`
    - **Sesi 3 doc**: Only fills `{{Sesi3_ISU_UTAMA}}` + `{{Sesi3_LANGKAH_KEHADAPAN}}`
    - **Sesi 4 doc**: Only fills `{{Sesi4_ISU_UTAMA}}` + `{{Sesi4_LANGKAH_KEHADAPAN}}`
  - [x] Added `buildSessionIsuUtama_()` - Gets updates from previous session (N-1) ✅
  - [x] Added `buildSessionLangkahKehadapan_()` - Current session focus + actions ✅
  - [x] Future session tables remain empty (placeholders unfilled) ✅
  - [x] Added comprehensive test function: `testSessionSpecificRumusan()` ✅
  - [x] Replaced complex table manipulation with simple text replacement ✅

- [ ] **Create consistent field mapping**:
  - Build mapping between frontend form fields and backend sheet columns
  - Normalize data structure between systems
  - Handle field name discrepancies

### Data Processing
- [ ] **Add comprehensive data validation**:
  - Validate required fields by session type
  - Check session continuity (can't skip sessions)
  - Verify inisiatif data completeness
  - Validate image links format

- [ ] **Fix kemaskiniInisiatif mapping**:
  - Ensure previous session updates appear in ISU UTAMA column
  - Map frontend "kemaskiniInisiatif" to backend update fields
  - Build proper update summary text

- [ ] **Enhance Rumusan Sesi processing**:
  - Build previous updates summary from completed sessions
  - Combine with current session focus areas
  - Handle empty/missing previous data

---

## Phase 3: Image Processing Improvements (Medium Priority)

### Quality Issues
- [ ] **Reduce compression aggressiveness**:
  - Increase target size from 600KB to 750KB
  - Start with higher quality (0.85 instead of 0.7)
  - Use more gradual quality reduction steps

- [ ] **Improve dimension handling**:
  - Increase max dimension from 800px to 1200px
  - Use better image smoothing algorithms
  - Preserve aspect ratios more carefully

### Upload Reliability
- [ ] **Add image validation**:
  - Validate file types before processing
  - Check minimum/maximum dimensions
  - Verify file integrity

- [ ] **Implement retry logic**:
  - Retry failed uploads with exponential backoff
  - Handle network timeouts gracefully
  - Provide better error messages to users

---

## Phase 4: Frontend Enhancements (Medium Priority)

### User Experience
- [ ] **Enhanced form validation**:
  - Client-side validation before submission
  - Real-time field validation feedback
  - Better error message specificity

- [ ] **Improve progress feedback**:
  - Show upload progress for each image
  - Display processing status during compression
  - Provide estimated time remaining

- [ ] **Better draft handling**:
  - More reliable autosave functionality
  - Draft conflict resolution
  - Clear draft restoration messaging

### Error Handling
- [ ] **Enhanced error recovery**:
  - Allow retry of individual failed uploads
  - Partial submission capability
  - Better error categorization (temporary vs permanent)

- [ ] **User feedback improvements**:
  - Clearer success/failure messaging
  - Actionable error instructions
  - Progress indicators during long operations

---

## Phase 5: System Reliability (Lower Priority)

### Monitoring & Logging
- [ ] **Add execution logging**:
  - Track processing success/failure rates
  - Log performance metrics
  - Monitor error patterns

- [ ] **Implement health checks**:
  - Verify template accessibility
  - Check sheet permissions
  - Validate folder structure

### Performance
- [ ] **Optimize document processing**:
  - Batch text replacements
  - Reduce number of document operations
  - Cache frequently accessed data

- [ ] **Improve error recovery**:
  - Graceful degradation for non-critical errors
  - Rollback capability for failed processing
  - Better lock management

---

## Implementation Priority Order

1. **Template placeholder additions** (Phase 1) - Foundation work
2. **Table content building logic** - Fixes core document generation issue
3. **Session history tracking** - Ensures Sesi 2-4 work properly
4. **Field mapping standardization** - Prevents data loss/corruption
5. **Image compression improvements** - Addresses quality complaints
6. **Form validation enhancements** - Prevents user errors
7. **Upload reliability** - Reduces failure rates
8. **User experience improvements** - Polish and usability
9. **System monitoring** - Long-term maintenance

---

## Success Criteria

### Must Have
- [ ] Inisiatif Utama table displays correctly in Sesi 1
- [ ] Sesi Mentoring table shows all historical sessions in Sesi 2+
- [ ] Previous session updates appear in Rumusan Sesi ISU UTAMA column
- [ ] Images maintain acceptable quality after compression
- [ ] No data loss between frontend submission and backend processing

### Nice to Have
- [ ] Better user feedback during processing
- [ ] Retry capability for failed operations
- [ ] Performance monitoring and alerts
- [ ] Automated error recovery

---

## Notes

- Work **with** existing template structure rather than replacing it
- Focus on data consistency between frontend and backend
- Prioritize fixes that prevent document generation failures
- Image quality improvements should balance file size constraints
- All changes should be backward compatible with existing data