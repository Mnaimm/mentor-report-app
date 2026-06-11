import { useState, useEffect } from 'react';
import {
  GRADE_CRITERIA_MAP,
  UPWARD_MOBILITY_SECTIONS,
  calculateCheckboxValue,
  calculateTagClickValue,
} from '../lib/upwardMobilityUtils';

const inputCls =
  'mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

function NumberInput({ label, value, onChange, placeholder, min, disabled }) {
  return (
    <div className="mb-1">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        step="0.01"
        min={min}
        required
        disabled={disabled}
        className={inputCls}
      />
    </div>
  );
}

function UlasanTextarea({ label, value, onChange, placeholder, disabled }) {
  return (
    <div className="mb-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={2}
        placeholder={placeholder}
        required
        disabled={disabled}
        className={inputCls}
      />
    </div>
  );
}

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

export default function UMSection({ umState, onUmChange, lockedSections, onLockSection, praisiDari }) {
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const tarikhLawatanCarried = !!(
    praisiDari &&
    umState.UM_TARIKH_LAWATAN_PREMIS &&
    umState.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat'
  );

  useEffect(() => {
    setBannerDismissed(false);
  }, [praisiDari]);

  const handleCheckboxChange = (field, value, checked) => {
    onUmChange(field, calculateCheckboxValue(umState[field], value, checked));
  };

  const handleTagClick = (tag) => {
    onUmChange('UM_KRITERIA_IMPROVEMENT', calculateTagClickValue(umState.UM_KRITERIA_IMPROVEMENT, tag));
  };

  return (
    <>
      {/* Prefill banner */}
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
        {/* ── Section 3: Status & Mobiliti ── */}
        <SectionCard title="Bahagian 3: Status &amp; Mobiliti Usahawan">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-md">
            <p className="text-sm text-blue-800">
              💡 Bahagian ini untuk menilai tahap kemajuan usahawan dalam program mentoring.
            </p>
          </div>

          {/* UM Status radio */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upward Mobility Status <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {[
                { value: 'G1', label: 'Grade 1 (G1)', desc: ' - Lulus kemudahan/fasiliti SME' },
                { value: 'G2', label: 'Grade 2 (G2)', desc: ' - Berjaya improve credit worthiness' },
                { value: 'G3', label: 'Grade 3 (G3)', desc: ' - Improve mana-mana bahagian bisnes' },
                { value: 'NIL', label: 'NIL', desc: ' - Tiada peningkatan' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-start p-3 border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all"
                >
                  <input
                    type="radio"
                    name="UM_STATUS"
                    value={opt.value}
                    checked={umState.UM_STATUS === opt.value}
                    onChange={(e) => onUmChange('UM_STATUS', e.target.value)}
                    className="mr-3 mt-1"
                    required
                  />
                  <div>
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-gray-600">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Quick tags */}
          {umState.UM_STATUS && umState.UM_STATUS !== 'NIL' && GRADE_CRITERIA_MAP[umState.UM_STATUS] && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💡 Quick Tags - Klik untuk tambah ke kriteria:
              </label>
              <div className="flex flex-wrap gap-2">
                {GRADE_CRITERIA_MAP[umState.UM_STATUS].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className="px-3 py-1.5 bg-white border-2 border-blue-400 text-blue-700 rounded-full hover:bg-blue-500 hover:text-white hover:border-blue-600 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Klik mana-mana tag di atas untuk menambahnya ke dalam textarea di bawah. Anda masih boleh taip sendiri jika perlu.
              </p>
            </div>
          )}

          {/* Kriteria improvement */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Jika G1/G2/G3, nyatakan kriteria improvement
            </label>
            <textarea
              value={umState.UM_KRITERIA_IMPROVEMENT}
              onChange={(e) => onUmChange('UM_KRITERIA_IMPROVEMENT', e.target.value)}
              rows={3}
              placeholder="Contoh: Grade 2 - Berjaya bayar balik pinjaman tepat pada masa, credit score meningkat dari C kepada B"
              className={inputCls}
            />
          </div>

          {/* Tarikh Lawatan ke Premis */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Tarikh Lawatan ke Premis
            </label>
            {tarikhLawatanCarried && (
              <span className="inline-flex items-center text-sm font-medium text-green-600 border border-green-500 rounded px-2 py-1 bg-green-50">
                ✓ Disalin dari {praisiDari}
              </span>
            )}
            <div className={`flex gap-4 mb-2${tarikhLawatanCarried ? ' opacity-50' : ''}`}>
              <label className={`flex items-center ${tarikhLawatanCarried ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  name="UM_TARIKH_LAWATAN_STATUS"
                  value="sudah"
                  checked={
                    umState.UM_TARIKH_LAWATAN_PREMIS !== '' &&
                    umState.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat'
                  }
                  onChange={(e) => {
                    if (!tarikhLawatanCarried && e.target.checked && umState.UM_TARIKH_LAWATAN_PREMIS === 'Belum dilawat') {
                      onUmChange('UM_TARIKH_LAWATAN_PREMIS', '');
                    }
                  }}
                  className="mr-2"
                  disabled={tarikhLawatanCarried}
                />
                <span>Sudah dilawat</span>
              </label>
              <label className={`flex items-center ${tarikhLawatanCarried ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="radio"
                  name="UM_TARIKH_LAWATAN_STATUS"
                  value="belum"
                  checked={umState.UM_TARIKH_LAWATAN_PREMIS === 'Belum dilawat'}
                  onChange={(e) => {
                    if (!tarikhLawatanCarried && e.target.checked) {
                      onUmChange('UM_TARIKH_LAWATAN_PREMIS', 'Belum dilawat');
                    }
                  }}
                  className="mr-2"
                  disabled={tarikhLawatanCarried}
                />
                <span>Belum dilawat</span>
              </label>
            </div>
            {umState.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat' && (
              <input
                type="date"
                value={umState.UM_TARIKH_LAWATAN_PREMIS || ''}
                onChange={(e) => !tarikhLawatanCarried && onUmChange('UM_TARIKH_LAWATAN_PREMIS', e.target.value)}
                disabled={tarikhLawatanCarried}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500${tarikhLawatanCarried ? ' opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
              />
            )}
          </div>
        </SectionCard>

        {/* ── Section 4: Bank Islam & Fintech ── */}
        <SectionCard title={UPWARD_MOBILITY_SECTIONS.SECTION_4.title}>
          {praisiDari && !lockedSections.bank && (
            <button
              type="button"
              onClick={() => onLockSection('bank', true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded mb-3"
            >
              🔒 Tidak Berubah
            </button>
          )}
          {lockedSections.bank && (
            <span className="inline-flex items-center text-sm font-medium text-green-600 border border-green-500 rounded px-2 py-1.5 mb-3 bg-green-50">
              ✓ Disalin dari {praisiDari}
              <button
                type="button"
                onClick={() => onLockSection('bank', false)}
                className="ml-2 text-gray-400 hover:text-gray-700"
              >
                Edit
              </button>
            </span>
          )}
          <div className={`space-y-4${lockedSections.bank ? ' opacity-50 cursor-not-allowed' : ''}`}>
            {UPWARD_MOBILITY_SECTIONS.SECTION_4.items.map((item) => (
              <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-700 mb-2">{item.title}</div>
                <div className="text-sm text-gray-600 mb-3">
                  {item.desc.split('\n').map((line, i) => (
                    <p key={i} className="mb-1">
                      {line.includes('Klik Yes') || line.includes('Klik No') ? (
                        <>
                          <strong>{line.split('-')[0]}</strong> -{line.split('-').slice(1).join('-')}
                        </>
                      ) : (
                        line
                      )}
                    </p>
                  ))}
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="Ya"
                      checked={umState[item.id] === 'Ya'}
                      onChange={(e) => onUmChange(item.id, e.target.value)}
                      className="mr-2"
                      disabled={lockedSections.bank}
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="Tidak"
                      checked={umState[item.id] === 'Tidak'}
                      onChange={(e) => onUmChange(item.id, e.target.value)}
                      className="mr-2"
                      disabled={lockedSections.bank}
                    />
                    <span>No</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Section 5: Situasi Kewangan Perniagaan ── */}
        <SectionCard title={UPWARD_MOBILITY_SECTIONS.SECTION_5.title}>
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4 rounded-md">
            <p className="text-sm text-blue-800">{UPWARD_MOBILITY_SECTIONS.SECTION_5.infoMessage}</p>
          </div>
          {praisiDari && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              <span>⚡</span>
              <span>Nilai dipra-isi dari sesi lepas — sila kemaskini mengikut situasi semasa</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Items 0-2: pendapatan, pekerja, pekerja_parttime — always editable */}
            {UPWARD_MOBILITY_SECTIONS.SECTION_5.items.slice(0, 3).map((item) => (
              <div key={item.field} className="border-l-4 border-orange-300 pl-4">
                <NumberInput
                  label={item.label}
                  value={umState[item.field]}
                  onChange={(e) => onUmChange(item.field, e.target.value)}
                  placeholder={item.placeholder}
                  min={item.type === 'number_rm' ? '0' : undefined}
                />
                <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <UlasanTextarea
                    label={item.ulasanLabel}
                    value={umState[item.ulasanField]}
                    onChange={(e) => onUmChange(item.ulasanField, e.target.value)}
                    placeholder={item.ulasanPlaceholder}
                  />
                </div>
              </div>
            ))}

            {/* Items 3-5: aset_bukan_tunai, simpanan, zakat — lockable carry-forward group */}
            <div>
              {praisiDari && !lockedSections.aset && (
                <button
                  type="button"
                  onClick={() => onLockSection('aset', true)}
                  className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded mb-3"
                >
                  🔒 Tidak Berubah
                </button>
              )}
              {lockedSections.aset && (
                <span className="inline-flex items-center text-sm font-medium text-green-600 border border-green-500 rounded px-2 py-1.5 mb-3 bg-green-50">
                  ✓ Disalin dari {praisiDari}
                  <button
                    type="button"
                    onClick={() => onLockSection('aset', false)}
                    className="ml-2 text-gray-400 hover:text-gray-700"
                  >
                    Edit
                  </button>
                </span>
              )}
              <div className={`space-y-6${lockedSections.aset ? ' opacity-50 cursor-not-allowed' : ''}`}>
                {UPWARD_MOBILITY_SECTIONS.SECTION_5.items.slice(3).map((item) => (
                  <div key={item.field} className="border-l-4 border-orange-300 pl-4">
                    <NumberInput
                      label={item.label}
                      value={umState[item.field]}
                      onChange={(e) => onUmChange(item.field, e.target.value)}
                      placeholder={item.placeholder}
                      min={item.type === 'number_rm' ? '0' : undefined}
                      disabled={lockedSections.aset}
                    />
                    <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <UlasanTextarea
                        label={item.ulasanLabel}
                        value={umState[item.ulasanField]}
                        onChange={(e) => onUmChange(item.ulasanField, e.target.value)}
                        placeholder={item.ulasanPlaceholder}
                        disabled={lockedSections.aset}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Section 6: Digitalisasi & Pemasaran Online ── */}
        <SectionCard title={UPWARD_MOBILITY_SECTIONS.SECTION_6.title}>
          {praisiDari && !lockedSections.digital && (
            <button
              type="button"
              onClick={() => onLockSection('digital', true)}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded mb-3"
            >
              🔒 Tidak Berubah
            </button>
          )}
          {lockedSections.digital && (
            <span className="inline-flex items-center text-sm font-medium text-green-600 border border-green-500 rounded px-2 py-1.5 mb-3 bg-green-50">
              ✓ Disalin dari {praisiDari}
              <button
                type="button"
                onClick={() => onLockSection('digital', false)}
                className="ml-2 text-gray-400 hover:text-gray-700"
              >
                Edit
              </button>
            </span>
          )}

          <div className={`space-y-6${lockedSections.digital ? ' opacity-50 cursor-not-allowed' : ''}`}>
            {/* Digital */}
            <div className="border-l-4 border-orange-300 pl-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.label}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.options.map((opt) => (
                  <label key={opt} className="flex items-center p-2 hover:bg-orange-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      value={opt}
                      checked={
                        Array.isArray(umState[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field]) &&
                        umState[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field].includes(opt)
                      }
                      onChange={(e) =>
                        handleCheckboxChange(
                          UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field,
                          opt,
                          e.target.checked
                        )
                      }
                      className="mr-3"
                      disabled={lockedSections.digital}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <UlasanTextarea
                  label={UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanLabel}
                  value={umState[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanField]}
                  onChange={(e) =>
                    onUmChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanField, e.target.value)
                  }
                  placeholder={UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanPlaceholder}
                  disabled={lockedSections.digital}
                />
              </div>
            </div>

            {/* Marketing */}
            <div className="border-l-4 border-orange-300 pl-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.label}{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.options.map((opt) => (
                  <label key={opt} className="flex items-center p-2 hover:bg-orange-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      value={opt}
                      checked={
                        Array.isArray(umState[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field]) &&
                        umState[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field].includes(opt)
                      }
                      onChange={(e) =>
                        handleCheckboxChange(
                          UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field,
                          opt,
                          e.target.checked
                        )
                      }
                      className="mr-3"
                      disabled={lockedSections.digital}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <UlasanTextarea
                  label={UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanLabel}
                  value={umState[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanField]}
                  onChange={(e) =>
                    onUmChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanField, e.target.value)
                  }
                  placeholder={UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanPlaceholder}
                  disabled={lockedSections.digital}
                />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  );
}
