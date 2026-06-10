import React, { useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin } from '../../lib/auth';

export default function SendRemindersPage({ userEmail }) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData]       = useState(null); // { mentors[], totalMentors }
  const [previewError, setPreviewError]     = useState(null);

  const [testMode, setTestMode] = useState(false);

  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState(null);
  const [sendError, setSendError] = useState(null);

  // ── Preview ────────────────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewData(null);
    setPreviewError(null);
    setResult(null);
    setSendError(null);

    try {
      const res  = await fetch('/api/admin/send-reminders?preview=true');
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
    const count = previewData?.totalMentors;
    const msg   = count != null
      ? `Anda akan menghantar emel kepada ${count} mentor. Teruskan?`
      : 'Anda akan menghantar emel peringatan kepada semua mentor yang belum submit laporan pusingan semasa. Teruskan?';

    if (!confirm(msg)) return;

    setSending(true);
    setResult(null);
    setSendError(null);

    try {
      const url  = testMode ? '/api/admin/send-reminders?test=true' : '/api/admin/send-reminders';
      const res  = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error || 'Ralat tidak dijangka berlaku.');
      } else {
        setResult(data);
        setPreviewData(null); // clear preview after send
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

  const busy = previewLoading || sending;

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

        {/* ── Result panel (shown after send) ─────────────────────────────── */}
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

        {/* ── Main action card (hidden after result) ───────────────────────── */}
        {!result && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Peringatan Pusingan Semasa</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Semak senarai mentor yang belum hantar laporan, kemudian sahkan sebelum menghantar emel.
                  </p>
                </div>
              </div>

              {/* Step 1 — Preview button */}
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
                  '↻ Semak Semula'
                ) : (
                  'Semak Senarai Dulu'
                )}
              </button>

              {/* Step 2 — Test mode + Confirm & Send (only after preview) */}
              {previewData && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
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
                          Semua emel akan dihantar ke naemmukhtar@gmail.com sahaja
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
                      `[TEST] Hantar kepada naemmukhtar@gmail.com (${previewData.totalMentors} mentor)`
                    ) : (
                      `Confirm & Hantar (${previewData.totalMentors} mentor)`
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ── Preview error ──────────────────────────────────────────────── */}
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

            {/* ── Send error ─────────────────────────────────────────────────── */}
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

            {/* ── Preview table ──────────────────────────────────────────────── */}
            {previewData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">Senarai Mentor Tertunggak</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {previewData.totalMentors === 0
                        ? 'Tiada mentor dengan laporan tertunggak.'
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
                              {mentor.batches.length > 0
                                ? mentor.batches.join(', ')
                                : '-'}
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
