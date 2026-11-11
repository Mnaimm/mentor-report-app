// lib/upwardMobilityV2.js
// UM v2 (B10 Bangkit / M9 Maju onward): config, validation and serialisation.
// Shared by the form (UMSectionV2) and the submit routes; no client-only or server-only imports.
// Stored values are stable lowercase codes (no commas); labels are for display and Sheets only.

export const UM_V2_VERSION = 2;

// Sessions that require SWOT (all entrepreneurs)
export const SWOT_SESSIONS = [1, 3];
export const SWOT_MIN_TAGS = 1;
export const SWOT_MAX_TAGS = 3;
export const LAIN_LAIN = 'lain_lain';
export const BELUM = 'belum';

// Upward Mobility status + G1/G2 tags unchanged from v1; G3 reduced for v2
export const UM_STATUS_OPTIONS = [
  { value: 'G1', label: 'Grade 1 (G1)', desc: ' - Lulus kemudahan/fasiliti SME' },
  { value: 'G2', label: 'Grade 2 (G2)', desc: ' - Berjaya improve credit worthiness' },
  { value: 'G3', label: 'Grade 3 (G3)', desc: ' - Improve mana-mana bahagian bisnes' },
  { value: 'NIL', label: 'NIL', desc: ' - Tiada peningkatan' },
];

export const GRADE_CRITERIA_MAP_V2 = {
  G1: ['BIMB SME Facility', 'Other Bank SME Facility', 'Ready Documentation'],
  G2: ['BangKIT to Maju', 'Maju to SME Financing', 'Improve Credit Score'],
  G3: ['Income/Sale', 'Job Creation', 'Saving', 'Digitalization'],
};

// BIMB channels (Ya/Tidak). field = state key, column = upward_mobility_reports column
export const BIMB_CHANNELS = [
  { field: 'akaun_semasa', column: 'bank_akaun_semasa', label: 'Akaun Semasa BIMB' },
  { field: 'bimb_biz', column: 'bank_bizapp', label: 'BIMB Biz' },
  { field: 'pos_perisian', column: 'bank_pos_perisian', label: 'Sistem POS / Perisian Perakaunan' },
  { field: 'al_awfar', column: 'bank_al_awfar', label: 'Akaun Al-Awfar' },
  { field: 'merchant_terminal', column: 'bank_merchant_terminal', label: 'Terminal Peniaga' },
  { field: 'fasiliti_lain', column: 'bank_fasiliti_lain', label: 'Kemudahan BIMB Lain' },
  {
    field: 'akaun_pengurusan', column: 'bank_akaun_pengurusan', label: 'Akaun Pengurusan',
    help: 'Wujud sekurang-kurangnya Penyata Untung Rugi atau Aliran Tunai bulanan',
  },
  {
    field: 'pengisytiharan_cukai', column: 'bank_pengisytiharan_cukai', label: 'Pengisytiharan Cukai',
    help: 'Ada fail cukai LHDN dan telah mengisytiharkan pendapatan',
  },
];

export const YA_TIDAK = ['Ya', 'Tidak'];

export const MEDIA_SOSIAL_OPTIONS = [
  { code: 'perkenal_produk', label: 'Perkenal produk / jenama' },
  { code: 'layan_pelanggan', label: 'Layan & berinteraksi dengan pelanggan' },
  { code: 'cari_pelanggan', label: 'Cari pelanggan baharu' },
  { code: 'kongsi_ilmu', label: 'Kongsi ilmu / bina komuniti' },
  { code: BELUM, label: 'Belum menggunakan', exclusive: true },
];

export const EDAGANG_OPTIONS = [
  { code: 'marketplace', label: 'Marketplace' },
  { code: 'kedai_online', label: 'Laman web / kedai online sendiri' },
  { code: 'tempahan_servis', label: 'Tempahan perkhidmatan online' },
  { code: BELUM, label: 'Belum menerima tempahan online', exclusive: true },
];

// SWOT tags. S/W: generic lists. O/T: grouped by PESTEL. Every quadrant also offers Lain-lain.
// noteKey = key in swot_nota (jsonb {S, W, O, T}); each quadrant has an optional note.
export const SWOT_NOTE_MAX = 120;
const LAIN_LAIN_TAG = { code: LAIN_LAIN, label: 'Lain-lain' };

