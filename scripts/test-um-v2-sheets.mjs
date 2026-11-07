// B3: UM v2 Sheets block — mapper lengths, block positions, v1 unchanged vs stage2 (e7b8323).
// Usage (from repo root): node scripts/test-um-v2-sheets.mjs [repoRoot]
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const WT = process.argv[2] || process.cwd();
const lib = await import(pathToFileURL(path.join(WT, 'lib/upwardMobilityV2.js')).href);
const {
  INITIAL_UM_V2_STATE, validateUpwardMobilityV2, serializeUMV2,
  umV2ToSheetsUM, umV2ToSheetsV2Block, UM_V2_SHEETS_HEADERS,
} = lib;

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✅' : '  ❌'} ${msg}`); if (!cond) failures++; };
const col = (i) => { let n = i + 1, s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

// ---- extract a top-level function (const x = (...) => {...}; or function x(...) {...}) from source
function extract(src, name) {
  const re = new RegExp(`^(const ${name} = |function ${name}\\b)`, 'm');
  const m = re.exec(src);
  if (!m) throw new Error(`${name} not found`);
  let i = src.indexOf('{', m.index);
  if (name === 'sheetsV2Block') { // arrow with parenthesised body
    i = src.indexOf('(', src.indexOf('=>', m.index));
    let d = 0, j = i;
    for (; j < src.length; j++) { if (src[j] === '(') d++; else if (src[j] === ')' && --d === 0) break; }
    return src.slice(m.index, j + 1) + ';';
  }
  let d = 0, j = i;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return src.slice(m.index, j + 1) + ';';
}
function load(src, names) {
  const helper = src.includes('const sheetsV2Block =') ? extract(src, 'sheetsV2Block') : '';
  const extra = src.includes('function deriveLegacyJualanFromKewangan')
    ? src.match(/^const BANGKIT_MONTHS = .*$/m)[0] + '\n' + extract(src, 'deriveLegacyJualanFromKewangan')
    : '';
  const body = `${extra}\n${helper}\n${names.map((n) => extract(src, n)).join('\n')}\nreturn { ${names.join(', ')} };`;
  return new Function('umV2ToSheetsV2Block', 'UM_V2_SHEETS_HEADERS', body)(umV2ToSheetsV2Block, UM_V2_SHEETS_HEADERS);
}
const fileNew = (f) => readFileSync(path.join(WT, f), 'utf8');
const fileOld = (f) => execSync(`git -C "${WT}" show e7b8323:${f}`, { encoding: 'utf8', maxBuffer: 1 << 26 });

const B_NAMES = ['mapBangkitDataToSheetRow', 'mapUMToUpwardMobilitySheetRow'];
const M_NAMES = ['mapMajuDataToSheetRow', 'mapUMDataToSheetRow'];
const R_NAMES = ['mapBangkitDataToSheetRow'];
const bNew = load(fileNew('pages/api/submitBangkit.js'), B_NAMES);
const bOld = load(fileOld('pages/api/submitBangkit.js'), B_NAMES);
const mNew = load(fileNew('pages/api/submitMajuReportum.js'), M_NAMES);
const mOld = load(fileOld('pages/api/submitMajuReportum.js'), M_NAMES);
const rNew = load(fileNew('pages/api/admin/reports/[id]/revise.js'), R_NAMES);

// ---- payloads
const v2State = (sesi) => serializeUMV2({
  ...INITIAL_UM_V2_STATE,
  status: 'G3', kriteria_improvement: 'Income/Sale, Saving', tarikh_lawatan: 'Belum dilawat',
  bimb: { akaun_semasa: 'Ya', bimb_biz: 'Tidak', pos_perisian: 'Ya', al_awfar: 'Tidak', merchant_terminal: 'Ya',
          fasiliti_lain: 'Tidak', akaun_pengurusan: 'Ya', pengisytiharan_cukai: 'Tidak' },
  pendapatan: '8000', ulasan_pendapatan: 'Naik', pekerja_ft: '2', pekerja_pt: '0', ulasan_pekerjaan: 'Tambah 1',
  simpanan: '0', ulasan_simpanan: 'Tiada', zakat: '0', ulasan_zakat: 'Belum',
  media_sosial: ['perkenal_produk', 'cari_pelanggan'], ulasan_media_sosial: 'FB, TikTok',
  edagang_saluran: ['belum'], edagang_whatsapp: 'Ya', ulasan_edagang: 'WhatsApp sahaja',
  swot: { justifikasi: 'Asas', kekuatan: ['kualiti_produk'], kelemahan: ['wang_bercampur', 'lain_lain'],
          peluang: ['geran_bantuan_agensi'], ancaman: ['kos_input_meningkat', 'cuaca_banjir'],
          nota: { S: '', W: 'Tiada sistem stok', O: '', T: 'Banjir 2024' } },
}, { sesiNumber: sesi });

const v1UM = {
  UM_STATUS: 'G2', UM_KRITERIA_IMPROVEMENT: 'Improve Credit Score', UM_AKAUN_BIMB: 'Ya', UM_BIMB_BIZ: 'Tidak',
  UM_AL_AWFAR: 'Ya', UM_MERCHANT_TERMINAL: 'Tidak', UM_FASILITI_LAIN: 'Tidak', UM_MESINKIRA: 'Ya',
  UM_PENDAPATAN_SEMASA: '5000', UM_ULASAN_PENDAPATAN: 'x', UM_PEKERJA_SEMASA: '1', UM_ULASAN_PEKERJA: 'y',
  UM_ASET_BUKAN_TUNAI_SEMASA: '10000', UM_PEKERJA_PARTTIME_SEMASA: '1', UM_ULASAN_PEKERJA_PARTTIME: 'z',
  UM_ULASAN_ASET_BUKAN_TUNAI: 'mesin', UM_SIMPANAN_SEMASA: '300', UM_ULASAN_SIMPANAN: 's', UM_ZAKAT_SEMASA: '0',
  UM_ULASAN_ZAKAT: 'q', UM_DIGITAL_SEMASA: 'Ya', UM_ULASAN_DIGITAL: 'd', UM_MARKETING_SEMASA: 'Ya',
  UM_ULASAN_MARKETING: 'm', UM_TARIKH_LAWATAN_PREMIS: '2026-01-15',
};
const bangkitBase = (sesi, um) => ({
  mentorEmail: 'm@x.my', status: 'Selesai', sesiLaporan: sesi, usahawan: 'TEST22', namaSyarikat: 'Syk',
  namaMentor: 'Mentor', entrepreneur_id: 'e-1', UPWARD_MOBILITY_JSON: JSON.stringify(um),
});
const majuBase = (sesi, um) => ({
  NAMA_MENTOR: 'Mentor', EMAIL_MENTOR: 'm@x.my', NAMA_MENTEE: 'TEST22', SESI_NUMBER: sesi,
  MIA_STATUS: 'Tidak MIA', entrepreneur_id: 'e-1', UPWARD_MOBILITY_JSON: JSON.stringify(um),
});

// What the handlers now pass to the mappers (mirrors submitBangkit / submitMajuReportum)
const sheetsData = (base, v2, { umVersion, isMIA, sesi }) => ({
  ...base,
  ...(v2 && { UPWARD_MOBILITY_JSON: JSON.stringify(umV2ToSheetsUM(v2)) }),
  UM_SHEETS_V2_BLOCK: umV2ToSheetsV2Block(v2, { umVersion, isMIA, sesiNumber: sesi }),
});

const block = (row, start) => row.slice(start, start + 18);
const mask = (row) => row.map((v, i) => (i === 0 ? '<ts>' : v)); // timestamp column

// ---- 1. the block function
console.log('\n1. umV2ToSheetsV2Block');
const s1 = v2State(1), s2 = v2State(2);
ok(validateUpwardMobilityV2(s1, { sesiNumber: 1 }).length === 0, 'sample v2 Sesi 1 payload passes v2 validation');
ok(validateUpwardMobilityV2(s2, { sesiNumber: 2 }).length === 0, 'sample v2 Sesi 2 payload passes v2 validation');
const b1 = umV2ToSheetsV2Block(s1, { umVersion: 2, sesiNumber: 1 });
const b2 = umV2ToSheetsV2Block(s2, { umVersion: 2, sesiNumber: 2 });
const b2leak = umV2ToSheetsV2Block({ ...s2, swot: s1.swot }, { umVersion: 2, sesiNumber: 2 });
const bv1 = umV2ToSheetsV2Block(null);
const bmia = umV2ToSheetsV2Block(null, { umVersion: 2, isMIA: true, sesiNumber: 1 });
ok(UM_V2_SHEETS_HEADERS.length === 18 && [b1, b2, bv1, bmia].every((b) => b.length === 18), 'all blocks have 18 values');
console.log('     Sesi 1 block:'); UM_V2_SHEETS_HEADERS.forEach((h, i) => console.log(`       ${h.padEnd(24)} ${JSON.stringify(b1[i])}`));
ok(b1[0] === '2' && b1[4] === 'Perkenal produk / jenama; Cari pelanggan baharu', 'v2: UM_VERSI=2, Media Sosial = labels joined with "; "');
ok(b1[6] === 'Belum menerima tempahan online' && b1[7] === 'Ya', 'v2: exclusive E-Dagang label + WhatsApp');
ok(b1[11] === 'Wang bisnes dan peribadi bercampur; Lain-lain' && b1[15] === 'Tiada sistem stok' && b1[14] === '', 'v2 Sesi 1: SWOT labels + notes per quadrant');
ok(b2.slice(9).every((v) => v === '') && b2[0] === '2' && b2[4] !== '', 'v2 Sesi 2: SWOT columns empty, rest filled');
ok(b2leak.slice(9).every((v) => v === ''), 'v2 Sesi 2: SWOT sent by a client is still not written');
ok(bv1[0] === '1' && bv1.slice(1).every((v) => v === ''), "v1: ['1', '' x17]");
ok(bmia[0] === '2' && bmia.slice(1).every((v) => v === ''), "v2 MIA: ['2', '' x17]");
ok(umV2ToSheetsUM(s1).UM_STATUS_PENGLIBATAN === 'Active', "umV2ToSheetsUM: UM_STATUS_PENGLIBATAN = 'Active'");

// ---- 2. mappers: length + block position
console.log('\n2. Mapper length and block position');
const cases = [
  ['v2 Sesi 1', s1, 1, 2], ['v2 Sesi 2', s2, 2, 2], ['v1 Sesi 2', null, 2, 1],
];
for (const [label, v2, sesi, ver] of cases) {
  const um = v2 || v1UM;
  const bd = sheetsData(bangkitBase(sesi, um), v2, { umVersion: ver, sesi });
  const md = sheetsData(majuBase(sesi, um), v2, { umVersion: ver, sesi });
  const exp = umV2ToSheetsV2Block(v2, { umVersion: ver, sesiNumber: sesi });
  const bRow = bNew.mapBangkitDataToSheetRow(bd, null);
  const buRow = bNew.mapUMToUpwardMobilitySheetRow(bd, JSON.parse(bd.UPWARD_MOBILITY_JSON), 'Batch 10');
  const mRow = mNew.mapMajuDataToSheetRow(md);
  const muRow = mNew.mapUMDataToSheetRow(md, JSON.parse(md.UPWARD_MOBILITY_JSON), 'Batch 9');
  console.log(`   ${label}`);
  ok(bRow.length === 112 && JSON.stringify(block(bRow, 94)) === JSON.stringify(exp) && bRow[93] === '',
    `Bangkit tab: length ${bRow.length} (A–DH), block at ${col(94)}–${col(111)}, CP empty`);
  ok(buRow.length === 90 && JSON.stringify(block(buRow, 72)) === JSON.stringify(exp),
    `UM tab (Bangkit): length ${buRow.length} (A–CL), block at ${col(72)}–${col(89)}`);
  ok(mRow.length === 86 && JSON.stringify(block(mRow, 68)) === JSON.stringify(exp) && mRow[67] === '',
    `LaporanMajuUM: length ${mRow.length} (A–CH), block at ${col(68)}–${col(85)}, BP empty`);
  ok(muRow.length === 90 && JSON.stringify(block(muRow, 72)) === JSON.stringify(exp),
    `UM tab (Maju): length ${muRow.length} (A–CL), block at ${col(72)}–${col(89)}`);
  const act = ver === 2 ? 'Active' : '';
  ok(bRow[54] === act && buRow[44] === act && mRow[30] === act && muRow[44] === act,
    `UM_STATUS_PENGLIBATAN = '${act}' (Bangkit BC, UM AS, LaporanMajuUM AE, UM AS)`);
  if (ver === 2) {
    ok(bRow[57] === 'Ya' && bRow[62] === '' && mRow[33] === 'Ya' && mRow[38] === '',
      'v2: shared channels in v1 slots, UM_MESINKIRA empty');
  }
}

// ---- 3. v1 unchanged vs stage2 (except UM_VERSI='1' + empty block)
console.log('\n3. v1 output vs stage2 (e7b8323)');
const v1b = bangkitBase(2, v1UM), v1m = majuBase(2, v1UM);
const v1bNewData = sheetsData(v1b, null, { umVersion: 1, sesi: 2 });
const v1mNewData = sheetsData(v1m, null, { umVersion: 1, sesi: 2 });
const pairs = [
  ['Bangkit tab', mask(bOld.mapBangkitDataToSheetRow(v1b, null)), mask(bNew.mapBangkitDataToSheetRow(v1bNewData, null)), 94],
  ['UM tab (Bangkit)', mask(bOld.mapUMToUpwardMobilitySheetRow(v1b, v1UM, 'B7')), mask(bNew.mapUMToUpwardMobilitySheetRow(v1bNewData, v1UM, 'B7')), 72],
  ['LaporanMajuUM', mask(mOld.mapMajuDataToSheetRow(v1m)), mask(mNew.mapMajuDataToSheetRow(v1mNewData)), 68],
  ['UM tab (Maju)', mask(mOld.mapUMDataToSheetRow(v1m, v1UM, 'B6')), mask(mNew.mapUMDataToSheetRow(v1mNewData, v1UM, 'B6')), 72],
];
for (const [label, oldRow, newRow, start] of pairs) {
  const prefixSame = JSON.stringify(newRow.slice(0, oldRow.length)) === JSON.stringify(oldRow);
  const gap = newRow.slice(oldRow.length, start).every((v) => v === '');
  const tail = JSON.stringify(newRow.slice(start)) === JSON.stringify(['1', ...Array(17).fill('')]);
  ok(prefixSame && gap && tail, `${label}: first ${oldRow.length} columns identical, then ${start - oldRow.length} empty, then ['1', '' x17] (${oldRow.length} → ${newRow.length})`);
}

// ---- 4. revise.js mapper still A–CI (block goes in a separate CQ–DH range)
console.log('\n4. revise.js');
const rRow = rNew.mapBangkitDataToSheetRow({ ...bangkitBase(1, s1), UPWARD_MOBILITY_JSON: JSON.stringify(umV2ToSheetsUM(s1)) });
ok(rRow.length === 87 && rRow[55] === 'G3' && rRow[54] === 'Active', 'revise mapper: 87 columns (A–CI); v2 shared fields + Active land in v1 slots');

console.log(failures ? `\n❌ ${failures} check(s) failed` : '\n✅ all checks passed');
process.exit(failures ? 1 : 0);
