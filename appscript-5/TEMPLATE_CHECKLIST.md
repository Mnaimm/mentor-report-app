# Template Placeholder Checklist

This document lists all placeholders that the Apps Script expects in the templates. Use this to verify your Google Doc templates have the correct placeholders.

## Template URLs
- **Sesi 1**: https://docs.google.com/document/d/1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI/edit
- **Sesi 2-4**: https://docs.google.com/document/d/1JsSwCJK5SHrTQi5gSXgBa4ZPYws_52eiu-sE0ADvEVQ/edit

---

## COMMON PLACEHOLDERS (Both Templates)

### Basic Information
- [ ] `{{Nama Mentor}}`
- [ ] `{{Nama Usahawan}}`
- [ ] `{{Nama Bisnes}}`
- [ ] `{{Mentor Email}}`
- [ ] `{{Masa Sesi}}`
- [ ] `{{Sesi Laporan}}`
- [ ] `{{Mod Sesi}}`
- [ ] `{{no Telefon}}`
- [ ] `{{EMAIL}}`
- [ ] `{{Alamat}}`
- [ ] `{{Batch No}}`

### Sales Data (12 months)
- [ ] `{{Jualan Jan}}`
- [ ] `{{Jualan Feb}}`
- [ ] `{{Jualan Mac}}`
- [ ] `{{Jualan Apr}}`
- [ ] `{{Jualan Mei}}`
- [ ] `{{Jualan Jun}}`
- [ ] `{{Jualan Jul}}`
- [ ] `{{Jualan Ogos}}`
- [ ] `{{Jualan Sep}}`
- [ ] `{{Jualan Okt}}`
- [ ] `{{Jualan Nov}}`
- [ ] `{{Jualan Dis}}`

### Business Information
- [ ] `{{Produk/Servis}}`
- [ ] `{{Pautan Media Sosial}}`

### Session Content
- [ ] `{{Update Keputusan Terdahulu}}`
- [ ] `{{Ringkasan Sesi}}`

### Reflection (Sesi 1)
- [ ] `{{Panduan_Pemerhatian_Mentor}}`
- [ ] `{{Refleksi_Perasaan}}`
- [ ] `{{Refleksi_Skor}}`
- [ ] `{{Refleksi_Alasan_Skor}}`
- [ ] `{{Refleksi_Eliminate}}`
- [ ] `{{Refleksi_Raise}}`
- [ ] `{{Refleksi_Reduce}}`
- [ ] `{{Refleksi_Create}}`

### Images
- [ ] `{{Link_Carta_GrowthWheel}}`
- [ ] `{{Link_Gambar_Profil}}`
- [ ] `{{Link Gambar}}`
- [ ] `{{Link_Gambar_Premis}}`

### Footer
- [ ] `{{Tarikh}}` (in footer)
- [ ] `{{Nama Mentor}}` (in footer)

---

## SESI 1 SPECIFIC PLACEHOLDERS

### Date (Sesi 1 only)
- [ ] `{{Tarikh Sesi}}` (appears in body for Sesi 1)

### Business Categories (Inisiatif Utama)
- [ ] `{{Konsep_Bisnes_Focus}}`
- [ ] `{{Konsep_Bisnes_Keputusan}}`
- [ ] `{{Organisasi_Focus}}`
- [ ] `{{Organisasi_Keputusan}}`
- [ ] `{{Hubungan_Pelanggan_Focus}}`
- [ ] `{{Hubungan_Pelanggan_Keputusan}}`
- [ ] `{{Operasi_Focus}}`
- [ ] `{{Operasi_Keputusan}}`

### Session Image
- [ ] `{{Gambar Sesi 1}}`

---

## SESI 2-4 SPECIFIC PLACEHOLDERS

### Session History (Date & Mode for all sessions)
- [ ] `{{Sesi1_Date}}`
- [ ] `{{Sesi1_Mode}}`
- [ ] `{{Sesi2_Date}}`
- [ ] `{{Sesi2_Mode}}`
- [ ] `{{Sesi3_Date}}`
- [ ] `{{Sesi3_Mode}}`
- [ ] `{{Sesi4_Date}}`
- [ ] `{{Sesi4_Mode}}`

### Rumusan Sesi 2
- [ ] `{{Sesi2_ISU_UTAMA}}`
- [ ] `{{Sesi2_LANGKAH_KEHADAPAN}}`
- [ ] `{{Sesi2_RINGKASAN}}`

### Rumusan Sesi 3
- [ ] `{{Sesi3_ISU_UTAMA}}`
- [ ] `{{Sesi3_LANGKAH_KEHADAPAN}}`
- [ ] `{{Sesi3_RINGKASAN}}`

### Rumusan Sesi 4
- [ ] `{{Sesi4_ISU_UTAMA}}`
- [ ] `{{Sesi4_LANGKAH_KEHADAPAN}}`
- [ ] `{{Sesi4_RINGKASAN}}`

### Session Images (for all completed sessions)
- [ ] `{{Gambar Sesi 1}}`
- [ ] `{{Gambar Sesi 2}}`
- [ ] `{{Gambar Sesi 3}}`
- [ ] `{{Gambar Sesi 4}}`

---

## UPWARD MOBILITY PLACEHOLDERS (REQUIRED - Both Templates)

### Section 1: Engagement Status
- [ ] `{{um_status_penglibatan}}`
- [ ] `{{um_status}}`
- [ ] `{{um_kriteria_improvement}}`