export const SWOT_QUADRANTS = [
  {
    key: 'kekuatan', noteKey: 'S', column: 'swot_kekuatan', label: 'Kekuatan (dalaman)',
    groups: [{ label: null, tags: [
      { code: 'kualiti_produk', label: 'Kualiti produk / perkhidmatan baik' },
      { code: 'rekod_kewangan_kemas', label: 'Rekod kewangan kemas' },
      { code: 'pelanggan_setia', label: 'Pelanggan setia / pesanan berulang' },
      { code: 'pemasaran_aktif', label: 'Pemasaran aktif' },
      { code: 'pasukan_cekap', label: 'Pasukan cekap dan berdisiplin' },
      { code: 'operasi_sop_tersusun', label: 'Operasi dan SOP tersusun' },
    ] }],
  },
  {
    key: 'kelemahan', noteKey: 'W', column: 'swot_kelemahan', label: 'Kelemahan (dalaman)',
    groups: [{ label: null, tags: [
      { code: 'wang_bercampur', label: 'Wang bisnes dan peribadi bercampur' },
      { code: 'kurang_staf', label: 'Kekurangan staf / bekerja solo' },
      { code: 'pemasaran_lemah', label: 'Pemasaran lemah atau pasif' },
      { code: 'kapasiti_terhad', label: 'Kapasiti / peralatan terhad' },
      { code: 'kemahiran_digital_rendah', label: 'Kemahiran digital rendah' },
      { code: 'kos_margin_tidak_jelas', label: 'Kos dan margin tidak jelas' },
    ] }],
  },
  {
    key: 'peluang', noteKey: 'O', column: 'swot_peluang', label: 'Peluang (luaran, PESTEL)',
    groups: [
      { label: 'Politik', tags: [
        { code: 'geran_bantuan_agensi', label: 'Geran atau bantuan agensi' },
        { code: 'program_kerajaan', label: 'Program kerajaan sedia ada' },
      ] },
      { label: 'Ekonomi', tags: [
        { code: 'permintaan_bermusim', label: 'Permintaan bermusim / acara' },
        { code: 'pasaran_baharu', label: 'Pasaran / pelanggan baharu' },
      ] },
      { label: 'Sosial', tags: [
        { code: 'sokongan_komuniti', label: 'Sokongan komuniti setempat' },
        { code: 'tren_gaya_hidup', label: 'Tren gaya hidup / kesedaran pengguna' },
      ] },
      { label: 'Teknologi', tags: [
        { code: 'saluran_digital', label: 'Saluran digital / e-dagang' },
        { code: 'alat_digital_murah', label: 'Alat digital murah (POS, akaun)' },
      ] },
      { label: 'Persekitaran', tags: [
        { code: 'produk_mesra_alam', label: 'Permintaan produk mesra alam' },
        { code: 'jimat_kos_tenaga', label: 'Penjimatan kos tenaga' },
      ] },
      { label: 'Perundangan', tags: [
        { code: 'pensijilan_lesen', label: 'Pensijilan / lesen buka pasaran' },
        { code: 'insentif_cukai', label: 'Insentif cukai' },
      ] },
    ],
  },
  {
    key: 'ancaman', noteKey: 'T', column: 'swot_ancaman', label: 'Ancaman (luaran, PESTEL)',
    groups: [
      { label: 'Politik', tags: [
        { code: 'perubahan_dasar_subsidi', label: 'Perubahan dasar atau subsidi' },
        { code: 'politik_tidak_menentu', label: 'Ketidaktentuan politik' },
      ] },
      { label: 'Ekonomi', tags: [
        { code: 'kos_input_meningkat', label: 'Kos input meningkat' },
        { code: 'kuasa_beli_menurun', label: 'Kuasa beli pengguna menurun' },
      ] },
      { label: 'Sosial', tags: [
        { code: 'citarasa_berubah', label: 'Perubahan citarasa pengguna' },
        { code: 'kurang_tenaga_kerja', label: 'Kekurangan tenaga kerja' },
      ] },
      { label: 'Teknologi', tags: [
        { code: 'pesaing_maju_digital', label: 'Pesaing lebih maju digital' },
        { code: 'gangguan_platform', label: 'Gangguan platform / sistem' },
      ] },
      { label: 'Persekitaran', tags: [
        { code: 'cuaca_banjir', label: 'Cuaca atau banjir' },
        { code: 'gangguan_bekalan', label: 'Gangguan bekalan' },
      ] },
      { label: 'Perundangan', tags: [
        { code: 'syarat_lesen_ketat', label: 'Syarat lesen / PBT ketat' },
        { code: 'kos_pematuhan_meningkat', label: 'Kos pematuhan meningkat' },
      ] },
    ],
  },
];

