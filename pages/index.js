// pages/index.js
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";

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

const BatchCard = ({ batch, mentees, sessionData, miaData }) => (
  <div className="bg-white rounded-xl shadow-md p-6 mb-6">
    <h4 className="text-lg font-bold text-blue-600 mb-4">{batch}</h4>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-2 border-b">Usahawan</th>
            <th className="py-2 border-b">Bil. Sesi Dihantar</th>
            <th className="py-2 border-b">MIA</th>
          </tr>
        </thead>
        <tbody>
          {mentees.map((mentee) => (
            <tr key={mentee}>
              <td className="py-2 border-b">{mentee}</td>
              <td className="py-2 border-b">{sessionData?.[mentee] || 0}</td>
              <td className="py-2 border-b">{miaData?.[mentee] || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default function HomePage() {
  const { data: session, status } = useSession();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setStats(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setStatsLoading(true);
        setStatsError(null);
        const res = await fetch("/api/mentor-stats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setStats(json);
      } catch (e) {
        if (!cancelled) setStatsError(String(e?.message || e));
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [status]);

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
          {stats?.currentRound && (
            <div className="mt-2 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {stats.currentRound.label}
            </div>
          )}
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
            <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-md">
              <p>
                Selamat datang, <strong>{session.user.name}</strong>!
              </p>
              <button
                onClick={() => signOut()}
                className="bg-red-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                Log Keluar
              </button>
            </div>

            {/* Current Round Stats - Most Important */}
            {stats?.currentRoundStats && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  Kemajuan {stats.currentRound?.label || 'Semasa'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                  <StatCard
                    label="Jumlah Usahawan"
                    value={stats.totalMentees ?? 0}
                    color="blue"
                  />
                  <StatCard
                    label="Sudah Dilapor Pusingan Ini"
                    value={stats.currentRoundStats.reportedThisRound ?? 0}
                    sublabel={`daripada ${stats.totalMentees}`}
                    color="green"
                  />
                  <StatCard
                    label="Belum Dilapor Pusingan Ini"
                    value={stats.currentRoundStats.pendingThisRound ?? 0}
                    color="orange"
                  />
                  <StatCard
                    label="MIA Pusingan Ini"
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
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
                href="/laporan-sesi"
                title="Laporan Sesi iTEKAD"
                description="Isi laporan berterusan untuk usahawan anda di sini."
              />
              <ToolCard
                href="/laporan-maju"
                title="Laporan Kemajuan"
                description="Isi laporan kemajuan untuk usahawan anda."
              />
              <ToolCard
                href="/upward-mobility"
                title="Borang Upward Mobility"
                description="Lengkapkan borang Upward Mobility untuk Sesi 2 dan Sesi 4."
              />
              <ToolCard
                href="/growthwheel"
                title="Penilaian GrowthWheel 360°"
                description="Gunakan alat ini untuk penilaian dan muat turun carta."
              />
            </div>

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
                      miaData={stats.miaByBatch?.[batch]}
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
      </div>
    </div>
  );
}