### Section 2: BIMB Channels & Fintech
- [ ] `{{um_akaun_bimb}}`
- [ ] `{{um_bimb_biz}}`
- [ ] `{{um_al_awfar}}`
- [ ] `{{um_merchant_terminal}}`
- [ ] `{{um_fasiliti_lain}}`
- [ ] `{{um_mesinkira}}`

### Section 3: Financial & Employment Metrics
- [ ] `{{um_pendapatan_semasa}}`
- [ ] `{{um_ulasan_pendapatan}}`
- [ ] `{{um_pekerja_semasa}}`
- [ ] `{{um_ulasan_pekerja}}`
- [ ] `{{um_aset_bukan_tunai_semasa}}`
- [ ] `{{um_ulasan_aset_bukan_tunai}}`
- [ ] `{{um_aset_tunai_semasa}}`
- [ ] `{{um_ulasan_aset_tunai}}`
- [ ] `{{um_simpanan_semasa}}`
- [ ] `{{um_ulasan_simpanan}}`
- [ ] `{{um_zakat_semasa}}`
- [ ] `{{um_ulasan_zakat}}`

### Section 4: Digitalization
- [ ] `{{um_digital_semasa}}`
- [ ] `{{um_ulasan_digital}}`

### Section 5: Marketing
- [ ] `{{um_marketing_semasa}}`
- [ ] `{{um_ulasan_marketing}}`

### Section 6: Premises Visit
- [ ] `{{um_tarikh_lawatan_premis}}`

---

## HOW TO VERIFY YOUR TEMPLATES

### Step 1: Open Template in Google Docs
1. Click the template link above
2. Press `Ctrl+F` (or `Cmd+F` on Mac) to open Find

### Step 2: Search for Placeholders
Search for `{{` to find all placeholders in the document

### Step 3: Check Against This List
- Go through each placeholder in the checklist
- Mark it as checked [ ] → [x] if found in your template
- If a placeholder is missing, add it to your template

### Step 4: Check for Typos
Common issues:
- Extra spaces: `{{ Nama Mentor }}` should be `{{Nama Mentor}}`
- Wrong case: `{{nama_mentor}}` should be `{{Nama Mentor}}`
- Underscore vs space: Some use `_`, some use spaces - follow the list exactly

### Step 5: Special Checks

**For Sesi 1 Template:**
- Must have all 8 business category placeholders
- Must have `{{Gambar Sesi 1}}` for session image
- Must have `{{Tarikh Sesi}}` in body (not just footer)

**For Sesi 2-4 Template:**
- Must have session history placeholders (Sesi1-4 Date and Mode)
- Must have Rumusan placeholders for Sesi 2, 3, and 4
- Must have image placeholders for all 4 sessions

**Both Templates:**
- Must have ALL 28 Upward Mobility placeholders (NEW REQUIREMENT)
- Footer must have `{{Tarikh}}` and `{{Nama Mentor}}`

---

## QUICK FIND & REPLACE TIP

If you need to add missing placeholders to your template:

1. **Find the right section** in your template where the placeholder should go
2. **Type or paste** the placeholder exactly as shown (including `{{` and `}}`)
3. **Format** the placeholder text as you want it to appear
4. **Save** the template

---

## PLACEHOLDER USAGE NOTES

### Business Categories (Sesi 1 Only)
The script automatically maps focus areas to these 4 categories:
- **Konsep Bisnes**: Business Idea, Product Portfolio, Value Proposition
- **Organisasi**: Employees, Partners & Resources, Management
- **Hubungan Pelanggan**: Marketing, Sales, Customer Relations
- **Operasi**: Business Process, Financial, Delivery

### Images
- Images can be single URLs or JSON arrays of URLs
- Script will insert the first image and add subsequent images if array
- All images are resized to 400px width

### Upward Mobility Fields
- These are NEW fields for tracking business progress
- If field is empty in sheet, placeholder is replaced with empty string
- Backward compatible: Old reports without UM data will still work

---

## TROUBLESHOOTING

### Placeholder Not Being Replaced?
1. Check spelling and case - must match exactly
2. Check for extra spaces inside `{{ }}`
3. Make sure it's in the main body (not in text boxes or tables in some cases)
4. Check Apps Script logs for errors

### Image Not Appearing?
1. Verify image URL is accessible (not private)
2. Check if URL is valid (starts with http:// or https://)
3. Check Apps Script logs for fetch errors

### Footer Not Updating?
1. Make sure placeholders are in the Footer section (not body)
2. Check View → Header and Footer to edit footer
3. Verify `{{Tarikh}}` and `{{Nama Mentor}}` are in footer

---

## SUMMARY

**Total Placeholders:**
- **Common (Both)**: ~50 placeholders
- **Sesi 1 Specific**: ~10 placeholders
- **Sesi 2-4 Specific**: ~20 placeholders
- **Upward Mobility**: 28 placeholders

**Priority Checks:**
1. ✅ All Upward Mobility placeholders (28) - NEW & CRITICAL
2. ✅ Basic info placeholders (Nama Mentor, Usahawan, etc.)
3. ✅ Session-specific placeholders (Business Categories OR Rumusan Sesi)
4. ✅ Footer placeholders (Tarikh, Nama Mentor)

---

**Need Help?**
If you find placeholders that don't match or are missing, let me know and I can:
1. Update the Apps Script to match your template
2. Provide you with the exact placeholder text to add to your template
3. Help debug any issues with placeholder replacement
