import { useState, useEffect } from 'react';
import {
  UM_STATUS_OPTIONS,
  GRADE_CRITERIA_MAP_V2,
  BIMB_CHANNELS,
  MEDIA_SOSIAL_OPTIONS,
  EDAGANG_OPTIONS,
  SWOT_QUADRANTS,
  SWOT_MAX_TAGS,
  SWOT_NOTE_MAX,
  LAIN_LAIN,
  requiresSwot,
  swotTagsFor,
  toggleCode,
} from '../lib/upwardMobilityV2';
import { calculateTagClickValue } from '../lib/upwardMobilityUtils';

// UM v2 form section (B10 Bangkit / M9 Maju onward). UMSection.jsx remains the v1 form.
// onChange receives an updater: (prevState) => nextState.

const inputCls =
  'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

function SectionCard({ title, children }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <span className="ml-auto px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
          UPWARD MOBILITY
        </span>
      </div>
      {children}
    </div>
  );
}

function NumberInput({ label, value, onChange, placeholder, integer }) {
  return (
    <div className="mb-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={integer ? '1' : '0.01'}
        min="0"
        required
        className={inputCls}
      />
    </div>
  );
}

function UlasanTextarea({ label, value, onChange, placeholder }) {
  return (
    <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        required
        className={inputCls}
      />
    </div>
  );
}

function YaTidak({ name, value, onChange }) {
  return (
    <div className="flex gap-4">
      {['Ya', 'Tidak'].map((opt) => (
        <label key={opt} className="flex items-center cursor-pointer">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
            className="mr-2"
          />
          <span>{opt}</span>
        </label>
      ))}
    </div>
  );
}

function MultiSelect({ options, value, onToggle }) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.code} className="flex items-center p-2 hover:bg-orange-50 rounded cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(opt.code)}
            onChange={(e) => onToggle(opt.code, e.target.checked)}
            className="mr-3"
          />
          <span className={opt.exclusive ? 'italic text-gray-700' : ''}>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

