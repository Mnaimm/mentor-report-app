import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

const CollapseIcon = ({ is_open }) => (
  <svg className={`w-6 h-6 transition-transform duration-200 ${is_open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
  </svg>
);

export default function AdminCommandCenter({ userEmail, isReadOnlyUser, accessDenied }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // Legacy sales table state
  const [showLegacyTable, setShowLegacyTable] = useState(false);
  const [batches, setBatches] = useState([]);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyError, setLegacyError] = useState(null);
  const [openBatches, setOpenBatches] = useState({});

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  // Fetch overview stats on mount
  useEffect(() => {
    fetchOverviewStats();
  }, []);

  const fetchOverviewStats = async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch('/api/admin/overview-stats');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setStats(json.data);
    } catch (err) {
      setStatsError(err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  // Lazy-load legacy sales table
  const fetchLegacySalesData = async () => {
    if (batches.length > 0) return; // Already loaded
    setLegacyLoading(true);
    setLegacyError(null);
    try {
      const res = await fetch(`/api/admin/sales-status?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API responded with status: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setBatches(data);
      if (data.length > 0) {
        setOpenBatches({ 0: true });
      }
    } catch (err) {
      setLegacyError(err.message);
    } finally {
      setLegacyLoading(false);
    }
  };

  const toggleLegacyTable = () => {
    const newState = !showLegacyTable;
    setShowLegacyTable(newState);
    if (newState && batches.length === 0) {
      fetchLegacySalesData();
    }
  };

  const toggleBatch = (index) => {
    setOpenBatches(prev => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      {/* Page Title */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin — Pusat Kawalan</h1>
        <p className="text-gray-600">Papan pemuka pengurusan sistem iTEKAD</p>
      </div>

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : statsError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <p className="text-red-700">Error loading stats: {statsError}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Pending Verification */}
          <div className={`rounded-xl shadow-md p-6 ${stats.pendingVerification > 0 ? 'bg-red-50 border-2 border-red-300' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Laporan Belum Disemak</p>
                <p className={`text-3xl font-bold mt-2 ${stats.pendingVerification > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {stats.pendingVerification}
                </p>
              </div>
              <div className={`text-4xl ${stats.pendingVerification > 0 ? 'animate-pulse' : ''}`}>📝</div>
            </div>
          </div>

          {/* Open MIA */}
          <div className={`rounded-xl shadow-md p-6 ${stats.openMIA > 0 ? 'bg-red-50 border-2 border-red-300' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Permintaan MIA Terbuka</p>
                <p className={`text-3xl font-bold mt-2 ${stats.openMIA > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {stats.openMIA}
                </p>
              </div>
              <div className={`text-4xl ${stats.openMIA > 0 ? 'animate-pulse' : ''}`}>⚠️</div>
            </div>
          </div>

          {/* Unpaid Approved */}
          <div className={`rounded-xl shadow-md p-6 ${stats.unpaidApproved > 0 ? 'bg-amber-50 border-2 border-amber-300' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Laporan Belum Bayar</p>
                <p className={`text-3xl font-bold mt-2 ${stats.unpaidApproved > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {stats.unpaidApproved}
                </p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          {/* Active Payment Batches */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Batch Pembayaran Aktif</p>
                <p className="text-3xl font-bold mt-2 text-blue-600">{stats.activePaymentBatches}</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Left: Action Items */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            Tindakan Diperlukan
          </h2>
          <div className="space-y-3">
            <Link href="/admin/verification" className="block p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-red-800">Semak laporan tertunggak</p>
                  <p className="text-sm text-red-600">{stats?.pendingVerification || 0} laporan menunggu</p>
                </div>
                <span className="text-red-600">→</span>
              </div>
            </Link>
            <Link href="/admin/mia" className="block p-4 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-amber-800">Proses MIA terbuka</p>
                  <p className="text-sm text-amber-600">{stats?.openMIA || 0} permintaan tertunggak</p>
                </div>
                <span className="text-amber-600">→</span>
              </div>
            </Link>
            <Link href="/admin/payment-review" className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-blue-800">Urus pembayaran</p>
                  <p className="text-sm text-blue-600">{stats?.unpaidApproved || 0} laporan + {stats?.activePaymentBatches || 0} batch</p>
                </div>
                <span className="text-blue-600">→</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Right: Program Status */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Status Program
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">iTEKAD Bangkit</p>
                <p className="text-sm text-gray-600">Batch 7 (Aktif)</p>
              </div>
              <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">AKTIF</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">iTEKAD Maju</p>
                <p className="text-sm text-gray-600">Batch 6 (Aktif)</p>
              </div>
              <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">AKTIF</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div>
                <p className="font-semibold text-gray-900">TUBF</p>
                <p className="text-sm text-gray-600">Standby</p>
              </div>
              <span className="px-3 py-1 bg-gray-400 text-white text-xs font-bold rounded-full">STANDBY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Navigasi Pantas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Row 1 */}
          <Link href="/admin/verification" className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="text-lg font-bold">Verification</h3>
            <p className="text-sm text-emerald-100 mt-1">Semak & luluskan laporan</p>
          </Link>

          <Link href="/admin/payment-review" className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">💳</div>
            <h3 className="text-lg font-bold">Payment Review</h3>
            <p className="text-sm text-blue-100 mt-1">Urus batch pembayaran</p>
          </Link>

          <Link href="/admin/mia" className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold">MIA</h3>
            <p className="text-sm text-red-100 mt-1">Proses permintaan MIA</p>
          </Link>

          <Link href="/admin/progress" className="bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="text-lg font-bold">Progress</h3>
            <p className="text-sm text-purple-100 mt-1">Jejak akauntabiliti mentor</p>
          </Link>

          {/* Row 2 */}
          <Link href="/admin/lawatan-premis" className="bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="text-lg font-bold">Lawatan Premis</h3>
            <p className="text-sm text-orange-100 mt-1">Lawatan HQ tracking</p>
          </Link>

          <Link href="/admin/direktori-usahawan" className="bg-gradient-to-br from-cyan-500 to-sky-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-lg font-bold">Direktori Usahawan</h3>
            <p className="text-sm text-cyan-100 mt-1">Senarai entrepreneur</p>
          </Link>

          <Link href="/admin/mentors" className="bg-gradient-to-br from-lime-500 to-green-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🎓</div>
            <h3 className="text-lg font-bold">Mentors</h3>
            <p className="text-sm text-lime-100 mt-1">Urus mentor & tugasan</p>
          </Link>

          <Link href="/admin/dashboard" className="bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all transform hover:-translate-y-1">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-lg font-bold">Dashboard</h3>
            <p className="text-sm text-pink-100 mt-1">Charts & analytics</p>
          </Link>
        </div>
      </div>

      {/* Collapsible Legacy Sales Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <button
          onClick={toggleLegacyTable}
          className="w-full flex justify-between items-center p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <div className="text-left">
              <h2 className="text-xl font-bold text-gray-900">Status Laporan Jualan (Legacy)</h2>
              <p className="text-sm text-gray-500">Jadual batch dan progres mentor (klik untuk buka)</p>
            </div>
          </div>
          <CollapseIcon is_open={showLegacyTable} />
        </button>

        {showLegacyTable && (
          <div className="border-t">
            {legacyLoading ? (
              <div className="p-10 text-center text-gray-500">Loading batch data...</div>
            ) : legacyError ? (
              <div className="p-10 text-center text-red-500">Error: {legacyError}</div>
            ) : batches.length > 0 ? (
              <div className="p-6">
                {batches.map((batch, i) => (
                  <div key={i} className="mb-4 border rounded-lg shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleBatch(i)}
                      className="w-full flex justify-between items-center text-left p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <h3 className="text-xl font-bold text-blue-800">
                        {batch.batchName} <span className="text-lg font-semibold text-gray-600 ml-2">({batch.roundLabel})</span>
                      </h3>
                      <CollapseIcon is_open={openBatches[i]} />
                    </button>

                    {openBatches[i] && (
                      <div className="p-4">
                        {batch.zones.map((zone, z_idx) => (
                          <div key={z_idx} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 bg-gray-100 p-2 rounded-t-md">📍 Zon: {zone.zoneName}</h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full bg-white border">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="py-2 px-4 border-b text-left text-sm font-semibold text-gray-600">Mentor</th>
                                    <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">Mentees</th>
                                    <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">Sesi Dilaporkan</th>
                                    <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">Sales Data Done</th>
                                    <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600 w-1/4">Kemajuan</th>
                                    <th className="py-2 px-4 border-b text-sm font-semibold text-gray-600">MIA</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {zone.mentors.map((mentor, index) => (
                                    <tr key={index} className="text-center hover:bg-gray-50">
                                      <td className="py-3 px-4 border-b text-left">{mentor.mentorName}</td>
                                      <td className="py-3 px-4 border-b">{mentor.totalMentees}</td>
                                      <td className="py-3 px-4 border-b">{mentor.totalSessions} / {mentor.expectedSessions}</td>
                                      <td className="py-3 px-4 border-b">{mentor.salesDataCount} / {mentor.totalSessions}</td>
                                      <td className="py-3 px-4 border-b">
                                        <div className="flex items-center justify-center">
                                          <div className="w-full bg-gray-200 rounded-full h-4 mr-2">
                                            <div className="bg-blue-600 h-4 rounded-full" style={{ width: `${mentor.percent}%` }}></div>
                                          </div>
                                          <span className="text-sm text-gray-700">{mentor.percent}%</span>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 border-b">{mentor.miaCount}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-gray-500">No batch data available.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Server-side authentication (copied from old index.js)
export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);

  if (!hasAccess) {
    return {
      props: {
        accessDenied: true,
        userEmail,
      },
    };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);

  return {
    props: {
      userEmail,
      isReadOnlyUser,
    },
  };
}