// All selectable tags of a quadrant, Lain-lain last
export const swotTagsFor = (quadrantKey) => {
  const q = SWOT_QUADRANTS.find((x) => x.key === quadrantKey);
  return q ? [...q.groups.flatMap((g) => g.tags), LAIN_LAIN_TAG] : [];
};

// code → label maps for display and Sheets
const toLabelMap = (opts) => Object.fromEntries(opts.map((o) => [o.code, o.label]));
export const UM_V2_LABELS = {
  media_sosial: toLabelMap(MEDIA_SOSIAL_OPTIONS),
  edagang: toLabelMap(EDAGANG_OPTIONS),
  ...Object.fromEntries(SWOT_QUADRANTS.map((q) => [q.key, toLabelMap(swotTagsFor(q.key))])),
};

export const labelsFor = (mapKey, codes) =>
  (Array.isArray(codes) ? codes : []).map((c) => UM_V2_LABELS[mapKey]?.[c] || c);

export const requiresSwot = (sesiNumber) => SWOT_SESSIONS.includes(Number(sesiNumber));

export const INITIAL_UM_V2_STATE = {
  umVersion: UM_V2_VERSION,
  status: '',
  kriteria_improvement: '',
  tarikh_lawatan: '',
  bimb: Object.fromEntries(BIMB_CHANNELS.map((c) => [c.field, ''])),
  pendapatan: '', ulasan_pendapatan: '',
  pekerja_ft: '', pekerja_pt: '', ulasan_pekerjaan: '',
  simpanan: '', ulasan_simpanan: '',
  zakat: '', ulasan_zakat: '',
  media_sosial: [], ulasan_media_sosial: '',
  edagang_saluran: [], edagang_whatsapp: '', ulasan_edagang: '',
  swot: {
    justifikasi: '',
    kekuatan: [], kelemahan: [], peluang: [], ancaman: [],
    nota: { S: '', W: '', O: '', T: '' },
  },
};

// Multi-select toggle that keeps an exclusive option ('belum') alone
export const toggleCode = (current, code, checked, options) => {
  const arr = Array.isArray(current) ? current : [];
  if (!checked) return arr.filter((c) => c !== code);
  const exclusive = options.find((o) => o.code === code)?.exclusive;
  if (exclusive) return [code];
  const exclusiveCodes = options.filter((o) => o.exclusive).map((o) => o.code);
  return [...arr.filter((c) => !exclusiveCodes.includes(c)), code];
};

const isBlank = (v) => v === '' || v == null || (typeof v === 'string' && v.trim() === '');
const hasText = (v) => typeof v === 'string' && v.trim() !== '';
const isNonNegNumber = (v) => !isBlank(v) && Number.isFinite(Number(v)) && Number(v) >= 0;
const isNonNegInt = (v) => isNonNegNumber(v) && Number.isInteger(Number(v));

function validateMulti(errors, codes, options, label) {
  const arr = Array.isArray(codes) ? codes : [];
  const valid = options.map((o) => o.code);
  if (arr.length === 0) errors.push(`${label}: sila pilih sekurang-kurangnya satu`);
  if (arr.some((c) => !valid.includes(c))) errors.push(`${label}: pilihan tidak sah`);
  if (new Set(arr).size !== arr.length) errors.push(`${label}: pilihan berulang`);
  const exclusive = options.filter((o) => o.exclusive).map((o) => o.code);
  if (arr.length > 1 && arr.some((c) => exclusive.includes(c))) {
    errors.push(`${label}: "${options.find((o) => o.exclusive).label}" tidak boleh dipilih bersama pilihan lain`);
  }
}

/**
 * Validates UM v2 state. Same function on client and server.
 * @returns {string[]} Bahasa Malaysia error messages (empty when valid)
 */
