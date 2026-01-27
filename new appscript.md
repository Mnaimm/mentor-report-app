I need you to build a Google Apps Script from scratch for the Bangkit mentoring program that generates "Laporan Bangkit" documents with upward mobility tracking. Destination C:\Users\MyLenovo\Downloads\mentor-report\appscript-5

REFERENCE FILES (for compatibility):
1. C:\Users\MyLenovo\Downloads\mentor-report\appsscript-1\Code.js - Current AppScript implementation
2. C:\Users\MyLenovo\Downloads\mentor-report\pages\api\upload-proxy.js - File upload proxy
3. C:\Users\MyLenovo\Downloads\mentor-report\pages\api\submitBangkit.js - Form submission API
4. C:\Users\MyLenovo\Downloads\mentor-report\pages\laporan-bangkit.js - Frontend form

REQUIREMENTS:

1. GOOGLE SHEETS CONFIGURATION:
   - Sheet ID: 1yjxwqXSO8jtR-nbHA5X4h4YcNzC6jh0zCRsTkYovS7w
   - Tab name for new rows: "Bangkit"
   - Mapping tab name: "Mapping" (for mentor-mentee assignments and folder IDs)

2. TEMPLATE DOCUMENTS:
   - Sesi 1 Template ID: 1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI
   - Sesi 2/3/4 Template ID: 1JsSwCJK5SHrTQi5gSXgBa4ZPYws_52eiu-sE0ADvEVQ

3. BANGKIT SHEET HEADERS (Column Mappings):
```javascript
const BANGKIT_HEADERS = {
  // Basic Session Info
  Timestamp: 'Timestamp',
  Emai: 'Emai',
  StatusSesi: 'Status Sesi',
  SesiLaporan: 'Sesi Laporan',
  TarikhSesi: 'Tarikh Sesi',
  MasaSesi: 'Masa Sesi',
  ModSesi: 'Mod Sesi',
  NamaUsahawan: 'Nama Usahawan',
  NamaBisnes: 'Nama Bisnes',
  NamaMentor: 'Nama Mentor',
  
  // Session Content
  Update1: 'Update Keputusan Terdahulu 1',
  RingkasanSesi: 'Ringkasan Sesi',
  Fokus1: 'Fokus Area 1',
  Keputusan1: 'Keputusan 1',
  Tindakan1: 'Cadangan Tindakan 1',
  Fokus2: 'Fokus Area 2',
  Keputusan2: 'Keputusan 2',
  Tindakan2: 'Cadangan Tindakan 2',
  Fokus3: 'Fokus Area 3',
  Keputusan3: 'Keputusan 3',
  Tindakan3: 'Cadangan Tindakan 3',
  Fokus4: 'Fokus Area 4',
  Keputusan4: 'Keputusan 4',
  Tindakan4: 'Cadangan Tindakan 4',
  
  // Monthly Sales Data
  JualanJan: 'Jualan Jan',
  JualanFeb: 'Jualan Feb',
  JualanMac: 'Jualan Mac',
  JualanApr: 'Jualan Apr',
  JualanMei: 'Jualan Mei',
  JualanJun: 'Jualan Jun',
  JualanJul: 'Jualan Jul',
  JualanOgos: 'Jualan Ogos',
  JualanSep: 'Jualan Sep',
  JualanOkt: 'Jualan Okt',
  JualanNov: 'Jualan Nov',
  JualanDis: 'Jualan Dis',
  
  // Media & Documentation
  LinkGambar: 'Link Gambar',
  ProdukServis: 'Produk/Servis',
  PautanMediaSosial: 'Pautan Media Sosial',
  LinkCartaGW: 'Link_Carta_GrowthWheel',
  LinkBuktiMIA: 'Link_Bukti_MIA',
  PanduanPemerhatian: 'Panduan_Pemerhatian_Mentor',
  
  // Mentor Reflection
  RefPerasaan: 'Refleksi_Perasaan',
  RefSkor: 'Refleksi_Skor',
  RefAlasan: 'Refleksi_Alasan_Skor',
  RefEliminate: 'Refleksi_Eliminate',
  RefRaise: 'Refleksi_Raise',
  RefReduce: 'Refleksi_Reduce',
  RefCreate: 'Refleksi_Create',
  
  // Images
  LinkGambarProfil: 'Link_Gambar_Profil',
  LinkGambarPremis: 'Link_Gambar_Premis',
  PremisChecked: 'Premis_Dilawat_Checked',
  
  // Status & URL
  Status: 'Status',
  DocUrl: 'DOC_URL',
  MenteeFolderId: 'Mentee_Folder_ID',
  
  // Upward Mobility Fields (NEW)
  UMStatusPenglibatan: 'UM_STATUS_PENGLIBATAN',
  UMStatus: 'UM_STATUS',
  UMKriteriaImprovement: 'UM_KRITERIA_IMPROVEMENT',
  UMAkaunBimb: 'UM_AKAUN_BIMB',
  UMBimbBiz: 'UM_BIMB_BIZ',
  UMAlAwfar: 'UM_AL_AWFAR',
  UMMerchantTerminal: 'UM_MERCHANT_TERMINAL',
  UMFasilitiLain: 'UM_FASILITI_LAIN',
  UMMesinkira: 'UM_MESINKIRA',
  UMPendapatanSemasa: 'UM_PENDAPATAN_SEMASA',
  UMUlasanPendapatan: 'UM_ULASAN_PENDAPATAN',
  UMPekerjaSemasa: 'UM_PEKERJA_SEMASA',
  UMUlasanPekerja: 'UM_ULASAN_PEKERJA',
  UMAsetBukanTunaiSemasa: 'UM_ASET_BUKAN_TUNAI_SEMASA',
  UMUlasanAsetBukanTunai: 'UM_ULASAN_ASET_BUKAN_TUNAI',
  UMAsetTunaiSemasa: 'UM_ASET_TUNAI_SEMASA',
  UMUlasanAsetTunai: 'UM_ULASAN_ASET_TUNAI',
  UMSimpananSemasa: 'UM_SIMPANAN_SEMASA',
  UMUlasanSimpanan: 'UM_ULASAN_SIMPANAN',
  UMZakatSemasa: 'UM_ZAKAT_SEMASA',
  UMUlasanZakat: 'UM_ULASAN_ZAKAT',
  UMDigitalSemasa: 'UM_DIGITAL_SEMASA',
  UMUlasanDigital: 'UM_ULASAN_DIGITAL',
  UMMarketingSemasa: 'UM_MARKETING_SEMASA',
  UMUlasanMarketing: 'UM_ULASAN_MARKETING',
  UMTarikhLawatanPremis: 'UM_TARIKH_LAWATAN_PREMIS'
};
```

