// pages/laporan-khas.js — Simplified form for Kes Khas (takeover) mentors
import React, { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import {
  INITIAL_UPWARD_MOBILITY_STATE,
  UPWARD_MOBILITY_SECTIONS,
  GRADE_CRITERIA_MAP,
  calculateCheckboxValue,
  calculateTagClickValue,
  validateUpwardMobility,
} from '../lib/upwardMobilityUtils';

// ── UI primitives ──────────────────────────────────────────────────────────
const Section = ({ title, children, borderColor = 'border-blue-500' }) => (
  <div className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${borderColor}`}>
    <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
    <div className="space-y-4">{children}</div>
  </div>
);

const InputField = ({ label, type = 'text', value, onChange, required = false, disabled = false, placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    />
  </div>
);

const SelectField = ({ label, value, onChange, children, required = false, disabled = false }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
    >
      {children}
    </select>
  </div>
);

const TextArea = ({ label, value, onChange, placeholder, rows = 4, required = false }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder || 'Taip respons anda di sini...'}
      rows={rows}
      required={required}
      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

// ── Main Component ─────────────────────────────────────────────────────────
export default function LaporanKhasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [mentees, setMentees] = useState([]);
  const [selectedMentee, setSelectedMentee] = useState(null);
  const [nextSession, setNextSession] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenteeLoading, setIsMenteeLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [mentorKhasList, setMentorKhasList] = useState([]);
  const [selectedMentorKhas, setSelectedMentorKhas] = useState('');

  const initialForm = {
    session_date: new Date().toISOString().split('T')[0],
    masa_mula: '',
    mod_sesi: 'Face to Face',
    lokasi_f2f: '',
    pemerhatian: '',
    rumusan: '',
    status_perniagaan: '',
    jualan_terkini: Array(12).fill(''),
    data_kewangan_bulanan: [{ bulan: '', jumlah: '', catatan: '' }],
    upwardMobility: { ...INITIAL_UPWARD_MOBILITY_STATE },
  };

  const [form, setForm] = useState(initialForm);

  // ── Detect admin/coordinator mode (no redirect — show monitoring banner) ──
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/khas/check-mentor')
      .then(r => r.json())
      .then(d => {
        if (d.isCoordinator || d.isAdmin) {
          setIsAdminMode(true);
        }
      })
      .catch(() => {});
  }, [status]);

  // ── Load mentor's mentees (non-admin path only) ──
  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/khas/my-mentees')
      .then(r => r.json())
      .then(data => {
        setMentees(Array.isArray(data) ? data : []);
      })
      .catch(() => setMentees([]))
      .finally(() => setIsLoading(false));
  }, [status]);

  // ── Load all khas mentors when in admin mode ──
  useEffect(() => {
    if (!isAdminMode) return;
    fetch('/api/khas/mentors-list')
      .then(r => r.ok ? r.json() : [])
      .then(data => setMentorKhasList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [isAdminMode]);

  const handleMentorKhasChange = async (e) => {
    const mentorId = e.target.value;
    setSelectedMentorKhas(mentorId);
    setSelectedMentee(null);
    setMentees([]);
    setForm(initialForm);
    setNextSession(1);
    setError('');

    if (!mentorId) return;

    try {
      const res = await fetch(`/api/khas/mentee-list?mentor_id=${encodeURIComponent(mentorId)}`);
      const data = await res.json();
      setMentees(Array.isArray(data) ? data : []);
    } catch {
      setMentees([]);
    }
  };

  const handleMenteeChange = async (e) => {
    const entrepreneur_id = e.target.value;
    if (!entrepreneur_id) {
      setSelectedMentee(null);
      setForm(initialForm);
      setNextSession(1);
      return;
    }

    const mentee = mentees.find(m => m.entrepreneur_id === entrepreneur_id);
    setSelectedMentee(mentee);
    setIsMenteeLoading(true);
    setForm(initialForm);
    setError('');

    try {
      const program = mentee.programType;
      const [sessionRes, prefillRes] = await Promise.all([
        fetch(`/api/khas/mentee-session?entrepreneur_id=${encodeURIComponent(entrepreneur_id)}&program=${program}`),
        fetch(`/api/khas/prefill?entrepreneur_id=${encodeURIComponent(entrepreneur_id)}&program=${program}`),
      ]);

      const sessionData = await sessionRes.json();
      const prefillData = await prefillRes.json();

      setNextSession(sessionData.nextSession || 1);

      setForm(prev => ({
        ...prev,
        pemerhatian: prefillData.text || '',
      }));
    } catch {
      setError('Gagal memuatkan data mentee. Sila cuba lagi.');
    } finally {
      setIsMenteeLoading(false);
    }
  };

  const handleUMChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      upwardMobility: { ...prev.upwardMobility, [field]: value },
    }));
  };

  const handleUMCheckboxChange = (field, value, checked) => {
    setForm(prev => {
      const current = prev.upwardMobility[field] || [];
      return {
        ...prev,
        upwardMobility: { ...prev.upwardMobility, [field]: calculateCheckboxValue(current, value, checked) },
      };
    });
  };

  const handleTagClick = (tag) => {
    const current = form.upwardMobility.UM_KRITERIA_IMPROVEMENT || '';
    const updated = calculateTagClickValue(current, tag);
    if (updated !== current) handleUMChange('UM_KRITERIA_IMPROVEMENT', updated);
  };

  const handleKewanganChange = (index, field, value) => {
    setForm(prev => {
      const rows = [...prev.data_kewangan_bulanan];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, data_kewangan_bulanan: rows };
    });
  };

  const addKewanganRow = () => {
    setForm(prev => ({
      ...prev,
      data_kewangan_bulanan: [...prev.data_kewangan_bulanan, { bulan: '', jumlah: '', catatan: '' }],
    }));
  };

  const removeKewanganRow = (index) => {
    setForm(prev => ({
      ...prev,
      data_kewangan_bulanan: prev.data_kewangan_bulanan.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!selectedMentee) { setError('Sila pilih usahawan.'); return; }
    if (!form.session_date) { setError('Sila masukkan tarikh sesi.'); return; }
    if (!form.rumusan?.trim()) { setError('Sila isi rumusan sesi.'); return; }

    const isMaju = selectedMentee.programType === 'maju';

    if (!form.pemerhatian?.trim()) {
      setError(`Sila isi ${isMaju ? 'Latar Belakang Usahawan' : 'Pemerhatian Mentor'}.`);
      return;
    }

    if (form.mod_sesi === 'Face to Face' && !form.lokasi_f2f?.trim()) {
      setError('Sila masukkan lokasi untuk sesi Face to Face.');
      return;
    }

    const umErrors = validateUpwardMobility(form.upwardMobility, false);
    if (umErrors.length > 0) {
      setError(`Sila lengkapkan medan Upward Mobility:\n\n${umErrors.join('\n')}`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    const umJSON = JSON.stringify({
      UM_STATUS: form.upwardMobility.UM_STATUS || '',
      UM_KRITERIA_IMPROVEMENT: form.upwardMobility.UM_KRITERIA_IMPROVEMENT || '',
      UM_AKAUN_BIMB: form.upwardMobility.UM_AKAUN_BIMB || '',
      UM_BIMB_BIZ: form.upwardMobility.UM_BIMB_BIZ || '',
      UM_AL_AWFAR: form.upwardMobility.UM_AL_AWFAR || '',
      UM_MERCHANT_TERMINAL: form.upwardMobility.UM_MERCHANT_TERMINAL || '',
      UM_FASILITI_LAIN: form.upwardMobility.UM_FASILITI_LAIN || '',
      UM_MESINKIRA: form.upwardMobility.UM_MESINKIRA || '',
      UM_PENDAPATAN_SEMASA: form.upwardMobility.UM_PENDAPATAN_SEMASA || '',
      UM_ULASAN_PENDAPATAN: form.upwardMobility.UM_ULASAN_PENDAPATAN || '',
      UM_PEKERJA_SEMASA: form.upwardMobility.UM_PEKERJA_SEMASA || '',
      UM_ULASAN_PEKERJA: form.upwardMobility.UM_ULASAN_PEKERJA || '',
      UM_PEKERJA_PARTTIME_SEMASA: form.upwardMobility.UM_PEKERJA_PARTTIME_SEMASA || '',
      UM_ULASAN_PEKERJA_PARTTIME: form.upwardMobility.UM_ULASAN_PEKERJA_PARTTIME || '',
      UM_ASET_BUKAN_TUNAI_SEMASA: form.upwardMobility.UM_ASET_BUKAN_TUNAI_SEMASA || '',
      UM_ULASAN_ASET_BUKAN_TUNAI: form.upwardMobility.UM_ULASAN_ASET_BUKAN_TUNAI || '',
      UM_SIMPANAN_SEMASA: form.upwardMobility.UM_SIMPANAN_SEMASA || '',
      UM_ULASAN_SIMPANAN: form.upwardMobility.UM_ULASAN_SIMPANAN || '',
      UM_ZAKAT_SEMASA: form.upwardMobility.UM_ZAKAT_SEMASA || '',
      UM_ULASAN_ZAKAT: form.upwardMobility.UM_ULASAN_ZAKAT || '',
      UM_DIGITAL_SEMASA: Array.isArray(form.upwardMobility.UM_DIGITAL_SEMASA)
        ? form.upwardMobility.UM_DIGITAL_SEMASA.join(', ')
        : (form.upwardMobility.UM_DIGITAL_SEMASA || ''),
      UM_ULASAN_DIGITAL: form.upwardMobility.UM_ULASAN_DIGITAL || '',
      UM_MARKETING_SEMASA: Array.isArray(form.upwardMobility.UM_MARKETING_SEMASA)
        ? form.upwardMobility.UM_MARKETING_SEMASA.join(', ')
        : (form.upwardMobility.UM_MARKETING_SEMASA || ''),
      UM_ULASAN_MARKETING: form.upwardMobility.UM_ULASAN_MARKETING || '',
      UM_TARIKH_LAWATAN_PREMIS: form.upwardMobility.UM_TARIKH_LAWATAN_PREMIS || '',
    });

    const payload = {
      entrepreneur_id: selectedMentee.entrepreneur_id,
      program: selectedMentee.programType,
      session_number: nextSession,
      session_date: form.session_date,
      mod_sesi: form.mod_sesi,
      lokasi_f2f: form.mod_sesi === 'Face to Face' ? form.lokasi_f2f : null,
      masa_mula: form.masa_mula || null,
      pemerhatian: isMaju ? null : form.pemerhatian,
      latarbelakang: isMaju ? form.pemerhatian : null,
      rumusan: form.rumusan,
      status_perniagaan: form.status_perniagaan || null,
      jualan_terkini: isMaju ? null : form.jualan_terkini,
      data_kewangan_bulanan: isMaju ? form.data_kewangan_bulanan : null,
      UPWARD_MOBILITY_JSON: umJSON,
    };

    try {
      const res = await fetch('/api/submitKhas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Ralat semasa menghantar laporan.');

      setSuccess(`✅ Laporan Sesi ${nextSession} untuk ${selectedMentee.Usahawan} berjaya dihantar!`);
      setSelectedMentee(null);
      setForm(initialForm);
      setNextSession(1);
      window.scrollTo(0, 0);

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Auth states ──
  if (status === 'loading' || isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-gray-500">Memuatkan...</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <p className="mb-4 text-lg">Sila log masuk untuk mengakses borang ini.</p>
          <button
            onClick={() => signIn('google')}
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700"
          >
            Log Masuk dengan Google
          </button>
        </div>
      </div>
    );
  }

  const isMaju = selectedMentee?.programType === 'maju';

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="max-w-3xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Laporan Kes Khas</h1>
              <p className="text-sm text-gray-500 mt-1">
                Borang ringkas untuk mentor pengambilalihan (takeover)
              </p>
            </div>
            <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded-full">
              KES KHAS
            </span>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Mentor: <strong>{session?.user?.name}</strong>
          </div>
        </div>

        {/* Admin/Coordinator monitoring banner */}
        {isAdminMode && (
          <div className="bg-blue-50 border border-blue-300 text-blue-800 rounded-lg p-4 mb-4 flex items-start gap-3">
            <span className="text-xl">🔍</span>
            <p className="text-sm font-medium">
              Anda melayari borang ini sebagai <strong>Admin/Koordinator</strong>. Borang ini hanya untuk kegunaan mentor Kes Khas.
            </p>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 rounded-lg p-4 mb-4 whitespace-pre-line">
            ❌ {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-300 text-green-800 rounded-lg p-4 mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mentee Selector */}
          <Section title="Pilih Usahawan">
            {/* Admin: mentor khas filter */}
            {isAdminMode && (
              <div>
                <SelectField
                  label="Mentor Kes Khas"
                  onChange={handleMentorKhasChange}
                  value={selectedMentorKhas}
                >
                  <option value="">-- Pilih Mentor --</option>
                  {mentorKhasList.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                  ))}
                </SelectField>
                {mentorKhasList.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Tiada mentor kes khas aktif ditemui.</p>
                )}
              </div>
            )}

            {/* Mentee dropdown — disabled for admin until mentor selected */}
            {!isAdminMode && mentees.length === 0 ? (
              <p className="text-gray-500 text-sm">Tiada usahawan aktif ditemui untuk akaun anda.</p>
            ) : (
              <SelectField
                label="Usahawan"
                required
                onChange={handleMenteeChange}
                value={selectedMentee?.entrepreneur_id || ''}
                disabled={isAdminMode && !selectedMentorKhas}
              >
                <option value="">-- Pilih Usahawan --</option>
                {mentees.map(m => (
                  <option key={m.entrepreneur_id} value={m.entrepreneur_id}>
                    {m.Usahawan} ({m.Batch || m.program})
                  </option>
                ))}
              </SelectField>
            )}

            {selectedMentee && !isMenteeLoading && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg text-sm space-y-1">
                <p><strong>Sesi yang akan diisi:</strong> Sesi {nextSession}</p>
                <p><strong>Program:</strong> {selectedMentee.program}</p>
                <p><strong>Syarikat:</strong> {selectedMentee.Nama_Syarikat || '—'}</p>
                <p><strong>Alamat:</strong> {selectedMentee.Alamat || '—'}</p>
                <p><strong>No. Tel:</strong> {selectedMentee.No_Tel || '—'}</p>
              </div>
            )}

            {isMenteeLoading && (
              <p className="text-sm text-gray-400">Memuatkan maklumat sesi...</p>
            )}
          </Section>

          {selectedMentee && !isMenteeLoading && (
            <>
              {/* Session Info */}
              <Section title="Maklumat Sesi" borderColor="border-green-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InputField
                    label="Tarikh Sesi"
                    type="date"
                    value={form.session_date}
                    onChange={e => setForm(p => ({ ...p, session_date: e.target.value }))}
                    required
                  />
                  <InputField
                    label="Waktu Bermula"
                    type="time"
                    value={form.masa_mula}
                    onChange={e => setForm(p => ({ ...p, masa_mula: e.target.value }))}
                  />
                  <SelectField
                    label="Mod Sesi"
                    value={form.mod_sesi}
                    onChange={e => setForm(p => ({ ...p, mod_sesi: e.target.value }))}
                    required
                  >
                    <option>Face to Face</option>
                    <option>Online</option>
                  </SelectField>
                </div>
                {form.mod_sesi === 'Face to Face' && (
                  <InputField
                    label="Lokasi Sesi (F2F)"
                    value={form.lokasi_f2f}
                    onChange={e => setForm(p => ({ ...p, lokasi_f2f: e.target.value }))}
                    placeholder="Cth: Pejabat usahawan, ABC Cafe"
                    required
                  />
                )}
              </Section>

              {/* Pemerhatian / Latar Belakang */}
              <Section
                title={isMaju ? 'Latar Belakang Usahawan' : 'Pemerhatian Mentor'}
                borderColor="border-yellow-500"
              >
                <p className="text-xs text-gray-500">
                  Dipra-isi dari laporan terdahulu (jika ada). Sila kemaskini mengikut keadaan semasa.
                </p>
                <TextArea
                  label={isMaju ? 'Latar Belakang Usahawan *' : 'Pemerhatian Mentor *'}
                  value={form.pemerhatian}
                  onChange={e => setForm(p => ({ ...p, pemerhatian: e.target.value }))}
                  rows={6}
                  required
                  placeholder={isMaju
                    ? 'Huraikan latar belakang usahawan, perniagaan, dan perkembangan semasa...'
                    : 'Tulis pemerhatian anda tentang usahawan dan perniagaan mereka...'}
                />
              </Section>

              {/* Rumusan Sesi */}
              <Section title="Rumusan Sesi" borderColor="border-blue-500">
                {isMaju && (
                  <InputField
                    label="Status Perniagaan Keseluruhan"
                    value={form.status_perniagaan}
                    onChange={e => setForm(p => ({ ...p, status_perniagaan: e.target.value }))}
                    placeholder="Cth: Baik, Perlu Perhatian, Kritikal"
                  />
                )}
                <TextArea
                  label={isMaju ? 'Rumusan dan Langkah Ke Hadapan *' : 'Rumusan Sesi *'}
                  value={form.rumusan}
                  onChange={e => setForm(p => ({ ...p, rumusan: e.target.value }))}
                  rows={5}
                  required
                  placeholder="Tuliskan rumusan perbincangan dan pelan tindakan..."
                />
              </Section>

              {/* Data Kewangan */}
              {!isMaju ? (
                <Section title="Data Jualan Bulanan" borderColor="border-indigo-500">
                  <p className="text-xs text-gray-500">
                    Masukkan jumlah jualan setiap bulan (RM). Tinggalkan kosong jika tiada data.
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {MONTHS.map((month, i) => (
                      <div key={month}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{month}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.jualan_terkini[i]}
                          onChange={e => {
                            const updated = [...form.jualan_terkini];
                            updated[i] = e.target.value;
                            setForm(p => ({ ...p, jualan_terkini: updated }));
                          }}
                          placeholder="0"
                          className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </Section>
              ) : (
                <Section title="Data Kewangan Bulanan" borderColor="border-indigo-500">
                  <p className="text-xs text-gray-500">
                    Tambah entri kewangan bulanan mengikut keperluan.
                  </p>
                  <div className="space-y-3">
                    {form.data_kewangan_bulanan.map((row, i) => (
                      <div key={i} className="grid grid-cols-3 gap-3 items-end bg-gray-50 p-3 rounded-lg">
                        <InputField
                          label="Bulan"
                          value={row.bulan}
                          onChange={e => handleKewanganChange(i, 'bulan', e.target.value)}
                          placeholder="Cth: Jan 2025"
                        />
                        <InputField
                          label="Jumlah (RM)"
                          type="number"
                          value={row.jumlah}
                          onChange={e => handleKewanganChange(i, 'jumlah', e.target.value)}
                          placeholder="0.00"
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={row.catatan}
                              onChange={e => handleKewanganChange(i, 'catatan', e.target.value)}
                              placeholder="Opsional"
                              className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            />
                            {form.data_kewangan_bulanan.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeKewanganRow(i)}
                                className="px-2 py-2 text-red-500 hover:text-red-700 text-sm"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addKewanganRow}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Tambah Entri
                  </button>
                </Section>
              )}

              {/* Upward Mobility — Section 3: Status */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">Bahagian 3: Status Upward Mobility</h2>
                  <span className="px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                    UPWARD MOBILITY
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status Upward Mobility Semasa *
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {['G1', 'G2', 'G3', 'Lain-lain'].map(grade => (
                        <label key={grade} className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            value={grade}
                            checked={form.upwardMobility.UM_STATUS === grade}
                            onChange={e => handleUMChange('UM_STATUS', e.target.value)}
                            className="mr-2"
                          />
                          <span className="text-sm">{grade}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {form.upwardMobility.UM_STATUS && form.upwardMobility.UM_STATUS !== 'Lain-lain' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kriteria {form.upwardMobility.UM_STATUS}
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {(GRADE_CRITERIA_MAP[form.upwardMobility.UM_STATUS] || []).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleTagClick(tag)}
                            className="px-3 py-1 text-xs rounded-full border border-orange-400 text-orange-700 hover:bg-orange-50 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <TextArea
                    label="Jika G1/G2/G3, nyatakan kriteria improvement"
                    value={form.upwardMobility.UM_KRITERIA_IMPROVEMENT}
                    onChange={e => handleUMChange('UM_KRITERIA_IMPROVEMENT', e.target.value)}
                    rows={3}
                    placeholder="Cth: Grade 2 - Berjaya bayar balik pinjaman tepat pada masa"
                  />

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Tarikh Lawatan ke Premis</label>
                    <div className="flex gap-4 mb-2">
                      {['sudah', 'belum'].map(opt => (
                        <label key={opt} className="flex items-center cursor-pointer">
                          <input
                            type="radio"
                            name="UM_TARIKH_LAWATAN_STATUS"
                            value={opt}
                            checked={opt === 'belum'
                              ? form.upwardMobility.UM_TARIKH_LAWATAN_PREMIS === 'Belum dilawat'
                              : form.upwardMobility.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat'}
                            onChange={() => {
                              if (opt === 'belum') handleUMChange('UM_TARIKH_LAWATAN_PREMIS', 'Belum dilawat');
                              else if (form.upwardMobility.UM_TARIKH_LAWATAN_PREMIS === 'Belum dilawat') handleUMChange('UM_TARIKH_LAWATAN_PREMIS', '');
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{opt === 'sudah' ? 'Sudah dilawat' : 'Belum dilawat'}</span>
                        </label>
                      ))}
                    </div>
                    {form.upwardMobility.UM_TARIKH_LAWATAN_PREMIS !== 'Belum dilawat' && (
                      <input
                        type="date"
                        value={form.upwardMobility.UM_TARIKH_LAWATAN_PREMIS || ''}
                        onChange={e => handleUMChange('UM_TARIKH_LAWATAN_PREMIS', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Upward Mobility — Section 4: BIMB Channels */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">{UPWARD_MOBILITY_SECTIONS.SECTION_4.title}</h2>
                  <span className="px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                    UPWARD MOBILITY
                  </span>
                </div>
                <div className="space-y-4">
                  {UPWARD_MOBILITY_SECTIONS.SECTION_4.items.map(item => (
                    <div key={item.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="font-semibold text-gray-700 mb-2 text-sm">{item.title}</div>
                      <div className="text-xs text-gray-600 mb-3">
                        {item.desc.split('\n').map((line, li) => <p key={li} className="mb-1">{line}</p>)}
                      </div>
                      <div className="flex gap-4">
                        {['Ya', 'Tidak'].map(opt => (
                          <label key={opt} className="flex items-center cursor-pointer">
                            <input
                              type="radio"
                              value={opt}
                              checked={form.upwardMobility[item.id] === opt}
                              onChange={e => handleUMChange(item.id, e.target.value)}
                              className="mr-2"
                            />
                            <span className="text-sm">{opt === 'Ya' ? 'Yes' : 'No'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upward Mobility — Section 5: Financial Metrics */}
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">{UPWARD_MOBILITY_SECTIONS.SECTION_5.title}</h2>
                  <span className="px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                    UPWARD MOBILITY
                  </span>
                </div>
                {UPWARD_MOBILITY_SECTIONS.SECTION_5.infoMessage && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                    {UPWARD_MOBILITY_SECTIONS.SECTION_5.infoMessage}
                  </div>
                )}
                <div className="space-y-6">
                  {UPWARD_MOBILITY_SECTIONS.SECTION_5.items.map(item => (
                    <div key={item.field} className="border-l-4 border-orange-300 pl-4">
                      {item.type === 'radio_yes_no' ? (
                        <div className="mb-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {item.label} <span className="text-red-500">*</span>
                          </label>
                          <div className="flex gap-4">
                            {['Ya', 'Tidak'].map(opt => (
                              <label key={opt} className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  value={opt}
                                  checked={form.upwardMobility[item.field] === opt}
                                  onChange={e => handleUMChange(item.field, e.target.value)}
                                  className="mr-2"
                                />
                                <span className="text-sm">{opt}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {item.label} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.upwardMobility[item.field] || ''}
                            onChange={e => handleUMChange(item.field, e.target.value)}
                            placeholder={item.placeholder}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      )}
                      <div className="mt-2 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <TextArea
                          label={item.ulasanLabel}
                          value={form.upwardMobility[item.ulasanField] || ''}
                          onChange={e => handleUMChange(item.ulasanField, e.target.value)}
                          rows={2}
                          placeholder={item.ulasanPlaceholder}
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upward Mobility — Section 6: Digital & Marketing */}
              {UPWARD_MOBILITY_SECTIONS.SECTION_6 && (
                <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-orange-500">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">{UPWARD_MOBILITY_SECTIONS.SECTION_6.title}</h2>
                    <span className="px-3 py-1 text-xs font-semibold text-white bg-orange-500 rounded-full uppercase tracking-wide">
                      UPWARD MOBILITY
                    </span>
                  </div>
                  <div className="space-y-6">
                    {/* Digital */}
                    <div className="border-l-4 border-orange-300 pl-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.label} <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 mb-3">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.options.map(opt => (
                          <label key={opt} className="flex items-start cursor-pointer gap-2">
                            <input
                              type="checkbox"
                              value={opt}
                              checked={(form.upwardMobility[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field] || []).includes(opt)}
                              onChange={e => handleUMCheckboxChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.field, opt, e.target.checked)}
                              className="mt-1 shrink-0"
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <TextArea
                          label={UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanLabel}
                          value={form.upwardMobility[UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanField] || ''}
                          onChange={e => handleUMChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanField, e.target.value)}
                          rows={2}
                          placeholder={UPWARD_MOBILITY_SECTIONS.SECTION_6.digital.ulasanPlaceholder}
                          required
                        />
                      </div>
                    </div>
                    {/* Marketing */}
                    <div className="border-l-4 border-orange-300 pl-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.label} <span className="text-red-500">*</span>
                      </label>
                      <div className="space-y-2 mb-3">
                        {UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.options.map(opt => (
                          <label key={opt} className="flex items-start cursor-pointer gap-2">
                            <input
                              type="checkbox"
                              value={opt}
                              checked={(form.upwardMobility[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field] || []).includes(opt)}
                              onChange={e => handleUMCheckboxChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.field, opt, e.target.checked)}
                              className="mt-1 shrink-0"
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                        <TextArea
                          label={UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanLabel}
                          value={form.upwardMobility[UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanField] || ''}
                          onChange={e => handleUMChange(UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanField, e.target.value)}
                          rows={2}
                          placeholder={UPWARD_MOBILITY_SECTIONS.SECTION_6.marketing.ulasanPlaceholder}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="mt-6 pt-4 border-t text-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-12 rounded-lg disabled:bg-gray-400 transition-colors"
                >
                  {isSubmitting ? '📤 Menghantar...' : `Hantar Laporan Sesi ${nextSession}`}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