export function validateUpwardMobilityV2(state, { sesiNumber } = {}) {
  const errors = [];
  const s = state || {};
  const P = 'Upward Mobility -';

  if (Number(s.umVersion) !== UM_V2_VERSION) errors.push(`${P} Versi borang tidak sah`);
  if (!UM_STATUS_OPTIONS.some((o) => o.value === s.status)) errors.push(`${P} Upward Mobility Status adalah wajib diisi`);

  for (const c of BIMB_CHANNELS) {
    if (!YA_TIDAK.includes(s.bimb?.[c.field])) errors.push(`${P} ${c.label} (Ya/Tidak) adalah wajib diisi`);
  }

  // 1. Jualan / Pendapatan
  if (!isNonNegNumber(s.pendapatan)) errors.push(`${P} Jualan / Pendapatan (RM) mesti nombor 0 atau lebih`);
  if (!hasText(s.ulasan_pendapatan)) errors.push(`${P} Ulasan Jualan / Pendapatan adalah wajib diisi`);

  // 2. Penciptaan Pekerjaan (one shared ulasan)
  if (!isNonNegInt(s.pekerja_ft)) errors.push(`${P} Pekerja sepenuh masa mesti nombor bulat 0 atau lebih`);
  if (!isNonNegInt(s.pekerja_pt)) errors.push(`${P} Pekerja separuh masa mesti nombor bulat 0 atau lebih`);
  if (!hasText(s.ulasan_pekerjaan)) errors.push(`${P} Ulasan Penciptaan Pekerjaan adalah wajib diisi`);

  // 3. Simpanan
  if (!isNonNegNumber(s.simpanan)) errors.push(`${P} Simpanan (RM) mesti nombor 0 atau lebih`);
  if (!hasText(s.ulasan_simpanan)) errors.push(`${P} Ulasan Simpanan adalah wajib diisi`);

  // 4. Zakat (0 allowed)
  if (!isNonNegNumber(s.zakat)) errors.push(`${P} Zakat (RM) mesti nombor 0 atau lebih (0 jika tidak bayar)`);
  if (!hasText(s.ulasan_zakat)) errors.push(`${P} Ulasan Zakat adalah wajib diisi`);

  // 5. Media Sosial
  validateMulti(errors, s.media_sosial, MEDIA_SOSIAL_OPTIONS, `${P} Media Sosial`);
  if (!hasText(s.ulasan_media_sosial)) errors.push(`${P} Ulasan Media Sosial (platform dan contoh) adalah wajib diisi`);

  // 6. E-Dagang
  validateMulti(errors, s.edagang_saluran, EDAGANG_OPTIONS, `${P} E-Dagang`);
  if (!YA_TIDAK.includes(s.edagang_whatsapp)) errors.push(`${P} Tempahan melalui WhatsApp atau mesej biasa (Ya/Tidak) adalah wajib diisi`);
  if (!hasText(s.ulasan_edagang)) errors.push(`${P} Ulasan E-Dagang adalah wajib diisi`);

  // SWOT: Sesi 1 and 3 only
  if (requiresSwot(sesiNumber)) {
    const swot = s.swot || {};
    if (!hasText(swot.justifikasi)) errors.push(`${P} SWOT: Justifikasi adalah wajib diisi`);
    for (const q of SWOT_QUADRANTS) {
      const tags = Array.isArray(swot[q.key]) ? swot[q.key] : [];
      const valid = swotTagsFor(q.key).map((t) => t.code);
      const note = swot.nota?.[q.noteKey];
      if (tags.length < SWOT_MIN_TAGS || tags.length > SWOT_MAX_TAGS) {
        errors.push(`${P} SWOT ${q.label}: pilih ${SWOT_MIN_TAGS} hingga ${SWOT_MAX_TAGS} tag`);
      }
      if (tags.some((t) => !valid.includes(t))) errors.push(`${P} SWOT ${q.label}: tag tidak sah`);
      if (new Set(tags).size !== tags.length) errors.push(`${P} SWOT ${q.label}: tag berulang`);
      if (note != null && typeof note !== 'string') errors.push(`${P} SWOT ${q.label}: nota tidak sah`);
      if (typeof note === 'string' && note.trim().length > SWOT_NOTE_MAX) {
        errors.push(`${P} SWOT ${q.label}: nota maksimum ${SWOT_NOTE_MAX} aksara`);
      }
      if (tags.includes(LAIN_LAIN) && !hasText(note)) {
        errors.push(`${P} SWOT ${q.label}: nota wajib diisi apabila "Lain-lain" dipilih`);
      }
    }
  }

  return errors;
}