4. MAPPING SHEET HEADERS:
```javascript
const MAPPING_HEADERS = {
  Batch: 'Batch',
  Zon: 'Zon',
  Mentor: 'Mentor',
  MentorEmail: 'Mentor_Email',
  Mentee: 'Mentee',
  NamaSyarikat: 'Nama Syarikat',
  Alamat: 'Alamat ',
  NoTelefon: 'no Telefon',
  FolderId: 'Folder_ID',
  Email: 'EMAIL',
  JenisBisnes: 'JENIS BISNES'
};
```

5. CORE FUNCTIONALITY REQUIRED:

A. **doPost() Handler**:
   - Receives data from submitBangkit.js API
   - Parses JSON payload
   - Validates required fields
   - Writes row to Bangkit sheet
   - Returns row number for tracking

B. **Automatic Document Generation**:
   - Triggered by onChange event on Bangkit sheet
   - OR time-driven trigger (every 1 minute)
   - Checks for unprocessed rows (empty DOC_URL column)
   - Skips rows with Status = "DONE"
   - Processes one row at a time
   - Updates DOC_URL and Status after generation

C. **Document Generation Process**:
   - Select correct template based on session number (Sesi 1 vs Sesi 2/3/4)
   - Copy template to mentee's folder
   - Replace ALL placeholders with data from row
   - Generate unique filename: "Laporan Sesi [Session#] - [Mentee Name] - [Date] - [Timestamp]"
   - Move to mentee folder (look up from Mapping sheet by Mentee name)
   - Write document URL back to DOC_URL column
   - Update Status to "DONE - [timestamp]"

D. **Template Placeholder Mapping**:
   - Basic info: {{nama_mentor}}, {{nama_usahawan}}, {{nama_bisnes}}, {{tarikh_sesi}}, {{masa_sesi}}, {{mod_sesi}}
   - Session content: {{ringkasan_sesi}}, {{update_1}}, {{fokus_1}}, {{keputusan_1}}, {{tindakan_1}}, etc.
   - Financial: {{jualan_jan}}, {{jualan_feb}}, etc.
   - Reflection: {{refleksi_perasaan}}, {{refleksi_skor}}, {{refleksi_alasan}}, etc.
   - Images: {{link_gambar}}, {{link_gambar_profil}}, {{link_gambar_premis}}, etc.
   
   - **NEW - Upward Mobility placeholders**:
     - {{um_status_penglibatan}}
     - {{um_status}}
     - {{um_kriteria_improvement}}
     - {{um_akaun_bimb}}
     - {{um_bimb_biz}}
     - {{um_al_awfar}}
     - {{um_merchant_terminal}}
     - {{um_fasiliti_lain}}
     - {{um_mesinkira}}
     - {{um_pendapatan_semasa}}
     - {{um_ulasan_pendapatan}}
     - {{um_pekerja_semasa}}
     - {{um_ulasan_pekerja}}
     - {{um_aset_bukan_tunai_semasa}}
     - {{um_ulasan_aset_bukan_tunai}}
     - {{um_aset_tunai_semasa}}
     - {{um_ulasan_aset_tunai}}
     - {{um_simpanan_semasa}}
     - {{um_ulasan_simpanan}}
     - {{um_zakat_semasa}}
     - {{um_ulasan_zakat}}
     - {{um_digital_semasa}}
     - {{um_ulasan_digital}}
     - {{um_marketing_semasa}}
     - {{um_ulasan_marketing}}
     - {{um_tarikh_lawatan_premis}}

