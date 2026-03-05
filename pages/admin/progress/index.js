import React, { useEffect, useMemo, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../../lib/auth';
import AccessDenied from '../../../components/AccessDenied';
import ReadOnlyBadge from '../../../components/ReadOnlyBadge';

const ProgressBar = ({ value, total }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-700 min-w-[36px] text-right">{pct}%</span>
    </div>
  );
};

const StatusCell = ({ status }) => {
  const styles = {
    submitted: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    missing: 'bg-red-100 text-red-800',
    not_due: 'bg-gray-100 text-gray-500',
  };
  const label = {
    submitted: '✓',
    pending: '•',
    missing: '✗',
    not_due: '-',
  };
  const cls = styles[status] || styles.not_due;
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded ${cls}`}>
      {label[status] || '-'}
    </span>
  );
};

export default function AdminProgress({ userEmail, isReadOnlyUser, accessDenied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [program, setProgram] = useState('all');
  const [batch, setBatch] = useState('all');
  const [round, setRound] = useState('all');

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (program !== 'all') params.set('program', program);
      if (batch !== 'all') params.set('batch', batch);
      if (round !== 'all') params.set('round', round);

      const res = await fetch(`/api/admin/progress?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch progress data');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [program, batch, round]);

  const roundStats = data?.roundStats || [];
  const mentorStats = data?.mentorStats || [];
  const missingReports = data?.missingReports || [];

  const batches = useMemo(() => {
    const set = new Set(roundStats.map((r) => r.batch));
    return ['all', ...Array.from(set).sort()];
  }, [roundStats]);

  const rounds = useMemo(() => {
    const set = new Set(roundStats.map((r) => r.round));
    return ['all', ...Array.from(set).sort((a, b) => a - b)];
  }, [roundStats]);

  const expectedTotal = roundStats.reduce((sum, r) => sum + r.expected, 0);
  const submittedTotal = roundStats.reduce((sum, r) => sum + r.submitted, 0);
  const missingTotal = roundStats.reduce((sum, r) => sum + r.missing, 0);

  const alerts = [
    missingTotal > 0 ? `⚠️ ${missingTotal} reports missing` : null,
    mentorStats.filter((m) => m.missing > 0).length > 0
      ? `⚠️ ${mentorStats.filter((m) => m.missing > 0).length} mentors behind schedule`
      : null,
    mentorStats.filter((m) => Object.values(m.rounds || {}).includes('pending')).length > 0
      ? `⚠️ ${mentorStats.filter((m) => Object.values(m.rounds || {}).includes('pending')).length} mentors pending verification`
      : null,
  ].filter(Boolean);

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Progress</h1>
        <p className="text-gray-600">Operational command center for missing reports</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="all">All Programs</option>
            <option value="bangkit">Bangkit</option>
            <option value="maju">Maju</option>
          </select>
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            {batches.map((b) => (
              <option key={b} value={b}>{b === 'all' ? 'All Batches' : b}</option>
            ))}
          </select>
          <select
            value={round}
            onChange={(e) => setRound(e.target.value)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            {rounds.map((r) => (
              <option key={r} value={r}>{r === 'all' ? 'All Rounds' : `Round ${r}`}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-center text-gray-600 p-8">Loading progress...</div>}
      {error && <div className="text-center text-red-600 p-8">{error}</div>}

      {!loading && !error && (
        <>
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Alerts</h2>
            {alerts.length === 0 && <p className="text-sm text-gray-500">No critical alerts.</p>}
            <ul className="text-sm text-gray-700 space-y-1">
              {alerts.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </ul>
            <div className="mt-4">
              <a href="#missing" className="text-sm text-blue-600 hover:text-blue-800">
                View Missing Reports
              </a>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Program Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-500">Expected Reports</div>
                <div className="text-2xl font-bold text-gray-900">{expectedTotal}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Submitted Reports</div>
                <div className="text-2xl font-bold text-green-600">{submittedTotal}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Missing Reports</div>
                <div className="text-2xl font-bold text-red-600">{missingTotal}</div>
              </div>
            </div>
            <ProgressBar value={submittedTotal} total={expectedTotal} />
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Round Status</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Round</th>
                    <th className="text-right px-4 py-2">Expected</th>
                    <th className="text-right px-4 py-2">Submitted</th>
                    <th className="text-right px-4 py-2">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {roundStats.map((r, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        Round {r.round} <span className="text-xs text-gray-500">({r.batch})</span>
                      </td>
                      <td className="px-4 py-2 text-right">{r.expected}</td>
                      <td className="px-4 py-2 text-right">{r.submitted}</td>
                      <td className={`px-4 py-2 text-right ${r.missing > 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {r.missing}
                      </td>
                    </tr>
                  ))}
                  {roundStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                        No round data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Mentor Accountability</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Mentor</th>
                    <th className="text-right px-4 py-2">Assigned</th>
                    <th className="text-right px-4 py-2">Submitted</th>
                    <th className="text-right px-4 py-2">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mentorStats.map((m) => (
                    <tr key={m.mentor_id}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{m.mentor_name}</div>
                        <div className="text-xs text-gray-500">{m.mentor_email}</div>
                      </td>
                      <td className="px-4 py-2 text-right">{m.assigned}</td>
                      <td className="px-4 py-2 text-right">{m.submitted}</td>
                      <td className={`px-4 py-2 text-right ${m.missing > 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {m.missing}
                      </td>
                    </tr>
                  ))}
                  {mentorStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                        No mentor data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Mentor Progress Heatmap</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Mentor</th>
                    {[1, 2, 3, 4].map((r) => (
                      <th key={r} className="text-center px-2 py-2">R{r}</th>
                    ))}
                    <th className="text-right px-4 py-2">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mentorStats.map((m) => (
                    <tr key={m.mentor_id}>
                      <td className="px-4 py-2">{m.mentor_name}</td>
                      {[1, 2, 3, 4].map((r) => (
                        <td key={r} className="text-center px-2 py-2">
                          <StatusCell status={m.rounds?.[r] || 'not_due'} />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right">{m.missing}</td>
                    </tr>
                  ))}
                  {mentorStats.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                        No mentor data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Legend: ✓ submitted, • pending verification, ✗ missing, - not due
            </div>
          </div>

          <div id="missing" className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Missing Reports</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2">Mentor</th>
                    <th className="text-left px-4 py-2">Entrepreneur</th>
                    <th className="text-center px-2 py-2">Round</th>
                    <th className="text-left px-4 py-2">Batch</th>
                    <th className="text-left px-4 py-2">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {missingReports.map((m, idx) => (
                    <tr key={`${m.mentor_id}-${m.entrepreneur_id}-${m.round}-${idx}`}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900">{m.mentor_name}</div>
                        <div className="text-xs text-gray-500">{m.mentor_email}</div>
                      </td>
                      <td className="px-4 py-2">{m.entrepreneur_name}</td>
                      <td className="px-2 py-2 text-center">R{m.round}</td>
                      <td className="px-4 py-2">{m.batch}</td>
                      <td className="px-4 py-2">{m.due_date || '-'}</td>
                    </tr>
                  ))}
                  {missingReports.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                        No missing reports
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
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
  const isReadOnlyUser = await isReadOnly(userEmail);

  return {
    props: {
      userEmail,
      isReadOnlyUser,
      accessDenied: !hasAccess,
    },
  };
}
