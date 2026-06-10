import React, { useState, useEffect } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin } from '../../lib/auth';

const MALAY_MONTHS = [
  'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
  'Julai', 'Ogos', 'Sept', 'Okt', 'Nov', 'Dis',
];

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return `${d.getDate()} ${MALAY_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const end   = new Date(dateStr); end.setHours(23, 59, 59, 999);
  const today = new Date();        today.setHours(0, 0, 0, 0);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

export default function SendRemindersPage({ userEmail }) {
  // ── Step 0: batch selector ─────────────────────────────────────────────────
  const [activeBatches, setActiveBatches]   = useState(null); // null = loading, [] = empty/error
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [selectedBatch, setSelectedBatch]   = useState(''); // '' = Semua Batch

  // ── Step 1: preview ────────────────────────────────────────────────────────
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData]       = useState(null);
  const [previewError, setPreviewError]     = useState(null);

  // ── Step 2: test mode + send ───────────────────────────────────────────────
  const [testMode, setTestMode]     = useState(false);
  const [sending, setSending]       = useState(false);
  const [result, setResult]         = useState(null);
  const [sendError, setSendError]   = useState(null);

  // Load active batches on mount
  useEffect(() => {
    async function fetchBatches() {
      try {
        const res  = await fetch('/api/admin/send-reminders?list_batches=true');
        const data = await res.json();
        setActiveBatches(data.batches || []);
      } catch {
        setActiveBatches([]);
      } finally {
        setBatchesLoading(false);
      }
    }
    fetchBatches();
  }, []);

  // Reset preview when batch selection changes
  function handleBatchSelect(batch) {
    setSelectedBatch(batch);
    setPreviewData(null);
    setPreviewError(null);
    setSendError(null);
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewError(null);
    setResult(null);
    setSendError(null);

    try {
      const params = new URLSearchParams({ preview: 'true' });
      if (selectedBatch) params.set('batch_name', selectedBatch);

      const res  = await fetch(`/api/admin/send-reminders?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error || 'Ralat semasa memuatkan senarai.');
      } else {
        setPreviewData(data);
      }
    } catch (err) {
      setPreviewError('Ralat sambungan: ' + err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  async function handleSend() {
    const count      = previewData?.totalMentors;
    const batchLabel = selectedBatch || 'Semua Batch';
    const msg = count != null
      ? `Anda akan menghantar emel kepada ${count} mentor (${batchLabel}). Teruskan?`
      : `Anda akan menghantar emel peringatan — ${batchLabel}. Teruskan?`;

    if (!confirm(msg)) return;

    setSending(true);
    setResult(null);
    setSendError(null);

    try {
      const params = new URLSearchParams();
      if (testMode)      params.set('test', 'true');
      if (selectedBatch) params.set('batch_name', selectedBatch);
      const qs  = params.toString();
      const url = `/api/admin/send-reminders${qs ? `?${qs}` : ''}`;

      const res  = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || 'Ralat tidak dijangka berlaku.');
      } else {
        setResult(data);
        setPreviewData(null);
      }
    } catch (err) {
      setSendError('Ralat sambungan: ' + err.message);
    } finally {
      setSending(false);
    }
  }

  function handleReset() {
    setPreviewData(null);
    setPreviewError(null);
    setResult(null);
    setSendError(null);
    setTestMode(false);
  }

  const busy       = previewLoading || sending;
  const batchLabel = selectedBatch || 'Semua Batch';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-900 text-white px-6 py-5 shadow">
        <div className="max-w-3xl mx-auto">
          <div className="mb-1">
            <Link href="/admin" className="text-blue-200 hover:text-white text-sm">← Admin</Link>
          </div>
          <h1 className="text-2xl font-bold">Hantar Peringatan Laporan</h1>
          <p className="text-blue-200 text-sm mt-1">
            Hantar emel automatik kepada mentor yang belum submit laporan pusingan semasa
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* ── Result panel ─────────────────────────────────────────────────── */}
        {result && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-green-700">{result.message || 'Selesai'}</span>
              </div>
              <button onClick={handleReset} className="text-sm text-gray-500 hover:text-gray-700 underline">
                Semak semula
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{result.sent ?? 0}</p>
                  <p className="text-sm text-green-600 mt-1">Emel Dihantar</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-gray-600">{result.skipped ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Laporan Lengkap</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{result.errors?.length ?? 0}</p>
                  <p className="text-sm text-red-500 mt-1">Gagal</p>
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Emel yang gagal dihantar:</p>
                  <div className="space-y-2">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 bg-red-50 rounded-lg px-4 py-2 text-sm">
                        <span className="font-medium text-red-700 flex-shrink-0">{e.mentor}</span>
                        <span className="text-gray-400">—</span>
                        <span className="text-red-600 truncate">{e.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Main action card ─────────────────────────────────────────────── */}
        {!result && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">

              {/* Step 0 — Batch selector */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Pilih Batch</p>
                {batchesLoading ? (
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-9 w-28 bg-gray-100 rounded-full animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                  <div className="flex flex-wrap gap-2">
                    {/* "Semua Batch" pill */}
                    <button
                      onClick={() => handleBatchSelect('')}
                      disabled={busy}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                        selectedBatch === ''
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                      } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Semua Batch
                    </button>

                    {(activeBatches || []).map(batch => (
                      <button
                        key={batch.batch_name}
                        onClick={() => handleBatchSelect(batch.batch_name)}
                        disabled={busy}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                          selectedBatch === batch.batch_name
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                        } ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {batch.batch_name}
                      </button>
                    ))}

                    {!batchesLoading && activeBatches?.length === 0 && (
                      <span className="text-sm text-gray-400 italic">Tiada batch aktif ditemui</span>
                    )}
                  </div>

                  {/* Active round info bar — shown only when a specific batch is selected */}
                  {(() => {
                    if (!selectedBatch || !activeBatches?.length) return null;
                    const info = activeBatches.find(b => b.batch_name === selectedBatch);
                    if (!info) return null;

                    if (info.is_overdue) {
                      return (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                          <span>🚨</span>
                          <span className="font-semibold text-red-700">Overdue:</span>
                          <span className="text-red-700">Pusingan {info.round_number}</span>
                          <span className="text-red-300 mx-1">|</span>
                          <span className="font-medium text-red-600">Tempoh:</span>
                          <span className="text-red-700">{formatDateShort(info.start_date)} – {formatDateShort(info.end_date)}</span>
                          {info.days_overdue != null && (
                            <>
                              <span className="text-red-300 mx-1">|</span>
                              <span className="text-red-700 font-semibold">Tertunggak {info.days_overdue} hari</span>
                            </>
                          )}
                        </div>
                      );
                    }

                    const days = daysUntil(info.end_date);
                    const daysColor = days == null
                      ? 'text-gray-500'
                      : days < 7
                      ? 'text-red-600 font-semibold'
                      : days < 14
                      ? 'text-amber-600 font-semibold'
                      : 'text-gray-500';
                    return (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                        <span>🗓</span>
                        <span className="font-semibold text-blue-800">Pusingan Aktif:</span>
                        <span>Pusingan {info.round_number}</span>
                        <span className="text-gray-400 mx-1">|</span>
                        <span className="font-medium text-gray-600">Tempoh:</span>
                        <span>{formatDateShort(info.start_date)} – {formatDateShort(info.end_date)}</span>
                        {days != null && (
                          <>
                            <span className="text-gray-400 mx-1">|</span>
                            <span className={daysColor}>Due dalam {days} hari</span>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  </>
                )}
              </div>

              {/* Step 1 — Preview button */}
              <div>
                <button
                  onClick={handlePreview}
                  disabled={busy}
                  className={`w-full py-3 px-6 rounded-lg font-semibold border-2 transition-colors ${
                    busy
                      ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                      : previewData
                      ? 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                      : 'border-blue-700 text-blue-700 bg-white hover:bg-blue-50'
                  }`}
                >
                  {previewLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Memuatkan senarai...
                    </span>
                  ) : previewData ? (
                    `↻ Semak Semula — ${batchLabel}`
                  ) : (
                    `Semak Senarai Dulu — ${batchLabel}`
                  )}
                </button>
              </div>

              {/* Step 2 — Test mode + Confirm & Send (only after preview) */}
              {previewData && (
                <div className="pt-4 border-t border-gray-100 space-y-4">
                  {/* Test mode toggle */}
                  <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={testMode}
                        onChange={e => setTestMode(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${testMode ? 'bg-amber-500' : 'bg-gray-300'}`} />
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${testMode ? 'translate-x-4' : ''}`} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Mod Ujian</span>
                      {testMode && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Semua emel akan dihantar ke mentor@startlah.my sahaja
                        </p>
                      )}
                    </div>
                  </label>

                  {/* Confirm & Send button */}
                  <button
                    onClick={handleSend}
                    disabled={busy || previewData.totalMentors === 0}
                    className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
                      busy || previewData.totalMentors === 0
                        ? 'bg-gray-300 cursor-not-allowed'
                        : testMode
                        ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700'
                        : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900'
                    }`}
                  >
                    {sending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Menghantar peringatan...
                      </span>
                    ) : previewData.totalMentors === 0 ? (
                      'Tiada emel untuk dihantar'
                    ) : testMode ? (
                      `[TEST] Hantar kepada mentor@startlah.my (${previewData.totalMentors} mentor)`
                    ) : (
                      `Hantar Peringatan — ${batchLabel} (${previewData.totalMentors} mentor)`
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ── Preview error ────────────────────────────────────────────── */}
            {previewError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-red-700">Ralat Pratonton</span>
                </div>
                <p className="text-red-600 text-sm ml-7">{previewError}</p>
              </div>
            )}

            {/* ── Send error ───────────────────────────────────────────────── */}
            {sendError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-red-700">Ralat Penghantaran</span>
                </div>
                <p className="text-red-600 text-sm ml-7">{sendError}</p>
              </div>
            )}

            {/* ── Preview table ─────────────────────────────────────────────── */}
            {previewData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">Senarai Mentor Tertunggak</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {previewData.totalMentors === 0
                        ? `Tiada laporan tertunggak — ${batchLabel}.`
                        : `${previewData.totalMentors} mentor akan menerima emel peringatan`}
                    </p>
                  </div>
                  {previewData.totalMentors > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
                      {previewData.totalMentors} mentor
                    </span>
                  )}
                </div>

                {previewData.totalMentors === 0 ? (
                  <div className="px-6 py-10 text-center text-gray-400 text-sm">
                    Semua mentor telah menghantar laporan untuk pusingan semasa.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-6 py-3 font-semibold text-gray-600">#</th>
                          <th className="text-left px-6 py-3 font-semibold text-gray-600">Nama Mentor</th>
                          <th className="text-left px-6 py-3 font-semibold text-gray-600">Email</th>
                          <th className="text-center px-6 py-3 font-semibold text-gray-600">Bil. Laporan Tertunggak</th>
                          <th className="text-left px-6 py-3 font-semibold text-gray-600">Batch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {previewData.mentors.map((mentor, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-gray-400">{i + 1}</td>
                            <td className="px-6 py-3 font-medium text-gray-900">{mentor.name}</td>
                            <td className="px-6 py-3 text-gray-500">{mentor.email}</td>
                            <td className="px-6 py-3 text-center">
                              <span className="bg-red-100 text-red-700 font-semibold text-xs px-2.5 py-1 rounded-full">
                                {mentor.pendingCount}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-gray-500">
                              {mentor.batches.length > 0 ? mentor.batches.join(', ') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-xs text-gray-400 text-center">
          Peringatan hanya dihantar kepada mentor dalam pusingan aktif yang belum submit laporan. Emel dari noreply@startlah.my.
        </p>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);
  if (!session) return { redirect: { destination: '/api/auth/signin', permanent: false } };

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);
  if (!hasAccess) return { redirect: { destination: '/', permanent: false } };

  return { props: { userEmail } };
}