E. **Business Category Mapping** (refer to Code.js):
   - Map Fokus Area 1-4 to business categories:
     - Konsep Bisnes
     - Organisasi
     - Hubungan Pelanggan
     - Operasi
   - Build category content with focus areas and decisions
   - Populate template with category-specific placeholders

F. **Error Handling**:
   - Try-catch blocks for all operations
   - Detailed logging with console.log/Logger.log
   - Return error messages in doPost responses
   - Handle missing folder IDs gracefully
   - Handle empty/null values (use || '' pattern)

G. **Helper Functions**:
   - `openBangkitSheet()` - Opens Bangkit tab
   - `openMappingSheet()` - Opens Mapping tab
   - `buildColumnIndex(headers)` - Creates column index from headers
   - `lookupMenteeFolder(menteeName)` - Finds folder ID from Mapping sheet
   - `selectTemplate(sessionNumber)` - Returns correct template ID
   - `processUnprocessedRows()` - Main automation function
   - `processSingleRow(rowNumber)` - Process specific row
   - `buildBusinessCategoryContent(row)` - Map focus areas to categories

6. COMPATIBILITY REQUIREMENTS:

Must work seamlessly with:
- `submitBangkit.js` - Expects doPost to accept JSON and return {success, message, rowNumber}
- `upload-proxy.js` - File uploads handled separately, AppScript receives URLs only
- `laporan-bangkit.js` - Frontend form structure and field names

7. IMPORTANT CONSTRAINTS:

- Use ScriptLock to prevent concurrent processing
- Process only ONE row per trigger execution
- Skip rows already processed (has DOC_URL or Status = DONE)
- Support backward compatibility (old rows without UM data still work)
- Empty UM fields should display as empty strings, not "undefined"
- Date formatting should be consistent
- All logging should be detailed for debugging


B. doPost(e) Contract Constraints

Your doPost(e) must:

 Accept JSON only
 Reject non-POST requests
 Validate e.postData.contents
 Validate action
 Validate programType === 'bangkit'
 Always return JSON
 Never throw uncaught errors
Golden rule
One exit point = JSON response

C. Error Handling Constraints (NON-NEGOTIABLE)

 Wrap entire doPost in try/catch
 Catch JSON.parse errors
 Catch missing rowNumber
 Catch missing sheet/tab
 Catch missing folder ID
 Catch template copy failure
 Catch permission errors
 Return { success:false, error, step }
No console-only logging.

E. Concurrency Constraints

 Use LockService.getScriptLock()
 tryLock(10000)
 Always releaseLock() in finally
 Process ONE row only per run
This prevents double-doc generation.

 F. Processing Constraints (Bangkit-specific)
 Skip rows with DOC_URL
 Skip rows with Status starts with DONE
 Handle missing UM fields with || ''
 Support legacy rows (no UM columns)
 Write back:
DOC_URL
Status = DONE - timestamp

G. Testing Constraints (Before production)

Before reconnecting proxy:
 Test doPost() manually using curl / Postman
 Test processSingleRow(rowNumber)
 Test unknown action
 Test missing rowNumber
 Test row already DONE
 Confirm response is pure JSON


8. TESTING FUNCTIONS TO INCLUDE:

- `testProcessSingleRow(rowNumber)` - Test document generation for specific row
- `testColumnMapping()` - Verify column indices are correct
- `testBusinessCategoryMapping()` - Test focus area categorization
- `setupOnChangeTrigger()` - Install onChange trigger
- `setupTimeDrivenTrigger()` - Install 1-minute trigger

DELIVERABLES:

1. Complete working Apps Script code
2. Clear comments explaining each section
3. Console.log statements for debugging
4. Error handling for all edge cases
5. Functions that comply with the existing frontend API contract

Please build this script from scratch, using Code.js as reference for structure and patterns, but ensuring full compatibility with the submitBangkit.js API and laporan-bangkit.js frontend form.