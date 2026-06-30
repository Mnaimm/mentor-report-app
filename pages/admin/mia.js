import React, { useEffect, useState, useCallback } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

function DaysBadge({ days }) {
  if (days > 90) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-900 text-red-300 border border-red-700">
        🔴 Urgent &bull; {days} hari
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-900 text-yellow-300 border border-yellow-700">
      🟡 Dalam Proses &bull; {days} hari
    </span>
  );
}

function TiadaSebabBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
      ⚪ Tiada Sebab
    </span>
  );
}

function MenteeRow({ mentee }) {
  const [expanded, setExpanded] = useState(false);
  const displayDate = mentee.session_date
    ? new Date(mentee.session_date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date(mentee.submission_date).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="border border-gray-700 rounded-lg mb-2 overflow-hidden">
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 cursor-pointer hover:bg-gray-750 transition-colors"
        style={{ backgroundColor: 'rgb(31,41,55)' }}
        onClick={() => setExpanded(v => !v)}
      >
        {/* Name + business */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{mentee.nama_mentee}</p>
          {mentee.business_name && (
            <p className="text-xs text-gray-400 truncate">{mentee.business_name}</p>
          )}
        </div>

        {/* Program / batch / session */}
        <div className="text-right sm:w-48">
          <p className="text-sm text-gray-300">{mentee.program} &bull; Sesi {mentee.session_number}</p>
          {mentee.batch && <p className="text-xs text-gray-500">{mentee.batch}</p>}
        </div>

        {/* Days badge */}
        <div className="sm:w-52 flex flex-wrap gap-1 sm:justify-end">
          <DaysBadge days={mentee.days_since} />
          {!mentee.mia_reason && <TiadaSebabBadge />}
        </div>

        {/* Expand toggle */}
        <div className="text-gray-500 text-sm sm:w-8 text-right">
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-900 border-t border-gray-700 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Tarikh MIA:</span>
              <span className="ml-2 text-gray-200">{displayDate}</span>
            </div>
            {mentee.phone && (
              <div>
                <span className="text-gray-500">No. Telefon:</span>
                <a
                  href={`tel:${mentee.phone}`}
                  className="ml-2 text-blue-400 hover:text-blue-300"
                  onClick={e => e.stopPropagation()}
                >
                  {mentee.phone}
                </a>
              </div>
            )}
            {mentee.state && (
              <div>
                <span className="text-gray-500">Negeri:</span>
                <span className="ml-2 text-gray-200">{mentee.state}</span>
              </div>
            )}
          </div>

          {mentee.mia_reason ? (
            <div>
              <p className="text-gray-500 text-xs mb-1">Alasan MIA:</p>
              <p className="text-sm text-gray-200 bg-gray-800 rounded p-3 whitespace-pre-wrap border border-gray-700">
                {mentee.mia_reason}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Tiada alasan dinyatakan oleh mentor.</p>
          )}
        </div>
      )}
    </div>
  );
}

function MentorGroup({ group }) {
  const [expanded, setExpanded] = useState(false);
  const hasUrgent = group.max_days_since > 90;

  return (
    <div className={`rounded-xl mb-4 border overflow-hidden ${hasUrgent ? 'border-red-800' : 'border-gray-700'}`}>
      {/* Group header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={`w-full flex flex-col sm:flex-row sm:items-center gap-2 p-5 text-left transition-colors ${
          hasUrgent ? 'bg-red-950 hover:bg-red-900' : 'bg-gray-800 hover:bg-gray-750'
        }`}
        style={hasUrgent ? {} : { backgroundColor: 'rgb(31,41,55)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base">{group.mentor_name}</p>
          <p className="text-xs text-gray-400">{group.mentor_email}</p>
        </div>
        <div className="flex items-center gap-3 sm:justify-end">
          <span className="text-sm text-gray-400">{group.mentees.length} usahawan MIA</span>
          <DaysBadge days={group.max_days_since} />
          <span className="text-gray-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Mentee list */}
      {expanded && (
        <div className="p-4 bg-gray-900 border-t border-gray-700 space-y-2">
          {group.mentees.map(m => (
            <MenteeRow key={m.report_id} mentee={m} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SenaraeMIAPage({ userEmail, isReadOnlyUser, accessDenied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (accessDenied) return <AccessDenied userEmail={userEmail} />;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/mia');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuatkan data');
      setData(json);
    } catch (err) {
      console.error('Error fetching MIA data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const summary = data?.summary || { total: 0, urgent: 0, tanpaSebab: 0 };
  const mentorGroups = data?.mentorGroups || [];
  const unassigned = data?.unassigned || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <nav className="text-xs text-gray-500 mb-1">
              <Link href="/admin" className="hover:text-gray-300">Admin</Link>
              <span className="mx-2">/</span>
              <span className="text-gray-300">Senarai MIA</span>
            </nav>
            <h1 className="text-2xl font-bold text-white">Senarai MIA</h1>
            <p className="text-sm text-gray-400 mt-1">Usahawan yang tidak dapat dihubungi (Missing In Action)</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 text-sm text-white rounded-lg transition-colors"
          >
            {loading ? 'Memuatkan...' : '↻ Muat Semula'}
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Jumlah MIA</p>
            <p className="text-3xl font-bold text-white">{summary.total}</p>
          </div>
          <div className="bg-red-950 rounded-xl p-5 border border-red-800">
            <p className="text-red-400 text-xs font-medium uppercase tracking-wide mb-1">Urgent (&gt;90 hari)</p>
            <p className="text-3xl font-bold text-red-300">{summary.urgent}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-600">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-1">Tiada Sebab</p>
            <p className="text-3xl font-bold text-gray-300">{summary.tanpaSebab}</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-20 text-gray-500">Memuatkan senarai MIA...</div>
        ) : error ? (
          <div className="text-center py-20 text-red-400">Ralat: {error}</div>
        ) : mentorGroups.length === 0 && unassigned.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-lg font-medium text-gray-300">Tiada usahawan MIA</p>
            <p className="text-sm text-gray-500 mt-1">Semua usahawan boleh dihubungi.</p>
          </div>
        ) : (
          <>
            {/* Mentor groups */}
            {mentorGroups.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Mengikut Mentor ({mentorGroups.length} mentor)
                </h2>
                {mentorGroups.map(g => (
                  <MentorGroup key={g.mentor_id} group={g} />
                ))}
              </section>
            )}

            {/* Penugasan Tamat */}
            {unassigned.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                  Penugasan Tamat — Tiada Mentor Aktif ({unassigned.length})
                </h2>
                <div className="rounded-xl border border-gray-700 overflow-hidden">
                  <div className="bg-gray-800 p-5 border-b border-gray-700">
                    <p className="text-sm text-gray-400">
                      Usahawan ini tidak mempunyai penugasan mentor aktif. Mungkin mentor sudah dipindahkan atau berhenti.
                    </p>
                  </div>
                  <div className="p-4 bg-gray-900 space-y-2">
                    {unassigned.map(m => (
                      <MenteeRow key={m.report_id} mentee={m} />
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return { redirect: { destination: '/api/auth/signin', permanent: false } };
  }

  const userEmail = session.user.email;
  const hasAccess = await canAccessAdmin(userEmail);

  if (!hasAccess) {
    return { props: { accessDenied: true, userEmail } };
  }

  const isReadOnlyUser = await isReadOnly(userEmail);

  return { props: { userEmail, isReadOnlyUser, accessDenied: false } };
}