/**
 * Non-empty SWOT notes as { S, W, O, T } (trimmed), or null when there are none.
 */
export function swotNotes(swot) {
  const out = {};
  for (const q of SWOT_QUADRANTS) {
    const note = typeof swot?.nota?.[q.noteKey] === 'string' ? swot.nota[q.noteKey].trim() : '';
    if (note) out[q.noteKey] = note;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * UPWARD_MOBILITY_JSON body sent by the form. SWOT is dropped outside Sesi 1/3
 * so those rows store NULL.
 */
export function serializeUMV2(state, { sesiNumber } = {}) {
  const { swot, ...rest } = state;
  const out = { ...rest, umVersion: UM_V2_VERSION };
  if (requiresSwot(sesiNumber)) {
    out.swot = {
      justifikasi: swot.justifikasi,
      kekuatan: swot.kekuatan, kelemahan: swot.kelemahan, peluang: swot.peluang, ancaman: swot.ancaman,
      nota: swotNotes(swot) || {},
    };
  }
  return out;
}

/**
 * Carry-forward from the latest v2 row of the same program (/api/um/latest-report).
 * Not carried: status, kriteria, pendapatan and SWOT (assessed fresh each session).
 */
export function umV2PrefillFromRow(row) {
  if (!row) return {};
  const str = (v) => (v == null ? '' : String(v));
  const yaTidak = (v) => (YA_TIDAK.includes(v) ? v : '');
  const codes = (arr, options) =>
    (Array.isArray(arr) ? arr : []).filter((c) => options.some((o) => o.code === c));
  return {
    ...(row.tarikh_lawatan && /^\d{4}-\d{2}-\d{2}$/.test(row.tarikh_lawatan) && { tarikh_lawatan: row.tarikh_lawatan }),
    bimb: Object.fromEntries(BIMB_CHANNELS.map((c) => [c.field, yaTidak(row[c.column])])),
    pekerja_ft: str(row.pekerja_semasa),
    pekerja_pt: str(row.pekerja_parttime_semasa),
    ulasan_pekerjaan: row.ulasan_pekerjaan ?? '',
    simpanan: str(row.simpanan_semasa),
    ulasan_simpanan: row.ulasan_simpanan ?? '',
    zakat: str(row.zakat_semasa),
    ulasan_zakat: row.ulasan_zakat ?? '',
    media_sosial: codes(row.media_sosial, MEDIA_SOSIAL_OPTIONS),
    ulasan_media_sosial: row.ulasan_media_sosial ?? '',
    edagang_saluran: codes(row.edagang_saluran, EDAGANG_OPTIONS),
    edagang_whatsapp: yaTidak(row.edagang_whatsapp),
    ulasan_edagang: row.ulasan_edagang ?? '',
  };
}

/**
 * v1-shaped object holding only the UM fields that already have Sheets columns.
 * Passed to the existing Sheets mappers, so v1-only columns come out blank.
 * Values are strings so 0 survives the mappers' `|| ''`.
 */
export function umV2ToSheetsUM(v2) {
  const str = (v) => (v === '' || v == null ? '' : String(v));
  return {
    // v2 has no penglibatan field; non-MIA v2 rows are 'Active' (only non-MIA v2 reaches here)
    UM_STATUS_PENGLIBATAN: 'Active',
    UM_STATUS: str(v2.status),
    UM_KRITERIA_IMPROVEMENT: str(v2.kriteria_improvement),
    UM_TARIKH_LAWATAN_PREMIS: str(v2.tarikh_lawatan),
    // BIMB channels that mean the same in v1 and v2
    UM_AKAUN_BIMB: str(v2.bimb?.akaun_semasa),
    UM_BIMB_BIZ: str(v2.bimb?.bimb_biz),
    UM_AL_AWFAR: str(v2.bimb?.al_awfar),
    UM_MERCHANT_TERMINAL: str(v2.bimb?.merchant_terminal),
    UM_FASILITI_LAIN: str(v2.bimb?.fasiliti_lain),
    UM_PENDAPATAN_SEMASA: str(v2.pendapatan),
    UM_ULASAN_PENDAPATAN: str(v2.ulasan_pendapatan),
    UM_PEKERJA_SEMASA: str(v2.pekerja_ft),
    UM_PEKERJA_PARTTIME_SEMASA: str(v2.pekerja_pt),
    UM_ULASAN_PEKERJA: str(v2.ulasan_pekerjaan),
    UM_SIMPANAN_SEMASA: str(v2.simpanan),
    UM_ULASAN_SIMPANAN: str(v2.ulasan_simpanan),
    UM_ZAKAT_SEMASA: str(v2.zakat),
    UM_ULASAN_ZAKAT: str(v2.ulasan_zakat),
  };
}

/**
 * Sheets-only display conversion: the form/Supabase keep 'Ya'/'Tidak'; the Sheets columns (read by the
 * Apps Script PDF templates) get 'Yes'/'No'. Anything else passes through unchanged.
 * Never apply to values going to Supabase.
 */
export function toYesNo_(val) {
  if (val === 'Ya') return 'Yes';
  if (val === 'Tidak') return 'No';
  return val;
}

/**
 * The 18-column UM v2 block appended at the end of the Bangkit tab (CQ–DH),
 * LaporanMajuUM (BQ–CH) and the UM tab (BU–CL). Header names = v2 template placeholders.
 * Order is fixed: the Sheets writers append by position.
 */
export const UM_V2_SHEETS_HEADERS = [
  'UM_VERSI', 'UM_POS_PERISIAN', 'UM_AKAUN_PENGURUSAN', 'UM_PENGISYTIHARAN_CUKAI',
  'UM_MEDIA_SOSIAL', 'UM_ULASAN_MEDIA_SOSIAL', 'UM_EDAGANG', 'UM_WHATSAPP', 'UM_ULASAN_EDAGANG',
  'UM_SWOT_JUSTIFIKASI', 'UM_SWOT_S', 'UM_SWOT_W', 'UM_SWOT_O', 'UM_SWOT_T',
  'UM_SWOT_NOTA_S', 'UM_SWOT_NOTA_W', 'UM_SWOT_NOTA_O', 'UM_SWOT_NOTA_T',
];

/**
 * Values for UM_V2_SHEETS_HEADERS, in the same order.
 * - v1 (umVersion !== 2): ['1', '', …] so the Apps Script template picker is explicit.
 * - v2 MIA or no v2 data: ['2', '', …].
 * - v2: multi-selects as labels joined with '; ' (codes stay in the DB);
 *   SWOT only for Sesi 1/3, empty otherwise.
 * @param v2 validated v2 UM state (null on the v1 path or for MIA)
 * @param opts { umVersion, isMIA, sesiNumber }
 */
export function umV2ToSheetsV2Block(v2, { umVersion = 1, isMIA = false, sesiNumber } = {}) {
  const block = Array(UM_V2_SHEETS_HEADERS.length).fill('');
  if (Number(umVersion) !== UM_V2_VERSION) {
    block[0] = '1';
    return block;
  }
  block[0] = String(UM_V2_VERSION);
  if (isMIA || !v2) return block;

  const str = (v) => (v === '' || v == null ? '' : String(v));
  const join = (mapKey, codes) => labelsFor(mapKey, codes).join('; ');

  block[1] = toYesNo_(str(v2.bimb?.pos_perisian));
  block[2] = toYesNo_(str(v2.bimb?.akaun_pengurusan));
  block[3] = toYesNo_(str(v2.bimb?.pengisytiharan_cukai));
  block[4] = join('media_sosial', v2.media_sosial);
  block[5] = str(v2.ulasan_media_sosial);
  block[6] = join('edagang', v2.edagang_saluran);
  block[7] = toYesNo_(str(v2.edagang_whatsapp));
  block[8] = str(v2.ulasan_edagang);

  if (requiresSwot(sesiNumber) && v2.swot) {
    const swot = v2.swot;
    const notes = swotNotes(swot) || {};
    block[9] = str(swot.justifikasi);
    SWOT_QUADRANTS.forEach((q, i) => {
      block[10 + i] = join(q.key, swot[q.key]);
      block[14 + i] = notes[q.noteKey] || '';
    });
  }
  return block;
}
