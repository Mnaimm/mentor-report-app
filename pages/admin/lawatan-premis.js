// pages/admin/lawatan-premis.js
import React, { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import Link from 'next/link';
import { canAccessAdmin, isReadOnly } from '../../lib/auth';
import AccessDenied from '../../components/AccessDenied';
import ReadOnlyBadge from '../../components/ReadOnlyBadge';

// Summary Card Component
const SummaryCard = ({ title, value, total, color = 'blue', icon, onClick }) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  const colorClasses = {
    blue: 'from-blue-500 to-indigo-600',
    green: 'from-green-500 to-emerald-600',
    red: 'from-red-500 to-rose-600',
    yellow: 'from-yellow-500 to-orange-600',
    purple: 'from-purple-500 to-violet-600',
    gray: 'from-gray-500 to-slate-600'
  };

  const bgGradient = colorClasses[color] || colorClasses.blue;

  return (
    <div
      className={`bg-gradient-to-br ${bgGradient} rounded-xl shadow-lg p-6 text-white transform transition-all hover:scale-105 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="text-4xl opacity-80">{icon}</div>
        <div className="text-right">
          <div className="text-4xl font-bold">{value}</div>
          {total > 0 && (
            <div className="text-sm opacity-80">daripada {total}</div>
          )}
        </div>
      </div>
      <div className="text-sm font-medium opacity-90">{title}</div>
      {total > 0 && (
        <div className="mt-3 bg-white bg-opacity-20 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const badges = {
    completed: {
      color: 'bg-green-100 text-green-800 border-green-300',
      icon: '✅',
      label: 'Selesai'
    },
    overdue: {
      color: 'bg-red-100 text-red-800 border-red-300',
      icon: '⚠️',
      label: 'Tertunggak'
    },
    pending: {
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      icon: '⏳',
      label: 'Belum Selesai'
    }
  };

  const badge = badges[status] || badges.pending;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}>
      {badge.icon} {badge.label}
    </span>
  );
};

// Format relative date (e.g., "38 hari yang lalu")
const formatRelativeDate = (dateString) => {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hari ini';
    if (diffDays === 1) return 'Semalam';
    if (diffDays < 30) return `${diffDays} hari yang lalu`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 bulan yang lalu';
    if (diffMonths < 12) return `${diffMonths} bulan yang lalu`;

    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} tahun yang lalu`;
  } catch (e) {
    return dateString;
  }
};

// Main Component
export default function LawatanPremisDashboard({ userEmail, isReadOnlyUser, accessDenied }) {
  // States
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterProgram, setFilterProgram] = useState('all');
  const [filterBatch, setFilterBatch] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Timestamps
  const [lastUpdated, setLastUpdated] = useState(null);

  // Selected items for bulk actions
  const [selectedItems, setSelectedItems] = useState(new Set());

  // If access denied, show AccessDenied component
  if (accessDenied) {
    return <AccessDenied userEmail={userEmail} />;
  }

  // Fetch data function
  const fetchData = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        program: filterProgram,
        batch: filterBatch,
        status: filterStatus
      });

      if (forceRefresh) {
        params.append('refresh', 'true');
      }

      const url = `/api/admin/lawatan-premis?${params.toString()}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`API responded with status: ${res.status}`);
      }

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch data');
      }

      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchData();
  }, [filterProgram, filterBatch, filterStatus]);

  // Apply search filter
  const getFilteredVisits = () => {
    if (!data?.visits) return [];

    let filtered = data.visits;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        v =>
          v.menteeName.toLowerCase().includes(query) ||
          v.mentorName.toLowerCase().includes(query) ||
          v.menteeEmail.toLowerCase().includes(query) ||
          v.mentorEmail.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  // Pagination
  const getPaginatedVisits = () => {
    const filtered = getFilteredVisits();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filtered.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getFilteredVisits().length / ITEMS_PER_PAGE);

  // Export to CSV
  const exportToCSV = () => {
    const visits = getFilteredVisits();

    const headers = ['Usahawan', 'Email Usahawan', 'Mentor', 'Email Mentor', 'Program', 'Batch', 'Status', 'Tarikh Lawatan', 'Sumber Data'];
    const rows = visits.map(v => [
      v.menteeName,
      v.menteeEmail,
      v.mentorName,
      v.mentorEmail,
      v.program,
      v.batch,
      v.status === 'completed' ? 'Selesai' : v.status === 'overdue' ? 'Tertunggak' : 'Belum Selesai',
      v.visitDate || '-',
      v.source
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lawatan-premis-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Toggle selection
  const toggleSelection = (menteeName) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(menteeName)) {
      newSelected.delete(menteeName);
    } else {
      newSelected.add(menteeName);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    const currentPageVisits = getPaginatedVisits();
    if (selectedItems.size === currentPageVisits.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentPageVisits.map(v => v.menteeName)));
    }
  };

  // Quick filter handler
  const applyQuickFilter = (status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">📍 Lawatan Premis Dashboard</h1>
              <p className="text-indigo-100">Pantau status lawatan premis untuk semua program</p>
            </div>
            <div className="flex gap-3 items-start">
              {isReadOnlyUser && <ReadOnlyBadge />}
              <Link
                href="/admin"
                className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                ← Kembali ke Admin
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Batch/Program Selector */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-md p-6 mb-6 border border-indigo-200">
          <h3 className="font-bold text-lg text-gray-800 mb-4">🔍 Penapis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Program</label>
              <select
                value={filterProgram}
                onChange={(e) => {
                  setFilterProgram(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">Semua Program</option>
                {data?.filters?.availablePrograms?.map(prog => (
                  <option key={prog} value={prog}>{prog}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
              <select
                value={filterBatch}
                onChange={(e) => {
                  setFilterBatch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">Semua Batch</option>
                {data?.filters?.availableBatches?.map(batch => (
                  <option key={batch} value={batch}>{batch}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">Semua Status</option>
                <option value="completed">✅ Selesai</option>
                <option value="overdue">⚠️ Tertunggak</option>
                <option value="pending">⏳ Belum Selesai</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-between items-center">
            <div className="text-sm text-gray-600">
              Paparan: <strong>{filterProgram === 'all' ? 'Semua Program' : filterProgram}</strong>
              {' - '}
              <strong>{data?.summary?.totalVisits || 0} lawatan</strong>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilterProgram('all');
                  setFilterBatch('all');
                  setFilterStatus('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => fetchData(true)}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Memuatkan...' : 'Muat Semula'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Memuatkan data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-semibold">Ralat memuat data</div>
                <div className="text-sm">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <SummaryCard
                title="Jumlah Lawatan"
                value={data.summary.totalVisits}
                total={data.summary.totalVisits}
                color="gray"
                icon="📊"
              />
              <SummaryCard
                title="Selesai"
                value={data.summary.completed}
                total={data.summary.totalVisits}
                color="green"
                icon="✅"
                onClick={() => applyQuickFilter('completed')}
              />
              <SummaryCard
                title="Belum Selesai"
                value={data.summary.pending}
                total={data.summary.totalVisits}
                color="yellow"
                icon="⏳"
                onClick={() => applyQuickFilter('pending')}
              />
              <SummaryCard
                title="Tertunggak"
                value={data.summary.overdue}
                total={data.summary.totalVisits}
                color="red"
                icon="⚠️"
                onClick={() => applyQuickFilter('overdue')}
              />
              <SummaryCard
                title="Dengan Tarikh"
                value={data.summary.withDate}
                total={data.summary.totalVisits}
                color="purple"
                icon="📅"
              />
            </div>

            {/* Alert Box (Overdue) */}
            {data.summary.overdue > 0 && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🚨</span>
                    <div>
                      <div className="font-bold text-red-800">
                        {data.summary.overdue} Lawatan Tertunggak
                      </div>
                      <div className="text-sm text-red-700">
                        Lawatan ini sepatutnya selesai pada Round 2 tetapi belum dilakukan
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => applyQuickFilter('overdue')}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Lihat Senarai →
                  </button>
                </div>
              </div>
            )}

            {/* Search and Quick Filters */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    placeholder="🔍 Cari usahawan atau mentor..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    📥 Export CSV
                  </button>
                  {selectedItems.size > 0 && (
                    <button
                      onClick={() => alert(`Hantar peringatan kepada ${selectedItems.size} mentor (Coming Soon)`)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      ✉️ Hantar Peringatan ({selectedItems.size})
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Filter Buttons */}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button
                  onClick={() => applyQuickFilter('all')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Semua ({data.summary.totalVisits})
                </button>
                <button
                  onClick={() => applyQuickFilter('overdue')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filterStatus === 'overdue'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                >
                  ⚠️ Tertunggak ({data.summary.overdue})
                </button>
                <button
                  onClick={() => applyQuickFilter('pending')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filterStatus === 'pending'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                >
                  ⏳ Belum Selesai ({data.summary.pending})
                </button>
                <button
                  onClick={() => applyQuickFilter('completed')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    filterStatus === 'completed'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  ✅ Selesai ({data.summary.completed})
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedItems.size === getPaginatedVisits().length && getPaginatedVisits().length > 0}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usahawan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mentor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Program / Batch
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarikh Lawatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sumber Data
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tindakan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPaginatedVisits().length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                          Tiada data dijumpai untuk penapis yang dipilih
                        </td>
                      </tr>
                    ) : (
                      getPaginatedVisits().map((visit, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-gray-50 ${
                            visit.status === 'overdue' ? 'bg-red-50' : ''
                          }`}
                        >
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(visit.menteeName)}
                              onChange={() => toggleSelection(visit.menteeName)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {visit.menteeName}
                            </div>
                            <div className="text-xs text-gray-500">{visit.menteeEmail}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {visit.mentorName}
                            </div>
                            <div className="text-xs text-gray-500">{visit.mentorEmail}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">{visit.program}</div>
                            <div className="text-xs text-gray-500">{visit.batch}</div>
                            <div className="text-xs text-gray-400">Round {visit.currentRound}</div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={visit.status} />
                          </td>
                          <td className="px-6 py-4">
                            {visit.visitDate ? (
                              <div>
                                <div className="text-sm text-gray-900">
                                  {new Date(visit.visitDate).toLocaleDateString('ms-MY')}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatRelativeDate(visit.visitDate)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 italic">
                                {visit.status === 'completed' ? 'Tarikh tidak direkod' : 'Belum selesai'}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-600">{visit.source}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => alert(`View details for ${visit.menteeName} (Coming Soon)`)}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Lihat
                              </button>
                              <button
                                onClick={() => window.location.href = `mailto:${visit.mentorEmail}`}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                              >
                                Hubungi
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Paparan {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, getFilteredVisits().length)} daripada {getFilteredVisits().length} lawatan
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Sebelum
                      </button>
                      <div className="flex gap-1">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                          const page = i + 1;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                                currentPage === page
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                        {totalPages > 5 && <span className="px-2 py-2">...</span>}
                        {totalPages > 5 && (
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${
                              currentPage === totalPages
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {totalPages}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Seterusnya →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Last Updated */}
            {lastUpdated && (
              <div className="mt-4 text-sm text-gray-500 text-center">
                Dikemaskini: {lastUpdated.toLocaleString('ms-MY')}
                {data.cached && ` (Cache: ${data.cacheAge}s)`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Server-side authentication
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
