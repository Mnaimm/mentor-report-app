import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import DebugPanel from '../components/DebugPanel';
import UserSwitcher from '../components/UserSwitcher';
import { ImpersonationManager } from '../lib/impersonation';

const ToolCard = ({ href, title, description }) => (
  <Link
    href={href}
    className="block p-6 bg-white rounded-xl shadow-md hover:shadow-xl hover:scale-105 transition-transform duration-200"
  >
    <h3 className="text-xl font-bold text-blue-600 mb-2">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </Link>
);

const StatCard = ({ label, value, sublabel = null, color = "blue" }) => {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    orange: "text-orange-600",
    red: "text-red-600"
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 text-center">
      <div className={`text-3xl font-extrabold ${colorClasses[color]}`}>{value}</div>
      <div className="text-gray-500 mt-1">{label}</div>
      {sublabel && <div className="text-xs text-gray-400 mt-1">{sublabel}</div>}
    </div>
  );
};

const BatchCard = ({ batch, mentees, sessionData }) => (
  <div className="bg-white rounded-xl shadow-md p-6 mb-6">
    <h4 className="text-lg font-bold text-blue-600 mb-4">{batch}</h4>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 border-b">Usahawan</th>
            <th className="py-2 border-b">Bil. Sesi Dihantar</th>
          </tr>
        </thead>
        <tbody>
          {mentees.map((mentee) => (
            <tr key={mentee}>
              <td className="py-2 border-b">{mentee}</td>
              <td className="py-2 border-b">{sessionData?.[mentee] || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const MiaSection = ({ miaMentees }) => {
  if (!miaMentees || miaMentees.length === 0) {
    return null;
  }

  // Group by batch
  const miaByBatch = {};
  miaMentees.forEach(mentee => {
    if (!miaByBatch[mentee.batch]) {
      miaByBatch[mentee.batch] = [];
    }
    miaByBatch[mentee.batch].push(mentee);
  });

  return (
    <div className="mt-10 mb-8">
      <h3 className="text-2xl font-bold mb-4 text-red-600">
        Usahawan MIA (Missing In Action)
      </h3>
      <div className="mb-4 text-sm text-gray-600">
        Jumlah MIA: <span className="font-bold text-red-600">{miaMentees.length}</span> usahawan
      </div>
      <div className="space-y-6">
        {Object.entries(miaByBatch)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([batch, mentees]) => (
            <div key={batch} className="bg-white rounded-xl shadow-md p-6">
              <h4 className="text-lg font-bold text-gray-700 mb-4">
                {batch} <span className="text-red-600">({mentees.length} MIA)</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      <th className="py-2 border-b">Usahawan</th>
                      <th className="py-2 border-b">Bil. MIA</th>
                      <th className="py-2 border-b">Bil. Sesi Dihantar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentees.map((mentee) => (
                      <tr key={mentee.name}>
                        <td className="py-2 border-b">{mentee.name}</td>
                        <td className="py-2 border-b text-red-600 font-semibold">{mentee.miaCount}</td>
                        <td className="py-2 border-b">{mentee.totalSessions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default function HomePage() {
  const { data: session, status } = useSession();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [pendingBanner, setPendingBanner] = useState(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [currentRounds, setCurrentRounds] = useState([]);
  const [roundsLoading, setRoundsLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      console.log('❌ Dashboard: User not authenticated, clearing stats');
      setStats(null);
      return;
    }

    console.log('🔄 Dashboard: User authenticated, fetching stats...');
    let cancelled = false;
    const load = async () => {
      try {
        setStatsLoading(true);
        setStatsError(null);

        const startTime = Date.now();
        console.log('🚀 Dashboard: Starting API call to /api/mentor-stats');

        // Include impersonation — both header (existing) and query param (new DB-checked approach)
        const headers = ImpersonationManager.getHeaders();
        const impersonatedEmail = ImpersonationManager.getImpersonateUser();
        const statsUrl = impersonatedEmail
          ? `/api/mentor-stats?impersonate=${encodeURIComponent(impersonatedEmail)}`
          : '/api/mentor-stats';
        const res = await fetch(statsUrl, { headers });
        const fetchTime = Date.now() - startTime;

        console.log(`⏱️ Dashboard: API call completed in ${fetchTime}ms, status: ${res.status}`);

        if (!res.ok) {
          const errorText = await res.text();
          console.error(`❌ Dashboard: API error ${res.status}:`, errorText);
          throw new Error(`HTTP ${res.status}: ${errorText}`);
        }

        const json = await res.json();
        const totalTime = Date.now() - startTime;

        console.log(`✅ Dashboard: Data received in ${totalTime}ms:`, {
          requestId: json.debug?.requestId,
          totalMentees: json.totalMentees,
          allTimeReports: json.allTime?.totalReports,
          currentRoundReported: json.currentRoundStats?.reportedThisRound,
          apiProcessingTime: json.debug?.totalTimeMs + 'ms'
        });

        if (!cancelled) {
          setStats(json);
          console.log('📊 Dashboard: Stats state updated successfully');

          // Debug UM stats
          if (json.upwardMobilityStats) {
            console.log('📋 UM Stats received:', json.upwardMobilityStats);
            console.log('📋 UM Debug info:', {
              umFormsLoaded: json.debug?.umFormsLoaded,
              umBatchesTracked: json.debug?.umBatchesTracked
            });
          }
        }
      } catch (e) {
        console.error('❌ Dashboard: Error loading stats:', e);
        if (!cancelled) setStatsError(String(e?.message || e));
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      console.log('🚫 Dashboard: Stats loading cancelled (component unmounted)');
    };
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setRoundsLoading(true);
    const todayCheck = new Date();
    todayCheck.setHours(12, 0, 0, 0);
    fetch('/api/batch-timeline')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.rounds) return;
        setCurrentRounds(data.rounds.filter(r => {
          if (!r.start_date || !r.end_date) return false;
          const start = new Date(r.start_date + 'T00:00:00');
          const end   = new Date(r.end_date   + 'T23:59:59');
          return todayCheck >= start && todayCheck <= end;
        }));
      })
      .catch(() => {})
      .finally(() => setRoundsLoading(false));
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    const impersonatedEmail = ImpersonationManager.getImpersonateUser();
    const summaryUrl = impersonatedEmail
      ? `/api/mentor/pending-summary?impersonate=${encodeURIComponent(impersonatedEmail)}`
      : '/api/mentor/pending-summary';
    const headers = ImpersonationManager.getHeaders();
    fetch(summaryUrl, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setPendingBanner(data); })
      .catch(() => {});
  }, [status]);

  const isAdmin = !!session?.user?.email &&
    (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
      .split(',').map(e => e.trim()).includes(session.user.email);

  // During impersonation the session still belongs to the admin, but the view
  // should behave as the impersonated mentor's view.
  const isImpersonating = !!ImpersonationManager.getImpersonateUser();
  const viewingAsAdmin = isAdmin && !isImpersonating;

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
      <div className="max-w-5xl mx-auto p-4 sm:p-8">
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
            Portal Mentor iTEKAD
          </h1>
          <p className="text-gray-500 mt-1">
            Sila pilih borang yang ingin anda isi atau kemaskini.
          </p>
          <div className="flex justify-center items-center mt-6 border-t pt-6">
            <img src="/logo1.png" alt="Logo" className="h-12 sm:h-16" />
          </div>
        </header>

        {!session ? (
          <div className="text-center bg-white p-8 rounded-xl shadow-md">
            <p className="mb-4 text-lg">
              Sila log masuk untuk mengakses alatan mentor.
            </p>
            <button
              onClick={() => signIn("google")}
              className="bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Log Masuk dengan Google
            </button>
          </div>
        ) : (
          <div>
            {/* Welcome banner */}
            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-md">
              <p>
                Selamat datang, <strong>{session.user.name}</strong>!
              </p>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <div className="opacity-40 hover:opacity-100 transition-opacity">
                    <UserSwitcher
                      onImpersonationChange={(email) => {
                        console.log('Impersonation changed:', email);
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={() => signOut()}
                  className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
                >
                  Log Keluar
                </button>
              </div>
            </div>

            {/* Debug Info — true admin view only (hidden during impersonation) */}
            {viewingAsAdmin && stats?.debug && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-600">
                <strong>Debug Info:</strong> Request ID: {stats.debug.requestId} |
                Data fetched at: {new Date(stats.debug.timestamp).toLocaleTimeString()} |
                API processing: {stats.debug.totalTimeMs}ms |
                <button
                  onClick={() => window.location.reload()}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Refresh Data
                </button>
              </div>
            )}

            {/* Pusingan Semasa — mentor view (also shown when admin is impersonating a mentor) */}
            {!viewingAsAdmin && (() => {
              // Cohort pairing — mirrors BatchTimeline.js logic exactly
              const cohortMap = {};
              currentRounds.forEach(r => {
                const prog    = (r.program || '').toLowerCase();
                const bname   = r.batch_name || 'Unknown';
                const numMatch = bname.match(/\d+/);
                const batchNum = numMatch ? parseInt(numMatch[0], 10) : 0;
                const isBangkit = prog.includes('bangkit');
                const cohortNum = isBangkit ? batchNum : batchNum + 1;
                const progKey   = isBangkit ? 'bangkit' : 'maju';
                if (!cohortMap[cohortNum]) cohortMap[cohortNum] = {};
                cohortMap[cohortNum][progKey] = { batchName: bname, round: r };
              });
              const cohorts = Object.keys(cohortMap).map(Number).sort((a, b) => a - b);

              const EntryCell = ({ entry }) => {
                if (!entry) return <td className="py-2 pr-4 text-gray-300 text-sm">—</td>;
                return (
                  <td className="py-2 pr-4">
                    <span className="text-gray-700 text-sm">{entry.batchName} </span>
                    <span className="font-bold text-green-600 text-sm">R{entry.round.round_number}</span>
                    {entry.round.period_label && (
                      <span className="text-xs text-gray-400 ml-1">{entry.round.period_label}</span>
                    )}
                  </td>
                );
              };

              return (
                <div className="mb-8 bg-white rounded-lg border border-gray-200 px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-gray-700">Pusingan Semasa</span>
                    <Link href="/mentor/timeline" className="text-sm text-blue-600 hover:text-blue-800">
                      → Lihat Jadual Penuh
                    </Link>
                  </div>
                  {roundsLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map(i => (
                        <div key={i} className="h-5 bg-gray-100 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : cohorts.length === 0 ? (
                    <p className="text-sm text-gray-400">Tiada pusingan aktif pada masa ini</p>
                  ) : (
                    <table className="w-full">
                      <tbody>
                        {cohorts.map((cohortNum, i) => {
                          const c = cohortMap[cohortNum];
                          return (
                            <tr key={cohortNum} className={i < cohorts.length - 1 ? 'border-b border-gray-100' : ''}>
                              <td className="py-2 pr-4 text-xs text-gray-400 whitespace-nowrap w-0">
                                Kohort {cohortNum}
                              </td>
                              <EntryCell entry={c.bangkit} />
                              <EntryCell entry={c.maju} />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })()}

            {/* Current Period Stats - Most Important */}
            {stats?.currentRoundStats && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Kemajuan Semasa ({stats.currentPeriod?.periodName || stats.currentPeriod?.label || 'Current Period'})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                  <StatCard
                    label="Jumlah Usahawan"
                    value={stats.totalMentees ?? 0}
                    sublabel={`${stats.totalMenteesInCurrentPeriod ?? 0} dalam pusingan semasa`}
                    color="blue"
                  />
                  <StatCard
                    label="Sudah Dilapor Tempoh Ini"
                    value={stats.currentRoundStats.reportedThisRound ?? 0}
                    sublabel={`daripada ${stats.totalMenteesInCurrentPeriod ?? stats.totalMentees}`}
                    color="green"
                  />
                  <StatCard
                    label="Belum Dilapor Tempoh Ini"
                    value={stats.currentRoundStats.pendingThisRound ?? 0}
                    color="orange"
                  />
                  <StatCard
                    label="MIA Tempoh Ini"
                    value={stats.currentRoundStats.miaThisRound ?? 0}
                    color="red"
                  />
                </div>
              </div>
            )}

            {/* Overall Summary Stats */}
            {statsLoading && (
              <div className="text-center text-gray-500 mb-8">
                Memuatkan statistik…
              </div>
            )}
            {statsError && (
              <div className="text-center text-red-500 mb-8">
                Gagal memuatkan statistik: {statsError}
              </div>
            )}
            {stats?.allTime && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Ringkasan Keseluruhan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard
                    label="Jumlah Laporan Dihantar"
                    value={stats.allTime.totalReports ?? 0}
                    sublabel="semua pusingan"
                    color="blue"
                  />
                  <StatCard
                    label="Usahawan Pernah Dilapor"
                    value={stats.allTime.uniqueMenteesReported ?? 0}
                    sublabel="sekurang-kurangnya 1 laporan"
                    color="green"
                  />
                  <StatCard
                    label="Lawatan Premis Done"
                    value={stats.allTime.premisVisitCount ?? 0}
                    sublabel="usahawan dengan premis dilawat"
                    color="blue"
                  />
                  <StatCard
                    label="Jumlah MIA"
                    value={stats.allTime.miaCount ?? 0}
                    sublabel="semua pusingan"
                    color="red"
                  />
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <ToolCard
                href="/mentor/usahawan-saya"
                title="Usahawan Saya"
                description="Direktori usahawan yang ditugaskan kepada anda."
              />
              <ToolCard
                href="/laporan-bangkit"
                title="Laporan Sesi iTEKAD Bangkit"
                description="Isi laporan berterusan untuk usahawan anda di sini."
              />
              <ToolCard
                href="/laporan-maju-um"
                title="Laporan Sesi iTEKAD Maju"
                description="Isi laporan kemajuan untuk usahawan anda."
              />
              <ToolCard
                href="/growthwheel"
                title="Penilaian GrowthWheel 360°"
                description="Gunakan alat ini untuk penilaian dan muat turun carta."
              />
              <ToolCard
                href="/mentor/timeline"
                title="Jadual Batch Saya"
                description="Lihat garis masa pusingan batch yang anda kendalikan."
              />
            </div>

            {/* MIA Section - Dedicated section for MIA mentees */}
            {stats?.miaMentees && <MiaSection miaMentees={stats.miaMentees} />}

            {/* Upward Mobility Forms - REMOVED per user request (legacy tracking) */}

            {/* Per-batch tables */}
            {stats && stats.menteesByBatch && Object.keys(stats.menteesByBatch).length > 0 && (
              <div className="mt-10">
                <h3 className="text-2xl font-bold mb-6">
                  Kemajuan Sesi per Usahawan (Mengikut Batch)
                </h3>
                <div className="mb-4 text-sm text-gray-600">
                  * Menunjukkan keseluruhan laporan dari semua pusingan
                </div>
                {Object.entries(stats.menteesByBatch)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([batch, mentees]) => (
                    <BatchCard
                      key={batch}
                      batch={batch}
                      mentees={mentees}
                      sessionData={stats.sessionsByBatch?.[batch]}
                    />
                  ))}
              </div>
            )}

            {/* Fallback: Original table if batch data not available */}
            {stats && stats.allTime?.perMenteeSessions && !stats.menteesByBatch && (
              <div className="mt-10 bg-white rounded-xl shadow-md p-6">
                <h3 className="text-xl font-bold mb-4">
                  Kemajuan Sesi per Usahawan
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="py-2 border-b">Usahawan</th>
                        <th className="py-2 border-b">Bil. Sesi Dihantar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.allTime.perMenteeSessions).map(
                        ([name, count]) => (
                          <tr key={name}>
                            <td className="py-2 border-b">{name}</td>
                            <td className="py-2 border-b">{count}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Debug Panel - Only show for authenticated users */}
        {session && <DebugPanel />}
      </div>

      {/* Overdue floating banner — shown past round midpoint with pending reports */}
      {session && pendingBanner?.hasPending && !bannerDismissed && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-50 border-t-2 border-amber-400 shadow-lg">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-amber-800 text-sm font-medium">
              ⚠️ Tindakan Diperlukan — Anda mempunyai{' '}
              <strong>{pendingBanner.count}</strong> laporan belum dihantar untuk pusingan semasa. Sila hantar sebelum{' '}
              <strong>{pendingBanner.endDate}</strong>.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={pendingBanner.laporanUrl}
                className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
              >
                Hantar Sekarang
              </a>
              <button
                onClick={() => setBannerDismissed(true)}
                className="text-amber-600 hover:text-amber-800 text-lg font-bold leading-none"
                aria-label="Tutup"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}