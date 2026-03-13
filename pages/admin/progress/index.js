import React, { useEffect, useMemo, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../../lib/auth';
import AccessDenied from '../../../components/AccessDenied';
import ReadOnlyBadge from '../../../components/ReadOnlyBadge';

const ProgressBar = ({ value, total }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  let colorClass = 'bg-red-500';
  if (pct >= 90) colorClass = 'bg-green-500';
  else if (pct >= 70) colorClass = 'bg-amber-500';

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${colorClass} h-2.5 rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-bold text-gray-700 min-w-[48px] text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {pct}%
      </span>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    submitted: 'bg-green-500 text-white',
    pending: 'bg-amber-400 text-white',
    missing: 'bg-red-500 text-white',
    not_due: 'bg-gray-200 text-gray-400',
  };
  const label = {
    submitted: '✓',
    pending: '●',
    missing: '✗',
    not_due: '—',
  };
  const cls = styles[status] || styles.not_due;
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded font-bold text-sm ${cls}`}>
      {label[status] || '—'}
    </span>
  );
};

const AccountabilityPill = ({ missing }) => {
  if (missing === 0) {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-300">✓ On Track</span>;
  } else if (missing <= 2) {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">⚠ Behind</span>;
  } else {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">⚠ At Risk</span>;
  }
};

export default function AdminProgress({ userEmail, isReadOnlyUser, accessDenied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [program, setProgram] = useState('all');
  const [batch, setBatch] = useState('all');
  const [round, setRound] = useState('all');
  const [missingRoundFilter, setMissingRoundFilter] = useState('all');
  const [initialLoad, setInitialLoad] = useState(true);
  const [expandedBatches, setExpandedBatches] = useState(new Set());

  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  const toggleBatch = (batchName) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchName)) {
      newExpanded.delete(batchName);
    } else {
      newExpanded.add(batchName);
    }
    setExpandedBatches(newExpanded);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (program !== 'all') params.set('program', program);
      // Fix 3: On initial load with 'all', let API determine active batch
      // After initial load, respect user's batch selection
      if (batch !== 'all' || !initialLoad) {
        params.set('batch', batch);
      }
      if (round !== 'all') params.set('round', round);

      const res = await fetch(`/api/admin/progress?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch progress data');
      setData(json);

      // On initial load, expand active batches and set batch filter
      if (initialLoad) {
        const activeBatches = Object.keys(json.batchGroups || {}).filter(
          batchName => json.batchGroups[batchName].isActive
        );
        setExpandedBatches(new Set(activeBatches));

        if (json.activeBatch) {
          setBatch(json.activeBatch);
        }
        setInitialLoad(false);
      }
    } catch (err) {
      setError(err.message);
      setInitialLoad(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [program, batch, round]);

  const batchGroups = data?.batchGroups || {};
  const totals = data?.totals || { expected: 0, submitted: 0, missing: 0 };

  const batches = useMemo(() => {
    return ['all', ...Object.keys(batchGroups).sort()];
  }, [batchGroups]);

  const rounds = useMemo(() => {
    const allRounds = new Set();
    Object.values(batchGroups).forEach(group => {
      group.roundStats.forEach(r => allRounds.add(r.round));
    });
    return ['all', ...Array.from(allRounds).sort((a, b) => a - b)];
  }, [batchGroups]);

  const expectedTotal = totals.expected;
  const submittedTotal = totals.submitted;
  const missingTotal = totals.missing;

  const mentorsBehind = Object.values(batchGroups).reduce((count, group) =>
    count + group.mentorStats.filter((m) => m.missing > 0).length
  , 0);

  const allMissingReports = Object.values(batchGroups).flatMap(group => group.missingReports);

  const filteredMissingReports = missingRoundFilter === 'all'
    ? allMissingReports
    : allMissingReports.filter(m => m.round === parseInt(missingRoundFilter));

  // Check if report is overdue
  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    return now > due;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      {/* Alert Banner */}
      {!loading && !error && missingTotal > 0 && (
        <div className="bg-red-600 text-white py-3 px-4 shadow-md">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-bold text-lg">URGENT: {missingTotal} Missing Reports</p>
                <p className="text-sm opacity-90">{mentorsBehind} mentors behind schedule</p>
              </div>
            </div>
            <a href="#missing" className="px-4 py-2 bg-white text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors text-sm">
              View Details →
            </a>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Progress Command Center</h1>
              <p className="text-sm text-gray-600 mt-1">Real-time operational oversight</p>
            </div>
            <Link href="/admin/dashboard" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Programs</option>
              <option value="bangkit">Bangkit</option>
              <option value="maju">Maju</option>
            </select>
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {batches.map((b) => (
                <option key={b} value={b}>{b === 'all' ? 'All Batches' : b}</option>
              ))}
            </select>
            <select
              value={round}
              onChange={(e) => setRound(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {rounds.map((r) => (
                <option key={r} value={r}>{r === 'all' ? 'All Rounds' : `Round ${r}`}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading progress data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {/* Expected */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expected</p>
                    <p className="text-4xl font-bold text-gray-900 mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{expectedTotal}</p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Submitted */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</p>
                    <p className="text-4xl font-bold text-green-600 mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{submittedTotal}</p>
                  </div>
                  <div className="bg-green-100 rounded-full p-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Missing */}
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Missing</p>
                    <p className="text-4xl font-bold text-red-600 mt-2" style={{ fontVariantNumeric: 'tabular-nums' }}>{missingTotal}</p>
                  </div>
                  <div className="bg-red-100 rounded-full p-4">
                    <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Batch Groups (Collapsible) */}
            {Object.entries(batchGroups).map(([batchName, group]) => {
              const isExpanded = expandedBatches.has(batchName);
              const { roundStats, mentorStats, totals: batchTotals } = group;

              return (
                <div key={batchName} className="bg-white rounded-lg shadow-md mb-6 overflow-hidden border border-gray-200">
                  {/* Batch Header (Collapsible) */}
                  <button
                    onClick={() => toggleBatch(batchName)}
                    className="w-full px-6 py-4 border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                      <div className="text-left">
                        <h2 className="text-base font-bold text-gray-900">{batchName}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {batchTotals.expected} expected • {batchTotals.submitted} submitted • {batchTotals.missing} missing
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.isActive && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Active</span>
                      )}
                    </div>
                  </button>

                  {/* Batch Content (Expandable) */}
                  {isExpanded && (
                    <>
                      {/* Round Status for this Batch */}
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Round Status</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Round</th>
                              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>Expected</th>
                              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>Submitted</th>
                              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>Missing</th>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {roundStats.map((r, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-900">Round {r.round}</div>
                                  <div className="text-xs text-gray-500">{r.program}</div>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.expected}</td>
                                <td className="px-6 py-4 text-right font-medium text-green-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.submitted}</td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`font-bold ${r.missing > 0 ? 'text-red-600' : 'text-gray-400'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {r.missing}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <ProgressBar value={r.submitted} total={r.expected} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mentor Heatmap for this Batch */}
                      <div className="px-6 py-4 bg-gray-50 border-b border-t border-gray-200">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mentor Progress Heatmap</h3>
                        <p className="text-xs text-gray-500 mt-1">Sorted by missing count (highest risk first)</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mentor</th>
                              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">R1</th>
                              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">R2</th>
                              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">R3</th>
                              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">R4</th>
                              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider" style={{ fontVariantNumeric: 'tabular-nums' }}>Missing</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {mentorStats.map((m) => (
                              <tr key={m.mentor_id} className="hover:bg-gray-50">
                                <td className="px-6 py-4">
                                  <div className="font-medium text-gray-900">{m.mentor_name}</div>
                                  <div className="text-xs text-gray-500">{m.mentor_email}</div>
                                </td>
                                {[1, 2, 3, 4].map((r) => (
                                  <td key={r} className="text-center px-3 py-4">
                                    <StatusBadge status={m.rounds?.[r] || 'not_due'} />
                                  </td>
                                ))}
                                <td className="px-6 py-4">
                                  <AccountabilityPill missing={m.missing} />
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <span className={`font-bold text-lg ${m.missing > 0 ? 'text-red-600' : 'text-gray-400'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                                    {m.missing}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {mentorStats.length === 0 && (
                              <tr>
                                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                  No mentors in this batch
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                        <div className="flex items-center gap-6 text-xs text-gray-600">
                          <div className="flex items-center gap-2">
                            <StatusBadge status="submitted" />
                            <span>Submitted</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status="pending" />
                            <span>Pending</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status="missing" />
                            <span>Missing</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status="not_due" />
                            <span>Not Due</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {Object.keys(batchGroups).length === 0 && !loading && (
              <div className="bg-white rounded-lg shadow-md mb-6 p-8 text-center text-gray-500">
                No batch data available
              </div>
            )}

            {/* Missing Reports */}
            <div id="missing" className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Missing Reports</h2>
                    <p className="text-xs text-gray-500 mt-1">{filteredMissingReports.length} reports pending submission</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMissingRoundFilter(r.toString())}
                        className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                          missingRoundFilter === r.toString()
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        R{r}
                      </button>
                    ))}
                    <button
                      onClick={() => setMissingRoundFilter('all')}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                        missingRoundFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Mentor</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrepreneur</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Round</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Urgency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredMissingReports.map((m, idx) => {
                      const overdue = isOverdue(m.due_date);
                      return (
                        <tr key={`${m.mentor_id}-${m.entrepreneur_id}-${m.round}-${idx}`} className={`hover:bg-gray-50 ${overdue ? 'bg-red-50' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{m.mentor_name}</div>
                            <div className="text-xs text-gray-500">{m.mentor_email}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-700">{m.entrepreneur_name}</td>
                          <td className="px-3 py-4 text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded font-bold text-sm text-gray-700">
                              {m.round}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-700">{m.batch}</td>
                          <td className="px-6 py-4 text-gray-700" style={{ fontVariantNumeric: 'tabular-nums' }}>{m.due_date || '—'}</td>
                          <td className="px-6 py-4">
                            {overdue ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
                                🔥 OVERDUE
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMissingReports.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          {missingRoundFilter === 'all' ? 'No missing reports - all on track!' : `No missing reports for Round ${missingRoundFilter}`}
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
