// pages/admin/dashboard.js
import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

// Reusable UmSection component from mentor dashboard
const UmSection = ({ batch, session, sessionLabel, totalMentees, submitted, pending, pendingMentees, noReportsYet, mentorName }) => {
  const [expanded, setExpanded] = useState(false);

  // Special display for batches with no reports submitted yet
  if (noReportsYet) {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl shadow-md p-6 mb-4 border-l-4 border-orange-500">
        <h4 className="text-lg font-bold text-orange-700 mb-3">
          {mentorName && <span className="text-gray-600">{mentorName} - </span>}
          {batch} - Borang Upward Mobility ({sessionLabel})
        </h4>
        <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-orange-200">
          <div className="text-3xl">⚠️</div>
          <div>
            <p className="font-semibold text-gray-800 mb-1">
              Tiada laporan {sessionLabel} dihantar lagi.
            </p>
            <p className="text-sm text-gray-600">
              Sila hantar laporan {sessionLabel} terlebih dahulu sebelum mengisi Borang Upward Mobility.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Normal display for batches with reports submitted
  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-md p-6 mb-4 border-l-4 border-purple-500">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-lg font-bold text-purple-700">
          {mentorName && <span className="text-gray-600">{mentorName} - </span>}
          {batch} - Borang Upward Mobility ({sessionLabel})
        </h4>
        <div className="text-right">
          <div className="text-2xl font-bold text-purple-600">
            {submitted}/{totalMentees}
          </div>
          <div className="text-xs text-gray-500">Borang Dihantar</div>
        </div>
      </div>

      <div className="flex gap-4 mb-3">
        <div className="flex-1">
          <div className="text-sm text-gray-600">✅ Sudah Hantar</div>
          <div className="text-xl font-semibold text-green-600">{submitted}</div>
        </div>
        <div className="flex-1">
          <div className="text-sm text-gray-600">⏳ Belum Hantar</div>
          <div className="text-xl font-semibold text-orange-600">{pending}</div>
        </div>
      </div>

      {pending > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
          >
            {expanded ? '▼' : '▶'}
            {expanded ? 'Sembunyikan' : 'Lihat'} Senarai Belum Hantar ({pending})
          </button>

          {expanded && (
            <div className="mt-3 p-3 bg-white rounded border border-purple-200">
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {pendingMentees.map((mentee, idx) => (
                  <li key={idx}>{mentee}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Progress Bar Component
const ProgressBar = ({ value, total, showPercentage = true }) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  let colorClass = 'bg-red-500';
  if (percentage >= 70) colorClass = 'bg-green-500';
  else if (percentage >= 40) colorClass = 'bg-orange-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2.5">
        <div
          className={`${colorClass} h-2.5 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      {showPercentage && (
        <span className="text-sm font-medium text-gray-700 min-w-[45px] text-right">
          {percentage}%
        </span>
      )}
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const isOnTrack = status === 'on_track';
  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-semibold ${
        isOnTrack
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      }`}
    >
      {isOnTrack ? '✓ On Track' : '⚠ At Risk'}
    </span>
  );
};

// Mentor Detail Modal Component
const MentorDetailModal = ({ mentor, onClose }) => {
  if (!mentor) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">{mentor.mentorName}</h2>
              <p className="text-blue-100 text-sm">{mentor.mentorEmail}</p>
              <div className="flex gap-3 mt-3">
                <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                  👥 {mentor.totalMentees} Mentees
                </span>
                <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                  📦 {mentor.batches.length} Batch{mentor.batches.length > 1 ? 'es' : ''}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">{mentor.umCompletionRate}%</div>
              <div className="text-xs text-gray-600 mt-1">UM Completion</div>
              <div className="text-xs text-gray-500 mt-1">
                {mentor.totalUMSubmitted}/{mentor.totalUMRequired}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{mentor.reportCompletionRate}%</div>
              <div className="text-xs text-gray-600 mt-1">Report Completion</div>
              <div className="text-xs text-gray-500 mt-1">
                {mentor.totalReportsSubmitted}/{mentor.totalReportsRequired}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.round((mentor.umCompletionRate + mentor.reportCompletionRate) / 2)}%
              </div>
              <div className="text-xs text-gray-600 mt-1">Overall Progress</div>
              <div className="text-xs text-gray-500 mt-1">Combined</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-600">{mentor.batches.length}</div>
              <div className="text-xs text-gray-600 mt-1">Active Batches</div>
              <div className="text-xs text-gray-500 mt-1">Managing</div>
            </div>
          </div>

          {/* Per-Batch Breakdown */}
          <h3 className="text-xl font-bold text-gray-800 mb-4">Batch Breakdown</h3>
          <div className="space-y-6">
            {mentor.batches.map((batch, idx) => (
              <div key={idx} className="border rounded-xl p-6 bg-gray-50">
                {/* Batch Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-bold text-gray-800">{batch.batchName}</h4>
                    <div className="flex gap-3 mt-2 text-sm text-gray-600">
                      <span>📍 Round {batch.currentRound}</span>
                      <span>👥 {batch.menteeCount} mentees</span>
                      {batch.miaCount > 0 && (
                        <span className="text-red-600 font-semibold">⚠ {batch.miaCount} MIA</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {batch.overallProgress.percentComplete}%
                    </div>
                    <div className="text-xs text-gray-500">Overall</div>
                  </div>
                </div>

                {/* UM Section */}
                <div className="mb-4">
                  <h5 className="font-semibold text-gray-700 mb-3">📋 Upward Mobility Forms</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Session 2 UM */}
                    {batch.upwardMobility.session2Required && (
                      <UmSection
                        batch={batch.batchName}
                        session={2}
                        sessionLabel="Sesi 2"
                        totalMentees={batch.upwardMobility.session2.required}
                        submitted={batch.upwardMobility.session2.submitted}
                        pending={batch.upwardMobility.session2.pending}
                        pendingMentees={batch.upwardMobility.session2.pendingMentees}
                        noReportsYet={batch.sessionReports.session2.submitted === 0}
                        mentorName={null}
                      />
                    )}
                    {/* Session 4 UM */}
                    {batch.upwardMobility.session4Required && (
                      <UmSection
                        batch={batch.batchName}
                        session={4}
                        sessionLabel="Sesi 4"
                        totalMentees={batch.upwardMobility.session4.required}
                        submitted={batch.upwardMobility.session4.submitted}
                        pending={batch.upwardMobility.session4.pending}
                        pendingMentees={batch.upwardMobility.session4.pendingMentees}
                        noReportsYet={batch.sessionReports.session4.submitted === 0}
                        mentorName={null}
                      />
                    )}
                  </div>
                </div>

                {/* Session Reports Section */}
                <div>
                  <h5 className="font-semibold text-gray-700 mb-3">📝 Session Reports</h5>
                  <div className="bg-white rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Session</th>
                          <th className="px-4 py-2 text-center">Submitted</th>
                          <th className="px-4 py-2 text-center">Required</th>
                          <th className="px-4 py-2 text-center">Pending</th>
                          <th className="px-4 py-2 text-left">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4].map((sessionNum) => {
                          const sessionData = batch.sessionReports[`session${sessionNum}`];
                          return (
                            <tr key={sessionNum} className="border-t">
                              <td className="px-4 py-3 font-medium">Session {sessionNum}</td>
                              <td className="px-4 py-3 text-center text-green-600 font-semibold">
                                {sessionData.submitted}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">
                                {sessionData.required}
                              </td>
                              <td className="px-4 py-3 text-center text-orange-600 font-semibold">
                                {sessionData.pending}
                              </td>
                              <td className="px-4 py-3">
                                <ProgressBar
                                  value={sessionData.submitted}
                                  total={sessionData.required}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-6 pt-6 border-t">
            <h3 className="text-lg font-bold text-gray-800 mb-3">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <a
                href={`mailto:${mentor.mentorEmail}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                📧 Contact Mentor
              </a>
              <button
                disabled
                className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                title="Coming in Phase 2"
              >
                🔔 Send Reminder
              </button>
              <button
                disabled
                className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm font-medium"
                title="Coming in Phase 2"
              >
                💰 View Payment Status
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function AdminProgressDashboard({ userEmail, isReadOnlyUser, accessDenied }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState(null);

  const ITEMS_PER_PAGE = 20;

  // If access is denied, show AccessDenied component
  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = forceRefresh
        ? `/api/admin/mentor-progress?refresh=true`
        : `/api/admin/mentor-progress`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`API responded with status: ${res.status}`);

      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch data');

      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get unique batches for filter
  const uniqueBatches = data?.mentors
    ? [...new Set(data.mentors.flatMap((m) => m.batches.map((b) => b.batchName)))]
        .sort()
    : [];

  // Filter and sort mentors
  const filteredMentors = data?.mentors
    ? data.mentors
        .filter((mentor) => {
          // Search filter
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
              !mentor.mentorName.toLowerCase().includes(query) &&
              !mentor.mentorEmail.toLowerCase().includes(query)
            ) {
              return false;
            }
          }

          // Batch filter
          if (filterBatch !== 'all') {
            if (!mentor.batches.some((b) => b.batchName === filterBatch)) {
              return false;
            }
          }

          // Status filter
          if (filterStatus !== 'all') {
            const overallCompletion =
              (mentor.umCompletionRate + mentor.reportCompletionRate) / 2;
            const isOnTrack = overallCompletion >= 50;
            if (filterStatus === 'on_track' && !isOnTrack) return false;
            if (filterStatus === 'at_risk' && isOnTrack) return false;
          }

          return true;
        })
        .sort((a, b) => {
          switch (sortBy) {
            case 'name':
              return a.mentorName.localeCompare(b.mentorName);
            case 'um_progress':
              return b.umCompletionRate - a.umCompletionRate;
            case 'report_progress':
              return b.reportCompletionRate - a.reportCompletionRate;
            case 'overall':
              const aOverall = (a.umCompletionRate + a.reportCompletionRate) / 2;
              const bOverall = (b.umCompletionRate + b.reportCompletionRate) / 2;
              return bOverall - aOverall;
            default:
              return 0;
          }
        })
    : [];

  // Pagination
  const totalPages = Math.ceil(filteredMentors.length / ITEMS_PER_PAGE);
  const paginatedMentors = filteredMentors.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mentor progress data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔄 Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      {/* Read-Only Badge */}
      {isReadOnlyUser && <ReadOnlyBadge userEmail={userEmail} />}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Admin Dashboard - Mentor Progress Overview
            </h1>
            <nav className="text-sm text-gray-600">
              <Link href="/admin" className="hover:text-blue-600">
                Admin
              </Link>
              <span className="mx-2">/</span>
              <span className="text-gray-800 font-medium">Dashboard</span>
            </nav>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium text-sm"
            >
              ← Back to Sales Status
            </Link>
            <button
              onClick={() => fetchData(true)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleString()}
            {data?.cached && (
              <span className="ml-2 text-green-600">
                (Cached - {data.cacheAge}s old)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Mentors */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Total Mentors</p>
              <p className="text-3xl font-bold text-gray-800">{data?.summary?.totalMentors || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Active in program</p>
            </div>
            <div className="text-4xl">👥</div>
          </div>
        </div>

        {/* UM Forms Progress */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-gray-500 text-sm font-medium mb-1">UM Forms Progress</p>
              <p className="text-3xl font-bold text-purple-600">
                {data?.summary?.umCompletionRate || 0}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {data?.summary?.totalUMFormsSubmitted || 0}/{data?.summary?.totalUMFormsRequired || 0} completed
              </p>
            </div>
            <div className="text-4xl">📋</div>
          </div>
          <ProgressBar
            value={data?.summary?.totalUMFormsSubmitted || 0}
            total={data?.summary?.totalUMFormsRequired || 1}
            showPercentage={false}
          />
        </div>

        {/* Session Reports Progress */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <p className="text-gray-500 text-sm font-medium mb-1">Session Reports</p>
              <p className="text-3xl font-bold text-blue-600">
                {data?.summary?.sessionReportCompletionRate || 0}%
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {data?.summary?.totalSessionReportsSubmitted || 0}/{data?.summary?.totalSessionReportsRequired || 0} submitted
              </p>
            </div>
            <div className="text-4xl">📝</div>
          </div>
          <ProgressBar
            value={data?.summary?.totalSessionReportsSubmitted || 0}
            total={data?.summary?.totalSessionReportsRequired || 1}
            showPercentage={false}
          />
        </div>

        {/* Mentors At Risk */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Mentors At Risk</p>
              <p className="text-3xl font-bold text-red-600">
                {data?.summary?.mentorsAtRisk || 0}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Below 50% completion
              </p>
              {data?.summary?.mentorsOnTrack > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  {data.summary.mentorsOnTrack} on track ✓
                </p>
              )}
            </div>
            <div className="text-4xl">⚠️</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Mentors
            </label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Batch Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Batch
            </label>
            <select
              value={filterBatch}
              onChange={(e) => {
                setFilterBatch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Batches</option>
              {uniqueBatches.map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
            </select>
          </div>
        </div>

        {/* Sort */}
        <div className="mt-4 flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Sort by:</label>
          <div className="flex gap-2">
            {[
              { value: 'name', label: 'Name' },
              { value: 'um_progress', label: 'UM Progress' },
              { value: 'report_progress', label: 'Report Progress' },
              { value: 'overall', label: 'Overall %' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === option.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {paginatedMentors.length} of {filteredMentors.length} mentors
      </div>

      {/* Mentors Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Mentor
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Mentees
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Batch(es)
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  UM Progress
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Reports Progress
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedMentors.length > 0 ? (
                paginatedMentors.map((mentor, idx) => {
                  const overallCompletion =
                    (mentor.umCompletionRate + mentor.reportCompletionRate) / 2;
                  const isOnTrack = overallCompletion >= 50;

                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{mentor.mentorName}</div>
                        <div className="text-sm text-gray-500">{mentor.mentorEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-lg font-semibold text-gray-800">
                          {mentor.totalMentees}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {mentor.batches.map((batch, bIdx) => (
                            <span
                              key={bIdx}
                              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                            >
                              {batch.batchName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-800 mb-1">
                          {mentor.totalUMSubmitted}/{mentor.totalUMRequired} ({mentor.umCompletionRate}%)
                        </div>
                        <ProgressBar
                          value={mentor.totalUMSubmitted}
                          total={mentor.totalUMRequired || 1}
                          showPercentage={false}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-semibold text-gray-800 mb-1">
                          {mentor.totalReportsSubmitted}/{mentor.totalReportsRequired} ({mentor.reportCompletionRate}%)
                        </div>
                        <ProgressBar
                          value={mentor.totalReportsSubmitted}
                          total={mentor.totalReportsRequired || 1}
                          showPercentage={false}
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={isOnTrack ? 'on_track' : 'at_risk'} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setSelectedMentor(mentor)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No mentors found matching your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mb-8">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            Next
          </button>
        </div>
      )}

      {/* Phase 2 Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-100 rounded-xl p-6 border-2 border-dashed border-gray-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-500">Report Approval Queue</h3>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              Coming Soon
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Report approval workflow coming in Phase 2
          </p>
        </div>

        <div className="bg-gray-100 rounded-xl p-6 border-2 border-dashed border-gray-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-500">Payment Processing</h3>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              Coming Soon
            </span>
          </div>
          <p className="text-sm text-gray-500">
            Payment queue and processing coming in Phase 2
          </p>
        </div>
      </div>

      {/* Mentor Detail Modal */}
      {selectedMentor && (
        <MentorDetailModal
          mentor={selectedMentor}
          onClose={() => setSelectedMentor(null)}
        />
      )}
    </div>
  );
}

// Server-side authentication and authorization check
export async function getServerSideProps(context) {
  const session = await getSession(context);

  // Check if user is authenticated
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  const userEmail = session.user.email;

  // Check if user has access to admin page
  const hasAccess = await canAccessAdmin(userEmail);

  if (!hasAccess) {
    // Return props that will render AccessDenied component
    return {
      props: {
        accessDenied: true,
        userEmail,
      },
    };
  }

  // Check if user is in read-only mode
  const isReadOnlyUser = await isReadOnly(userEmail);

  return {
    props: {
      userEmail,
      isReadOnlyUser,
    },
  };
}