export default function UMSectionV2({ umState, onChange, sesiNumber, praisiDari }) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => setBannerDismissed(false), [praisiDari]);

  const set = (field, value) => onChange((prev) => ({ ...prev, [field]: value }));
  const setBimb = (field, value) => onChange((prev) => ({ ...prev, bimb: { ...prev.bimb, [field]: value } }));
  const setSwot = (patch) => onChange((prev) => ({ ...prev, swot: { ...prev.swot, ...patch } }));
  const setNote = (noteKey, value) =>
    onChange((prev) => ({ ...prev, swot: { ...prev.swot, nota: { ...prev.swot.nota, [noteKey]: value } } }));

  const toggleSwotTag = (quadrantKey, code) =>
    onChange((prev) => {
      const current = prev.swot[quadrantKey] || [];
      const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : current.length >= SWOT_MAX_TAGS
          ? current
          : [...current, code];
      return { ...prev, swot: { ...prev.swot, [quadrantKey]: next } };
    });

  const showSwot = requiresSwot(sesiNumber);

  return (
    <>
      {praisiDari && !bannerDismissed && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start justify-between mb-4">
          <p className="text-sm text-amber-800">
            ⚡ Data dipra-isi dari <strong>{praisiDari}</strong> — sila semak dan kemaskini
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            className="ml-4 text-amber-600 hover:text-amber-800 text-xl leading-none"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* ── Bahagian 3: Status & Mobiliti ── */}
        <SectionCard title="Bahagian 3: Status &amp; Mobiliti Usahawan">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upward Mobility Status <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {UM_STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-start p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all"
                >
                  <input
                    type="radio"
                    name="UM_V2_STATUS"
                    value={opt.value}
                    checked={umState.status === opt.value}
                    onChange={(e) => set('status', e.target.value)}
                    className="mr-3 mt-1"
                  />
                  <div>
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-gray-600">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {GRADE_CRITERIA_MAP_V2[umState.status] && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💡 Quick Tags - Klik untuk tambah ke kriteria:
              </label>
              <div className="flex flex-wrap gap-2">
                {GRADE_CRITERIA_MAP_V2[umState.status].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => set('kriteria_improvement', calculateTagClickValue(umState.kriteria_improvement, tag))}
                    className="px-3 py-1.5 bg-white border-2 border-blue-400 text-blue-700 rounded-full hover:bg-blue-500 hover:text-white hover:border-blue-600 transition-all duration-200 text-sm font-medium shadow-sm"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Jika G1/G2/G3, nyatakan kriteria improvement
            </label>
            <textarea
              value={umState.kriteria_improvement}
              onChange={(e) => set('kriteria_improvement', e.target.value)}
              rows={3}
              className={inputCls}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Tarikh Lawatan ke Premis</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="UM_V2_LAWATAN"
                  checked={umState.tarikh_lawatan !== '' && umState.tarikh_lawatan !== 'Belum dilawat'}
                  onChange={() => umState.tarikh_lawatan === 'Belum dilawat' && set('tarikh_lawatan', '')}
                  className="mr-2"
                />
                <span>Sudah dilawat</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="UM_V2_LAWATAN"
                  checked={umState.tarikh_lawatan === 'Belum dilawat'}
                  onChange={() => set('tarikh_lawatan', 'Belum dilawat')}
                  className="mr-2"
                />
                <span>Belum dilawat</span>
              </label>
            </div>
            {umState.tarikh_lawatan !== 'Belum dilawat' && (
              <input
                type="date"
                value={umState.tarikh_lawatan || ''}
                onChange={(e) => set('tarikh_lawatan', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </SectionCard>

        {/* ── Bahagian 4: Saluran Bank Islam ── */}
        <SectionCard title="Bahagian 4: Penggunaan Saluran Bank Islam &amp; Pengurusan">
          <div className="space-y-3">
            {BIMB_CHANNELS.map((c) => (
              <div key={c.field} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-700 mb-1">
                  {c.label} <span className="text-red-500">*</span>
                </div>
                {c.help && <p className="text-sm text-gray-600 mb-2">{c.help}</p>}
                <YaTidak name={`UM_V2_BIMB_${c.field}`} value={umState.bimb?.[c.field]} onChange={(v) => setBimb(c.field, v)} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Bahagian 5: Dimensi 1–4 ── */}
        <SectionCard title="Bahagian 5: Situasi Perniagaan (Semasa)">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-md">
            <p className="text-sm text-blue-800">💡 Masukkan maklumat SEMASA sahaja. Masukkan 0 jika tiada.</p>
          </div>
          <div className="space-y-6">
            <div className="border-l-4 border-orange-300 pl-4">
              <NumberInput label="1. Jualan / Pendapatan (RM sebulan)" value={umState.pendapatan} onChange={(v) => set('pendapatan', v)} placeholder="Cth: 8000" />
              <UlasanTextarea label="Ulasan Mentor" value={umState.ulasan_pendapatan} onChange={(v) => set('ulasan_pendapatan', v)} placeholder="Cth: Jualan meningkat berbanding sesi lepas." />
            </div>

            <div className="border-l-4 border-orange-300 pl-4">
              <div className="font-medium text-gray-800 mb-2">2. Penciptaan Pekerjaan</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberInput label="Pekerja sepenuh masa (FT)" value={umState.pekerja_ft} onChange={(v) => set('pekerja_ft', v)} placeholder="Cth: 2" integer />
                <NumberInput label="Pekerja separuh masa (PT)" value={umState.pekerja_pt} onChange={(v) => set('pekerja_pt', v)} placeholder="Cth: 1" integer />
              </div>
              <UlasanTextarea label="Ulasan Mentor (Pekerjaan)" value={umState.ulasan_pekerjaan} onChange={(v) => set('ulasan_pekerjaan', v)} placeholder="Cth: Tambah 1 pekerja sambilan untuk musim perayaan." />
            </div>

            <div className="border-l-4 border-orange-300 pl-4">
              <NumberInput label="3. Simpanan Perniagaan (RM)" value={umState.simpanan} onChange={(v) => set('simpanan', v)} placeholder="Cth: 3000" />
              <UlasanTextarea label="Ulasan Mentor" value={umState.ulasan_simpanan} onChange={(v) => set('ulasan_simpanan', v)} placeholder="Cth: Usahawan mula ada simpanan kecemasan." />
            </div>

            <div className="border-l-4 border-orange-300 pl-4">
              <NumberInput label="4. Zakat Perniagaan (RM)" value={umState.zakat} onChange={(v) => set('zakat', v)} placeholder="Cth: 500 (0 jika tidak bayar zakat)" />
              <UlasanTextarea label="Ulasan Mentor" value={umState.ulasan_zakat} onChange={(v) => set('ulasan_zakat', v)} placeholder="Cth: Belum bayar zakat tahun ini." />
            </div>
          </div>
        </SectionCard>

        {/* ── Bahagian 6: Media Sosial & E-Dagang ── */}
        <SectionCard title="Bahagian 6: Media Sosial &amp; E-Dagang">
          <div className="space-y-6">
            <div className="border-l-4 border-orange-300 pl-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                5. Media Sosial: bagaimana usahawan menggunakannya? (pilih semua yang berkaitan) <span className="text-red-500">*</span>
              </label>
              <MultiSelect
                options={MEDIA_SOSIAL_OPTIONS}
                value={umState.media_sosial}
                onToggle={(code, checked) => set('media_sosial', toggleCode(umState.media_sosial, code, checked, MEDIA_SOSIAL_OPTIONS))}
              />
              <UlasanTextarea label="Ulasan Mentor (platform dan contoh)" value={umState.ulasan_media_sosial} onChange={(v) => set('ulasan_media_sosial', v)} placeholder="Cth: Aktif di TikTok dan Facebook, buat live 2 kali seminggu." />
            </div>

            <div className="border-l-4 border-orange-300 pl-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                6. E-Dagang: saluran tempahan online (pilih semua yang berkaitan) <span className="text-red-500">*</span>
              </label>
              <MultiSelect
                options={EDAGANG_OPTIONS}
                value={umState.edagang_saluran}
                onToggle={(code, checked) => set('edagang_saluran', toggleCode(umState.edagang_saluran, code, checked, EDAGANG_OPTIONS))}
              />
              <div className="mt-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Tempahan melalui WhatsApp atau mesej biasa <span className="text-red-500">*</span>
                </div>
                <YaTidak name="UM_V2_EDAGANG_WHATSAPP" value={umState.edagang_whatsapp} onChange={(v) => set('edagang_whatsapp', v)} />
              </div>
              <UlasanTextarea label="Ulasan Mentor (E-Dagang)" value={umState.ulasan_edagang} onChange={(v) => set('ulasan_edagang', v)} placeholder="Cth: 30% tempahan datang dari Shopee." />
            </div>
          </div>
        </SectionCard>

        {/* ── Bahagian 7: SWOT (Sesi 1 & 3) ── */}
        {showSwot && (
          <SectionCard title="Bahagian 7: Analisis SWOT">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-md">
              <p className="text-sm text-blue-800">
                💡 Pilih 1 hingga {SWOT_MAX_TAGS} tag bagi setiap kuadran. Nota pilihan (maksimum {SWOT_NOTE_MAX} aksara) wajib diisi jika memilih &quot;Lain-lain&quot;.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Justifikasi SWOT <span className="text-red-500">*</span>
              </label>
              <textarea
                value={umState.swot?.justifikasi || ''}
                onChange={(e) => setSwot({ justifikasi: e.target.value })}
                rows={3}
                placeholder="Ringkasan kedudukan usahawan berdasarkan SWOT ini."
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {SWOT_QUADRANTS.map((q) => {
                const selected = umState.swot?.[q.key] || [];
                const full = selected.length >= SWOT_MAX_TAGS;
                const note = umState.swot?.nota?.[q.noteKey] || '';
                const needsNote = selected.includes(LAIN_LAIN);
                const groups = [...q.groups, { label: null, tags: swotTagsFor(q.key).filter((t) => t.code === LAIN_LAIN) }];
                return (
                  <div key={q.key} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-800">
                        {q.noteKey}: {q.label} <span className="text-red-500">*</span>
                      </span>
                      <span className={`text-xs font-medium ${full ? 'text-orange-700' : 'text-gray-500'}`}>
                        {selected.length}/{SWOT_MAX_TAGS}
                      </span>
                    </div>
                    {groups.map((g, gi) => (
                      <div key={gi} className="mb-2">
                        {g.label && <div className="text-xs font-semibold text-gray-500 uppercase mb-1">{g.label}</div>}
                        <div className="flex flex-wrap gap-2">
                          {g.tags.map((t) => {
                            const on = selected.includes(t.code);
                            return (
                              <button
                                key={t.code}
                                type="button"
                                onClick={() => toggleSwotTag(q.key, t.code)}
                                disabled={!on && full}
                                aria-pressed={on}
                                className={`px-3 py-1 rounded-full text-sm border-2 transition-all ${
                                  on
                                    ? 'bg-orange-500 border-orange-600 text-white'
                                    : 'bg-white border-gray-300 text-gray-700 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed'
                                }`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <label className="block text-xs font-medium text-gray-600 mt-3">
                      Nota {needsNote ? <span className="text-red-500">* (wajib untuk Lain-lain)</span> : '(pilihan)'}
                    </label>
                    <input
                      type="text"
                      value={note}
                      maxLength={SWOT_NOTE_MAX}
                      onChange={(e) => setNote(q.noteKey, e.target.value)}
                      className={inputCls}
                    />
                    <div className="text-right text-xs text-gray-400">{note.length}/{SWOT_NOTE_MAX}</div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </div>
    </>
  );
}
